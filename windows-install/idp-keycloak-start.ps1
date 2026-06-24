<#
.SYNOPSIS
Starts Keycloak in the background and bootstraps the master-realm admin user.

.DESCRIPTION
Sets KC_BOOTSTRAP_ADMIN_USERNAME and KC_BOOTSTRAP_ADMIN_PASSWORD env vars for
the spawned process (Keycloak 26+ uses these on first start to create the master
admin). Launches kc.bat start-dev as a detached background process, then polls
the master realm's OIDC discovery endpoint until Keycloak is ready.

If Keycloak is already running and reachable, the script just verifies and exits.
If Keycloak was previously bootstrapped with a different admin password, the env
vars are ignored (Keycloak only honors them on first start) — use the existing
admin credentials downstream.

Does NOT require elevation.

.PARAMETER KeycloakInstallPath
Where Keycloak is installed. Default: C:\keycloak.

.PARAMETER AdminUser
Bootstrap admin username (first-run only). Default: admin.

.PARAMETER AdminPassword
Bootstrap admin password (first-run only).

.PARAMETER BaseUrl
URL to probe. Default: http://localhost:8080.

.PARAMETER ReadyTimeoutSeconds
How long to wait for Keycloak to be reachable. Default: 120.

.EXAMPLE
.\idp-keycloak-start.ps1 -AdminPassword 'admin'
#>

param(
    [string]$KeycloakInstallPath = "C:\keycloak",
    [string]$AdminUser = "admin",

    [Parameter(Mandatory = $true)]
    [string]$AdminPassword,

    [string]$BaseUrl = "http://localhost:8080",
    [int]$ReadyTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'

$discoveryUrl = "$BaseUrl/realms/master/.well-known/openid-configuration"

# 1. Is Keycloak already up?
try {
    $r = Invoke-RestMethod -Uri $discoveryUrl -TimeoutSec 5
    Write-Host "Keycloak already running at $BaseUrl" -ForegroundColor Green
    Write-Host "Issuer: $($r.issuer)"
    return
} catch {
    Write-Host "Keycloak not responding yet — starting it..."
}

# 2. Verify install -- accept flat OR nested layout
$kcBat = $null
if (Test-Path (Join-Path $KeycloakInstallPath "bin\kc.bat")) {
    $kcBat = Join-Path $KeycloakInstallPath "bin\kc.bat"
} else {
    $sub = Get-ChildItem $KeycloakInstallPath -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path "$($_.FullName)\bin\kc.bat" } |
        Select-Object -First 1
    if ($sub) { $kcBat = "$($sub.FullName)\bin\kc.bat" }
}
if (-not $kcBat) {
    throw "kc.bat not found under $KeycloakInstallPath. Run idp-keycloak-setup.ps1 first to download Keycloak."
}

# Keycloak needs a JDK (Java 17+). idp-keycloak-setup installs it and sets
# JAVA_HOME; if neither a usable JAVA_HOME nor java on PATH is present, fail
# early with a clear message instead of a kc.bat error.
$machineJavaHome = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
$javaAvailable = $false
if (Get-Command java -ErrorAction SilentlyContinue) { $javaAvailable = $true }
elseif ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { $javaAvailable = $true }
elseif ($machineJavaHome -and (Test-Path "$machineJavaHome\bin\java.exe")) { $javaAvailable = $true }
if (-not $javaAvailable) {
    throw "No JDK found (java not on PATH and JAVA_HOME unset/invalid). Keycloak needs Java 17+. Run idp-keycloak-setup.ps1 first to install it."
}

# 3. Start Keycloak in the background. The bootstrap env vars are set on THIS
#    process so the spawned kc.bat inherits them (Start-Process has no
#    -Environment parameter in PS 5.1); Keycloak 26+ creates the master admin
#    from KC_BOOTSTRAP_ADMIN_* on first launch and ignores them thereafter.
$env:KC_BOOTSTRAP_ADMIN_USERNAME = $AdminUser
$env:KC_BOOTSTRAP_ADMIN_PASSWORD = $AdminPassword
# Older aliases still honored by 26.x for backward compat:
$env:KEYCLOAK_ADMIN = $AdminUser
$env:KEYCLOAK_ADMIN_PASSWORD = $AdminPassword

# Redirect startup output to log files instead of capturing it on pipes we
# never read: an unread redirected pipe can fill its OS buffer (~4 KB) and
# block Keycloak mid-startup, so it never becomes ready. Files have no such
# limit, and they give the "check the logs" guidance below something real to
# point at (start-dev logs to the console, not to data\log, by default).
$startupLog = Join-Path $KeycloakInstallPath "keycloak-startup.log"
$startupErr = Join-Path $KeycloakInstallPath "keycloak-startup.err.log"
$proc = Start-Process -FilePath $kcBat -ArgumentList "start-dev" `
    -WorkingDirectory (Split-Path $kcBat -Parent) `
    -RedirectStandardOutput $startupLog -RedirectStandardError $startupErr `
    -WindowStyle Hidden -PassThru

# The child already has its own copy of the env block; don't leave the admin
# password lingering in this process's environment.
Remove-Item Env:KC_BOOTSTRAP_ADMIN_PASSWORD, Env:KEYCLOAK_ADMIN_PASSWORD -ErrorAction SilentlyContinue

Write-Host "Started Keycloak (PID $($proc.Id)). Startup log: $startupLog"

# 4. Poll discovery endpoint until ready (or timeout)
$deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
$ready = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-RestMethod -Uri $discoveryUrl -TimeoutSec 3
        $ready = $true
        break
    } catch {
        Start-Sleep -Seconds 3
    }
}

if (-not $ready) {
    throw "Keycloak did not become ready within $ReadyTimeoutSeconds seconds. Check the startup log at $startupLog (and $startupErr)."
}

Write-Host ""
Write-Host "SUCCESS: Keycloak running at $BaseUrl" -ForegroundColor Green
Write-Host "Admin user: $AdminUser (password as provided)"
Write-Host "PID: $($proc.Id) — close this terminal or stop the process to shut down."
