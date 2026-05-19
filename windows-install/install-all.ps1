#Requires -RunAsAdministrator
<#
.SYNOPSIS
Master installer for the Ed-Fi Admin App on Windows IIS. Fully automated.

Runs in three phases with no manual interaction required.

  Phase 1 — Prereqs
    01-prereqs-sql.ps1        SQL Server Mixed Mode + TCP/IP + sa
    02-prereqs-iis.ps1        iisnode + HTTPS cert + binding
    03a-prereqs-runtime.ps1    Node.js + npm cache override + Keycloak download

  Phase 2 — Build and start
    03c-build-project.ps1     npm ci + build:api + build:fe (slow)
    03b-keycloak-start.ps1    Bootstrap admin via env vars; start Keycloak detached;
                              wait for readiness

  Phase 3 — Deploy
    06-keycloak-bootstrap.ps1 Realm + client + user (+ audience mapper)
    04-deploy-api.ps1         Deploy API to IIS
    05-deploy-fe.ps1          Deploy FE to IIS

Re-run modes:
  Default               Run all three phases end-to-end
  -SkipPhase1           Skip prereqs (already done)
  -SkipPhase2           Skip build + Keycloak start (artifacts and Keycloak already up)
  -OnlyPhase1           Run prereqs only

If you'd rather build manually or run Keycloak in a foreground terminal, use
-SkipPhase2 and handle those yourself before re-running with -SkipPhase1
-SkipPhase2.

.PARAMETER SaPassword
SQL Server sa password.

.PARAMETER KeycloakAdminPassword
Password for the master-realm Keycloak admin user. Used as the bootstrap admin
when Keycloak starts for the first time (script 03b). Subsequent runs of
Keycloak ignore this — make sure it matches an admin that actually exists.

.PARAMETER KeycloakClientSecret
Secret to set on the edfiadminapp Keycloak client. You pick this.

.PARAMETER TestUserPassword
Password for the seeded test user.

.PARAMETER SourcePath
Path to the cloned Ed-Fi-AdminApp repo. Defaults to the parent of the script
directory — i.e., the scripts live in <repo>\windows-install\ and the repo
root is one level up. Override only if your layout differs.

.PARAMETER DatabaseName
SQL Server database name. Default: sbaa. Propagated to 01 (creates the DB) and
04 (patches MSSQL_DB_DATABASE in production.js).

.PARAMETER AdminUsername
Email seeded as the admin user. Default: admin@example.com.

.PARAMETER JdkDownloadUrl
Optional URL to an OpenJDK zip — phase 1 will install + set JAVA_HOME.

.PARAMETER IncludeAudienceMapper
Switch — add the Keycloak audience mapper (needed for bearer-token API access).

.PARAMETER EnableDirectAccessGrants
Switch — enable password grant on the Keycloak client (testing only).

.PARAMETER AcceptRisks
Switch — bypass the y/N confirmation when 00-check-prereqs flags collision
risks (e.g., another app sharing the SQL instance, a non-OpenJDK-21 'java' on
PATH, another IIS site bound to :443). Use for non-interactive runs only after
reviewing the [RISK] items.

.PARAMETER AutoUpgradeNode
Switch — when 00a-fix-node.ps1 detects a too-old Node on PATH, skip the y/N
confirmation and proceed with nvm-windows + Node LTS setup automatically.
For non-interactive runs. Passed through as -AssumeYes to 00a-fix-node.ps1.

.PARAMETER YopassUrl
URL of a Yopass service to use for sharing newly-created Ed-Fi API client
credentials. Default empty — Yopass is disabled and the AdminApp falls back
to displaying credentials inline (a supported AdminApp configuration). Pass
e.g. -YopassUrl 'http://yopass.internal:8082' to enable it against a
pre-existing deployment; the install scripts do not stand up Yopass for you.

.EXAMPLE
.\install-all.ps1 `
  -SaPassword 'EdFi-Local!2026' `
  -KeycloakAdminPassword 'admin' `
  -KeycloakClientSecret 'YOUR_CHOSEN_CLIENT_SECRET' `
  -TestUserPassword 'TestUser123!'
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SaPassword,

    [Parameter(Mandatory = $true)]
    [string]$KeycloakAdminPassword,

    [Parameter(Mandatory = $true)]
    [string]$KeycloakClientSecret,

    [Parameter(Mandatory = $true)]
    [string]$TestUserPassword,

    [string]$SourcePath = (Split-Path $PSScriptRoot -Parent),
    [string]$DatabaseName = "sbaa",
    [string]$AdminUsername = "admin@example.com",
    [string]$JdkDownloadUrl,

    [switch]$IncludeAudienceMapper,
    [switch]$EnableDirectAccessGrants,

    [switch]$SkipPhase1,
    [switch]$SkipPhase2,
    [switch]$OnlyPhase1,
    [switch]$SkipPreflightCheck,
    [switch]$AcceptRisks,
    [switch]$AutoUpgradeNode,

    [string]$YopassUrl = ""
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot

function Write-Phase {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
}

# Sanity-check that $SourcePath looks like an AdminApp repo before we try to
# build / deploy from it. The user got the scripts by cloning (or unzipping)
# the repo, so this should always pass on the default; only fires if someone
# overrode -SourcePath to a wrong directory.
if (-not (Test-Path "$SourcePath\package.json")) {
    throw "Expected AdminApp repo at '$SourcePath' but no package.json found. Pass -SourcePath if the repo is elsewhere."
}

# Pre-flight: run 00-check-prereqs.ps1 to validate manual prereqs are in place.
# Exit codes from 00:
#   0 = clean
#   1 = blocking FAIL items, install must not proceed
#   2 = ready, but [RISK] items present (collisions with existing software);
#       prompt the user to confirm unless -AcceptRisks was passed
if (-not $SkipPreflightCheck) {
    # Node version remediation runs BEFORE the diagnostic so a stale Node 16
    # doesn't fail the pre-flight on a fixable issue. 00a-fix-node.ps1 is a no-op
    # when Node is missing (03a will install) or already at the floor.
    Write-Phase "Pre-flight: Node version check (00a-fix-node.ps1)"
    $fixNodeArgs = @{ SourcePath = $SourcePath }
    if ($AutoUpgradeNode) { $fixNodeArgs.AssumeYes = $true }
    & "$scriptDir\00a-fix-node.ps1" @fixNodeArgs

    Write-Phase "Pre-flight check (00-check-prereqs.ps1)"
    & "$scriptDir\00-check-prereqs.ps1" -SourcePath $SourcePath -DatabaseName $DatabaseName
    $preflightExit = $LASTEXITCODE
    if ($preflightExit -eq 1) {
        throw "Pre-flight check failed. Fix the [FAIL] items above and re-run, or pass -SkipPreflightCheck to bypass (not recommended)."
    } elseif ($preflightExit -eq 2) {
        if ($AcceptRisks) {
            Write-Host ""
            Write-Host "Collision risks acknowledged via -AcceptRisks. Proceeding." -ForegroundColor Magenta
        } else {
            Write-Host ""
            Write-Host "The pre-flight flagged [RISK] items above -- the install will modify state" -ForegroundColor Magenta
            Write-Host "that another app on this machine may depend on (SQL instance config, PATH" -ForegroundColor Magenta
            Write-Host "ordering of 'java', the HTTPS:443 binding, etc.)." -ForegroundColor Magenta
            $reply = Read-Host "Continue anyway? (y/N)"
            if ($reply -notmatch '^[Yy]') {
                throw "Aborted by user. Re-run with -AcceptRisks to skip this prompt next time."
            }
        }
    } elseif ($preflightExit -ne 0) {
        throw "Pre-flight check returned unexpected exit code $preflightExit."
    }
}

# ---------- Phase 1 — Prereqs ----------
if (-not $SkipPhase1) {
    Write-Phase "Phase 1.1: SQL Server prereqs (01-prereqs-sql.ps1)"
    & "$scriptDir\01-prereqs-sql.ps1" -SaPassword $SaPassword -DatabaseName $DatabaseName

    Write-Phase "Phase 1.2: IIS prereqs (02-prereqs-iis.ps1)"
    & "$scriptDir\02-prereqs-iis.ps1"

    Write-Phase "Phase 1.3: Runtime prereqs (03a-prereqs-runtime.ps1)"
    if ($JdkDownloadUrl) {
        & "$scriptDir\03a-prereqs-runtime.ps1" -JdkDownloadUrl $JdkDownloadUrl
    } else {
        & "$scriptDir\03a-prereqs-runtime.ps1"
    }

    Write-Host ""
    Write-Host "Phase 1 complete." -ForegroundColor Green

    # Refresh the current process's PATH from the registry so subsequent child
    # processes (notably 03c-build-project running npm) inherit Node's bin
    # directory even if winget just installed Node a moment ago in this same shell.
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

if ($OnlyPhase1) {
    Write-Host "Exiting after phase 1 (-OnlyPhase1)." -ForegroundColor Yellow
    return
}

# ---------- Phase 2 — Build + start Keycloak ----------
if (-not $SkipPhase2) {
    Write-Phase "Phase 2.1: Build the project (03c-build-project.ps1)"
    Write-Host "This takes several minutes. Output streams below."
    & "$scriptDir\03c-build-project.ps1" -SourcePath $SourcePath

    Write-Phase "Phase 2.2: Start Keycloak in background (03b-keycloak-start.ps1)"
    & "$scriptDir\03b-keycloak-start.ps1" -AdminPassword $KeycloakAdminPassword
}

# Sanity checks before phase 3
if (-not (Test-Path "$SourcePath\dist\packages\api\main.js")) {
    throw "$SourcePath\dist\packages\api\main.js missing. Build step skipped or failed."
}
if (-not (Test-Path "$SourcePath\dist\packages\fe\index.html")) {
    throw "$SourcePath\dist\packages\fe\index.html missing. Build step skipped or failed."
}
try {
    Invoke-RestMethod -Uri "http://localhost:8080/realms/master/.well-known/openid-configuration" -TimeoutSec 5 | Out-Null
} catch {
    throw "Keycloak isn't reachable at http://localhost:8080. Start it before continuing."
}

# ---------- Phase 3 — Deploy ----------
Write-Phase "Phase 3.1: Keycloak realm + client + user (06-keycloak-bootstrap.ps1)"
$kcArgs = @{
    AdminPassword = $KeycloakAdminPassword
    ClientSecret = $KeycloakClientSecret
    TestUserPassword = $TestUserPassword
    TestUserEmail = $AdminUsername
}
if ($IncludeAudienceMapper) { $kcArgs.IncludeAudienceMapper = $true }
if ($EnableDirectAccessGrants) { $kcArgs.EnableDirectAccessGrants = $true }
& "$scriptDir\06-keycloak-bootstrap.ps1" @kcArgs

Write-Phase "Phase 3.2: Deploy API (04-deploy-api.ps1)"
& "$scriptDir\04-deploy-api.ps1" `
    -SourcePath $SourcePath `
    -SaPassword $SaPassword `
    -DatabaseName $DatabaseName `
    -KeycloakClientSecret $KeycloakClientSecret `
    -AdminUsername $AdminUsername `
    -YopassUrl $YopassUrl

Write-Phase "Phase 3.3: Deploy FE (05-deploy-fe.ps1)"
& "$scriptDir\05-deploy-fe.ps1" -SourcePath "$SourcePath\dist\packages\fe"

# ---------- Smoke test ----------
Write-Phase "Smoke test: hitting the API"

# Trust self-signed cert for this probe
Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class InstallAllCertTrust : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate c, WebRequest r, int p) { return true; }
}
"@ -ErrorAction SilentlyContinue
[System.Net.ServicePointManager]::CertificatePolicy = New-Object InstallAllCertTrust

# iisnode lazy-starts on first request, so the first hit can be slow. Retry briefly.
$apiOk = $false
for ($i = 0; $i -lt 12; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "https://localhost/adminapp-api/api/teams" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        # Anything non-5xx counts as the app being up (401 expected without a token).
        $apiOk = $true; break
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if ($resp) {
            $code = [int]$resp.StatusCode
            if ($code -lt 500) { $apiOk = $true; break }
        }
        Start-Sleep -Seconds 5
    } catch {
        Start-Sleep -Seconds 5
    }
}

if ($apiOk) {
    Write-Host "API is responding at https://localhost/adminapp-api/" -ForegroundColor Green

    # Wait for the [user] table to exist. TypeORM migrations run during Nest
    # bootstrap, which is triggered by the smoke test, but the smoke test gets
    # its 401 response before TypeORM necessarily finishes the seed migration.
    # Poll for the table for up to 30 seconds.
    Write-Host "Waiting for migrations to finish creating the [user] table..."
    $userTableReady = $false
    for ($i = 0; $i -lt 15; $i++) {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            & sqlcmd -S "tcp:localhost,1433" -U sa -P $SaPassword -d $DatabaseName -Q "SET NOCOUNT ON; SELECT TOP 1 1 FROM [user];" 2>&1 | Out-Null
        } finally {
            $ErrorActionPreference = $prev
        }
        if ($LASTEXITCODE -eq 0) { $userTableReady = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $userTableReady) {
        Write-Host "[user] table didn't appear within 30s. Migrations may have failed -- check iisnode stderr." -ForegroundColor Yellow
    }

    # Ensure the admin user exists with roleId=2. Three scenarios this handles:
    #   1. Seed migration ran and inserted the user with roleId=2 -- both
    #      statements below are no-ops.
    #   2. Migrations created the [user] table but the seed didn't fire (we
    #      observed this on a clean VM run) -- INSERT runs, user gets roleId=2.
    #   3. The user exists but with NULL roleId (auth-flow auto-create path) --
    #      UPDATE corrects it.
    Write-Host "Ensuring '$AdminUsername' exists with admin role..."
    $upsertQuery = @"
IF NOT EXISTS (SELECT 1 FROM [user] WHERE username = '$AdminUsername')
    INSERT INTO [user] (username, roleId, isActive) VALUES ('$AdminUsername', 2, 1);
UPDATE [user] SET roleId = 2, isActive = 1
    WHERE username = '$AdminUsername' AND (roleId IS NULL OR isActive = 0);
"@
    & sqlcmd -S "tcp:localhost,1433" -U sa -P $SaPassword -d $DatabaseName -Q $upsertQuery 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Admin user present with roleId=2." -ForegroundColor Green
    } else {
        Write-Host "Couldn't ensure admin user automatically (sqlcmd exit $LASTEXITCODE)." -ForegroundColor Yellow
        Write-Host "If login loops, run this manually:" -ForegroundColor Yellow
        Write-Host "  sqlcmd -S `"(local)`" -U sa -P '<pw>' -d $DatabaseName -Q `"INSERT INTO [user] (username, roleId, isActive) VALUES ('$AdminUsername', 2, 1);`""
    }
} else {
    Write-Host "API is NOT responding after ~60s of retries." -ForegroundColor Red
    Write-Host "Check the iisnode logs:" -ForegroundColor Yellow
    Write-Host "  Get-ChildItem C:\inetpub\Ed-Fi\adminapp-api\iisnode | Sort LastWriteTime -Desc | Select -First 2 | Get-Content -Tail 30"
    Write-Host "And the IIS app pool state:" -ForegroundColor Yellow
    Write-Host "  Get-WebAppPoolState -Name EdFi-AdminApp-API"
    Write-Host ""
    throw "Install completed but the API smoke test failed. Fix the underlying issue and re-run install-all (idempotent), or run 04-deploy-api.ps1 directly to redeploy."
}

# ---------- Done ----------
Write-Phase "INSTALL COMPLETE"

$summary = @"
Ed-Fi Admin App -- Install Summary
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

Admin App
  URL:                https://localhost/adminapp/
  Sign in with:
    Email:            $AdminUsername
    Password:         $TestUserPassword

API
  URL:                https://localhost/adminapp-api/

Keycloak (Identity Provider)
  Admin console:      http://localhost:8080/admin/
  Sign in with:
    Username:         admin
    Password:         $KeycloakAdminPassword
  edfi realm:         http://localhost:8080/realms/edfi/
  Client secret:      $KeycloakClientSecret

SQL Server
  Server:             (local) / tcp:localhost,1433
  Login:              sa
  Password:           $SaPassword
  Database:           $DatabaseName

Notes
  - The HTTPS cert is self-signed and was added to Trusted Root by 02-prereqs-iis.ps1.
    If the browser still warns, fully close and reopen it once.
  - This file contains passwords in plaintext. Delete or protect it for non-dev use.
"@

# Print to console and persist alongside the source tree (one level above the
# scripts folder by default) so the user can recover values later. Lives
# outside the scripts folder because it's an install artifact, not a script.
Write-Host $summary -ForegroundColor Green
$summaryDir = Split-Path $SourcePath -Parent   # e.g., C:\Ed-Fi
if (-not (Test-Path $summaryDir)) { New-Item -ItemType Directory -Path $summaryDir -Force | Out-Null }
$summaryPath = Join-Path $summaryDir "install-summary.txt"
Set-Content -Path $summaryPath -Value $summary -Encoding UTF8
Write-Host ""
Write-Host "Saved to: $summaryPath" -ForegroundColor Cyan
