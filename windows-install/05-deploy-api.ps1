#Requires -RunAsAdministrator
<#
.SYNOPSIS
Deploys the Ed-Fi Admin App API to IIS via the httpPlatform handler.

.DESCRIPTION
- Copies built API files from source to destination
- Creates/configures the IIS App Pool (LoadUserProfile=true, no managed runtime)
- Creates or updates the IIS application (under a parent site) or standalone site
- Writes the httpPlatform web.config (handler + <httpPlatform> block)
- Patches production.js with bare-metal values (DB, API/FE URLs, OIDC)
- Sets icacls permissions for the App Pool user

Run AFTER:
  - 02-prereqs-sql.ps1 (SQL ready)
  - 01-prereqs-iis.ps1 (IIS + httpPlatform handler ready)
  - 03-prereqs-node.ps1 (Node, npm cache ready)
  - `npm ci --legacy-peer-deps` and `npm run build:api` in the source repo

.PARAMETER SourcePath
The built API output folder. Typically the repo root, containing main.js +
packages\ + node_modules\.

.PARAMETER DestPath
Where to deploy. Default: C:\inetpub\EdFi-AdminApp-API (a dedicated directory,
not nested under another site's root).

.PARAMETER AppPoolName
Name of the IIS App Pool. Default: EdFi-AdminApp-API.

.PARAMETER StandalonePort
HTTP port for the standalone API site (EdFi-AdminApp-API). Default: 3333.

.PARAMETER AppDbUsername
The dedicated least-privilege SQL login the Admin App connects as, provisioned by
02-prereqs-sql.ps1 (db_owner on the app DB, not sa). Written into production.js as
MSSQL_DB_USERNAME. Default: edfi_adminapp.

.PARAMETER AppDbPassword
Password for the dedicated Admin App login (set in 02-prereqs-sql.ps1). Written
into production.js as MSSQL_DB_PASSWORD.

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

.PARAMETER AdminUsername
Email seeded as the admin user. Default: admin@example.com.

.EXAMPLE
.\05-deploy-api.ps1 -SourcePath C:\Ed-Fi\Ed-Fi-AdminApp -AppDbPassword 'EdFi-App-Local!2026' -OidcClientSecret 'RBsHTSb...'
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [string]$DestPath = "C:\inetpub\EdFi-AdminApp-API",
    [string]$AppPoolName = "EdFi-AdminApp-API",
    # The API deploys as a standalone HTTP site named $AppPoolName on this port.
    [int]$StandalonePort = 3333,
    # npm cache folder, granted to the App Pool identity and set as the pool's
    # NPM_CONFIG_CACHE so npm under the App Pool writes there (not the unwritable profile).
    [string]$NpmCachePath = "C:\npm-cache",

    # Which database engine production.js should be configured for.
    # 'mssql' -> requires -AppDbPassword.
    # 'pgsql' -> requires -PgDbPassword (host/port/user/db default to the
    # docker-compose setup under windows-install\docker\). Engine-specific
    # password validation is enforced in the body of the script; -DbEngine
    # itself has a default, so it should not be Mandatory.
    [ValidateSet('mssql','pgsql')]
    [string]$DbEngine = 'mssql',

    # SQL Server credentials the Admin App connects as at runtime. Required only
    # when -DbEngine is 'mssql'. This is the dedicated least-privilege login
    # provisioned by 02-prereqs-sql.ps1 (db_owner on the app DB, not sa).
    [string]$AppDbUsername = "edfi_adminapp",
    [SecureString]$AppDbPassword,

    [string]$DatabaseName = "sbaa",

    # PostgreSQL connection details. Required only when -DbEngine is 'pgsql'.
    # Defaults match the docker-compose setup at windows-install\docker\ where
    # the dedicated app user 'edfiadminapp' is provisioned by init/01-...sh.
    [string]$PgDbHost = "localhost",
    [int]$PgDbPort = 5432,
    [string]$PgDbUsername = "edfiadminapp",
    [SecureString]$PgDbPassword,

    # OIDC settings written into production.js. Defaults are the local-Keycloak
    # example; override for any other provider (Entra, Google, Auth0, ...).
    [string]$OidcIssuer = "http://localhost:8080/realms/edfi",
    [string]$OidcClientId = "edfiadminapp",

    [Parameter(Mandatory = $true)]
    [SecureString]$OidcClientSecret,

    [string]$OidcScope = "openid email profile",

    # URLs baked into production.js. Defaults match the standalone HTTP sites.
    [string]$ApiUrl = "http://localhost:3333",
    [string]$FeUrl = "http://localhost:4200",
    [string]$AdminUsername = "admin@example.com",

    # Yopass: pass a non-empty URL to enable Yopass (one-time-share for newly-
    # created Ed-Fi API client credentials). Default is empty -> Yopass is
    # disabled and the AdminApp falls back to displaying credentials inline,
    # which is a documented and supported mode (USE_YOPASS=false).
    [string]$YopassUrl = "",

    # Data-at-rest encryption key (64 hex chars / 32 bytes) the AdminApp uses to
    # encrypt stored ODS/API environment secrets (aes-256-cbc). Empty -> reuse an
    # already-deployed non-default key, or generate a fresh one on a clean box. A
    # post-patch guard rejects the shipped default. Losing or changing this key
    # makes previously-encrypted environment secrets unrecoverable.
    [string]$DbEncryptionKey = "",

    # Escape hatch for the key-rotation guard: proceed even when a freshly
    # generated key would orphan existing encrypted environments (accepts data loss).
    [switch]$ForceKeyRotation
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

# Engine-specific required arg validation. Each engine needs its own password
# parameter; the other one is irrelevant and ignored.
if ($DbEngine -eq 'mssql' -and -not $AppDbPassword) {
    throw "-AppDbPassword is required when -DbEngine is 'mssql'."
}
if ($DbEngine -eq 'pgsql' -and -not $PgDbPassword) {
    throw "-PgDbPassword is required when -DbEngine is 'pgsql'."
}

# Secrets arrive as SecureString (kept off the command line); unwrap the ones
# supplied to plaintext locals for sqlcmd -P and the production.js patch.
# Point-of-use plaintext is unavoidable. DbEncryptionKey stays a plain string:
# it's generated/reused internally, not a caller-supplied credential.
# Use new locals -- assigning back to the [SecureString]-typed parameters would
# re-trigger their type conversion and fail.
$AppDbPasswordPlain    = if ($AppDbPassword)    { [System.Net.NetworkCredential]::new('', $AppDbPassword).Password } else { $null }
$PgDbPasswordPlain     = if ($PgDbPassword)     { [System.Net.NetworkCredential]::new('', $PgDbPassword).Password } else { $null }
$OidcClientSecretPlain = if ($OidcClientSecret) { [System.Net.NetworkCredential]::new('', $OidcClientSecret).Password } else { $null }

$apiBuildDir = "$SourcePath\dist\packages\api"
if (-not (Test-Path "$apiBuildDir\main.js")) {
    throw "Build output not found at $apiBuildDir\main.js. Did you run 'npm run build:api'?"
}

# Selective copy. The deployment needs three pieces, NOT a full source-tree mirror:
#   1. Built API output (main.js + assets\)             from dist\packages\api\
#   2. Config files (production.js etc.)                from packages\api\config\
#   3. node_modules (runtime deps)                      from repo root
# Each piece is mirrored independently so /MIR doesn't wipe sibling content
# (web.config, logs\, the other source piece).
# Capture any already-deployed non-default encryption key BEFORE the file-copy
# phase below overwrites production.js. The source ships a stub production.js that
# the config copy would otherwise clobber, defeating key reuse and silently
# rotating the key on every re-run. Reusing it keeps previously-encrypted ODS/API
# environment secrets decryptable across a reinstall.
$defaultKey = 'bbeadc2d4d15f5c9cfc2239b682cca392b233ee6979b6b9578d256aa01a7c565'
$existingDeployedKey = ''
$deployedProdJs = "$DestPath\packages\api\config\production.js"
if (Test-Path $deployedProdJs) {
    if ((Get-Content $deployedProdJs -Raw) -match "KEY: '([0-9a-f]{64})'" -and $Matches[1] -ne $defaultKey) {
        $existingDeployedKey = $Matches[1]
    }
}

New-Item -ItemType Directory -Path $DestPath -Force | Out-Null

Write-Host "Copying built API output..."
& robocopy $apiBuildDir $DestPath /E /NFL /NDL /NJH /NJS /XF web.config /XD logs packages node_modules | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Failed to copy the built API output from $apiBuildDir to $DestPath (robocopy exit $LASTEXITCODE). Check free disk space and that the destination isn't locked by a running app pool." }

Write-Host "Copying api/config..."
New-Item -ItemType Directory -Path "$DestPath\packages\api" -Force | Out-Null
& robocopy "$SourcePath\packages\api\config" "$DestPath\packages\api\config" /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Failed to copy api/config from $SourcePath\packages\api\config to $DestPath\packages\api\config (robocopy exit $LASTEXITCODE)." }

Write-Host "Copying node_modules (this takes a minute)..."
& robocopy "$SourcePath\node_modules" "$DestPath\node_modules" /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Failed to copy node_modules from $SourcePath\node_modules to $DestPath\node_modules (robocopy exit $LASTEXITCODE). Check free disk space." }

# App Pool
try {
    if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
        Write-Host "Creating App Pool '$AppPoolName'..."
        New-WebAppPool -Name $AppPoolName | Out-Null
    }
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "processModel.loadUserProfile" -Value $true
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedRuntimeVersion" -Value ""
    Write-Host "App Pool '$AppPoolName' configured (LoadUserProfile=true)."
} catch {
    throw "Failed to create/configure the IIS App Pool '$AppPoolName'. Is IIS running and the WAS service started? Original: $($_.Exception.Message)"
}

# IIS standalone HTTP site (named after the App Pool, e.g. EdFi-AdminApp-API)
try {
    if (Get-Website -Name $AppPoolName -ErrorAction SilentlyContinue) {
        Write-Host "Site '$AppPoolName' exists. Updating physical path..."
        Set-ItemProperty -Path "IIS:\Sites\$AppPoolName" -Name "physicalPath" -Value $DestPath
        Set-ItemProperty -Path "IIS:\Sites\$AppPoolName" -Name "applicationPool" -Value $AppPoolName
    } else {
        New-Website -Name $AppPoolName -Port $StandalonePort -PhysicalPath $DestPath -ApplicationPool $AppPoolName | Out-Null
        Write-Host "Standalone site '$AppPoolName' created on HTTP port $StandalonePort."
    }
} catch {
    throw "Failed to create/update the IIS site '$AppPoolName' on port $StandalonePort. Is the port already in use by another site (check 00-check-prereqs.ps1)? Original: $($_.Exception.Message)"
}

# web.config -- IIS hosts Node via the httpPlatform handler (reverse proxy to a
# loopback port IIS assigns through HTTP_PLATFORM_PORT). httpPlatform launches node
# AS the App Pool virtual account, so node must live where that identity can execute
# it: a machine-wide location, NOT under a user profile. nvm-windows points
# <root>\nodejs at the active version via a symlink and can resolve into
# C:\Users\<user>\... -- which the App Pool can't traverse, failing with Access
# Denied / HTTP 502.5. Resolve the PATH node, follow its symlink to the real target,
# reject a user-profile path, and fall back to a machine-wide install.
$nodeExe = $null
$nodeCandidates = @()
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) { $nodeCandidates += $nodeCmd.Source }
$nodeCandidates += "C:\Program Files\nodejs\node.exe"
foreach ($candidate in ($nodeCandidates | Where-Object { $_ } | Select-Object -Unique)) {
    if (-not (Test-Path $candidate)) { continue }
    $link = (Get-Item $candidate -ErrorAction SilentlyContinue).Target
    $real = if ($link) { @($link)[0] } else { $candidate }
    if ($real -like "$env:SystemDrive\Users\*") {
        Write-Host "Skipping node at $real (under a user profile; the IIS App Pool can't execute it)." -ForegroundColor DarkGray
        continue
    }
    $nodeExe = $real
    break
}
if (-not $nodeExe) {
    throw "No IIS-accessible node.exe found. Install Node machine-wide (e.g. winget OpenJS.NodeJS.LTS -> C:\Program Files\nodejs) so the IIS App Pool identity can execute it. Node under a user profile (an nvm-windows default) is not hostable by IIS. Re-run 03-prereqs-node.ps1 if needed."
}
Write-Host "httpPlatform will launch node at: $nodeExe"

$webConfig = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="httpPlatformHandler" path="*" verb="*" modules="httpPlatformHandler" resourceType="Unspecified" />
    </handlers>
    <httpPlatform processPath="__NODE_EXE__" arguments="main.js" stdoutLogEnabled="true" stdoutLogFile=".\logs\node-stdout.log" startupTimeLimit="60">
      <environmentVariables>
        <environmentVariable name="NODE_ENV" value="production" />
      </environmentVariables>
    </httpPlatform>
    <httpErrors errorMode="Detailed" />
  </system.webServer>
</configuration>
'@
$webConfig = $webConfig.Replace('__NODE_EXE__', $nodeExe)

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
    try {
        Set-Content -Path $webConfigPath -Value $webConfig -Encoding UTF8
    } catch {
        throw "Failed to write web.config at $webConfigPath. Check the destination is writable. Original: $($_.Exception.Message)"
    }
    Write-Host "web.config written."
}

# The source repo ships production.js as a thin stub (only FE_URL, DB_SSL,
# ENABLE_OPEN_API, WHITELISTED_REDIRECTS) and production.js-edfi as the full
# Ed-Fi template (DB_SECRET_VALUE, OIDC config, etc.). The full template is
# what the API actually needs; always overwrite from it before patching.
$prodJs = "$DestPath\packages\api\config\production.js"
$prodJsTemplate = "$DestPath\packages\api\config\production.js-edfi"

# Resolve the data-at-rest encryption key. Precedence: an explicit -DbEncryptionKey
# wins; else reuse the key captured from the previously-deployed production.js
# (grabbed before the copy phase clobbered it); a clean box with no prior key
# generates a fresh one. Rotating this key makes previously-encrypted ODS/API
# environment secrets unrecoverable, which the guard below defends against.
$freshKeyGenerated = $false
if (-not $DbEncryptionKey -and $existingDeployedKey) {
    $DbEncryptionKey = $existingDeployedKey
    Write-Host "Reusing the existing per-install data-encryption key."
}
if (-not $DbEncryptionKey) {
    $keyBytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($keyBytes)
    $DbEncryptionKey = ($keyBytes | ForEach-Object { $_.ToString('x2') }) -join ''
    $freshKeyGenerated = $true
    Write-Host "Generated a per-install data-encryption key."
}

# Guard (defense-in-depth): a freshly generated key cannot decrypt environment
# secrets written under a prior install's key. If we're deploying a NEW key but
# the DB already holds environment rows, fail loudly instead of letting the app
# break with a generic "unexpected error". MSSQL only (the engine tested here);
# a pgsql guard is a follow-up. Best-effort: an unreachable DB / missing table is
# treated as "no data at risk".
if ($freshKeyGenerated -and $DbEngine -eq 'mssql' -and -not $ForceKeyRotation) {
    $envCount = 0
    # Pass the password via SQLCMDPASSWORD instead of -P so it stays off the
    # sqlcmd process command line; cleared in the finally.
    $env:SQLCMDPASSWORD = $AppDbPasswordPlain
    try {
        $out = & sqlcmd -S "tcp:localhost,1433" -U $AppDbUsername -d $DatabaseName -C -h -1 -W -t 10 `
            -Q "SET NOCOUNT ON; IF OBJECT_ID('sb_environment','U') IS NOT NULL SELECT COUNT(*) FROM sb_environment ELSE SELECT 0;" 2>$null
        if ($LASTEXITCODE -eq 0 -and $out) { $envCount = [int]("$($out | Select-Object -First 1)").Trim() }
    } catch {
        Write-Warning "Could not verify existing encrypted environments before deploying a new key: $($_.Exception.Message)"
    } finally {
        Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue
    }
    if ($envCount -gt 0) {
        throw @"
A new data-at-rest encryption key was generated, but database '$DatabaseName' already
holds $envCount encrypted environment(s) from a previous install. The new key CANNOT
decrypt them -- the Admin App would fail with a generic error. Choose one:
  * Run uninstall.ps1 (drops '$DatabaseName'), then reinstall -- clean slate.
  * Pass the ORIGINAL key via -DbEncryptionKey to keep the existing environments.
  * Pass -ForceKeyRotation to proceed anyway and abandon the existing encrypted data.
"@
    }
}

if (Test-Path $prodJsTemplate) {
    try {
        Copy-Item $prodJsTemplate $prodJs -Force
    } catch {
        throw "Failed to seed production.js from the -edfi template at $prodJsTemplate. Check the config folder is writable. Original: $($_.Exception.Message)"
    }
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
        # JS-escape single quotes in the app credentials
        $jsUser = $AppDbUsername.Replace("'", "\'")
        $jsPw = $AppDbPasswordPlain.Replace("'", "\'")
        $c = $c.Replace("DB_ENGINE: 'pgsql',",                                  "DB_ENGINE: 'mssql',")
        $c = $c.Replace("DB_TRUST_CERTIFICATE: false,",                         "DB_TRUST_CERTIFICATE: true,")
        $c = $c.Replace("MSSQL_DB_HOST: 'edfiadminapp-mssql',",                 "MSSQL_DB_HOST: 'localhost',")
        $c = $c.Replace("MSSQL_DB_DATABASE: 'sbaa',",                           "MSSQL_DB_DATABASE: '$DatabaseName',")
        $c = $c.Replace("MSSQL_DB_USERNAME: 'sa',",                             "MSSQL_DB_USERNAME: '$jsUser',")
        $c = $c.Replace("MSSQL_DB_PASSWORD: 'YourStrong!Passw0rd',",            "MSSQL_DB_PASSWORD: '$jsPw',")
    } else {
        # pgsql: leave DB_ENGINE alone (template already says 'pgsql'), turn
        # off DB_SSL for the docker self-signed cert, patch the postgres
        # defaults inside DB_SECRET_VALUE.
        $jsPgPw = $PgDbPasswordPlain.Replace("'", "\'")
        $c = $c.Replace("DB_SSL: true,",                                        "DB_SSL: false,")
        $c = $c.Replace("DB_HOST: 'edfiadminapp-postgres',",                    "DB_HOST: '$PgDbHost',")
        $c = $c.Replace("DB_PORT: 5432,",                                       "DB_PORT: $PgDbPort,")
        $c = $c.Replace("DB_USERNAME: 'postgres',",                             "DB_USERNAME: '$PgDbUsername',")
        $c = $c.Replace("DB_DATABASE: 'sbaa',",                                 "DB_DATABASE: '$DatabaseName',")
        $c = $c.Replace("DB_PASSWORD: 'postgres',",                             "DB_PASSWORD: '$jsPgPw',")
    }

    $c = $c.Replace("API_PORT: 3333,",                                      "API_PORT: process.env.HTTP_PLATFORM_PORT || 3333,")
    $c = $c.Replace("MY_URL: 'https://localhost/adminapp-api',",            "MY_URL: '$ApiUrl',")
    $c = $c.Replace("const FE_URL = 'https://localhost/adminapp';",         "const FE_URL = '$FeUrl';")
    $c = $c.Replace("issuer: 'https://localhost/auth/realms/edfi',",        "issuer: '$OidcIssuer',")
    $c = $c.Replace("ISSUER: 'https://localhost/auth/realms/edfi',",        "ISSUER: '$OidcIssuer',")
    $c = $c.Replace("clientId: 'edfiadminapp',",                            "clientId: '$OidcClientId',")
    $c = $c.Replace("CLIENT_ID: 'edfiadminapp',",                           "CLIENT_ID: '$OidcClientId',")
    $c = $c.Replace("clientSecret: 'big-secret-123',",                      "clientSecret: '$OidcClientSecretPlain',")
    $c = $c.Replace("CLIENT_SECRET: 'big-secret-123',",                     "CLIENT_SECRET: '$OidcClientSecretPlain',")
    $c = $c.Replace("scope: '',",                                           "scope: '$OidcScope',")
    $c = $c.Replace("ADMIN_USERNAME: 'admin@example.com',",                 "ADMIN_USERNAME: '$AdminUsername',")

    # Yopass: enable iff a URL was provided, otherwise disable (USE_YOPASS=false
    # is supported by the AdminApp -- credentials are shown inline instead of
    # via a one-time-share link).
    $useYopassJs = if ($YopassUrl) { 'true' } else { 'false' }
    $c = $c.Replace("USE_YOPASS: true,",                                    "USE_YOPASS: $useYopassJs,")
    $c = $c.Replace("YOPASS_URL: 'http://edfiadminapp-yopass:80',",         "YOPASS_URL: '$YopassUrl',")

    # Per-install data-at-rest encryption key (never ships the shipped default).
    $c = $c.Replace("KEY: '$defaultKey',",                                  "KEY: '$DbEncryptionKey',")

    # Fail loudly if the default key survived patching -- deploying it would give
    # every install the same data-at-rest key.
    if ($c -match $defaultKey) {
        throw "The default DB_ENCRYPTION_SECRET_VALUE.KEY is still present in $prodJs after patching. Refusing to deploy with the well-known default key."
    }

    if ($c -ne $original) {
        try {
            Set-Content -Path $prodJs -Value $c -Encoding UTF8
        } catch {
            throw "Failed to write the patched production.js at $prodJs. Check the config folder is writable. Original: $($_.Exception.Message)"
        }
        Write-Host "production.js patched ($DbEngine)."
        $prodJsChanged = $true
    } else {
        Write-Host "production.js already has the desired values — not rewriting."
    }
} else {
    Write-Warning "production.js not found at $prodJs — skipping patch."
}

# Permissions for the App Pool virtual account. Done here (not earlier) because
# the pool now actually exists.
$appPoolIdentity = "IIS APPPOOL\$AppPoolName"
& icacls "$DestPath\packages" /grant "${appPoolIdentity}:(OI)(CI)M" /T | Out-Null
# httpPlatform writes Node stdout to .\logs (per web.config stdoutLogFile).
$logsDir = "$DestPath\logs"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
& icacls $logsDir /grant "${appPoolIdentity}:(OI)(CI)M" /T | Out-Null

# Grant the App Pool identity read+execute on the node directory so httpPlatform can
# launch node as that identity. Machine-wide installs (C:\Program Files\nodejs)
# already allow Authenticated Users; this is defensive for custom node locations.
$nodeDir = Split-Path $nodeExe -Parent
& icacls $nodeDir /grant "${appPoolIdentity}:(OI)(CI)(RX)" | Out-Null

# npm cache override, scoped to THIS App Pool (not machine-wide, so the user's
# other npm usage is unaffected). Create the cache folder, grant the App Pool
# identity Modify, and set NPM_CONFIG_CACHE on the pool's environment so npm
# under the App Pool writes there instead of the (unwritable) profile cache.
if (-not (Test-Path $NpmCachePath)) {
    New-Item -ItemType Directory -Path $NpmCachePath -Force | Out-Null
}
& icacls $NpmCachePath /grant "${appPoolIdentity}:(OI)(CI)M" /T | Out-Null
$envVarsFilter = "system.applicationHost/applicationPools/add[@name='$AppPoolName']/environmentVariables"
Remove-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter $envVarsFilter -Name "." -AtElement @{ name = 'NPM_CONFIG_CACHE' } -ErrorAction SilentlyContinue
try {
    Add-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter $envVarsFilter -Name "." -Value @{ name = 'NPM_CONFIG_CACHE'; value = $NpmCachePath }
} catch {
    throw "Failed to set NPM_CONFIG_CACHE on the App Pool '$AppPoolName'. App Pool environment variables require IIS 10 or newer. Original: $($_.Exception.Message)"
}
Write-Host "Permissions granted to $appPoolIdentity; NPM_CONFIG_CACHE set on App Pool -> $NpmCachePath."

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
