# MESLUME - Instalacao de servicos de operacao local (Windows).
# REQUER: PowerShell administrador; Django e banco FINALIZADOS e testados.
# Nao executa migracoes, nao cria banco, nao baixa executaveis.
[CmdletBinding()]
param(
    [string]$RaizOperacao = 'C:\Meslume',
    [string]$PostgresService = ''
)
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Abra o PowerShell como Administrador para instalar servicos.'
}
$execucao = Join-Path $RaizOperacao 'Execucao'
$ferramentas = Join-Path $execucao 'Ferramentas'
$servicos = Join-Path $execucao 'Servicos'
$logs = Join-Path $RaizOperacao 'Logs\Servicos'
$backend = Join-Path $execucao 'Backend'
$web = Join-Path $execucao 'Web'
$envfile = Join-Path $RaizOperacao 'Configuracao\backend.env'
$caddy = Join-Path $ferramentas 'caddy.exe'
$winsw = Join-Path $ferramentas 'WinSW-x64.exe'
$waitress = Join-Path $backend '.venv\Scripts\waitress-serve.exe'
$python = Join-Path $backend '.venv\Scripts\python.exe'
$requisitos = @(
    $caddy, $winsw, $waitress, $python, $envfile,
    (Join-Path $backend 'manage.py'),
    (Join-Path $backend 'config\wsgi.py'),
    (Join-Path $web 'index.html')
)
foreach ($arq in $requisitos) {
    if (-not (Test-Path -LiteralPath $arq -PathType Leaf)) {
        throw "Pre-requisito ausente: $arq. Servicos NAO instalados."
    }
}
foreach ($nome in @('MeslumeApi','MeslumeWeb')) {
    if (Get-Service -Name $nome -ErrorAction SilentlyContinue) {
        throw "Servico $nome ja existe. Nao sera modificado."
    }
}
if (-not $PostgresService) {
    $pg = @(Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue)
    if ($pg.Count -ne 1) {
        throw 'Informe -PostgresService com o nome exato exibido por Get-Service postgresql*.'
    }
    $PostgresService = $pg[0].Name
}
if (-not (Get-Service -Name $PostgresService -ErrorAction SilentlyContinue)) {
    throw "Servico PostgreSQL $PostgresService nao encontrado."
}
# Nao habilitar sem configuracao de producao local verificada (cookies/CSRF, DEBUG etc).
$config = Get-Content -LiteralPath $envfile -Raw
if ($config -notmatch '(?m)^\s*MESLUME_DEBUG\s*=\s*False\s*$') {
    throw 'Use MESLUME_DEBUG=False no backend.env antes da instalacao.'
}
# Verificar configuracao e migracoes sem modificar o banco.
$valorAnterior = [Environment]::GetEnvironmentVariable('MESLUME_ENV_FILE', 'Process')
[Environment]::SetEnvironmentVariable('MESLUME_ENV_FILE', $envfile, 'Process')
try {
    Push-Location $backend
    try {
        & $python manage.py check
        if ($LASTEXITCODE -ne 0) { throw 'Falha de configuracao Django.' }
        & $python manage.py migrate --check
        if ($LASTEXITCODE -ne 0) { throw 'Migracoes pendentes. Nao instalar servicos.' }
        $flags = & $python -c "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings'); from django.conf import settings; print('cookie_secure=' + str(settings.SESSION_COOKIE_SECURE) + ';csrf_secure=' + str(settings.CSRF_COOKIE_SECURE))"
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao consultar configuracao de cookies.' }
        if (($flags -join '') -notmatch 'cookie_secure=False;csrf_secure=False') {
            throw 'A instalacao local usa HTTP somente em 127.0.0.1. Ajuste cookies Secure para False EXCLUSIVAMENTE neste ambiente local, ou configure HTTPS antes de instalar.'
        }
    } finally { Pop-Location }
} finally {
    [Environment]::SetEnvironmentVariable('MESLUME_ENV_FILE', $valorAnterior, 'Process')
}
# Apenas loopback: nao expor a internet. Caddy e API comunicam na mesma origem HTTP local.
New-Item -ItemType Directory -Path $servicos -Force | Out-Null
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$arquivoCaddy = Join-Path $servicos 'Caddyfile'
$caddyConfig = @'
http://127.0.0.1:8080 {
    bind 127.0.0.1
    encode gzip

    handle /api/* {
        reverse_proxy 127.0.0.1:4317
    }

    handle /admin/* {
        reverse_proxy 127.0.0.1:4317
    }

    handle_path /static/* {
        root * C:/Meslume/Execucao/Backend/staticfiles
        file_server
    }

    handle {
        root * C:/Meslume/Execucao/Web
        try_files {path} /index.html
        file_server
    }
}
'@
if ($RaizOperacao -ne 'C:\Meslume') {
    $caddyConfig = $caddyConfig.Replace('C:/Meslume', $RaizOperacao.Replace('\','/').TrimEnd('/'))
}
Set-Content -LiteralPath $arquivoCaddy -Value $caddyConfig -Encoding UTF8
& $caddy validate --config $arquivoCaddy --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddyfile invalido. Servicos nao instalados.' }
# Dar apenas leitura dos fontes e escrita dos logs a LocalService.
# S-1-5-19 e o SID invariavel de NT AUTHORITY\LocalService.
& icacls.exe $execucao /grant '*S-1-5-19:(OI)(CI)RX' /T | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ACL execucao.' }
& icacls.exe $envfile /grant '*S-1-5-19:R' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ACL configuracao privada.' }
& icacls.exe $logs /grant '*S-1-5-19:(OI)(CI)M' /T | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ACL logs.' }
# Logs e XML NAO armazenam senhas. Arquivo env privado fica fora do Git.
$apiXml = @"
<service>
  <id>MeslumeApi</id>
  <name>Meslume - API Django</name>
  <description>Servidor Waitress local do Meslume</description>
  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>
  <depend>$PostgresService</depend>
  <serviceaccount><username>NT AUTHORITY\LocalService</username></serviceaccount>
  <executable>$waitress</executable>
  <arguments>--listen=127.0.0.1:4317 config.wsgi:application</arguments>
  <workingdirectory>$backend</workingdirectory>
  <env name="MESLUME_ENV_FILE" value="$envfile" />
  <logpath>$logs</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
  <onfailure action="restart" delay="15 sec" />
</service>
"@
$webXml = @"
<service>
  <id>MeslumeWeb</id>
  <name>Meslume - Interface Web</name>
  <description>Caddy local para Angular e proxy da API</description>
  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>
  <serviceaccount><username>NT AUTHORITY\LocalService</username></serviceaccount>
  <executable>$caddy</executable>
  <arguments>run --config "$arquivoCaddy" --adapter caddyfile</arguments>
  <workingdirectory>$servicos</workingdirectory>
  <logpath>$logs</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
  <onfailure action="restart" delay="15 sec" />
</service>
"@
$apiExe = Join-Path $servicos 'MeslumeApi.exe'
$webExe = Join-Path $servicos 'MeslumeWeb.exe'
Copy-Item $winsw $apiExe
Copy-Item $winsw $webExe
Set-Content -LiteralPath (Join-Path $servicos 'MeslumeApi.xml') -Value $apiXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $servicos 'MeslumeWeb.xml') -Value $webXml -Encoding UTF8
# Instalar, iniciar em ordem. Em falha, nao apagar dados, diagnosticar os logs.
& $apiExe install
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar MeslumeApi.' }
& $webExe install
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar MeslumeWeb.' }
& $apiExe start
if ($LASTEXITCODE -ne 0) { throw 'MeslumeApi instalado mas nao iniciou. Verifique Logs\Servicos.' }
& $webExe start
if ($LASTEXITCODE -ne 0) { throw 'MeslumeWeb instalado mas nao iniciou. Verifique Logs\Servicos.' }
Start-Sleep -Seconds 3
try {
    $resposta = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/api/v1/health/' -TimeoutSec 5 -UseBasicParsing
    if ($resposta.StatusCode -ne 200) { Write-Warning 'API nao retornou HTTP 200. Revisar logs antes de usar.' }
} catch {
    Write-Warning 'Servicos instalados, mas health da API falhou. Nao liberar para uso. Verifique Logs\Servicos.'
}
Write-Host 'Servicos registrados. Validar manualmente antes de usar: http://127.0.0.1:8080/' -ForegroundColor Green
Get-Service -Name 'MeslumeApi','MeslumeWeb',$PostgresService |
    Select-Object Name,Status,StartType | Format-Table -AutoSize
