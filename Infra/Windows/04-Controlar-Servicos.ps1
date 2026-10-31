# MESLUME - Controle dos servicos apos instalacao.
[CmdletBinding()]
param([ValidateSet('status','iniciar','parar','reiniciar')][string]$Acao = 'status')
$ErrorActionPreference = 'Stop'
$api = 'MeslumeApi'
$web = 'MeslumeWeb'
if ($Acao -ne 'status') {
    $principal = [Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Controle de servicos exige PowerShell como Administrador.'
    }
}
switch ($Acao) {
    'iniciar' {
        Start-Service -Name $api
        Start-Service -Name $web
    }
    'parar' {
        Stop-Service -Name $web -ErrorAction Stop
        Stop-Service -Name $api -ErrorAction Stop
    }
    'reiniciar' {
        Restart-Service -Name $api -ErrorAction Stop
        Restart-Service -Name $web -ErrorAction Stop
    }
}
Get-Service -Name $api,$web -ErrorAction SilentlyContinue |
    Select-Object Name,Status,StartType | Format-Table -AutoSize
# Nunca parar PostgreSQL: banco e servico independente.
