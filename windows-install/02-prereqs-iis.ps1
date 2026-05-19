#Requires -RunAsAdministrator
<#
.SYNOPSIS
Installs IIS URL Rewrite Module + iisnode, generates a trusted self-signed cert,
and binds it to an IIS site.

.DESCRIPTION
- Downloads and installs the IIS URL Rewrite Module MSI (if not present)
- Downloads and installs the iisnode MSI (if not present)
- Generates a self-signed certificate covering the specified hostnames
- Adds the certificate to LocalMachine\Root so browsers trust it
- Replaces the HTTPS binding on the target IIS site with one using this cert

Idempotent — safe to re-run. Existing certs with the same friendly name will
be left in place but a new binding-quality cert will be added each run.

.PARAMETER SiteName
The IIS site to bind the HTTPS cert to. Default: "Ed-Fi".

.PARAMETER HostNames
DNS names to include in the cert's SAN. Default: localhost + computer name.

.PARAMETER CertFriendlyName
Friendly name for the new cert. Default: "Ed-Fi Dev Cert".

.PARAMETER IisNodeVersion
Version of iisnode to install. Default: v0.2.26 (last published).

.EXAMPLE
.\02-prereqs-iis.ps1
.\02-prereqs-iis.ps1 -SiteName "Ed-Fi" -HostNames "localhost","mybox.local"
#>

param(
    [string]$SiteName = "Ed-Fi",
    [string[]]$HostNames = @("localhost", $env:COMPUTERNAME),
    [string]$CertFriendlyName = "Ed-Fi Dev Cert",
    [string]$IisNodeVersion = "v0.2.26"
)

$ErrorActionPreference = 'Stop'
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
    Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing
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

# Allow URL Rewrite to override HTTP_X_ORIGINAL_URL. Required when the API is
# hosted as an IIS sub-application: iisnode passes the FULL URL (including the
# app prefix /adminapp-api) to Node, which then doesn't match Nest's /api
# global prefix. The web.config rewrite rule uses <serverVariables> to set
# HTTP_X_ORIGINAL_URL to the app-relative path, but the variable must be on
# the server's allowed list first.
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
    Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing
    Write-Host "Installing iisnode..."
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait
    if (-not (Test-Path $iisnodeDll)) {
        throw "iisnode install failed."
    }
}

# Site existence -- create with a placeholder physical path if missing, then
# bind HTTPS on 443. The AdminApp API and FE deploy as IIS applications under
# this site (URLs end up at https://localhost/adminapp-api and /adminapp).
$site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if (-not $site) {
    $sitePath = "C:\inetpub\Ed-Fi"
    New-Item -ItemType Directory -Path $sitePath -Force | Out-Null
    # Create the site with a temporary HTTP binding on 8443 just so New-Website
    # has a valid initial binding; the HTTPS:443 binding is added below and the
    # 8443 binding is removed.
    New-Website -Name $SiteName -Port 8443 -PhysicalPath $sitePath | Out-Null
    Get-WebBinding -Name $SiteName -Protocol http -Port 8443 | Remove-WebBinding
    Write-Host "Created IIS site '$SiteName' at $sitePath."
}

$changesMade = $false

# Self-signed cert — reuse if one with the same FriendlyName exists, covers
# the requested hostnames, and isn't expiring soon (within 30 days)
$existingCert = Get-ChildItem "Cert:\LocalMachine\My" |
    Where-Object { $_.FriendlyName -eq $CertFriendlyName -and $_.NotAfter -gt (Get-Date).AddDays(30) } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

if ($existingCert) {
    $sanExt = $existingCert.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.17" }
    $sanText = if ($sanExt) { $sanExt.Format($false) } else { "" }
    $coversAll = $true
    foreach ($h in $HostNames) {
        if ($sanText -notmatch [regex]::Escape($h)) { $coversAll = $false; break }
    }
    if ($coversAll) {
        Write-Host "Reusing existing cert '$CertFriendlyName' (thumbprint $($existingCert.Thumbprint))."
        $cert = $existingCert
    } else {
        Write-Host "Existing cert '$CertFriendlyName' doesn't cover all requested hostnames — generating a new one."
        $cert = $null
    }
} else {
    $cert = $null
}

if (-not $cert) {
    Write-Host "Generating self-signed cert for: $($HostNames -join ', ')"
    $cert = New-SelfSignedCertificate `
        -DnsName $HostNames `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -FriendlyName $CertFriendlyName `
        -NotAfter (Get-Date).AddYears(5) `
        -KeyExportPolicy Exportable `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")
    $changesMade = $true
}

# Trust — only add to Root if not already there
$inRoot = Get-ChildItem "Cert:\LocalMachine\Root\$($cert.Thumbprint)" -ErrorAction SilentlyContinue
if ($inRoot) {
    Write-Host "Cert already trusted in LocalMachine\Root."
} else {
    $root = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
    $root.Open("ReadWrite")
    $root.Add($cert)
    $root.Close()
    Write-Host "Cert added to Trusted Root Certification Authorities."
    $changesMade = $true
}

# HTTPS binding — only rebind if current binding doesn't use this cert or wildcard host
$existingBinding = Get-WebBinding -Name $SiteName -Protocol "https" -ErrorAction SilentlyContinue
$bindingNeedsUpdate = $true
if ($existingBinding) {
    $currentThumb = (Get-Item "IIS:\SslBindings\*!443" -ErrorAction SilentlyContinue | Where-Object { $_.Port -eq 443 } | Select-Object -First 1).Thumbprint
    $isWildcard = $existingBinding.bindingInformation -like "*:443:"
    if ($currentThumb -eq $cert.Thumbprint -and $isWildcard) {
        Write-Host "HTTPS binding on '$SiteName' already uses this cert with wildcard host — skipping rebind."
        $bindingNeedsUpdate = $false
    }
}

if ($bindingNeedsUpdate) {
    if ($existingBinding) {
        Write-Host "Removing existing HTTPS binding(s) on '$SiteName'..."
        $existingBinding | Remove-WebBinding
    }
    New-WebBinding -Name $SiteName -Protocol "https" -Port 443 -IPAddress "*"
    (Get-WebBinding -Name $SiteName -Protocol "https" -Port 443).AddSslCertificate($cert.Thumbprint, "My")
    Write-Host "HTTPS binding on '$SiteName' now uses cert $($cert.Thumbprint)."
    $changesMade = $true
}

if ($changesMade) {
    Write-Host "Running iisreset..."
    iisreset /restart | Out-Null
} else {
    Write-Host "No changes — skipping iisreset."
}

Write-Host ""
Write-Host "SUCCESS: iisnode installed; HTTPS binding ready." -ForegroundColor Green
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host "Open https://localhost (in a fresh browser window) to verify the green padlock."
