#Requires -RunAsAdministrator
<#
.SYNOPSIS
Deploys the Ed-Fi Admin App frontend to IIS.

.DESCRIPTION
- Copies built FE files (index.html + assets\) to the IIS folder
- Creates or updates the IIS site
- Writes web.config with the React Router SPA rewrite rule

Run AFTER `npm run build:fe` produces dist\packages\fe\ in the source repo.

.PARAMETER SourcePath
Path to the Vite build output, e.g. C:\Ed-Fi\Ed-Fi-AdminApp\dist\packages\fe.

.PARAMETER DestPath
Where to deploy. Default: C:\inetpub\EdFi-AdminApp-FE.

.PARAMETER SiteName
IIS site name. Default: EdFi-AdminApp-FE.

.PARAMETER Port
HTTP port. Default: 4200.

.EXAMPLE
.\06-deploy-fe.ps1 -SourcePath C:\Ed-Fi\Ed-Fi-AdminApp\dist\packages\fe
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [string]$DestPath = "C:\inetpub\Ed-Fi\adminapp",
    # Default: deploy as an application under "Ed-Fi" at /adminapp -> URL is
    # https://localhost/adminapp/. Pass -ParentSiteName "" to create a
    # standalone site on $Port instead (HTTP on localhost:$Port).
    [string]$ParentSiteName = "Ed-Fi",
    [string]$AppAlias = "adminapp",
    [string]$StandaloneSiteName = "EdFi-AdminApp-FE",
    [int]$Port = 4200
)

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration

if (-not (Test-Path "$SourcePath\index.html")) {
    throw "index.html not found at $SourcePath. Did you run 'npm run build:fe'?"
}

Write-Host "Copying FE files to $DestPath..."
New-Item -ItemType Directory -Path $DestPath -Force | Out-Null
& robocopy $SourcePath $DestPath /MIR /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

if ($ParentSiteName) {
    # Sub-application under the parent site
    if (-not (Get-Website -Name $ParentSiteName -ErrorAction SilentlyContinue)) {
        throw "Parent site '$ParentSiteName' not found. Run 01-prereqs-iis.ps1 first or pass -ParentSiteName ''."
    }
    $existing = Get-WebApplication -Site $ParentSiteName -Name $AppAlias -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Application '$AppAlias' under '$ParentSiteName' exists. Updating physical path..."
        Set-ItemProperty -Path "IIS:\Sites\$ParentSiteName\$AppAlias" -Name "physicalPath" -Value $DestPath
    } else {
        New-WebApplication -Site $ParentSiteName -Name $AppAlias -PhysicalPath $DestPath | Out-Null
        Write-Host "Application '$AppAlias' created under '$ParentSiteName' -> https://localhost/$AppAlias/"
    }
} elseif (Get-Website -Name $StandaloneSiteName -ErrorAction SilentlyContinue) {
    Write-Host "Site '$StandaloneSiteName' exists. Updating physical path..."
    Set-ItemProperty -Path "IIS:\Sites\$StandaloneSiteName" -Name "physicalPath" -Value $DestPath
} else {
    New-Website -Name $StandaloneSiteName -Port $Port -PhysicalPath $DestPath | Out-Null
    Write-Host "Site '$StandaloneSiteName' created on port $Port."
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
  </system.webServer>
</configuration>
'@

$webConfigPath = "$DestPath\web.config"
if ((Test-Path $webConfigPath) -and ((Get-Content $webConfigPath -Raw) -eq $webConfig)) {
    Write-Host "web.config already matches — not rewriting."
} else {
    Set-Content -Path $webConfigPath -Value $webConfig -Encoding UTF8
    Write-Host "web.config written."
}

Write-Host ""
Write-Host "SUCCESS: FE deployed at http://localhost:$Port/" -ForegroundColor Green
