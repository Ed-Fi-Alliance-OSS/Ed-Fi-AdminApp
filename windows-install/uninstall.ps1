#Requires -RunAsAdministrator
<#
.SYNOPSIS
Reverses the Ed-Fi Admin App install. Leaves Node.js, JDK, SQL Server, and IIS
engines installed; removes only the AdminApp's own state.

.DESCRIPTION
Steps (each best-effort, continues past individual failures):

  1. IIS teardown:
     - Remove the standalone sites 'EdFi-AdminApp-API' and 'EdFi-AdminApp-FE'.
     - Stop+remove App Pool 'EdFi-AdminApp-API'.
     - Scrub a leftover global iisnode-all handler from applicationHost.config.
     - Delete C:\inetpub\Ed-Fi\adminapp and \adminapp-api (and the parent dir
       if it ends up empty).
  2. Database teardown (both engines, best-effort per engine):
     - MSSQL: DROP DATABASE [sbaa] using SQL Auth (sa + -SaPassword) if
       provided, else Windows Auth. Skipped when MSSQLSERVER isn't running.
       Leaves Mixed Mode / sa / TCP:1433 alone (instance-wide settings other
       apps may rely on).
     - PGSQL (docker): `docker compose down -v` from windows-install\docker so
       the data + cert volumes are removed. Skipped when no
       edfiadminapp-postgres container exists. Without the -v, the volume
       persists with the OLD edfiadminapp password and TypeORM-created
       tables, which causes auth/permission failures on the next install.
  2b. Yopass docker teardown (best-effort): `docker compose -f
     docker-compose.yopass.yml down -v` so the Yopass + memcached containers and
     their volumes are removed. Skipped when docker is absent or the
     edfiadminapp-yopass container was never created. Not gated by
     -KeepDatabase.
  3. Filesystem teardown:
     - Delete C:\npm-cache (unless -KeepNpmCache). The NPM_CONFIG_CACHE override
       is set on the App Pool by 05-deploy-api and is removed with the pool.
  4. Detect Keycloak leftovers (C:\keycloak, JAVA_HOME, a running Keycloak
     process) and, if any are found, suggest running uninstall-keycloak.ps1.
     Informational only -- this step does not stop or delete anything.
  5. Print a summary of what succeeded and what didn't.

The local Keycloak IdP (process, C:\keycloak, JAVA_HOME) is NOT touched here.
Use uninstall-keycloak.ps1 for that.

Does NOT touch:
  - Node.js, JDK, SQL Server, IIS engine installs.
  - URL Rewrite Module, iisnode (system-level MSIs).
  - The cloned source repo (wherever this script lives — the repo root is the
    parent of windows-install\).
  - install-summary.txt next to the repo (run with -RemoveSummary to delete).

Prompts for confirmation by default. Pass -Force for non-interactive runs.

.PARAMETER DatabaseName
Database to drop. Default: sbaa. Must match what 02-prereqs-sql.ps1 created.

.PARAMETER SaPassword
SQL sa password. If provided, the DB drop uses SQL Auth over TCP. If omitted,
the script falls back to Windows Auth via (local).

.PARAMETER KeycloakInstallPath
Path checked for Keycloak leftovers (informational only; this script does not
delete it). Default: C:\keycloak.

.PARAMETER NpmCachePath
Default: C:\npm-cache.

.PARAMETER AppPoolName
Default: EdFi-AdminApp-API.

.PARAMETER StandaloneFeSiteName
Name of the FE site created by 06-deploy-fe.ps1. Default: EdFi-AdminApp-FE.
(The API site name is the App Pool name, $AppPoolName.)

.PARAMETER InetpubPath
Root of deployed files. Default: C:\inetpub\Ed-Fi. Only $InetpubPath\adminapp
and $InetpubPath\adminapp-api are deleted (plus the parent dir if it ends up
empty).

.PARAMETER KeepDatabase
Switch — skip the DROP DATABASE step.

.PARAMETER KeepNpmCache
Switch — leave C:\npm-cache in place.

.PARAMETER RemoveSummary
Switch — also delete the install-summary.txt next to the repo (the file
install-all.ps1 wrote at the parent of the repo directory).

.PARAMETER Force
Switch — skip the confirmation prompt.

.EXAMPLE
.\uninstall.ps1
.\uninstall.ps1 -SaPassword 'EdFi-Local!2026' -Force
.\uninstall.ps1 -KeepDatabase -KeepNpmCache
#>

param(
    [string]$DatabaseName = "sbaa",
    [string]$SaPassword,
    [string]$KeycloakInstallPath = "C:\keycloak",
    [string]$NpmCachePath = "C:\npm-cache",
    [string]$AppPoolName = "EdFi-AdminApp-API",
    [string]$StandaloneFeSiteName = "EdFi-AdminApp-FE",
    [string]$InetpubPath = "C:\inetpub\Ed-Fi",
    # Summary is written by install-all.ps1 to the parent of the repo dir
    # (i.e. grandparent of windows-install\). Auto-resolve the same way.
    [string]$SummaryPath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "install-summary.txt"),

    [switch]$KeepDatabase,
    [switch]$KeepNpmCache,
    [switch]$RemoveSummary,
    [switch]$Force
)

# Don't bail on the first non-terminating error -- this is a teardown, we want
# to push through and report at the end.
$ErrorActionPreference = 'Continue'

$results = [System.Collections.Generic.List[object]]::new()
function Record {
    param([string]$Step, [string]$Status, [string]$Detail)
    $results.Add([pscustomobject]@{ Step = $Step; Status = $Status; Detail = $Detail })
    $color = switch ($Status) {
        'OK'    { 'Green' }
        'SKIP'  { 'DarkGray' }
        'WARN'  { 'Yellow' }
        'FAIL'  { 'Red' }
        default { 'White' }
    }
    Write-Host ("[{0,-4}] {1}" -f $Status, $Step) -ForegroundColor $color -NoNewline
    if ($Detail) { Write-Host "  -- $Detail" -ForegroundColor DarkGray } else { Write-Host "" }
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("-" * $Title.Length) -ForegroundColor Cyan
}

# Confirmation
Write-Host ""
Write-Host "Ed-Fi Admin App -- UNINSTALL" -ForegroundColor Magenta
Write-Host "This will remove:"
Write-Host "  - Standalone IIS sites '$AppPoolName' (API) and '$StandaloneFeSiteName' (FE)"
Write-Host "  - IIS App Pool '$AppPoolName'"
Write-Host "  - Deployed files under $InetpubPath\adminapp and $InetpubPath\adminapp-api"
if (-not $KeepDatabase)         {
    Write-Host "  - SQL database [$DatabaseName] (if MSSQLSERVER is running)"
    Write-Host "  - Docker postgres container + volumes (if edfiadminapp-postgres exists)"
}
Write-Host "  - Docker Yopass stack (edfiadminapp-yopass + memcached) and its volumes (if present)"
if (-not $KeepNpmCache)         { Write-Host "  - $NpmCachePath (npm cache dir)" }
if ($RemoveSummary)             { Write-Host "  - $SummaryPath" }
Write-Host ""
Write-Host "Leaves alone: Node.js, JDK, SQL Server, IIS, URL Rewrite, iisnode, source repo." -ForegroundColor DarkGray
Write-Host ""

if (-not $Force) {
    $reply = Read-Host "Proceed? (y/N)"
    if ($reply -notmatch '^[Yy]') {
        Write-Host "Aborted." -ForegroundColor Yellow
        return
    }
}

# ========================================================
Write-Section "1. IIS teardown"
# ========================================================
$iisAvailable = $false
try {
    Import-Module WebAdministration -ErrorAction Stop
    $iisAvailable = $true
} catch {
    Record "Load WebAdministration" "WARN" "IIS module unavailable -- skipping IIS steps"
}

if ($iisAvailable) {
    # Remove the two standalone AdminApp sites (API named after the App Pool, FE).
    foreach ($siteName in @($AppPoolName, $StandaloneFeSiteName)) {
        try {
            $site = Get-Website -Name $siteName -ErrorAction SilentlyContinue
            if ($site) {
                if ($site.State -eq 'Started') {
                    Stop-Website -Name $siteName -ErrorAction SilentlyContinue
                }
                Remove-Website -Name $siteName -ErrorAction Stop
                Record "Remove IIS site '$siteName'" "OK"
            } else {
                Record "IIS site '$siteName'" "SKIP" "Not present"
            }
        } catch {
            Record "Remove IIS site '$siteName'" "FAIL" $_.Exception.Message
        }
    }

    # Stop + remove App Pool
    try {
        if (Test-Path "IIS:\AppPools\$AppPoolName") {
            $state = (Get-WebAppPoolState -Name $AppPoolName -ErrorAction SilentlyContinue).Value
            if ($state -eq 'Started') {
                Stop-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue
            }
            Remove-WebAppPool -Name $AppPoolName -ErrorAction Stop
            Record "Remove App Pool '$AppPoolName'" "OK"
        } else {
            Record "App Pool '$AppPoolName'" "SKIP" "Not present"
        }
    } catch {
        Record "Remove App Pool '$AppPoolName'" "FAIL" $_.Exception.Message
    }
}

# Scrub the global iisnode-all handler from applicationHost.config. The standard
# iisnode MSI only registers an "iisnode" handler for *.js; "iisnode-all" with
# path="*" is a leftover from prior install attempts or manual experimentation
# and routes every request through node.exe, breaking sibling IIS sites.
try {
    $appcmdPath = "$env:SystemRoot\System32\inetsrv\appcmd.exe"
    if (-not (Test-Path $appcmdPath)) {
        Record "Scrub global iisnode-all handler" "SKIP" "appcmd.exe not found"
    } else {
        $handlerList = & $appcmdPath list config /section:handlers 2>$null
        $hasGlobal = $handlerList -match 'name="iisnode-all"'
        if (-not $hasGlobal) {
            Record "Global iisnode-all handler" "SKIP" "Not present in applicationHost.config"
        } else {
            & $appcmdPath set config -section:system.webServer/handlers "/-[name='iisnode-all']" /commit:apphost | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Record "Remove global iisnode-all handler" "OK" "applicationHost.config"
            } else {
                Record "Remove global iisnode-all handler" "FAIL" "appcmd exit $LASTEXITCODE"
            }
        }
    }
} catch {
    Record "Scrub global iisnode-all handler" "FAIL" $_.Exception.Message
}

# Deployed file trees. Delete the two subdirs the install created; if the parent
# dir ends up empty, remove it too (but don't fail if it isn't empty).
foreach ($sub in @('adminapp-api', 'adminapp')) {
    $subPath = Join-Path $InetpubPath $sub
    try {
        if (Test-Path $subPath) {
            Remove-Item -Path $subPath -Recurse -Force -ErrorAction Stop
            Record "Delete $subPath" "OK"
        } else {
            Record "Delete $subPath" "SKIP" "Not present"
        }
    } catch {
        Record "Delete $subPath" "FAIL" $_.Exception.Message
    }
}
if (Test-Path $InetpubPath) {
    $remaining = @(Get-ChildItem -LiteralPath $InetpubPath -Force -ErrorAction SilentlyContinue)
    if ($remaining.Count -eq 0) {
        try {
            Remove-Item -Path $InetpubPath -Force -ErrorAction Stop
            Record "Delete empty $InetpubPath" "OK"
        } catch {
            Record "Delete empty $InetpubPath" "WARN" $_.Exception.Message
        }
    } else {
        Record "Delete $InetpubPath" "SKIP" "$($remaining.Count) other entry(ies) remain"
    }
}

# ========================================================
Write-Section "2. Database (mssql and/or pgsql docker)"
# ========================================================
# Try SQL Server first (drop the AdminApp DB if present), then the docker
# postgres compose down. Both branches are best-effort and idempotent -- they
# SKIP cleanly when their respective engine isn't actually in use on this box.
# -KeepDatabase short-circuits both.
if ($KeepDatabase) {
    Record "Drop database [$DatabaseName]" "SKIP" "-KeepDatabase"
    Record "Docker postgres down -v" "SKIP" "-KeepDatabase"
} else {
    # --- mssql ----------------------------------------------------------------
    $sqlcmdAvailable = $null -ne (Get-Command sqlcmd -ErrorAction SilentlyContinue)
    $msSqlRunning = $null -ne (Get-Service MSSQLSERVER -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' })
    if (-not $sqlcmdAvailable -or -not $msSqlRunning) {
        Record "Drop database [$DatabaseName] (mssql)" "SKIP" $(if (-not $msSqlRunning) { "MSSQLSERVER not running" } else { "sqlcmd not on PATH" })
    } else {
        # SET SINGLE_USER ROLLBACK IMMEDIATE forces existing connections off
        # before the DROP. Without it the drop fails when iisnode still has a
        # pool open (e.g., if the App Pool removal above didn't terminate the
        # node process cleanly).
        $dropQuery = @"
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = N'$DatabaseName')
BEGIN
    ALTER DATABASE [$DatabaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$DatabaseName];
END
"@
        $authArgs = if ($SaPassword) {
            @("-S", "tcp:localhost,1433", "-U", "sa", "-P", $SaPassword)
        } else {
            @("-S", "(local)", "-E")
        }
        try {
            & sqlcmd @authArgs -Q $dropQuery -t 30 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $authMode = if ($SaPassword) { "SQL Auth" } else { "Windows Auth" }
                Record "Drop database [$DatabaseName] (mssql)" "OK" $authMode
            } else {
                Record "Drop database [$DatabaseName] (mssql)" "FAIL" "sqlcmd exit $LASTEXITCODE"
            }
        } catch {
            Record "Drop database [$DatabaseName] (mssql)" "FAIL" $_.Exception.Message
        }
    }

    # --- pgsql docker ---------------------------------------------------------
    # Run `docker compose down -v` from windows-install\docker so the persisted
    # data + cert volumes are removed. Without -v the volume keeps the OLD
    # edfiadminapp password and any tables created by an earlier TypeORM run,
    # which causes auth/permission failures on the next install.
    $dockerDir = Join-Path $PSScriptRoot "docker"
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Record "Docker postgres down -v" "SKIP" "docker not on PATH"
    } elseif (-not (Test-Path "$dockerDir\docker-compose.yml")) {
        Record "Docker postgres down -v" "SKIP" "docker-compose.yml not found at $dockerDir"
    } else {
        # Only act if the compose stack has actually been brought up before
        # (container exists, even if stopped). Otherwise SKIP cleanly.
        $containerExists = $false
        try {
            $found = & docker ps -a --filter "name=^edfiadminapp-postgres$" --format "{{.Names}}" 2>$null
            if ($found -match 'edfiadminapp-postgres') { $containerExists = $true }
        } catch { }
        if (-not $containerExists) {
            Record "Docker postgres down -v" "SKIP" "edfiadminapp-postgres container not present"
        } else {
            Push-Location $dockerDir
            try {
                & docker compose down -v 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Record "Docker postgres down -v" "OK" "Container + data/cert volumes removed"
                } else {
                    Record "Docker postgres down -v" "FAIL" "docker compose exit $LASTEXITCODE"
                }
            } catch {
                Record "Docker postgres down -v" "FAIL" $_.Exception.Message
            } finally {
                Pop-Location
            }
        }
    }
}

# ========================================================
Write-Section "2b. Yopass (docker stack)"
# ========================================================
# Tear down the dockerized Yopass stack if it was ever brought up (by
# yopass-docker.ps1 / install-all -SetupYopassDocker). Best-effort and
# idempotent: SKIPs cleanly when docker is absent or the container was never
# created. Not gated by -KeepDatabase -- Yopass is not the AdminApp database.
# `down -v` also removes the memcached-backed secret store volume(s).
$yopassCompose = Join-Path (Join-Path $PSScriptRoot "docker") "docker-compose.yopass.yml"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Record "Docker yopass down -v" "SKIP" "docker not on PATH"
} elseif (-not (Test-Path $yopassCompose)) {
    Record "Docker yopass down -v" "SKIP" "docker-compose.yopass.yml not found"
} else {
    $yopassExists = $false
    try {
        $found = & docker ps -a --filter "name=^edfiadminapp-yopass$" --format "{{.Names}}" 2>$null
        if ($found -match 'edfiadminapp-yopass') { $yopassExists = $true }
    } catch { }
    if (-not $yopassExists) {
        Record "Docker yopass down -v" "SKIP" "edfiadminapp-yopass container not present"
    } else {
        Push-Location (Split-Path $yopassCompose -Parent)
        try {
            & docker compose -f $yopassCompose down -v 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Record "Docker yopass down -v" "OK" "Yopass + memcached containers/volumes removed"
            } else {
                Record "Docker yopass down -v" "FAIL" "docker compose exit $LASTEXITCODE"
            }
        } catch {
            Record "Docker yopass down -v" "FAIL" $_.Exception.Message
        } finally {
            Pop-Location
        }
    }
}

# ========================================================
Write-Section "3. Filesystem"
# ========================================================
# npm cache. The NPM_CONFIG_CACHE override is set on the App Pool by
# 05-deploy-api and is removed with the App Pool above; nothing machine-wide
# to unset here.
if ($KeepNpmCache) {
    Record "Delete $NpmCachePath" "SKIP" "-KeepNpmCache"
} elseif (Test-Path $NpmCachePath) {
    try {
        Remove-Item -Path $NpmCachePath -Recurse -Force -ErrorAction Stop
        Record "Delete $NpmCachePath" "OK"
    } catch {
        Record "Delete $NpmCachePath" "FAIL" $_.Exception.Message
    }
} else {
    Record "Delete $NpmCachePath" "SKIP" "Not present"
}

# Optional: install-summary.txt
if ($RemoveSummary) {
    if (Test-Path $SummaryPath) {
        try {
            Remove-Item -Path $SummaryPath -Force -ErrorAction Stop
            Record "Delete $SummaryPath" "OK"
        } catch {
            Record "Delete $SummaryPath" "FAIL" $_.Exception.Message
        }
    } else {
        Record "Delete $SummaryPath" "SKIP" "Not present"
    }
}

# ========================================================
Write-Section "4. Keycloak leftovers (informational)"
# ========================================================
# This script does not touch the local Keycloak IdP. If leftovers from
# idp-keycloak-setup.ps1 are present, point the user at uninstall-keycloak.ps1.
# Informational only -- nothing here is stopped or deleted.
$kcLeftovers = @()
if (Test-Path $KeycloakInstallPath) { $kcLeftovers += "install dir $KeycloakInstallPath" }
if ([Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")) { $kcLeftovers += "Machine JAVA_HOME" }
try {
    $kcProc = Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'kc\.bat|keycloak|quarkus' }
    if ($kcProc) { $kcLeftovers += "running Keycloak process" }
} catch { }
if ($kcLeftovers.Count -gt 0) {
    Write-Host "Keycloak leftovers detected: $($kcLeftovers -join '; ')" -ForegroundColor Yellow
    Write-Host "These were NOT removed. Run uninstall-keycloak.ps1 to remove the local Keycloak IdP." -ForegroundColor Yellow
} else {
    Write-Host "No Keycloak leftovers detected." -ForegroundColor DarkGray
}

# ========================================================
Write-Section "Summary"
# ========================================================
$ok    = ($results | Where-Object { $_.Status -eq 'OK' }).Count
$skip  = ($results | Where-Object { $_.Status -eq 'SKIP' }).Count
$warn  = ($results | Where-Object { $_.Status -eq 'WARN' }).Count
$fail  = ($results | Where-Object { $_.Status -eq 'FAIL' }).Count
Write-Host "OK: $ok   SKIP: $skip   WARN: $warn   FAIL: $fail"
Write-Host ""

if ($fail -gt 0) {
    Write-Host "Some steps failed. Re-run the script to retry, or address the underlying issue:" -ForegroundColor Red
    $results | Where-Object { $_.Status -eq 'FAIL' } | ForEach-Object {
        Write-Host "  - $($_.Step): $($_.Detail)" -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "Uninstall complete." -ForegroundColor Green
    exit 0
}
