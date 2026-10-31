# Meslume | Backup PostgreSQL 17
# Execucao local/automatizada. Nao altera o banco de origem.

$ErrorActionPreference = 'Stop'

$pgDump = 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe'
$pgRestore = 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe'
$credenciais = 'C:\Meslume\Configuracao\meslume-backup.pgpass'
$diarios = 'C:\Meslume\Backups\PostgreSQL\Diarios'
$semanais = 'C:\Meslume\Backups\PostgreSQL\Semanais'
$logs = 'C:\Meslume\Logs\Backup'

$agora = Get-Date
$identificador = '{0}_{1}' -f $agora.ToString('yyyyMMdd_HHmmss'), $PID
$temporario = Join-Path $diarios ('meslume_' + $identificador + '.tmp')
$concluido = Join-Path $diarios ('meslume_' + $identificador + '.backup')
$arquivoLog = Join-Path $logs ('backup_' + $agora.ToString('yyyyMMdd') + '.log')

function Registrar([string] $mensagem) {
    ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $mensagem) |
        Out-File -FilePath $arquivoLog -Append -Encoding UTF8
    Write-Host $mensagem
}

try {
    foreach ($pasta in @($diarios, $semanais, $logs)) {
        New-Item -ItemType Directory -Path $pasta -Force | Out-Null
    }

    foreach ($arquivo in @($pgDump, $pgRestore, $credenciais)) {
        if (-not (Test-Path -LiteralPath $arquivo -PathType Leaf)) {
            throw ('Arquivo obrigatorio nao encontrado: ' + $arquivo)
        }
    }

    $env:PGPASSFILE = $credenciais
    $env:PGCONNECT_TIMEOUT = '10'
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

    Registrar 'Iniciando backup do banco meslume_homologacao.'

    # O pg_dump recebe a senha apenas via arquivo protegido PGPASSFILE.
    $preferenciaAnterior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $pgDump --host=127.0.0.1 --port=5432 --username=meslume_app `
            --dbname=meslume_homologacao --format=custom --no-password `
            --file=$temporario 2>&1 | Out-File -FilePath $arquivoLog -Append -Encoding UTF8
        $resultadoDump = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $preferenciaAnterior
    }

    if ($resultadoDump -ne 0) {
        throw ('pg_dump finalizou com codigo ' + $resultadoDump + '. Consulte o log.')
    }
    if (-not (Test-Path -LiteralPath $temporario -PathType Leaf)) {
        throw 'pg_dump nao gerou o arquivo temporario.'
    }
    if ((Get-Item -LiteralPath $temporario).Length -lt 512) {
        throw 'O arquivo gerado e inesperadamente pequeno.'
    }

    # Inspecao do catalogo; validacao completa requer restauracao em outro banco.
    $ErrorActionPreference = 'Continue'
    try {
        & $pgRestore --list $temporario 2>&1 | Out-Null
        $resultadoCatalogo = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $preferenciaAnterior
    }
    if ($resultadoCatalogo -ne 0) {
        throw ('pg_restore nao conseguiu ler o catalogo: ' + $resultadoCatalogo)
    }

    Move-Item -LiteralPath $temporario -Destination $concluido
    $tamanho = (Get-Item -LiteralPath $concluido).Length
    Registrar ('Backup diario valido: {0} ({1} bytes).' -f $concluido, $tamanho)

    # Copia semanal no domingo. Manter ate 8 copias semanais.
    if ($agora.DayOfWeek -eq [DayOfWeek]::Sunday) {
        $semanal = Join-Path $semanais ('meslume_semanal_' + $agora.ToString('yyyyMMdd') + '.backup')
        if (-not (Test-Path -LiteralPath $semanal)) {
            Copy-Item -LiteralPath $concluido -Destination $semanal
            Registrar ('Copia semanal criada: ' + $semanal)
        }
    }

    # A limpeza acontece somente depois de um backup validado.
    Get-ChildItem -LiteralPath $diarios -Filter 'meslume_*.backup' -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 14 |
        Remove-Item -Force

    Get-ChildItem -LiteralPath $semanais -Filter 'meslume_semanal_*.backup' -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 8 |
        Remove-Item -Force

    Registrar 'SUCESSO: backup finalizado e retencao aplicada.'
    exit 0
}
catch {
    try {
        Registrar ('FALHA: ' + $_.Exception.Message)
    }
    catch {
        Write-Error $_.Exception.Message
    }
    if (Test-Path -LiteralPath $temporario -PathType Leaf) {
        Remove-Item -LiteralPath $temporario -Force -ErrorAction SilentlyContinue
    }
    exit 1
}
finally {
    Remove-Item Env:\PGPASSFILE -ErrorAction SilentlyContinue
    Remove-Item Env:\PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
