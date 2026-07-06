#Requires -RunAsAdministrator
<#
.SYNOPSIS
Deploys the Ed-Fi Admin App frontend to IIS.

.DESCRIPTION
- Copies built FE files (index.html + assets\) to the IIS folder
- Creates or updates the IIS site under a dedicated App Pool (started explicitly)
- Writes web.config with the React Router SPA rewrite rule + security headers

Run AFTER `npm run build:fe` produces dist\packages\fe\ in the source repo.

.PARAMETER SourcePath
Path to the Vite build output, e.g. C:\Ed-Fi\Ed-Fi-AdminApp\dist\packages\fe.

.PARAMETER DestPath
Where to deploy. Default: C:\inetpub\EdFi-AdminApp-FE (a dedicated directory,
not nested under another site's root).

.PARAMETER SiteName
IIS site name. Default: EdFi-AdminApp-FE.

.PARAMETER Port
HTTP port. Default: 4200.

.PARAMETER ApiUrl
Base URL of the API the FE bundle calls. Only its origin (scheme://host:port) is
used, to populate the Content-Security-Policy connect-src. Must match the
VITE_API_URL baked into the bundle at build time. Default: http://localhost:3333.

.PARAMETER AppPoolName
Dedicated IIS App Pool for the FE site, created and started here so the SPA does
not depend on DefaultAppPool (which is often Stopped after a reboot). Default:
EdFi-AdminApp-FE.

.EXAMPLE
.\06-deploy-fe.ps1 -SourcePath C:\Ed-Fi\Ed-Fi-AdminApp\dist\packages\fe
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [string]$DestPath = "C:\inetpub\EdFi-AdminApp-FE",
    [string]$SiteName = "EdFi-AdminApp-FE",
    [int]$Port = 4200,
    [string]$ApiUrl = "http://localhost:3333",
    [string]$AppPoolName = "EdFi-AdminApp-FE"
)

$ErrorActionPreference = 'Stop'

# Precondition: IIS + the WebAdministration module must be available
# (01-prereqs-iis.ps1 installs the IIS pieces).
try {
    Import-Module WebAdministration -ErrorAction Stop
} catch {
    throw "IIS / the WebAdministration module isn't available. Ensure IIS is installed (setup-vm-prereqs.ps1) and run 01-prereqs-iis.ps1 before deploying."
}

if (-not (Test-Path "$SourcePath\index.html")) {
    throw "index.html not found at $SourcePath. Did you run 'npm run build:fe'?"
}

Write-Host "Copying FE files to $DestPath..."
New-Item -ItemType Directory -Path $DestPath -Force | Out-Null
& robocopy $SourcePath $DestPath /MIR /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

# Dedicated App Pool for the FE. Without one, New-Website binds the site to
# DefaultAppPool, which is often Stopped after a reboot or recycle -> the SPA 503s
# until it is started by hand. A dedicated pool (autoStart on by default) started
# explicitly here keeps the FE reachable on its own.
try {
    if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
        Write-Host "Creating App Pool '$AppPoolName'..."
        New-WebAppPool -Name $AppPoolName | Out-Null
    }
    # Static content -- no managed runtime needed.
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedRuntimeVersion" -Value ""
    Write-Host "App Pool '$AppPoolName' configured."
} catch {
    throw "Failed to create/configure the IIS App Pool '$AppPoolName'. Is IIS running and the WAS service started? Original: $($_.Exception.Message)"
}

if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
    Write-Host "Site '$SiteName' exists. Updating physical path and app pool..."
    Set-ItemProperty -Path "IIS:\Sites\$SiteName" -Name "physicalPath" -Value $DestPath
    Set-ItemProperty -Path "IIS:\Sites\$SiteName" -Name "applicationPool" -Value $AppPoolName
} else {
    New-Website -Name $SiteName -Port $Port -PhysicalPath $DestPath -ApplicationPool $AppPoolName | Out-Null
    Write-Host "Site '$SiteName' created on HTTP port $Port (App Pool '$AppPoolName')."
}

# Ensure the pool is running so the site serves immediately.
if ((Get-WebAppPoolState -Name $AppPoolName -ErrorAction SilentlyContinue).Value -ne 'Started') {
    Start-WebAppPool -Name $AppPoolName | Out-Null
    Write-Host "Started App Pool '$AppPoolName'."
}

$webConfig = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="index.html" />
        </rule>
      </rules>
    </rewrite>
    <!-- Baseline security headers. CSP is Report-Only for now and moves to enforcing
         with the always-on TLS work. connect-src must match the API origin the FE
         bundle calls (VITE_API_URL). style-src allows 'unsafe-inline' because MUI /
         emotion inject styles at runtime. -->
    <httpProtocol>
      <customHeaders>
        <remove name="X-Powered-By" />
        <add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" />
        <add name="X-Content-Type-Options" value="nosniff" />
        <add name="X-Frame-Options" value="DENY" />
        <add name="Referrer-Policy" value="no-referrer" />
        <add name="Content-Security-Policy-Report-Only" value="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' __API_ORIGIN__; form-action 'self'" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
'@

# The CSP connect-src must name the exact API origin (scheme://host:port), so the
# browser allows the FE's XHR calls to the API. Strip any path/query from -ApiUrl.
$apiOrigin = ([Uri]$ApiUrl).GetLeftPart([System.UriPartial]::Authority)
$webConfig = $webConfig.Replace('__API_ORIGIN__', $apiOrigin)

$webConfigPath = "$DestPath\web.config"
if ((Test-Path $webConfigPath) -and ((Get-Content $webConfigPath -Raw) -eq $webConfig)) {
    Write-Host "web.config already matches — not rewriting."
} else {
    Set-Content -Path $webConfigPath -Value $webConfig -Encoding UTF8
    Write-Host "web.config written."
}

Write-Host ""
Write-Host "SUCCESS: FE deployed at http://localhost:$Port/" -ForegroundColor Green
