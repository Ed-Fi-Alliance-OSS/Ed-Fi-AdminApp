#Requires -RunAsAdministrator
<#
.SYNOPSIS
Deploys the Ed-Fi Admin App API to IIS under iisnode.

.DESCRIPTION
- Copies built API files from source to destination
- Creates/configures the IIS App Pool (LoadUserProfile=true, no managed runtime)
- Creates or updates the IIS application (under a parent site) or standalone site
- Writes a known-good web.config (the three iisnode adjustments baked in)
- Patches production.js with bare-metal values (DB, API/FE URLs, Keycloak)
- Sets icacls permissions for the App Pool user

Run AFTER:
  - 01-prereqs-sql.ps1 (SQL ready)
  - 02-prereqs-iis.ps1 (IIS, cert, iisnode ready)
  - 03-prereqs-runtime.ps1 (Node, npm cache ready)
  - `npm ci --legacy-peer-deps` and `npm run build:api` in the source repo

.PARAMETER SourcePath
The built API output folder. Typically the repo root, containing main.js +
packages\ + node_modules\.

.PARAMETER DestPath
Where to deploy. Default: C:\inetpub\Ed-Fi\EdFi-AdminApp-API.

.PARAMETER AppPoolName
Name of the IIS App Pool. Default: EdFi-AdminApp-API.

.PARAMETER ParentSiteName
The IIS site to add this app under. Pass "" to create a new standalone site.
Default: Ed-Fi.

.PARAMETER AppAlias
The application path under the parent site. Default: EdFi-AdminApp-API
(produces URL https://localhost/EdFi-AdminApp-API).

.PARAMETER StandalonePort
If creating a new standalone site, this port. Default: 3333.

.PARAMETER SaPassword
SQL Server sa password (set in 01-prereqs-sql.ps1).

.PARAMETER DatabaseName
SQL Server database name. Default: sbaa. Must match what 01-prereqs-sql.ps1 created.

.PARAMETER KeycloakIssuer
OIDC issuer URL. Default: http://localhost:8080/realms/edfi.

.PARAMETER KeycloakClientId
Default: edfiadminapp.

.PARAMETER KeycloakClientSecret
The secret you created for the edfiadminapp client in Keycloak.

.PARAMETER KeycloakManagementDomain
Domain (host:port) of Keycloak. Default: localhost:8080.

.PARAMETER KeycloakMachineSecret
Default: edfi-machine-secret-456.

.PARAMETER ApiPort
Public-facing API port (used in MY_URL). Default: 3333.

.PARAMETER FePort
Public-facing FE port (used in FE_URL). Default: 4200.

.PARAMETER AdminUsername
Email seeded as the admin user. Default: admin@example.com.

.EXAMPLE
.\04-deploy-api.ps1 -SourcePath C:\Ed-Fi\Ed-Fi-AdminApp -SaPassword 'EdFi-Local!' -KeycloakClientSecret 'RBsHTSb...'
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [string]$DestPath = "C:\inetpub\Ed-Fi\adminapp-api",
    [string]$AppPoolName = "EdFi-AdminApp-API",
    # Default: nest under "Ed-Fi" site at /adminapp-api -> URL is
    # https://localhost/adminapp-api. Pass -ParentSiteName "" to deploy as a
    # standalone site on $StandalonePort instead.
    [string]$ParentSiteName = "Ed-Fi",
    [string]$AppAlias = "adminapp-api",
    [int]$StandalonePort = 3333,

    [Parameter(Mandatory = $true)]
    [string]$SaPassword,

    [string]$DatabaseName = "sbaa",

    [string]$KeycloakIssuer = "http://localhost:8080/realms/edfi",
    [string]$KeycloakClientId = "edfiadminapp",

    [Parameter(Mandatory = $true)]
    [string]$KeycloakClientSecret,

    [string]$KeycloakManagementDomain = "localhost:8080",
    [string]$KeycloakMachineSecret = "edfi-machine-secret-456",

    # API port for standalone mode (only used when -ParentSiteName "")
    [int]$ApiPort = 3333,
    [int]$FePort = 4200,
    # URLs baked into production.js. Defaults match the HTTPS sub-app deployment.
    [string]$ApiUrl = "https://localhost/adminapp-api",
    [string]$FeUrl = "https://localhost/adminapp",
    [string]$AdminUsername = "admin@example.com",

    # Yopass: pass a non-empty URL to enable Yopass (one-time-share for newly-
    # created Ed-Fi API client credentials). Default is empty -> Yopass is
    # disabled and the AdminApp falls back to displaying credentials inline,
    # which is a documented and supported mode (USE_YOPASS=false).
    [string]$YopassUrl = ""
)

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration

$apiBuildDir = "$SourcePath\dist\packages\api"
if (-not (Test-Path "$apiBuildDir\main.js")) {
    throw "Build output not found at $apiBuildDir\main.js. Did you run 'npm run build:api'?"
}

# Selective copy. The deployment needs three pieces, NOT a full source-tree mirror:
#   1. Built API output (main.js + assets\)             from dist\packages\api\
#   2. Config files (production.js etc.)                from packages\api\config\
#   3. node_modules (runtime deps)                      from repo root
# Each piece is mirrored independently so /MIR doesn't wipe sibling content
# (web.config, iisnode\ logs, the other source piece).
New-Item -ItemType Directory -Path $DestPath -Force | Out-Null

Write-Host "Copying built API output..."
& robocopy $apiBuildDir $DestPath /E /NFL /NDL /NJH /NJS /XF web.config /XD iisnode packages node_modules | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy (build output) failed: $LASTEXITCODE" }

Write-Host "Copying api/config..."
New-Item -ItemType Directory -Path "$DestPath\packages\api" -Force | Out-Null
& robocopy "$SourcePath\packages\api\config" "$DestPath\packages\api\config" /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy (config) failed: $LASTEXITCODE" }

Write-Host "Copying node_modules (this takes a minute)..."
& robocopy "$SourcePath\node_modules" "$DestPath\node_modules" /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy (node_modules) failed: $LASTEXITCODE" }

# App Pool
if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
    Write-Host "Creating App Pool '$AppPoolName'..."
    New-WebAppPool -Name $AppPoolName | Out-Null
}
Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "processModel.loadUserProfile" -Value $true
Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedRuntimeVersion" -Value ""
Write-Host "App Pool '$AppPoolName' configured (LoadUserProfile=true)."

# IIS site or application
if ($ParentSiteName) {
    $parent = Get-Website -Name $ParentSiteName -ErrorAction SilentlyContinue
    if (-not $parent) { throw "Parent site '$ParentSiteName' not found." }

    $existing = Get-WebApplication -Site $ParentSiteName -Name $AppAlias -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Application '$AppAlias' under '$ParentSiteName' exists. Updating..."
        Set-ItemProperty -Path "IIS:\Sites\$ParentSiteName\$AppAlias" -Name "physicalPath" -Value $DestPath
        Set-ItemProperty -Path "IIS:\Sites\$ParentSiteName\$AppAlias" -Name "applicationPool" -Value $AppPoolName
    } else {
        New-WebApplication -Site $ParentSiteName -Name $AppAlias -PhysicalPath $DestPath -ApplicationPool $AppPoolName | Out-Null
        Write-Host "Application '$AppAlias' created under site '$ParentSiteName'."
    }
} else {
    if (Get-Website -Name $AppPoolName -ErrorAction SilentlyContinue) {
        Write-Host "Site '$AppPoolName' exists. Updating physical path..."
        Set-ItemProperty -Path "IIS:\Sites\$AppPoolName" -Name "physicalPath" -Value $DestPath
        Set-ItemProperty -Path "IIS:\Sites\$AppPoolName" -Name "applicationPool" -Value $AppPoolName
    } else {
        New-Website -Name $AppPoolName -Port $StandalonePort -PhysicalPath $DestPath -ApplicationPool $AppPoolName | Out-Null
        Write-Host "Standalone site '$AppPoolName' created on port $StandalonePort."
    }
}

# web.config (the version that actually works)
$webConfig = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="NodeJS" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
          </conditions>
          <serverVariables>
            <set name="HTTP_X_ORIGINAL_URL" value="/{R:0}?{QUERY_STRING}" />
          </serverVariables>
          <action type="Rewrite" url="main.js" />
        </rule>
      </rules>
    </rewrite>
    <iisnode nodeProcessCommandLine="&quot;C:\Program Files\nodejs\node.exe&quot;" watchedFiles="web.config;*.js" loggingEnabled="true" logDirectory="iisnode" debuggingEnabled="true" devErrorsEnabled="true" node_env="production" promoteServerVars="PORT" />
    <defaultDocument>
      <files>
        <clear />
        <add value="main.js" />
      </files>
    </defaultDocument>
    <httpErrors errorMode="Detailed" />
    <handlers>
      <add name="iisnode-all" path="main.js" verb="*" modules="iisnode" resourceType="Unspecified" />
    </handlers>
  </system.webServer>
</configuration>
'@

$webConfigPath = "$DestPath\web.config"
$webConfigChanged = $true
if (Test-Path $webConfigPath) {
    $existing = Get-Content $webConfigPath -Raw
    if ($existing -eq $webConfig) {
        $webConfigChanged = $false
        Write-Host "web.config already matches — not rewriting."
    }
}
if ($webConfigChanged) {
    Set-Content -Path $webConfigPath -Value $webConfig -Encoding UTF8
    Write-Host "web.config written."
}

# The source repo ships production.js as a thin stub (only FE_URL, DB_SSL,
# ENABLE_OPEN_API, WHITELISTED_REDIRECTS) and production.js-edfi as the full
# Ed-Fi template (DB_SECRET_VALUE, OIDC config, etc.). The full template is
# what the API actually needs; always overwrite from it before patching.
$prodJs = "$DestPath\packages\api\config\production.js"
$prodJsTemplate = "$DestPath\packages\api\config\production.js-edfi"
if (Test-Path $prodJsTemplate) {
    Copy-Item $prodJsTemplate $prodJs -Force
    Write-Host "Seeded production.js from production.js-edfi template."
} elseif (-not (Test-Path $prodJs)) {
    throw "Neither production.js nor production.js-edfi found in deployed config folder."
}

# Patch production.js -- only write if any replacement actually changed something
$prodJsChanged = $false
if (Test-Path $prodJs) {
    $original = Get-Content $prodJs -Raw
    $c = $original
    # JS-escape single quotes in the password
    $jsPw = $SaPassword.Replace("'", "\'")
    $c = $c.Replace("DB_ENGINE: 'pgsql',",                                  "DB_ENGINE: 'mssql',")
    $c = $c.Replace("DB_TRUST_CERTIFICATE: false,",                         "DB_TRUST_CERTIFICATE: true,")
    $c = $c.Replace("MSSQL_DB_HOST: 'edfiadminapp-mssql',",                 "MSSQL_DB_HOST: 'localhost',")
    $c = $c.Replace("MSSQL_DB_DATABASE: 'sbaa',",                           "MSSQL_DB_DATABASE: '$DatabaseName',")
    $c = $c.Replace("MSSQL_DB_PASSWORD: 'YourStrong!Passw0rd',",            "MSSQL_DB_PASSWORD: '$jsPw',")
    $c = $c.Replace("API_PORT: 3333,",                                      "API_PORT: process.env.PORT || 3333,")
    $c = $c.Replace("MY_URL: 'https://localhost/adminapp-api',",            "MY_URL: '$ApiUrl',")
    $c = $c.Replace("const FE_URL = 'https://localhost/adminapp';",         "const FE_URL = '$FeUrl';")
    $c = $c.Replace("issuer: 'https://localhost/auth/realms/edfi',",        "issuer: '$KeycloakIssuer',")
    $c = $c.Replace("ISSUER: 'https://localhost/auth/realms/edfi',",        "ISSUER: '$KeycloakIssuer',")
    $c = $c.Replace("clientId: 'edfiadminapp',",                            "clientId: '$KeycloakClientId',")
    $c = $c.Replace("CLIENT_ID: 'edfiadminapp',",                           "CLIENT_ID: '$KeycloakClientId',")
    $c = $c.Replace("clientSecret: 'big-secret-123',",                      "clientSecret: '$KeycloakClientSecret',")
    $c = $c.Replace("CLIENT_SECRET: 'big-secret-123',",                     "CLIENT_SECRET: '$KeycloakClientSecret',")
    $c = $c.Replace("MANAGEMENT_DOMAIN: 'localhost',",                      "MANAGEMENT_DOMAIN: '$KeycloakManagementDomain',")
    $c = $c.Replace("MANAGEMENT_CLIENT_SECRET: 'edfi-machine-secret-456'",  "MANAGEMENT_CLIENT_SECRET: '$KeycloakMachineSecret'")
    $c = $c.Replace("ADMIN_USERNAME: 'admin@example.com',",                 "ADMIN_USERNAME: '$AdminUsername',")

    # Yopass: enable iff a URL was provided, otherwise disable (USE_YOPASS=false
    # is supported by the AdminApp -- credentials are shown inline instead of
    # via a one-time-share link).
    $useYopassJs = if ($YopassUrl) { 'true' } else { 'false' }
    $c = $c.Replace("USE_YOPASS: true,",                                    "USE_YOPASS: $useYopassJs,")
    $c = $c.Replace("YOPASS_URL: 'http://edfiadminapp-yopass:80',",         "YOPASS_URL: '$YopassUrl',")

    if ($c -ne $original) {
        Set-Content -Path $prodJs -Value $c -Encoding UTF8
        Write-Host "production.js patched."
        $prodJsChanged = $true
    } else {
        Write-Host "production.js already has the desired values — not rewriting."
    }
} else {
    Write-Warning "production.js not found at $prodJs — skipping patch."
}

# Permissions for the App Pool virtual account. Done here (not in 03a) because
# the pool now actually exists.
$appPoolIdentity = "IIS APPPOOL\$AppPoolName"
& icacls "$DestPath\packages" /grant "${appPoolIdentity}:(OI)(CI)M" /T | Out-Null
$iisnodeDir = "$DestPath\iisnode"
New-Item -ItemType Directory -Path $iisnodeDir -Force | Out-Null
& icacls $iisnodeDir /grant "${appPoolIdentity}:(OI)(CI)F" /T | Out-Null

# npm cache override -- the folder was created in 03a, but the App Pool user
# didn't exist yet. Grant access now so npm under iisnode can write to it.
$npmCache = [Environment]::GetEnvironmentVariable("NPM_CONFIG_CACHE", "Machine")
if ($npmCache -and (Test-Path $npmCache)) {
    & icacls $npmCache /grant "${appPoolIdentity}:(OI)(CI)M" /T | Out-Null
    Write-Host "Permissions granted to $appPoolIdentity (app folder + npm cache)."
} else {
    Write-Host "Permissions granted to $appPoolIdentity (app folder)."
}

# Trigger startup only if something actually changed
if ($webConfigChanged -or $prodJsChanged) {
    (Get-Item "$DestPath\web.config").LastWriteTime = Get-Date
    Write-Host "Touched web.config to recycle the app pool."
} else {
    Write-Host "No file changes — skipping app pool recycle."
}

Write-Host ""
Write-Host "SUCCESS: Admin App API deployed." -ForegroundColor Green
if ($ParentSiteName) {
    Write-Host "URL: https://localhost/$AppAlias/api/teams (expect 401 without a bearer token)"
} else {
    Write-Host "URL: http://localhost:${StandalonePort}/api/teams"
}
