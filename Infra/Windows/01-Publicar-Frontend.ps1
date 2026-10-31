# MESLUME - Publicacao inicial dos arquivos estaticos Angular.
# Executar no PowerShell comum; nao inicia servicos nem modifica o Git.
[CmdletBinding()]
param(
    [string]$Repositorio = 'C:\Projetos\Meslume',
    [string]$RaizOperacao = 'C:\Meslume'
)
$ErrorActionPreference = 'Stop'
$frontend = Join-Path $Repositorio 'Fontes\Frontend'
$publicacao = Join-Path $RaizOperacao 'Execucao\Web'
$pacote = Join-Path $RaizOperacao 'Pacotes\BackupFontes'
if (-not (Test-Path (Join-Path $frontend 'angular.json'))) { throw 'Angular nao encontrado no caminho esperado.' }
$webServico = Get-Service -Name 'MeslumeWeb' -ErrorAction SilentlyContinue
if ($webServico -and $webServico.Status -eq 'Running') {
    throw 'MeslumeWeb esta em execucao. Pare-o antes de atualizar o build publicado.'
}
Push-Location $frontend
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Angular falhou no build. Nao foi publicado.' }
} finally { Pop-Location }
$dist = Join-Path $frontend 'dist\meslume'
$src = Join-Path $dist 'browser'
if (-not (Test-Path (Join-Path $src 'index.html'))) { $src = $dist }
if (-not (Test-Path (Join-Path $src 'index.html'))) {
    throw 'index.html nao encontrado no build. Verifique angular.json/outputPath.'
}
# Nunca copiar builds na pasta dos fontes ou mexer no banco.
$staging = Join-Path $RaizOperacao ('Execucao\WebPreparacao-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Copy-Item -Path (Join-Path $src '*') -Destination $staging -Recurse -Force
if (-not (Test-Path (Join-Path $staging 'index.html'))) { throw 'Copia incompleta. Publicacao nao alterada.' }
if (Test-Path $publicacao) {
    $backup = Join-Path $pacote ('Web-' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
    New-Item -ItemType Directory -Path $pacote -Force | Out-Null
    Move-Item -LiteralPath $publicacao -Destination $backup
    Write-Host "Build anterior preservado em: $backup" -ForegroundColor Yellow
}
Move-Item -LiteralPath $staging -Destination $publicacao
Write-Host "[OK] Frontend publicado em $publicacao" -ForegroundColor Green
Write-Host 'ATENCAO: o frontend atual e um prototipo sem persistencia; nao usar dados reais.' -ForegroundColor Yellow
