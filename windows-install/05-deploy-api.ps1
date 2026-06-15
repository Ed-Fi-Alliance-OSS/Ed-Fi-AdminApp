#Requires -RunAsAdministrator
<#
.SYNOPSIS
Deploys the Ed-Fi Admin App API to IIS under iisnode.

.DESCRIPTION
- Copies built API files from source to destination
- Creates/configures the IIS App Pool (LoadUserProfile=true, no managed runtime)
- Creates or updates the IIS application (under a parent site) or standalone site
- Writes a known-good web.config (the three iisnode adjustments baked in)
- Patches production.js with bare-metal values (DB, API/FE URLs, OIDC)
- Sets icacls permissions for the App Pool user

Run AFTER:
  - 02-prereqs-sql.ps1 (SQL ready)
  - 01-prereqs-iis.ps1 (IIS + iisnode ready)
  - 03-prereqs-node.ps1 (Node, npm cache ready)
  - `npm ci --legacy-peer-deps` and `npm run build:api` in the source repo

.PARAMETER SourcePath
The built API output folder. Typically the repo root, containing main.js +
packages\ + node_modules\.

.PARAMETER DestPath
Where to deploy. Default: C:\inetpub\Ed-Fi\EdFi-AdminApp-API.

.PARAMETER AppPoolName
Name of the IIS App Pool. Default: EdFi-AdminApp-API.

.PARAMETER StandalonePort
HTTP port for the standalone API site (EdFi-AdminApp-API). Default: 3333.

.PARAMETER SaPassword
SQL Server sa password (set in 02-prereqs-sql.ps1).

.PARAMETER DatabaseName
SQL Server database name. Default: sbaa. Must match what 02-prereqs-sql.ps1 created.

.PARAMETER OidcIssuer
OIDC issuer URL. Default (Keycloak example): http://localhost:8080/realms/edfi.

.PARAMETER OidcClientId
OIDC client id. Default (Keycloak example): edfiadminapp.

.PARAMETER OidcClientSecret
OIDC client secret (the secret configured on the client in your IdP).

.PARAMETER OidcScope
OIDC scopes requested at login. Default: 'openid email profile'.

.PARAMETER OidcManagementDomain
Management API domain (host:port) of the IdP. Default (Keycloak example): localhost:8080.

.PARAMETER OidcMachineSecret
Machine-to-machine client secret. Default (Keycloak example): edfi-machine-secret-456.

.PARAMETER AdminUsername
Email seeded as the admin user. Default: admin@example.com.

.EXAMPLE
.\05-deploy-api.ps1 -SourcePath C:\Ed-Fi\Ed-Fi-AdminApp -SaPassword 'EdFi-Local!' -OidcClientSecret 'RBsHTSb...'
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [string]$DestPath = "C:\inetpub\Ed-Fi\adminapp-api",
    [string]$AppPoolName = "EdFi-AdminApp-API",
    # The API deploys as a standalone HTTP site named $AppPoolName on this port.
    [int]$StandalonePort = 3333,

    # Which database engine production.js should be configured for.
    # 'mssql' -> requires -SaPassword.
    # 'pgsql' -> requires -PgDbPassword (host/port/user/db default to the
    # docker-compose setup under windows-install\docker\). Engine-specific
    # password validation is enforced in the body of the script; -DbEngine
    # itself has a default, so it should not be Mandatory.
    [ValidateSet('mssql','pgsql')]
    [string]$DbEngine = 'mssql',

    # SQL Server sa password. Required only when -DbEngine is 'mssql'.
    [string]$SaPassword,

    [string]$DatabaseName = "sbaa",

    # PostgreSQL connection details. Required only when -DbEngine is 'pgsql'.
    # Defaults match the docker-compose setup at windows-install\docker\ where
    # the dedicated app user 'edfiadminapp' is provisioned by init/01-...sh.
    [string]$PgDbHost = "localhost",
    [int]$PgDbPort = 5432,
    [string]$PgDbUsername = "edfiadminapp",
    [string]$PgDbPassword,

    # OIDC settings written into production.js. Defaults are the local-Keycloak
    # example; override for any other provider (Entra, Google, Auth0, ...).
    [string]$OidcIssuer = "http://localhost:8080/realms/edfi",
    [string]$OidcClientId = "edfiadminapp",

    [Parameter(Mandatory = $true)]
    [string]$OidcClientSecret,

    [string]$OidcManagementDomain = "localhost:8080",
    [string]$OidcMachineSecret = "edfi-machine-secret-456",
    [string]$OidcScope = "openid email profile",

    # URLs baked into production.js. Defaults match the standalone HTTP sites.
    [string]$ApiUrl = "http://localhost:3333",
    [string]$FeUrl = "http://localhost:4200",
    [string]$AdminUsername = "admin@example.com",

    # Yopass: pass a non-empty URL to enable Yopass (one-time-share for newly-
    # created Ed-Fi API client credentials). Default is empty -> Yopass is
    # disabled and the AdminApp falls back to displaying credentials inline,
    # which is a documented and supported mode (USE_YOPASS=false).
    [string]$YopassUrl = ""
)

$ErrorActionPreference = 'Stop'

# Precondition: IIS + the WebAdministration module must be available
# (01-prereqs-iis.ps1 installs the IIS pieces). Fail early with an actionable
# message instead of a cryptic Import-Module error.
try {
    Import-Module WebAdministration -ErrorAction Stop
} catch {
    throw "IIS / the WebAdministration module isn't available. Ensure IIS is installed (setup-vm-prereqs.ps1) and run 01-prereqs-iis.ps1 before deploying."
}

# Precondition: the npm cache override must be set (03-prereqs-node.ps1 sets it).
# Without it, npm under the locked-down App Pool identity tries to write its cache
# to the user profile (which that account can't write) and the app pool fails to
# start under iisnode. Fail early instead of leaving a cryptic runtime error.
if (-not [Environment]::GetEnvironmentVariable("NPM_CONFIG_CACHE", "Machine")) {
    throw "NPM_CONFIG_CACHE (Machine) is not set. Run 03-prereqs-node.ps1 first so npm under iisnode has a writable cache."
}

# Engine-specific required arg validation. Each engine needs its own password
# parameter; the other one is irrelevant and ignored.
if ($DbEngine -eq 'mssql' -and -not $SaPassword) {
    throw "-SaPassword is required when -DbEngine is 'mssql'."
}
if ($DbEngine -eq 'pgsql' -and -not $PgDbPassword) {
    throw "-PgDbPassword is required when -DbEngine is 'pgsql'."
}

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

# IIS standalone HTTP site (named after the App Pool, e.g. EdFi-AdminApp-API)
if (Get-Website -Name $AppPoolName -ErrorAction SilentlyContinue) {
    Write-Host "Site '$AppPoolName' exists. Updating physical path..."
    Set-ItemProperty -Path "IIS:\Sites\$AppPoolName" -Name "physicalPath" -Value $DestPath
    Set-ItemProperty -Path "IIS:\Sites\$AppPoolName" -Name "applicationPool" -Value $AppPoolName
} else {
    New-Website -Name $AppPoolName -Port $StandalonePort -PhysicalPath $DestPath -ApplicationPool $AppPoolName | Out-Null
    Write-Host "Standalone site '$AppPoolName' created on HTTP port $StandalonePort."
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

# Patch production.js -- only write if any replacement actually changed something.
# Engine-aware: mssql replaces DB_ENGINE+MSSQL_DB_* defaults, pgsql replaces
# the postgres defaults inside DB_SECRET_VALUE (and sets DB_SSL: false because
# the docker-compose postgres uses a self-signed cert that TypeORM's
# verify-full mode rejects -- see windows-install\docker\README.md).
$prodJsChanged = $false
if (Test-Path $prodJs) {
    $original = Get-Content $prodJs -Raw
    $c = $original

    if ($DbEngine -eq 'mssql') {
        # JS-escape single quotes in the password
        $jsPw = $SaPassword.Replace("'", "\'")
        $c = $c.Replace("DB_ENGINE: 'pgsql',",                                  "DB_ENGINE: 'mssql',")
        $c = $c.Replace("DB_TRUST_CERTIFICATE: false,",                         "DB_TRUST_CERTIFICATE: true,")
        $c = $c.Replace("MSSQL_DB_HOST: 'edfiadminapp-mssql',",                 "MSSQL_DB_HOST: 'localhost',")
        $c = $c.Replace("MSSQL_DB_DATABASE: 'sbaa',",                           "MSSQL_DB_DATABASE: '$DatabaseName',")
        $c = $c.Replace("MSSQL_DB_PASSWORD: 'YourStrong!Passw0rd',",            "MSSQL_DB_PASSWORD: '$jsPw',")
    } else {
        # pgsql: leave DB_ENGINE alone (template already says 'pgsql'), turn
        # off DB_SSL for the docker self-signed cert, patch the postgres
        # defaults inside DB_SECRET_VALUE.
        $jsPgPw = $PgDbPassword.Replace("'", "\'")
        $c = $c.Replace("DB_SSL: true,",                                        "DB_SSL: false,")
        $c = $c.Replace("DB_HOST: 'edfiadminapp-postgres',",                    "DB_HOST: '$PgDbHost',")
        $c = $c.Replace("DB_PORT: 5432,",                                       "DB_PORT: $PgDbPort,")
        $c = $c.Replace("DB_USERNAME: 'postgres',",                             "DB_USERNAME: '$PgDbUsername',")
        $c = $c.Replace("DB_DATABASE: 'sbaa',",                                 "DB_DATABASE: '$DatabaseName',")
        $c = $c.Replace("DB_PASSWORD: 'postgres',",                             "DB_PASSWORD: '$jsPgPw',")
    }

    $c = $c.Replace("API_PORT: 3333,",                                      "API_PORT: process.env.PORT || 3333,")
    $c = $c.Replace("MY_URL: 'https://localhost/adminapp-api',",            "MY_URL: '$ApiUrl',")
    $c = $c.Replace("const FE_URL = 'https://localhost/adminapp';",         "const FE_URL = '$FeUrl';")
    $c = $c.Replace("issuer: 'https://localhost/auth/realms/edfi',",        "issuer: '$OidcIssuer',")
    $c = $c.Replace("ISSUER: 'https://localhost/auth/realms/edfi',",        "ISSUER: '$OidcIssuer',")
    $c = $c.Replace("clientId: 'edfiadminapp',",                            "clientId: '$OidcClientId',")
    $c = $c.Replace("CLIENT_ID: 'edfiadminapp',",                           "CLIENT_ID: '$OidcClientId',")
    $c = $c.Replace("clientSecret: 'big-secret-123',",                      "clientSecret: '$OidcClientSecret',")
    $c = $c.Replace("CLIENT_SECRET: 'big-secret-123',",                     "CLIENT_SECRET: '$OidcClientSecret',")
    $c = $c.Replace("scope: '',",                                           "scope: '$OidcScope',")
    $c = $c.Replace("MANAGEMENT_DOMAIN: 'localhost',",                      "MANAGEMENT_DOMAIN: '$OidcManagementDomain',")
    $c = $c.Replace("MANAGEMENT_CLIENT_SECRET: 'edfi-machine-secret-456'",  "MANAGEMENT_CLIENT_SECRET: '$OidcMachineSecret'")
    $c = $c.Replace("ADMIN_USERNAME: 'admin@example.com',",                 "ADMIN_USERNAME: '$AdminUsername',")

    # Yopass: enable iff a URL was provided, otherwise disable (USE_YOPASS=false
    # is supported by the AdminApp -- credentials are shown inline instead of
    # via a one-time-share link).
    $useYopassJs = if ($YopassUrl) { 'true' } else { 'false' }
    $c = $c.Replace("USE_YOPASS: true,",                                    "USE_YOPASS: $useYopassJs,")
    $c = $c.Replace("YOPASS_URL: 'http://edfiadminapp-yopass:80',",         "YOPASS_URL: '$YopassUrl',")

    if ($c -ne $original) {
        Set-Content -Path $prodJs -Value $c -Encoding UTF8
        Write-Host "production.js patched ($DbEngine)."
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
Write-Host "URL: http://localhost:${StandalonePort}/api/teams (expect 401 without a bearer token)"
