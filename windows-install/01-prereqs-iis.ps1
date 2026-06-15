#Requires -RunAsAdministrator
<#
.SYNOPSIS
Installs the IIS URL Rewrite Module and iisnode, and unlocks the IIS config the
Admin App's web.config files need.

.DESCRIPTION
- Downloads and installs the IIS URL Rewrite Module MSI (if not present)
- Downloads and installs the iisnode MSI (if not present)
- Unlocks the system.webServer/handlers section so application-level web.config
  files can register the iisnode handler
- Allows the HTTP_X_ORIGINAL_URL server variable the API rewrite rule sets

Idempotent -- safe to re-run.

This sets up the IIS engine prerequisites only. The API and FE are deployed as
two standalone HTTP sites by 05-deploy-api.ps1 and 06-deploy-fe.ps1. No
certificate or HTTPS binding is created; local dev is HTTP only.

.PARAMETER IisNodeVersion
Version of iisnode to install. Default: v0.2.26 (last published).

.EXAMPLE
.\01-prereqs-iis.ps1
#>

param(
    [string]$IisNodeVersion = "v0.2.26"
)

$ErrorActionPreference = 'Stop'

# Precondition: the IIS web server role must already be installed
# (setup-vm-prereqs.ps1 does that). This script only adds URL Rewrite + iisnode.
if (-not (Get-Service W3SVC -ErrorAction SilentlyContinue)) {
    throw "IIS (W3SVC) is not installed. Run setup-vm-prereqs.ps1 first, or enable the IIS role via Enable-WindowsOptionalFeature."
}
Import-Module WebAdministration

# IIS URL Rewrite Module
# Required by both web.config files (API rewrite to main.js, FE SPA fallback).
$rewriteDll = "$env:SystemRoot\System32\inetsrv\rewrite.dll"
if (Test-Path $rewriteDll) {
    Write-Host "URL Rewrite Module already installed."
} else {
    $url = "https://download.microsoft.com/download/D/D/E/DDE57C26-C62C-4C59-A1BB-31D58B36ADA2/rewrite_amd64_en-US.msi"
    $msi = "$env:TEMP\rewrite_amd64_en-US.msi"
    Write-Host "Downloading IIS URL Rewrite Module..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing
    } catch {
        throw "Failed to download the IIS URL Rewrite Module from $url. Check internet connectivity and that the URL is reachable. Original: $($_.Exception.Message)"
    }
    Write-Host "Installing IIS URL Rewrite Module..."
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait
    if (-not (Test-Path $rewriteDll)) {
        throw "URL Rewrite Module install failed (rewrite.dll not present)."
    }
}

# Unlock the system.webServer/handlers section so application-level web.configs
# can register the iisnode handler. IIS locks this by default; without the
# unlock, hitting the API returns HTTP 500.19 (0x80070021).
& "$env:SystemRoot\System32\inetsrv\appcmd.exe" unlock config -section:system.webServer/handlers | Out-Null
Write-Host "Unlocked system.webServer/handlers section."

# Allow URL Rewrite to set the HTTP_X_ORIGINAL_URL server variable. The API's
# web.config rewrite rule sets this so iisnode forwards the app-relative path to
# Nest; the variable must be on the server's allowed list first.
try {
    Add-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/rewrite/allowedServerVariables" -Name "." -Value @{name="HTTP_X_ORIGINAL_URL"} -ErrorAction Stop
    Write-Host "Allowed HTTP_X_ORIGINAL_URL override at server level."
} catch {
    if ($_.Exception.Message -match "already exists|Cannot add duplicate") {
        Write-Host "HTTP_X_ORIGINAL_URL already in allowedServerVariables."
    } else {
        throw
    }
}

# iisnode
$iisnodeDll = "$env:ProgramFiles\iisnode\iisnode.dll"
if (Test-Path $iisnodeDll) {
    Write-Host "iisnode already installed at $iisnodeDll"
} else {
    $url = "https://github.com/Azure/iisnode/releases/download/$IisNodeVersion/iisnode-full-$IisNodeVersion-x64.msi"
    $msi = "$env:TEMP\iisnode-$IisNodeVersion-x64.msi"
    Write-Host "Downloading iisnode from $url..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing
    } catch {
        throw "Failed to download iisnode from $url. Check internet connectivity and that the URL is reachable. Original: $($_.Exception.Message)"
    }
    Write-Host "Installing iisnode..."
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait
    if (-not (Test-Path $iisnodeDll)) {
        throw "iisnode install failed."
    }
}

Write-Host ""
Write-Host "SUCCESS: URL Rewrite + iisnode installed; IIS config unlocked." -ForegroundColor Green
Write-Host "The API and FE deploy as standalone HTTP sites (05-deploy-api.ps1, 06-deploy-fe.ps1)."
