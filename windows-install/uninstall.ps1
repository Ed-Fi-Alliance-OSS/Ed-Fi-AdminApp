#Requires -RunAsAdministrator
<#
.SYNOPSIS
Reverses the Ed-Fi Admin App install. Leaves Node.js, JDK, SQL Server, and IIS
engines installed; removes only the AdminApp's own state.

.DESCRIPTION
Steps (each best-effort, continues past individual failures):

  1. Stop any running Keycloak process (kc.bat / java listening on :8080).
  2. IIS teardown (surgical by default — see -RemoveParentEdFiSite):
     - Stop+remove App Pool 'EdFi-AdminApp-API'.
     - Remove sub-applications /adminapp and /adminapp-api from the parent site.
     - Delete C:\inetpub\Ed-Fi\adminapp and \adminapp-api only.
     - Remove standalone site 'EdFi-AdminApp-FE' if present.
     With -RemoveParentEdFiSite, also:
     - Remove the parent site 'Ed-Fi' and its HTTPS:443 binding.
     - Remove SSL binding 0.0.0.0:443.
     - Delete the entire C:\inetpub\Ed-Fi tree.
     - Remove the 'Ed-Fi Dev Cert' from LocalMachine\My and \Root.
  3. Cert teardown: only when -RemoveParentEdFiSite is set (otherwise the cert
     may still be bound by sibling sites under the same parent).
  4. Database teardown (both engines, best-effort per engine):
     - MSSQL: DROP DATABASE [sbaa] using SQL Auth (sa + -SaPassword) if
       provided, else Windows Auth. Skipped when MSSQLSERVER isn't running.
       Leaves Mixed Mode / sa / TCP:1433 alone (instance-wide settings other
       apps may rely on).
     - PGSQL (docker): `docker compose down -v` from windows-install\docker so
       the data + cert volumes are removed. Skipped when no
       edfiadminapp-postgres container exists. Without the -v, the volume
       persists with the OLD edfiadminapp password and TypeORM-created
       tables, which causes auth/permission failures on the next install.
  4b. Yopass docker teardown (best-effort): `docker compose -f
     docker-compose.yopass.yml down -v` so the Yopass + memcached containers and
     their volumes are removed. Skipped when docker is absent or the
     edfiadminapp-yopass container was never created. Not gated by
     -KeepDatabase.
  5. Filesystem + env teardown:
     - Delete C:\keycloak (unless -KeepKeycloakDownload).
     - Delete C:\npm-cache (unless -KeepNpmCache).
     - Unset Machine env vars NPM_CONFIG_CACHE and JAVA_HOME.
  6. Print a summary of what succeeded and what didn't.

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
Default: C:\keycloak.

.PARAMETER NpmCachePath
Default: C:\npm-cache.

.PARAMETER AppPoolName
Default: EdFi-AdminApp-API.

.PARAMETER ParentSiteName
The IIS site under which AdminApp sub-apps were deployed. Default: Ed-Fi.

.PARAMETER StandaloneFeSiteName
Standalone FE site name (only present if 05 was run with -ParentSiteName "").
Default: EdFi-AdminApp-FE.

.PARAMETER CertFriendlyName
Default: Ed-Fi Dev Cert.

.PARAMETER InetpubPath
Root of deployed files. Default: C:\inetpub\Ed-Fi. With surgical (default)
removal, only $InetpubPath\adminapp and $InetpubPath\adminapp-api are deleted.

.PARAMETER RemoveParentEdFiSite
Switch — destructively remove the entire parent 'Ed-Fi' IIS site, its :443
SSL binding, the self-signed 'Ed-Fi Dev Cert', and the full $InetpubPath
directory tree. Use only when this AdminApp install was the sole occupant of
the 'Ed-Fi' site (e.g., a fresh dev VM). Without this flag, the parent site
and any sibling sub-applications (WebApi, AdminApi, SwaggerUI, etc.) are left
intact.

.PARAMETER KeepDatabase
Switch — skip the DROP DATABASE step.

.PARAMETER KeepKeycloakDownload
Switch — leave C:\keycloak in place (just stop the running process).

.PARAMETER KeepNpmCache
Switch — leave C:\npm-cache in place.

.PARAMETER KeepCert
Switch — leave the self-signed cert in the cert stores.

.PARAMETER RemoveSummary
Switch — also delete the install-summary.txt next to the repo (the file
install-all.ps1 wrote at the parent of the repo directory).

.PARAMETER Force
Switch — skip the confirmation prompt.

.EXAMPLE
.\uninstall.ps1
.\uninstall.ps1 -SaPassword 'EdFi-Local!2026' -Force
.\uninstall.ps1 -KeepDatabase -KeepKeycloakDownload
#>

param(
    [string]$DatabaseName = "sbaa",
    [string]$SaPassword,
    [string]$KeycloakInstallPath = "C:\keycloak",
    [string]$NpmCachePath = "C:\npm-cache",
    [string]$AppPoolName = "EdFi-AdminApp-API",
    [string]$ParentSiteName = "Ed-Fi",
    [string]$StandaloneFeSiteName = "EdFi-AdminApp-FE",
    [string]$CertFriendlyName = "Ed-Fi Dev Cert",
    [string]$InetpubPath = "C:\inetpub\Ed-Fi",
    # Summary is written by install-all.ps1 to the parent of the repo dir
    # (i.e. grandparent of windows-install\). Auto-resolve the same way.
    [string]$SummaryPath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "install-summary.txt"),

    [switch]$KeepDatabase,
    [switch]$KeepKeycloakDownload,
    [switch]$KeepNpmCache,
    [switch]$KeepCert,
    [switch]$RemoveSummary,
    [switch]$RemoveParentEdFiSite,
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
Write-Host "  - Running Keycloak process"
Write-Host "  - IIS App Pool '$AppPoolName'"
Write-Host "  - IIS sub-applications '/adminapp' and '/adminapp-api' under site '$ParentSiteName'"
Write-Host "  - Standalone site '$StandaloneFeSiteName' (if present)"
if ($RemoveParentEdFiSite) {
    Write-Host "  - Parent IIS site '$ParentSiteName' + SSL binding 0.0.0.0:443  (-RemoveParentEdFiSite)" -ForegroundColor Red
    Write-Host "  - Full directory tree $InetpubPath  (-RemoveParentEdFiSite)" -ForegroundColor Red
    if (-not $KeepCert) {
        Write-Host "  - Self-signed cert '$CertFriendlyName' from LocalMachine\My and \Root  (-RemoveParentEdFiSite)" -ForegroundColor Red
    }
} else {
    Write-Host "  - Deployed files under $InetpubPath\adminapp and $InetpubPath\adminapp-api ONLY"
    Write-Host "    (parent '$ParentSiteName' site, its sibling sub-apps, the :443 binding, and"
    Write-Host "     '$CertFriendlyName' are LEFT INTACT. Pass -RemoveParentEdFiSite to wipe them.)" -ForegroundColor DarkGray
}
if (-not $KeepDatabase)         {
    Write-Host "  - SQL database [$DatabaseName] (if MSSQLSERVER is running)"
    Write-Host "  - Docker postgres container + volumes (if edfiadminapp-postgres exists)"
}
Write-Host "  - Docker Yopass stack (edfiadminapp-yopass + memcached) and its volumes (if present)"
if (-not $KeepKeycloakDownload) { Write-Host "  - $KeycloakInstallPath (Keycloak install dir)" }
if (-not $KeepNpmCache)         { Write-Host "  - $NpmCachePath (npm cache dir)" }
Write-Host "  - Machine env vars NPM_CONFIG_CACHE and JAVA_HOME"
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
Write-Section "1. Stop Keycloak"
# ========================================================
$kcStopped = $false
$killedPids = @{}

# Find Keycloak by command line: java.exe whose args reference kc.bat / quarkus / keycloak.
# Doing this first (rather than the :8080 listener) avoids killing some unrelated
# app that happens to be bound to 8080.
try {
    $kcJava = Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'kc\.bat|keycloak|quarkus' }
    foreach ($p in $kcJava) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        $killedPids[$p.ProcessId] = $true
        Record "Stop java.exe PID $($p.ProcessId)" "OK" "Keycloak match in cmdline"
        $kcStopped = $true
    }
} catch {
    Record "Stop java.exe (Keycloak)" "WARN" $_.Exception.Message
}

# Belt and braces: anything still listening on :8080 that's a java.exe gets stopped too.
# Other processes on :8080 are left alone (could be unrelated -- not ours to kill).
try {
    $listenerPid = (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
    if ($listenerPid -and -not $killedPids.ContainsKey($listenerPid)) {
        $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq 'java') {
            Stop-Process -Id $listenerPid -Force -ErrorAction Stop
            Record "Stop java.exe listener on :8080 (PID $listenerPid)" "OK"
            $kcStopped = $true
        } elseif ($proc) {
            Record "Listener on :8080 is $($proc.ProcessName) (PID $listenerPid)" "SKIP" "Not java.exe -- leaving alone"
        }
    }
} catch {
    Record "Stop :8080 listener" "WARN" $_.Exception.Message
}

if (-not $kcStopped) {
    Record "Stop Keycloak" "SKIP" "No matching java.exe process found"
}

# ========================================================
Write-Section "2. IIS teardown"
# ========================================================
$iisAvailable = $false
try {
    Import-Module WebAdministration -ErrorAction Stop
    $iisAvailable = $true
} catch {
    Record "Load WebAdministration" "WARN" "IIS module unavailable -- skipping IIS steps"
}

if ($iisAvailable) {
    # Remove sub-applications under the parent site (so the site can be removed cleanly)
    foreach ($alias in @('adminapp-api', 'adminapp')) {
        try {
            $app = Get-WebApplication -Site $ParentSiteName -Name $alias -ErrorAction SilentlyContinue
            if ($app) {
                Remove-WebApplication -Site $ParentSiteName -Name $alias -ErrorAction Stop
                Record "Remove IIS application '/$alias' under '$ParentSiteName'" "OK"
            } else {
                Record "IIS application '/$alias' under '$ParentSiteName'" "SKIP" "Not present"
            }
        } catch {
            Record "Remove IIS application '/$alias'" "FAIL" $_.Exception.Message
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

    # Remove parent site (Ed-Fi). Destructive — takes every other sub-application
    # under '$ParentSiteName' (WebApi, AdminApi, SwaggerUI, etc.) down with it.
    # Gated behind -RemoveParentEdFiSite so shared-site installs are safe by default.
    if ($RemoveParentEdFiSite) {
        try {
            $site = Get-Website -Name $ParentSiteName -ErrorAction SilentlyContinue
            if ($site) {
                if ($site.State -eq 'Started') {
                    Stop-Website -Name $ParentSiteName -ErrorAction SilentlyContinue
                }
                Remove-Website -Name $ParentSiteName -ErrorAction Stop
                Record "Remove IIS site '$ParentSiteName'" "OK" "-RemoveParentEdFiSite"
            } else {
                Record "IIS site '$ParentSiteName'" "SKIP" "Not present"
            }
        } catch {
            Record "Remove IIS site '$ParentSiteName'" "FAIL" $_.Exception.Message
        }
    } else {
        Record "Remove IIS site '$ParentSiteName'" "SKIP" "Surgical mode -- sibling apps preserved (pass -RemoveParentEdFiSite to wipe)"
    }

    # Remove standalone FE site (only present if 05 was run with -ParentSiteName "")
    try {
        $feSite = Get-Website -Name $StandaloneFeSiteName -ErrorAction SilentlyContinue
        if ($feSite) {
            if ($feSite.State -eq 'Started') {
                Stop-Website -Name $StandaloneFeSiteName -ErrorAction SilentlyContinue
            }
            Remove-Website -Name $StandaloneFeSiteName -ErrorAction Stop
            Record "Remove IIS site '$StandaloneFeSiteName'" "OK"
        } else {
            Record "IIS site '$StandaloneFeSiteName'" "SKIP" "Not present (standalone FE wasn't used)"
        }
    } catch {
        Record "Remove IIS site '$StandaloneFeSiteName'" "FAIL" $_.Exception.Message
    }

    # SSL binding 0.0.0.0:443 (added by 01-prereqs-iis.ps1's AddSslCertificate call).
    # The binding may still be referenced by surviving sibling sites under the
    # same parent, so it's only removed when -RemoveParentEdFiSite is set.
    if ($RemoveParentEdFiSite) {
        try {
            $sslBinding = Get-Item "IIS:\SslBindings\0.0.0.0!443" -ErrorAction SilentlyContinue
            if ($sslBinding) {
                Remove-Item "IIS:\SslBindings\0.0.0.0!443" -Force -ErrorAction Stop
                Record "Remove SSL binding 0.0.0.0:443" "OK" "-RemoveParentEdFiSite"
            } else {
                Record "SSL binding 0.0.0.0:443" "SKIP" "Not present"
            }
        } catch {
            Record "Remove SSL binding" "FAIL" $_.Exception.Message
        }
    } else {
        Record "Remove SSL binding 0.0.0.0:443" "SKIP" "Surgical mode -- siblings may still need it"
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

# Deployed file trees under $InetpubPath. In surgical mode (default) we only
# delete the two subdirs the install created; the parent dir and any sibling
# subdirs (WebApi, AdminApi, SwaggerUI, ...) are left in place.
if ($RemoveParentEdFiSite) {
    try {
        if (Test-Path $InetpubPath) {
            Remove-Item -Path $InetpubPath -Recurse -Force -ErrorAction Stop
            Record "Delete $InetpubPath" "OK" "-RemoveParentEdFiSite (full tree)"
        } else {
            Record "Delete $InetpubPath" "SKIP" "Not present"
        }
    } catch {
        Record "Delete $InetpubPath" "FAIL" $_.Exception.Message
    }
} else {
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
    # If the parent directory ended up empty (no siblings present), clean it up
    # too -- but don't fail if it isn't empty.
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
            Record "Delete $InetpubPath" "SKIP" "Surgical mode -- $($remaining.Count) sibling entry(ies) remain"
        }
    }
}

# ========================================================
Write-Section "3. Self-signed cert"
# ========================================================
# The cert is bound to 0.0.0.0:443 and may still be referenced by surviving
# sibling sites under the parent. In surgical mode (default) we keep it.
if ($KeepCert) {
    Record "Remove cert '$CertFriendlyName'" "SKIP" "-KeepCert"
} elseif (-not $RemoveParentEdFiSite) {
    Record "Remove cert '$CertFriendlyName'" "SKIP" "Surgical mode -- siblings may still bind to it (pass -RemoveParentEdFiSite to remove)"
} else {
    foreach ($store in @('My', 'Root')) {
        try {
            $certs = Get-ChildItem "Cert:\LocalMachine\$store" -ErrorAction SilentlyContinue |
                Where-Object { $_.FriendlyName -eq $CertFriendlyName }
            if ($certs) {
                foreach ($c in $certs) {
                    Remove-Item -Path "Cert:\LocalMachine\$store\$($c.Thumbprint)" -Force -ErrorAction Stop
                    Record "Remove cert from \$store" "OK" "Thumbprint $($c.Thumbprint)"
                }
            } else {
                Record "Cert in \$store" "SKIP" "No cert with FriendlyName '$CertFriendlyName'"
            }
        } catch {
            Record "Remove cert from \$store" "FAIL" $_.Exception.Message
        }
    }
}

# ========================================================
Write-Section "4. Database (mssql and/or pgsql docker)"
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
Write-Section "4b. Yopass (docker stack)"
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
Write-Section "5. Filesystem + env vars"
# ========================================================
# Keycloak install dir
if ($KeepKeycloakDownload) {
    Record "Delete $KeycloakInstallPath" "SKIP" "-KeepKeycloakDownload"
} elseif (Test-Path $KeycloakInstallPath) {
    try {
        Remove-Item -Path $KeycloakInstallPath -Recurse -Force -ErrorAction Stop
        Record "Delete $KeycloakInstallPath" "OK"
    } catch {
        Record "Delete $KeycloakInstallPath" "FAIL" $_.Exception.Message
    }
} else {
    Record "Delete $KeycloakInstallPath" "SKIP" "Not present"
}

# npm cache
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

# Env vars
foreach ($var in @('NPM_CONFIG_CACHE', 'JAVA_HOME')) {
    try {
        $cur = [Environment]::GetEnvironmentVariable($var, "Machine")
        if ($cur) {
            [Environment]::SetEnvironmentVariable($var, $null, "Machine")
            Record "Unset Machine env $var" "OK" "Was: $cur"
        } else {
            Record "Unset Machine env $var" "SKIP" "Not set"
        }
    } catch {
        Record "Unset Machine env $var" "FAIL" $_.Exception.Message
    }
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
    Write-Host "Open a fresh PowerShell window to pick up the cleared env vars before re-installing." -ForegroundColor Yellow
    exit 0
}
