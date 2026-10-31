# MESLUME - Somente leitura. Nao instala nem para servicos.
[CmdletBinding()]
param([string]$RaizOperacao = 'C:\Meslume')
$ErrorActionPreference = 'Stop'
Write-Host "`n=== MESLUME: DIAGNOSTICO WINDOWS ===" -ForegroundColor Cyan
$nomes = @('MeslumeApi', 'MeslumeWeb')
foreach ($nome in $nomes) {
    $servico = Get-Service -Name $nome -ErrorAction SilentlyContinue
    if ($null -eq $servico) { Write-Host "[AUSENTE] $nome" -ForegroundColor Yellow }
    else { Write-Host ("[{0}] {1} (tipo: {2})" -f $servico.Status, $nome, $servico.StartType) }
}
Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue |
    Select-Object Name, Status, StartType |
    Format-Table -AutoSize
$checks = @(
    @{Nome='Angular publicado'; Caminho=(Join-Path $RaizOperacao 'Execucao\Web\index.html')},
    @{Nome='Django publicado'; Caminho=(Join-Path $RaizOperacao 'Execucao\Backend\manage.py')},
    @{Nome='Waitress instalado'; Caminho=(Join-Path $RaizOperacao 'Execucao\Backend\.venv\Scripts\waitress-serve.exe')},
    @{Nome='Configuracao privada'; Caminho=(Join-Path $RaizOperacao 'Configuracao\backend.env')},
    @{Nome='Servidor Caddy'; Caminho=(Join-Path $RaizOperacao 'Execucao\Ferramentas\caddy.exe')},
    @{Nome='WinSW'; Caminho=(Join-Path $RaizOperacao 'Execucao\Ferramentas\WinSW-x64.exe')}
)
foreach ($item in $checks) {
    $status = if (Test-Path $item.Caminho) { 'OK' } else { 'PENDENTE' }
    Write-Host "[$status] $($item.Nome): $($item.Caminho)"
}
$portas = @(4317, 8080)
foreach ($porta in $portas) {
    $escuta = Get-NetTCPConnection -State Listen -LocalPort $porta -ErrorAction SilentlyContinue
    if ($escuta) { Write-Host "[OCUPADA] porta $porta por PID: $(($escuta.OwningProcess | Select-Object -Unique) -join ',')" }
    else { Write-Host "[LIVRE] porta $porta" }
}
foreach ($endereco in @('http://127.0.0.1:8080/', 'http://127.0.0.1:8080/api/v1/health/')) {
    try {
        $resp = Invoke-WebRequest -Uri $endereco -UseBasicParsing -TimeoutSec 4
        Write-Host "[HTTP $($resp.StatusCode)] $endereco" -ForegroundColor Green
    } catch { Write-Host "[INDISPONIVEL] $endereco" -ForegroundColor Yellow }
}
