#Requires -RunAsAdministrator
<#
.SYNOPSIS
Configures SQL Server for the Ed-Fi Admin App: enables Mixed Mode auth, TCP/IP
protocol, and the `sa` login with a known password.

.DESCRIPTION
Addresses two SQL Server defaults that block the Admin App API from connecting:
- Mixed Mode disabled (Windows-only auth) — fails because the app uses SQL Auth
- TCP/IP disabled — fails because the `mssql` Node driver requires TCP

Auto-detects the installed SQL Server major version from the registry.
Restarts the MSSQLSERVER service once at the end. Idempotent — safe to re-run.

.PARAMETER SaPassword
The password to assign to the sa login. Will be referenced later in
production.js as MSSQL_DB_PASSWORD.

.PARAMETER InstanceName
SQL Server instance name. Defaults to MSSQLSERVER (the default instance).

.PARAMETER DatabaseName
Name of the Admin App database to create (if it doesn't already exist).
Default: sbaa (the name the Admin App expects out of the box).

.EXAMPLE
.\01-prereqs-sql.ps1 -SaPassword 'EdFi-AdminApp-Local!2026'
.\01-prereqs-sql.ps1 -SaPassword 'EdFi-AdminApp-Local!2026' -DatabaseName 'myadminapp'
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SaPassword,

    [string]$InstanceName = "MSSQLSERVER",
    [string]$DatabaseName = "sbaa"
)

$ErrorActionPreference = 'Stop'

# Find the SQL Server version-specific registry key
$verKey = Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server" -ErrorAction SilentlyContinue |
    Where-Object { $_.PSChildName -like "MSSQL*.$InstanceName" } |
    Select-Object -First 1

if (-not $verKey) {
    throw "Could not find a SQL Server install for instance '$InstanceName'. Is SQL Server installed?"
}

$verName = $verKey.PSChildName
Write-Host "Detected SQL Server version key: $verName"

$registryChanged = $false

# Mixed Mode authentication — only set if not already 2
$lmPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$verName\MSSQLServer"
$currentMode = (Get-ItemProperty -Path $lmPath -Name "LoginMode" -ErrorAction SilentlyContinue).LoginMode
if ($currentMode -eq 2) {
    Write-Host "Mixed Mode already enabled (LoginMode=2)."
} else {
    Set-ItemProperty -Path $lmPath -Name "LoginMode" -Value 2
    Write-Host "Mixed Mode authentication enabled (LoginMode was $currentMode)."
    $registryChanged = $true
}

# TCP/IP protocol — only set values that aren't already correct
$tcpBase = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$verName\MSSQLServer\SuperSocketNetLib\Tcp"
$rootEnabled = (Get-ItemProperty -Path $tcpBase -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
if ($rootEnabled -ne 1) {
    Set-ItemProperty -Path $tcpBase -Name "Enabled" -Value 1
    $registryChanged = $true
}
Get-ChildItem $tcpBase | ForEach-Object {
    $cur = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
    if ($cur.Enabled -ne 1)         { Set-ItemProperty -Path $_.PSPath -Name "Enabled"         -Value 1      -ErrorAction SilentlyContinue; $script:registryChanged = $true }
    if ($cur.Active -ne 1)          { Set-ItemProperty -Path $_.PSPath -Name "Active"          -Value 1      -ErrorAction SilentlyContinue; $script:registryChanged = $true }
    if ($cur.TcpDynamicPorts -ne "") { Set-ItemProperty -Path $_.PSPath -Name "TcpDynamicPorts" -Value ""     -ErrorAction SilentlyContinue; $script:registryChanged = $true }
    if ($cur.TcpPort -ne "1433")    { Set-ItemProperty -Path $_.PSPath -Name "TcpPort"         -Value "1433" -ErrorAction SilentlyContinue; $script:registryChanged = $true }
}
Write-Host "TCP/IP settings checked/applied."

# Restart only if registry changes happened
if ($registryChanged) {
    Write-Host "Restarting SQL Server to apply registry changes..."
    Restart-Service -Name $InstanceName -Force
} else {
    Write-Host "No registry changes -- skipping service restart."
}

# Helper: run sqlcmd, return exit code, swallow stderr without tripping
# $ErrorActionPreference=Stop. PS 5.1 wraps native command stderr in
# NativeCommandError records and the script-wide Stop preference treats those
# as terminating, so we temporarily relax the preference around the call.
# Every call gets a query timeout (-t) so we never hang on a partially-up
# server.
function Invoke-Sqlcmd-Quiet {
    param([string[]]$SqlArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & sqlcmd @SqlArgs -t 10 2>&1 | Out-Null
    } finally {
        $ErrorActionPreference = $prev
    }
    return $LASTEXITCODE
}

# After a service restart, SQL Server's status goes Running before it's
# actually accepting queries. Loop with Windows-auth probes (sa may not be
# enabled yet) until a SELECT 1 succeeds or we time out.
Write-Host "Waiting for SQL Server to accept queries..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $ec = Invoke-Sqlcmd-Quiet @("-S", "(local)", "-E", "-Q", "SELECT 1", "-l", "3")
    if ($ec -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    throw "SQL Server did not become ready within ~60 seconds. Check the service is running."
}
Write-Host "SQL Server is responding."

# Enable sa, set password -- only ALTER LOGIN if current password doesn't work
Write-Host "Checking sa login..."
$ec = Invoke-Sqlcmd-Quiet @("-S", "tcp:localhost,1433", "-U", "sa", "-P", $SaPassword, "-Q", "SELECT 1", "-l", "3")
$saLoginWorks = ($ec -eq 0)

if ($saLoginWorks) {
    Write-Host "sa login already accepts the provided password -- skipping ALTER LOGIN."
} else {
    Write-Host "sa login doesn't accept the password -- running ALTER LOGIN..."
    $escapedPw = $SaPassword -replace "'", "''"
    $saQuery = "ALTER LOGIN sa WITH PASSWORD = '$escapedPw', CHECK_POLICY = OFF; ALTER LOGIN sa ENABLE;"
    $ec = Invoke-Sqlcmd-Quiet @("-S", "(local)", "-E", "-Q", $saQuery)
    if ($ec -ne 0) {
        throw "Failed to configure sa login (sqlcmd exit code $ec). Verify your Windows user has SQL sysadmin."
    }
}

# Verify TCP listener + SQL Auth
$listener = Get-NetTCPConnection -LocalPort 1433 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    throw "No listener on TCP 1433 after restart. Check Windows Firewall."
}

$ec = Invoke-Sqlcmd-Quiet @("-S", "tcp:localhost,1433", "-U", "sa", "-P", $SaPassword, "-Q", "SELECT @@VERSION")
if ($ec -ne 0) {
    throw "SQL Auth over TCP failed (sqlcmd exit code $ec)."
}

# Create the Admin App database if it doesn't already exist
Write-Host "Ensuring database '$DatabaseName' exists..."
$dbQuery = "IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'$DatabaseName') CREATE DATABASE [$DatabaseName];"
$ec = Invoke-Sqlcmd-Quiet @("-S", "tcp:localhost,1433", "-U", "sa", "-P", $SaPassword, "-Q", $dbQuery)
if ($ec -ne 0) {
    throw "Failed to create/verify database '$DatabaseName' (sqlcmd exit code $ec)."
}

Write-Host "Database '$DatabaseName' is present."

Write-Host ""
Write-Host "SUCCESS: SQL Server is configured for Mixed Mode + TCP/IP." -ForegroundColor Green
Write-Host "Save '$SaPassword' for use as MSSQL_DB_PASSWORD in production.js." -ForegroundColor Yellow
