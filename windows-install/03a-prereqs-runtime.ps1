#Requires -RunAsAdministrator
<#
.SYNOPSIS
Installs/verifies Node.js, sets up the npm cache override, downloads Keycloak,
and (optionally) extracts an OpenJDK build.

.DESCRIPTION
- Installs Node.js LTS via winget (skipped if already on PATH)
- Creates the npm cache folder, grants the App Pool user Modify, and sets
  the Machine env var NPM_CONFIG_CACHE so npm under iisnode doesn't try to
  write to the system profile
- Downloads and extracts Keycloak to a stable location
- (Optional) downloads and extracts an OpenJDK zip, sets JAVA_HOME and prepends
  its bin to the Machine PATH

Run AFTER 02-prereqs-iis.ps1 (which creates the App Pool indirectly via
04-deploy-api.ps1 — for npm-cache permissions, this script assumes the App
Pool name is known upfront).

.PARAMETER AppPoolName
App Pool user to grant npm-cache access to. Default: EdFi-AdminApp-API.

.PARAMETER KeycloakVersion
Default: 26.6.1.

.PARAMETER KeycloakInstallPath
Destination folder. Default: C:\keycloak.

.PARAMETER NpmCachePath
Folder to use for npm cache. Default: C:\npm-cache.

.PARAMETER JdkDownloadUrl
Optional URL to an OpenJDK zip. If provided, the script downloads, extracts to
C:\Program Files\Java\, and sets JAVA_HOME.

.EXAMPLE
.\03-prereqs-runtime.ps1
.\03-prereqs-runtime.ps1 -JdkDownloadUrl "https://download.java.net/.../openjdk-26.0.1_windows-x64_bin.zip"
#>

param(
    [string]$AppPoolName = "EdFi-AdminApp-API",
    [string]$KeycloakVersion = "26.6.1",
    [string]$KeycloakInstallPath = "C:\keycloak",
    [string]$NpmCachePath = "C:\npm-cache",
    [string]$JdkDownloadUrl
)

$ErrorActionPreference = 'Stop'

# Node.js
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

# npm cache override -- create the folder and set the machine env var here.
# The App Pool permission grant is deferred to 04-deploy-api.ps1 because the
# App Pool itself doesn't exist yet.
if (-not (Test-Path $NpmCachePath)) {
    New-Item -ItemType Directory -Path $NpmCachePath -Force | Out-Null
    Write-Host "Created $NpmCachePath"
}
[Environment]::SetEnvironmentVariable("NPM_CONFIG_CACHE", $NpmCachePath, "Machine")
Write-Host "NPM_CONFIG_CACHE = $NpmCachePath (Machine env var)"

# JDK -- Keycloak 26 officially requires Java 17 or 21. Behavior in order:
#   1. If `java` >=17 is already on PATH, USE IT. Skip the OpenJDK 21 install
#      and the PATH/JAVA_HOME overrides -- respects users who keep a newer JDK
#      (25, 26, ...) for other dev work. Keycloak runs at JVM level, so any
#      modern JDK works in practice even if not officially supported.
#   2. Otherwise install Microsoft OpenJDK 21 via winget and prepend its bin
#      to Machine PATH so Keycloak has a working JDK.
#   3. -JdkDownloadUrl overrides everything: skips both checks and downloads
#      a zip (offline scenarios).

# Step 1: detect existing usable Java
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
$existingJava = Get-Command java -ErrorAction SilentlyContinue
$existingJavaMajor = 0
if ($existingJava) {
    # `java -version` writes to stderr. Route the merge through cmd.exe rather
    # than PowerShell's `2>&1`, because in Windows PowerShell 5.1 redirecting a
    # native command's stderr inside PS wraps each line as a NativeCommandError
    # ErrorRecord, which is fatal under the parent script's
    # $ErrorActionPreference='Stop'. cmd /c merges the streams before PS ever
    # sees them, so the output arrives as plain strings.
    $javaVerLine = (& cmd /c "java -version 2>&1") | Select-Object -First 1
    if ($javaVerLine -match 'version "(\d+)') {
        $existingJavaMajor = [int]$Matches[1]
    } elseif ($javaVerLine -match 'version "1\.(\d+)') {
        $existingJavaMajor = [int]$Matches[1]   # 1.8.0_xxx style
    }
}

$openJdk21Root = $null
if ($existingJavaMajor -ge 17 -and -not $JdkDownloadUrl) {
    Write-Host "Java $existingJavaMajor already on PATH at $($existingJava.Source) -- skipping OpenJDK 21 install."
    Write-Host "Keycloak will run on the existing JDK. (To force install OpenJDK 21 anyway,"
    Write-Host "remove your current Java from PATH before re-running, or pass -JdkDownloadUrl.)"
} else {
    # Step 2: install / locate OpenJDK 21. Match jdk-21* dirs that actually
    # contain a runnable java.exe -- a leftover half-install can't fool us.
    $existing21 = Get-ChildItem "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "jdk-21*" -and (Test-Path "$($_.FullName)\bin\java.exe") } |
        Sort-Object Name -Descending | Select-Object -First 1
    if ($existing21) {
        $openJdk21Root = $existing21.FullName
        Write-Host "OpenJDK 21 already installed at $openJdk21Root"
    } elseif (-not $JdkDownloadUrl) {
        Write-Host "Installing OpenJDK 21 via winget (Keycloak runtime)..."
        & winget install Microsoft.OpenJDK.21 --source winget --accept-source-agreements --accept-package-agreements --silent
        if ($LASTEXITCODE -ne 0) {
            throw "OpenJDK install failed (winget exit code $LASTEXITCODE). Pass -JdkDownloadUrl to install from a zip instead."
        }
        $existing21 = Get-ChildItem "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "jdk-21*" -and (Test-Path "$($_.FullName)\bin\java.exe") } |
            Sort-Object Name -Descending | Select-Object -First 1
        if ($existing21) { $openJdk21Root = $existing21.FullName }
        if (-not $openJdk21Root) {
            throw "winget reported success but no jdk-21*\bin\java.exe found under C:\Program Files\Microsoft. Pass -JdkDownloadUrl or install OpenJDK 21 manually."
        }
        Write-Host "OpenJDK 21 installed at $openJdk21Root"
    }
}

# Step 3: PATH prepend + JAVA_HOME -- only when we installed/located OpenJDK 21
# (i.e., we did NOT take the "existing Java is fine" early-out).
if ($openJdk21Root) {
    $newJdkBin = "$openJdk21Root\bin"
    $mp = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $entries = $mp -split ';' | Where-Object { $_ -and $_ -ne $newJdkBin }
    $newPath = (@($newJdkBin) + $entries) -join ';'
    if ($mp -ne $newPath) {
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
        Write-Host "Prepended $newJdkBin to Machine PATH."
    }
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $openJdk21Root, "Machine")
    # Refresh in current process so 03b can spawn Keycloak with the right java
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    $env:JAVA_HOME = $openJdk21Root
}

# Keycloak -- accept flat OR nested (BasePath\keycloak-<ver>\bin\kc.bat) layout
$existingKcBat = $null
if (Test-Path "$KeycloakInstallPath\bin\kc.bat") {
    $existingKcBat = "$KeycloakInstallPath\bin\kc.bat"
} else {
    $sub = Get-ChildItem $KeycloakInstallPath -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path "$($_.FullName)\bin\kc.bat" } |
        Select-Object -First 1
    if ($sub) { $existingKcBat = "$($sub.FullName)\bin\kc.bat" }
}
if ($existingKcBat) {
    Write-Host "Keycloak already installed at $existingKcBat"
} else {
    $kcZip = "$env:TEMP\keycloak-$KeycloakVersion.zip"
    $kcUrl = "https://github.com/keycloak/keycloak/releases/download/$KeycloakVersion/keycloak-$KeycloakVersion.zip"
    Write-Host "Downloading Keycloak $KeycloakVersion..."
    Invoke-WebRequest -Uri $kcUrl -OutFile $kcZip -UseBasicParsing
    $parent = Split-Path $KeycloakInstallPath -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Write-Host "Extracting to $KeycloakInstallPath..."
    Expand-Archive -Path $kcZip -DestinationPath $parent -Force
    $extracted = Join-Path $parent "keycloak-$KeycloakVersion"
    if ((Test-Path $extracted) -and ($extracted -ne $KeycloakInstallPath)) {
        Move-Item -Path $extracted -Destination $KeycloakInstallPath
    }
    Write-Host "Keycloak ready at $KeycloakInstallPath"
}

# Optional JDK
if ($JdkDownloadUrl) {
    $jdkZip = "$env:TEMP\jdk-download.zip"
    Write-Host "Downloading JDK from $JdkDownloadUrl..."
    Invoke-WebRequest -Uri $JdkDownloadUrl -OutFile $jdkZip -UseBasicParsing
    $jdkParent = "C:\Program Files\Java"
    New-Item -ItemType Directory -Path $jdkParent -Force | Out-Null
    Expand-Archive -Path $jdkZip -DestinationPath $jdkParent -Force
    $jdkDir = Get-ChildItem $jdkParent -Directory | Where-Object { $_.Name -like "jdk-*" } | Sort-Object Name -Descending | Select-Object -First 1
    if ($jdkDir) {
        [Environment]::SetEnvironmentVariable("JAVA_HOME", $jdkDir.FullName, "Machine")
        $mp = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $newBin = "$($jdkDir.FullName)\bin"
        if ($mp -notlike "*$newBin*") {
            [Environment]::SetEnvironmentVariable("Path", "$newBin;$mp", "Machine")
        }
        Write-Host "JAVA_HOME = $($jdkDir.FullName)"
    }
}

Write-Host ""
Write-Host "SUCCESS: Runtime dependencies prepared." -ForegroundColor Green
Write-Host "Open a fresh PowerShell window to pick up the new PATH / env vars."
Write-Host "Start Keycloak with: cd $KeycloakInstallPath\bin; .\kc.bat start-dev"
