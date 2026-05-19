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
.\03b-keycloak-start.ps1 -AdminPassword 'admin'
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
    throw "kc.bat not found under $KeycloakInstallPath. Run 03a-prereqs-runtime.ps1 first to download Keycloak."
}

# 3. Start Keycloak in background with bootstrap env vars
#    The env vars are scoped to the spawned process; Keycloak 26+ creates the
#    master admin from them on first launch and ignores them thereafter.
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $kcBat
$psi.Arguments = "start-dev"
$psi.WorkingDirectory = Split-Path $kcBat -Parent
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$psi.EnvironmentVariables["KC_BOOTSTRAP_ADMIN_USERNAME"] = $AdminUser
$psi.EnvironmentVariables["KC_BOOTSTRAP_ADMIN_PASSWORD"] = $AdminPassword
# Older alias still honored by 26.x for backward compat:
$psi.EnvironmentVariables["KEYCLOAK_ADMIN"] = $AdminUser
$psi.EnvironmentVariables["KEYCLOAK_ADMIN_PASSWORD"] = $AdminPassword

$proc = [System.Diagnostics.Process]::Start($psi)
Write-Host "Started Keycloak (PID $($proc.Id))."

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
    throw "Keycloak did not become ready within $ReadyTimeoutSeconds seconds. Check logs in $KeycloakInstallPath\data\log."
}

Write-Host ""
Write-Host "SUCCESS: Keycloak running at $BaseUrl" -ForegroundColor Green
Write-Host "Admin user: $AdminUser (password as provided)"
Write-Host "PID: $($proc.Id) — close this terminal or stop the process to shut down."
