#Requires -RunAsAdministrator
<#
.SYNOPSIS
Reverses the Ed-Fi Admin App install. Leaves Node.js, JDK, SQL Server, and IIS
engines installed; removes only the AdminApp's own state.

.DESCRIPTION
Steps (each best-effort, continues past individual failures):

  1. Stop any running Keycloak process (kc.bat / java listening on :8080).
  2. IIS teardown:
     - Stop+remove App Pool 'EdFi-AdminApp-API'.
     - Remove sub-applications /adminapp and /adminapp-api from the parent site.
     - Remove the parent site 'Ed-Fi' and its HTTPS:443 binding.
     - Remove standalone site 'EdFi-AdminApp-FE' if present.
     - Remove SSL binding 0.0.0.0:443.
     - Delete deployed file trees under C:\inetpub\Ed-Fi.
  3. Cert teardown: remove 'Ed-Fi Dev Cert' from LocalMachine\My and \Root.
  4. SQL teardown: DROP DATABASE [sbaa] (or -DatabaseName) using SQL Auth (sa +
     -SaPassword) if provided, else Windows Auth. Leaves Mixed Mode / sa /
     TCP:1433 alone (instance-wide settings other apps may rely on).
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
Database to drop. Default: sbaa. Must match what 01-prereqs-sql.ps1 created.

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
Root of deployed files. Default: C:\inetpub\Ed-Fi.

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
Write-Host "  - IIS App Pool '$AppPoolName', site '$ParentSiteName', site '$StandaloneFeSiteName'"
Write-Host "  - Deployed files under $InetpubPath"
if (-not $KeepCert)             { Write-Host "  - Self-signed cert '$CertFriendlyName' from LocalMachine\My and \Root" }
if (-not $KeepDatabase)         { Write-Host "  - SQL database [$DatabaseName]" }
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

    # Remove parent site (Ed-Fi)
    try {
        $site = Get-Website -Name $ParentSiteName -ErrorAction SilentlyContinue
        if ($site) {
            if ($site.State -eq 'Started') {
                Stop-Website -Name $ParentSiteName -ErrorAction SilentlyContinue
            }
            Remove-Website -Name $ParentSiteName -ErrorAction Stop
            Record "Remove IIS site '$ParentSiteName'" "OK"
        } else {
            Record "IIS site '$ParentSiteName'" "SKIP" "Not present"
        }
    } catch {
        Record "Remove IIS site '$ParentSiteName'" "FAIL" $_.Exception.Message
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

    # SSL binding 0.0.0.0:443 (added by 02-prereqs-iis.ps1's AddSslCertificate call)
    try {
        $sslBinding = Get-Item "IIS:\SslBindings\0.0.0.0!443" -ErrorAction SilentlyContinue
        if ($sslBinding) {
            Remove-Item "IIS:\SslBindings\0.0.0.0!443" -Force -ErrorAction Stop
            Record "Remove SSL binding 0.0.0.0:443" "OK"
        } else {
            Record "SSL binding 0.0.0.0:443" "SKIP" "Not present"
        }
    } catch {
        Record "Remove SSL binding" "FAIL" $_.Exception.Message
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

# Deployed file trees under C:\inetpub\Ed-Fi
try {
    if (Test-Path $InetpubPath) {
        Remove-Item -Path $InetpubPath -Recurse -Force -ErrorAction Stop
        Record "Delete $InetpubPath" "OK"
    } else {
        Record "Delete $InetpubPath" "SKIP" "Not present"
    }
} catch {
    Record "Delete $InetpubPath" "FAIL" $_.Exception.Message
}

# ========================================================
Write-Section "3. Self-signed cert"
# ========================================================
if ($KeepCert) {
    Record "Remove cert '$CertFriendlyName'" "SKIP" "-KeepCert"
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
Write-Section "4. SQL database"
# ========================================================
if ($KeepDatabase) {
    Record "Drop database [$DatabaseName]" "SKIP" "-KeepDatabase"
} else {
    $sqlcmdAvailable = $null -ne (Get-Command sqlcmd -ErrorAction SilentlyContinue)
    if (-not $sqlcmdAvailable) {
        Record "Drop database [$DatabaseName]" "WARN" "sqlcmd not on PATH"
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
            $sqlOutput = & sqlcmd @authArgs -Q $dropQuery -t 30 2>&1
            if ($LASTEXITCODE -eq 0) {
                $authMode = if ($SaPassword) { "SQL Auth" } else { "Windows Auth" }
                Record "Drop database [$DatabaseName]" "OK" $authMode
            } else {
                $lastLine = ($sqlOutput | Where-Object { $_ -and "$_".Trim() } | Select-Object -Last 1)
                $detail = "sqlcmd exit $LASTEXITCODE"
                if ($lastLine) { $detail = "$detail -- $lastLine" }
                Record "Drop database [$DatabaseName]" "FAIL" $detail
            }
        } catch {
            Record "Drop database [$DatabaseName]" "FAIL" $_.Exception.Message
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
