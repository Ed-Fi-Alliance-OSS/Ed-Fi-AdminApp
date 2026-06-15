#Requires -RunAsAdministrator
<#
.SYNOPSIS
Installs/verifies Node.js, remediating a too-old version via nvm-windows when
necessary.

.DESCRIPTION
This is the only runtime prerequisite the generic Admin App install needs. Java
and Keycloak are NOT installed here; they live in idp-keycloak-setup.ps1 (the
optional local-IdP example path).

Order of operations (all idempotent):
  1. If a too-old Node is already on PATH, set up nvm-windows and switch to a
     current LTS, keeping the previous version recoverable via 'nvm install'.
     The required major is auto-detected from the repo's package.json
     engines.node when available.
  2. If Node is missing, install Node.js LTS via winget.

The npm cache override the App Pool needs under iisnode is configured by
05-deploy-api.ps1 (scoped to the App Pool), not here.

.PARAMETER SourcePath
The cloned AdminApp repo. When package.json exists there, engines.node is parsed
and used as the floor + nvm install target. Defaults to the parent of the script
directory (this script lives in <repo>\windows-install\).

.PARAMETER MinNodeMajor
Floor enforced when package.json detection fails. Default: 22.

.PARAMETER NodeLtsVersion
Node version spec to install via nvm when remediating. Default: "22" (bare
major -- nvm resolves to the latest patch on that line). When package.json
detection succeeds, this is overridden with the detected major.

.PARAMETER AssumeYes
Switch -- bypass the y/N prompt and proceed with the nvm-windows upgrade. For
non-interactive runs (CI, install-all -AutoUpgradeNode).

.EXAMPLE
.\03-prereqs-node.ps1
.\03-prereqs-node.ps1 -AssumeYes
#>

param(
    [string]$SourcePath = (Split-Path $PSScriptRoot -Parent),
    [int]$MinNodeMajor = 22,
    [string]$NodeLtsVersion = "22",
    [switch]$AssumeYes
)

$ErrorActionPreference = 'Stop'

# Auto-detect Node floor + install target from the repo's engines.node when
# available. nvm-windows accepts bare-major versions (e.g., 'nvm install 22'),
# which resolves to the latest 22.x release.
$pkgJsonPath = Join-Path $SourcePath 'package.json'
if (Test-Path $pkgJsonPath) {
    try {
        $engineSpec = (Get-Content $pkgJsonPath -Raw | ConvertFrom-Json).engines.node
        if ($engineSpec -and $engineSpec -match '(\d+)') {
            $detected = [int]$Matches[1]
            $MinNodeMajor = $detected
            $NodeLtsVersion = "$detected"   # let nvm pick the latest patch
            Write-Host "(Node target set from package.json engines.node='$engineSpec': major $detected)" -ForegroundColor DarkGray
        }
    } catch {
        # Parsing failed; keep the hardcoded fallbacks
    }
}

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

# Refresh in case Node or nvm was just installed in another shell
Refresh-Path

# Detect Node and decide whether a too-old version needs remediation. A missing
# Node is handled by the winget install further down, not here.
$needsRemediation = $false
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $verRaw = & node --version 2>$null
    if ($verRaw -notmatch '^v(\d+)\.') {
        Write-Host "Couldn't parse 'node --version' output: '$verRaw'. Skipping Node version check." -ForegroundColor Yellow
    } else {
        $currentMajor = [int]$Matches[1]
        $currentVer = $verRaw -replace '^v', ''
        if ($currentMajor -ge $MinNodeMajor) {
            Write-Host "Node $verRaw is at or above the required floor ($MinNodeMajor)." -ForegroundColor Green
        } else {
            $needsRemediation = $true
        }
    }
}

if ($needsRemediation) {
    Write-Host ""
    Write-Host "Node $verRaw is below the required floor of $MinNodeMajor." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This script can set up nvm-windows and install Node ${NodeLtsVersion}:"
    Write-Host "  1. winget install CoreyButler.NVMforWindows"
    Write-Host "  2. nvm install $NodeLtsVersion; nvm use $NodeLtsVersion"
    Write-Host "  3. Your previous Node $currentVer stays recoverable via:"
    Write-Host "       nvm install $currentVer"
    Write-Host ""
    Write-Host "Note: nvm-windows replaces C:\Program Files\nodejs with a managed symlink." -ForegroundColor DarkGray
    Write-Host "      Other apps hardcoded to that path keep working; apps depending on a" -ForegroundColor DarkGray
    Write-Host "      specific Node version may need 'nvm use <ver>' switching." -ForegroundColor DarkGray
    Write-Host ""

    if (-not $AssumeYes) {
        $reply = Read-Host "Proceed with nvm-windows + Node $NodeLtsVersion setup? (y/N)"
        if ($reply -notmatch '^[Yy]') {
            throw "Aborted by user. Upgrade Node manually, or re-run with -AssumeYes (or install-all -AutoUpgradeNode)."
        }
    }

    # Install nvm-windows if missing
    if (Get-Command nvm -ErrorAction SilentlyContinue) {
        Write-Host "nvm-windows already installed at $((Get-Command nvm).Source)."
    } else {
        Write-Host "Installing nvm-windows via winget..."
        & winget install CoreyButler.NVMforWindows --source winget --accept-source-agreements --accept-package-agreements --silent
        if ($LASTEXITCODE -ne 0) {
            throw "winget install for nvm-windows failed (exit $LASTEXITCODE). Try the installer at https://github.com/coreybutler/nvm-windows/releases."
        }
        Refresh-Path
        if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
            throw "winget reported success but 'nvm' is still not on PATH. Open a fresh PowerShell window (as administrator) and re-run 03-prereqs-node.ps1."
        }
    }

    # nvm install + use the target version
    Write-Host "Running: nvm install $NodeLtsVersion"
    & nvm install $NodeLtsVersion
    if ($LASTEXITCODE -ne 0) { throw "'nvm install $NodeLtsVersion' failed (exit $LASTEXITCODE)." }

    # nvm-windows accepts a bare-major spec for `nvm install` (it resolves to the
    # latest patch on that line), but `nvm use` requires the full X.Y.Z. When the
    # user (or package.json detection) gave us a bare-major spec, resolve it by
    # inspecting nvm-windows's storage root (NVM_HOME, fallback %APPDATA%\nvm),
    # which contains one vX.Y.Z\ subdirectory per installed Node version. The
    # filesystem is more reliable than parsing `nvm list` output, which can be
    # written through Windows console APIs that bypass PowerShell capture.
    $useVersion = $NodeLtsVersion
    if ($NodeLtsVersion -match '^\d+$') {
        $targetMajor = [int]$NodeLtsVersion

        # Find nvm-windows's storage root. settings.txt next to nvm.exe is the
        # authoritative source. Fall back to NVM_HOME, then %APPDATA%\nvm.
        $candidateRoots = @()
        $nvmCmd = Get-Command nvm -ErrorAction SilentlyContinue
        if ($nvmCmd) {
            $settingsPath = Join-Path (Split-Path $nvmCmd.Source -Parent) 'settings.txt'
            if (Test-Path $settingsPath) {
                $rootLine = Get-Content $settingsPath | Where-Object { $_ -match '^\s*root\s*:\s*(.+)$' } | Select-Object -First 1
                if ($rootLine -and $rootLine -match '^\s*root\s*:\s*(.+)$') {
                    $candidateRoots += $Matches[1].Trim()
                }
            }
            # nvm-windows sometimes stores versions next to nvm.exe itself
            $candidateRoots += (Split-Path $nvmCmd.Source -Parent)
        }
        if ($env:NVM_HOME)  { $candidateRoots += $env:NVM_HOME }
        $candidateRoots += (Join-Path $env:APPDATA 'nvm')
        $candidateRoots = $candidateRoots | Where-Object { $_ } | Select-Object -Unique

        $matching = @()
        $rootUsed = $null
        foreach ($root in $candidateRoots) {
            if (-not (Test-Path $root)) { continue }
            Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                if ($_.Name -match '^v?(\d+\.\d+\.\d+)$') {
                    try {
                        $v = [version]$Matches[1]
                        if ($v.Major -eq $targetMajor) {
                            $matching += $v
                            if (-not $rootUsed) { $rootUsed = $root }
                        }
                    } catch {}
                }
            }
        }
        $latest = $matching | Sort-Object -Descending | Select-Object -First 1

        # AV-fallback: if nvm install reported success but no version directory
        # appeared, an antivirus / EDR (Defender, CrowdStrike, etc.) most likely
        # consumed the extracted files. Recover by downloading the Node zip from
        # nodejs.org directly and dropping it into nvm's root with the correct
        # vX.Y.Z naming. nvm-windows then sees it like any other installed version.
        if (-not $latest) {
            Write-Host ""
            Write-Host "nvm install reported success but no v$targetMajor.* directory appeared." -ForegroundColor Yellow
            Write-Host "Falling back to direct download from nodejs.org (typical cause: AV/EDR" -ForegroundColor Yellow
            Write-Host "quarantining extracted files mid-install)." -ForegroundColor Yellow

            # Resolve a concrete X.Y.Z. For bare-major, query nodejs.org's release
            # index and pick the latest patch on that line.
            if ($NodeLtsVersion -match '^\d+\.\d+\.\d+$') {
                $fullVer = $NodeLtsVersion
            } else {
                try {
                    $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing -TimeoutSec 30
                    $best = $index |
                        Where-Object { $_.version -match "^v$targetMajor\." } |
                        Sort-Object { [version]($_.version -replace '^v','') } -Descending |
                        Select-Object -First 1
                    if (-not $best) { throw "No Node $targetMajor.x releases listed at nodejs.org/dist/index.json." }
                    $fullVer = $best.version -replace '^v', ''
                } catch {
                    throw "Couldn't resolve latest Node $targetMajor.x via nodejs.org: $_"
                }
            }

            # Pick which nvm root to write into -- prefer one we already confirmed exists
            $writeRoot = $candidateRoots | Where-Object { Test-Path $_ } | Select-Object -First 1
            if (-not $writeRoot) {
                throw "No nvm root directory found among: $($candidateRoots -join ', ')"
            }

            $url = "https://nodejs.org/dist/v$fullVer/node-v$fullVer-win-x64.zip"
            $zip = Join-Path $env:TEMP "node-v$fullVer.zip"
            $tmp = Join-Path $env:TEMP "node-v$fullVer-extract"
            $dst = Join-Path $writeRoot "v$fullVer"

            Write-Host "Downloading $url"
            Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
            if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
            Write-Host "Extracting to $tmp"
            Expand-Archive -Path $zip -DestinationPath $tmp
            $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
            if (-not $inner) { throw "Zip extraction produced no inner directory in $tmp." }
            if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
            # Copy + delete instead of Move-Item -- AV/EDR can hold transient locks
            # on freshly-extracted files that block the delete-source half of a
            # move. Copy-Item only needs read on the source, which is more tolerant.
            # robocopy is the second-line fallback because it retries through locks.
            Write-Host "Copying to $dst"
            try {
                Copy-Item -Path $inner.FullName -Destination $dst -Recurse -Force -ErrorAction Stop
            } catch {
                Write-Host "Copy-Item failed; retrying via robocopy..."
                & robocopy $inner.FullName $dst /E /R:5 /W:2 /NFL /NDL /NJH /NJS | Out-Null
                if ($LASTEXITCODE -ge 8) { throw "robocopy fallback failed (exit $LASTEXITCODE)." }
            }
            if (-not (Test-Path (Join-Path $dst 'node.exe'))) {
                throw "Manual install completed but no node.exe found at $dst."
            }
            Remove-Item $zip -ErrorAction SilentlyContinue
            Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

            Write-Host "Manual install complete at $dst" -ForegroundColor Green
            Write-Host "If this happens repeatedly, consider adding '$writeRoot' to your AV exclusions." -ForegroundColor DarkGray

            $useVersion = $fullVer
        } else {
            $useVersion = $latest.ToString()
            Write-Host "Resolved '$NodeLtsVersion' to '$useVersion' for 'nvm use' (from $rootUsed)."
        }
    }

    Write-Host "Running: nvm use $useVersion"
    & nvm use $useVersion
    if ($LASTEXITCODE -ne 0) { throw "'nvm use $useVersion' failed (exit $LASTEXITCODE)." }

    # Refresh PATH so child processes inherit the new node symlink target
    Refresh-Path

    # Verify
    $newVer = & node --version 2>$null
    if ($newVer -notmatch '^v(\d+)\.') {
        throw "Couldn't verify new node version (got: '$newVer'). Open a fresh PowerShell window and re-run install-all.ps1."
    }
    $newMajor = [int]$Matches[1]
    if ($newMajor -lt $MinNodeMajor) {
        throw "Node is still $newVer after nvm setup -- 'nvm use' may not have taken effect in this shell. Open a fresh PowerShell window and re-run."
    }

    Write-Host ""
    Write-Host "SUCCESS: Node is now $newVer." -ForegroundColor Green
    Write-Host "To switch back to the previous version later: nvm use $currentVer (after 'nvm install $currentVer' if it was uninstalled)" -ForegroundColor DarkGray
}

# Install Node.js LTS if it is still missing.
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    Write-Host "Node already on PATH: $(node --version) at $($node.Source)"
} else {
    Write-Host "Installing Node.js LTS via winget..."
    & winget install OpenJS.NodeJS.LTS --source winget --accept-source-agreements --accept-package-agreements --silent
    if ($LASTEXITCODE -ne 0) {
        throw "Node install failed (winget exit code $LASTEXITCODE). If this is the msstore cert issue, the --source winget flag should have skipped it. Check `winget search Node.js` to debug."
    }
    # Refresh PATH so subsequent steps in this same shell can use node/npm
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "Node installed."
}

Write-Host ""
Write-Host "SUCCESS: Node runtime prepared." -ForegroundColor Green
Write-Host "Open a fresh PowerShell window to pick up the new PATH."
