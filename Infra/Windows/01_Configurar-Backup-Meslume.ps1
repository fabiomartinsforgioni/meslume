# Meslume | Configuracao inicial do backup automatico
# Executar uma vez no PowerShell COMO ADMINISTRADOR.
# Solicita a senha do meslume_app localmente, sem exibi-la na tela.

$ErrorActionPreference = 'Stop'

$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$principalWindows = New-Object Security.Principal.WindowsPrincipal($identidade)
if (-not $principalWindows.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Execute o PowerShell como Administrador para criar a tarefa agendada.'
}

$origem = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptOrigem = Join-Path $origem '02_Executar-Backup-Meslume.ps1'
$execucaoPrivada = 'C:\Meslume\Execucao\Backup'
$scriptBackup = Join-Path $execucaoPrivada '02_Executar-Backup-Meslume.ps1'
$pgDump = 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe'
$pgRestore = 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe'
$credenciais = 'C:\Meslume\Configuracao\meslume-backup.pgpass'
$tarefa = 'Meslume_Backup_PostgreSQL'

foreach ($arquivo in @($scriptOrigem, $pgDump, $pgRestore)) {
    if (-not (Test-Path -LiteralPath $arquivo -PathType Leaf)) {
        throw ('Arquivo nao encontrado: ' + $arquivo)
    }
}

$pastasPrivadas = @(
    'C:\Meslume\Configuracao',
    $execucaoPrivada,
    'C:\Meslume\Backups\PostgreSQL\Diarios',
    'C:\Meslume\Backups\PostgreSQL\Semanais',
    'C:\Meslume\Logs\Backup'
)

foreach ($pasta in $pastasPrivadas) {
    New-Item -ItemType Directory -Path $pasta -Force | Out-Null
}

if (Test-Path -LiteralPath $credenciais -PathType Leaf) {
    throw ('Ja existe um arquivo de credenciais em ' + $credenciais +
        '. Confira a instalacao existente antes de reconfigurar.')
}

# Copia o script operacional para uma pasta que nao e gravavel sem elevacao.
& icacls.exe $execucaoPrivada /inheritance:r /grant:r `
    '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao proteger a pasta privada da tarefa agendada.'
}
Copy-Item -LiteralPath $scriptOrigem -Destination $scriptBackup -Force

Write-Host 'Informe a senha EXISTENTE do usuario PostgreSQL meslume_app.' -ForegroundColor Cyan
$segredo = Read-Host 'Senha do banco (entrada oculta)' -AsSecureString
$ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segredo)
try {
    $senha = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
    if ([string]::IsNullOrEmpty($senha)) {
        throw 'A senha nao pode ser vazia.'
    }
    $senhaEscapada = $senha.Replace('\', '\\').Replace(':', '\:')
    $linha = '127.0.0.1:5432:meslume_homologacao:meslume_app:' + $senhaEscapada + "`r`n"
    [System.IO.File]::WriteAllText($credenciais, $linha, ([System.Text.UTF8Encoding]::new($false)))
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
    Remove-Variable senha, senhaEscapada, linha -ErrorAction SilentlyContinue
}

# Restringe o arquivo de senha a SYSTEM, administradores e usuario atual.
$usuarioSid = $identidade.User.Value
& icacls.exe $credenciais /inheritance:r /grant:r `
    '*S-1-5-18:(R)' '*S-1-5-32-544:(F)' ("*{0}:(R)" -f $usuarioSid) | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao restringir permissoes do arquivo de credenciais.'
}

# As pastas de dump/log tambem devem ficar fora de acesso publico.
foreach ($pasta in $pastasPrivadas | Where-Object { $_ -notlike '*\Configuracao' -and $_ -ne $execucaoPrivada }) {
    & icacls.exe $pasta /inheritance:r /grant:r `
        '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' `
        ("*{0}:(OI)(CI)F" -f $usuarioSid) | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw ('Falha ao restringir permissoes: ' + $pasta)
    }
}

Write-Host "`nExecutando primeiro backup para validar a senha e o banco..." -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptBackup
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $credenciais -Force -ErrorAction SilentlyContinue
    throw 'Backup manual falhou. Verifique C:\Meslume\Logs\Backup. Nao foi criada tarefa agendada.'
}

$acao = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $scriptBackup) `
    -WorkingDirectory $execucaoPrivada

$gatilho = New-ScheduledTaskTrigger -Daily -At '20:00'
$opcoes = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$conta = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $tarefa -Action $acao -Trigger $gatilho `
    -Settings $opcoes -Principal $conta -Description `
    'Backup diario do PostgreSQL Meslume as 20h, independente de login.' -Force | Out-Null

Write-Host "`nTarefa criada: $tarefa (diariamente as 20h)." -ForegroundColor Green
Write-Host 'Disparando tambem a tarefa sob a conta SYSTEM para validar o agendamento...'
Start-ScheduledTask -TaskName $tarefa

Write-Host "`nPara consultar status:" -ForegroundColor Cyan
Write-Host "Get-ScheduledTaskInfo -TaskName '$tarefa'"
Write-Host 'Get-ChildItem C:\Meslume\Backups\PostgreSQL\Diarios'
Write-Host 'Get-Content C:\Meslume\Logs\Backup\backup_*.log -Tail 15'
Write-Host 'OBS: pg_restore --list valida o catalogo, nao substitui teste de restauracao isolada.'
