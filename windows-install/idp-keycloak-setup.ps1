#Requires -RunAsAdministrator
<#
.SYNOPSIS
Optional local Identity Provider example. Installs a JDK if needed, downloads
Keycloak, starts it, and provisions the edfi realm, edfiadminapp client, and
test user. One run leaves a fully-ready local Keycloak for the Admin App.

.DESCRIPTION
The Admin App's auth engine is provider-agnostic (generic OIDC discovery), so a
real deployment points it at whatever IdP the organization runs. This script is
only the convenience path for a local dev install that wants Keycloak as the
example IdP.

Steps (each idempotent):
  1. JDK: reuse an existing Java >= 17 already on PATH, otherwise install
     Microsoft OpenJDK 21 (Keycloak 26 requires Java 17 or 21) and set
     JAVA_HOME / PATH. -JdkDownloadUrl forces an offline zip install instead.
  2. Download + extract Keycloak to -KeycloakInstallPath.
  3. Start Keycloak by delegating to idp-keycloak-start.ps1 (bootstraps the
     master admin on first start, waits for the discovery endpoint).
  4. Provision the realm, client (with redirect/origin URIs), optional audience
     mapper, and the test user via the Keycloak admin REST API.

.PARAMETER KeycloakInstallPath
Where Keycloak is installed. Default: C:\keycloak.

.PARAMETER KeycloakVersion
Keycloak release to download if not already present. Default: 26.6.1.

.PARAMETER JdkDownloadUrl
Optional URL to an OpenJDK zip. If provided, downloads/extracts it and sets
JAVA_HOME instead of using winget / an existing JDK.

.PARAMETER AdminUser
Master-realm admin username (bootstrapped on first start only). Default: admin.

.PARAMETER AdminPassword
Master-realm admin password.

.PARAMETER KeycloakBaseUrl
URL to probe and provision against. Default: http://localhost:8080.

.PARAMETER ReadyTimeoutSeconds
How long to wait for Keycloak to be reachable. Default: 120.

.PARAMETER RealmName
Default: edfi.

.PARAMETER ClientId
Default: edfiadminapp.

.PARAMETER ClientSecret
The secret to set on the client. Save it; you pass the same value to 05-deploy-api.ps1.

.PARAMETER FeBaseUrl / -ApiBaseUrl
Base URLs used to build the client's redirect/origin URIs. Defaults assume the
sub-app deployment; pass overrides for standalone ports.

.PARAMETER TestUserEmail / -TestUserFirstName / -TestUserLastName / -TestUserPassword
The seeded test user. TestUserEmail must match the AdminApp DB's seeded user.

.PARAMETER IncludeAudienceMapper
Switch -- add the audience mapper (only needed for bearer-token API access).

.PARAMETER EnableDirectAccessGrants
Switch -- enable the password grant on the client. Testing only.

.EXAMPLE
.\idp-keycloak-setup.ps1 -AdminPassword 'admin' -ClientSecret 'mysecret123' -TestUserPassword 'TestUser123!'
#>

param(
    # --- JDK + Keycloak download/runtime ---
    [string]$KeycloakInstallPath = "C:\keycloak",
    [string]$KeycloakVersion = "26.6.1",
    [string]$JdkDownloadUrl,

    # --- Keycloak start + admin bootstrap ---
    [string]$AdminUser = "admin",

    [Parameter(Mandatory = $true)]
    [string]$AdminPassword,

    [string]$KeycloakBaseUrl = "http://localhost:8080",
    [int]$ReadyTimeoutSeconds = 120,

    # --- Realm / client / user provisioning ---
    [string]$RealmName = "edfi",
    [string]$ClientId = "edfiadminapp",

    [Parameter(Mandatory = $true)]
    [string]$ClientSecret,

    # Defaults match the standalone HTTP sites (FE on 4200, API on 3333). The
    # client's redirect and web-origin URIs are built from these.
    [string]$FeBaseUrl = "http://localhost:4200",
    [string]$ApiBaseUrl = "http://localhost:3333",
    [string]$TestUserEmail = "admin@example.com",
    [string]$TestUserFirstName = "Admin",
    [string]$TestUserLastName  = "User",

    [Parameter(Mandatory = $true)]
    [string]$TestUserPassword,

    # Realm display + session settings (Ed-Fi docs defaults). Tune per env if
    # needed. Offline session max requires offlineSessionMaxLifespanEnabled.
    [string]$RealmDisplayName     = "Ed-Fi",
    [string]$RealmDisplayNameHtml = "Ed-Fi Technology Suite",
    [int]$SsoSessionIdleSeconds     = 7200,        # 2h
    [int]$SsoSessionMaxSeconds      = 7200,        # 2h
    [int]$ClientSessionIdleSeconds  = 7200,        # 2h
    [int]$ClientSessionMaxSeconds   = 7200,        # 2h
    [int]$OfflineSessionIdleSeconds = 2592000,     # 30d
    [int]$OfflineSessionMaxSeconds  = 5184000,     # 60d

    [switch]$IncludeAudienceMapper,
    [switch]$EnableDirectAccessGrants
)

$ErrorActionPreference = 'Stop'
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
    # Heads-up before mutating the machine's Java: installing/prepending OpenJDK 21
    # changes what `java` resolves to and overwrites Machine JAVA_HOME. (This moved
    # here from 00-check-prereqs.ps1, which is now generic and Keycloak-free.)
    if ($existingJava) {
        Write-Host "NOTE: Java $existingJavaMajor is on PATH at $($existingJava.Source); OpenJDK 21 will be prepended so 'java' resolves to it." -ForegroundColor Yellow
    }
    $existingJavaHome = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
    if ($existingJavaHome -and ($existingJavaHome -notlike "*Microsoft\jdk-21*")) {
        Write-Host "NOTE: Machine JAVA_HOME ($existingJavaHome) will be overwritten with the OpenJDK 21 path." -ForegroundColor Yellow
    }

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
    # Refresh in current process so idp-keycloak-start can spawn Keycloak with the right java
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

# ---------------------------------------------------------------------------
# Start Keycloak (delegates to idp-keycloak-start.ps1) and wait until the admin
# REST API is reachable, then provision the realm/client/user below.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Starting Keycloak via idp-keycloak-start.ps1..."
& "$PSScriptRoot\idp-keycloak-start.ps1" `
    -KeycloakInstallPath $KeycloakInstallPath `
    -AdminUser $AdminUser `
    -AdminPassword $AdminPassword `
    -BaseUrl $KeycloakBaseUrl `
    -ReadyTimeoutSeconds $ReadyTimeoutSeconds

function Invoke-KcApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body
    )
    $h = @{ Authorization = "Bearer $script:token" }
    $params = @{
        Uri = "$KeycloakBaseUrl/admin$Path"
        Method = $Method
        Headers = $h
    }
    if ($Body) {
        $params.Body = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 10 }
        $params.ContentType = "application/json"
    }
    Invoke-RestMethod @params
}

# Get admin token. Catch invalid_grant specifically (401 from Keycloak) so the
# user gets actionable recovery steps instead of a raw WebException. This is
# the most common 06 failure mode -- the master admin was bootstrapped with a
# different password than what -KeycloakAdminPassword now carries, because
# KC_BOOTSTRAP_ADMIN_* env vars are first-run-only.
Write-Host "Authenticating to Keycloak admin API..."
try {
    $tokenResp = Invoke-RestMethod -Uri "$KeycloakBaseUrl/realms/master/protocol/openid-connect/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "grant_type=password&client_id=admin-cli&username=$AdminUser&password=$AdminPassword" `
        -ErrorAction Stop
} catch {
    # Untyped catch -- PS 5.1's Invoke-RestMethod wraps HTTP errors variably
    # (WebException, HttpResponseException, CmdletInvocationException, etc.).
    # Pull the response off whichever shape the exception came in, and prefer
    # $_.ErrorDetails.Message for the body since PS auto-populates it.
    $resp = $null
    if ($_.Exception.Response) {
        $resp = $_.Exception.Response
    } elseif ($_.Exception.InnerException -and $_.Exception.InnerException.Response) {
        $resp = $_.Exception.InnerException.Response
    }
    $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
    $body = if ($_.ErrorDetails) { $_.ErrorDetails.Message } else { "" }
    if (-not $body -and $resp) {
        try {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $body = $reader.ReadToEnd()
        } catch {}
    }

    if ($code -eq 401 -or $body -match 'invalid_grant') {
        Write-Host ""
        Write-Host "[ERROR] Keycloak admin auth failed (HTTP $code, invalid_grant)." -ForegroundColor Red
        Write-Host "        The master admin was bootstrapped with a different password than the"
        Write-Host "        one passed via -KeycloakAdminPassword. Keycloak 26's KC_BOOTSTRAP_ADMIN_*"
        Write-Host "        env vars only apply on first run against an empty data dir."
        Write-Host ""
        Write-Host "        Recovery options:" -ForegroundColor Yellow
        Write-Host "          A) Re-run install-all with the ORIGINAL admin password."
        Write-Host "          B) Wipe Keycloak data and bootstrap fresh (loses realm/client/user --"
        Write-Host "             install-all recreates them automatically):"
        Write-Host "               Stop-Process -Name java -Force -ErrorAction SilentlyContinue"
        Write-Host "               Remove-Item -Recurse -Force C:\keycloak\data"
        Write-Host "               .\install-all.ps1 ... -KeycloakAdminPassword '<new-pw>' -SkipPhase1"
        Write-Host ""
        throw "Keycloak admin auth failed -- see recovery options above."
    }
    # Any other web error: re-throw with the body for diagnostics
    if ($body) { Write-Host "Response body: $body" -ForegroundColor DarkGray }
    throw
}
$script:token = $tokenResp.access_token
Write-Host "Authenticated."

# Realm
$realms = Invoke-KcApi -Method Get -Path "/realms"
if (($realms | ForEach-Object { $_.realm }) -contains $RealmName) {
    Write-Host "Realm '$RealmName' already exists."
} else {
    Write-Host "Creating realm '$RealmName'..."
    Invoke-KcApi -Method Post -Path "/realms" -Body @{ realm = $RealmName; enabled = $true } | Out-Null
}

# Apply realm display + session settings idempotently. Fetch current values,
# compare against desired, PUT only on drift. Matches the doc-recommended
# Ed-Fi realm configuration (display name, 2h SSO + client sessions, 30d/60d
# offline). Override individual values via the corresponding script params.
$currentRealm = Invoke-KcApi -Method Get -Path "/realms/$RealmName"
$realmDesired = [ordered]@{
    realm                            = $RealmName
    enabled                          = $true
    displayName                      = $RealmDisplayName
    displayNameHtml                  = $RealmDisplayNameHtml
    ssoSessionIdleTimeout            = $SsoSessionIdleSeconds
    ssoSessionMaxLifespan            = $SsoSessionMaxSeconds
    clientSessionIdleTimeout         = $ClientSessionIdleSeconds
    clientSessionMaxLifespan         = $ClientSessionMaxSeconds
    offlineSessionIdleTimeout        = $OfflineSessionIdleSeconds
    offlineSessionMaxLifespan        = $OfflineSessionMaxSeconds
    offlineSessionMaxLifespanEnabled = $true
}
$realmNeedsUpdate = $false
foreach ($key in $realmDesired.Keys) {
    if ($key -eq 'realm') { continue }  # immutable; included in payload for shape
    $current = $currentRealm.$key
    $want    = $realmDesired[$key]
    if ($current -ne $want) {
        $realmNeedsUpdate = $true
        break
    }
}
if ($realmNeedsUpdate) {
    Write-Host "Applying Ed-Fi realm settings (display + session timeouts)..."
    Invoke-KcApi -Method Put -Path "/realms/$RealmName" -Body $realmDesired | Out-Null
    Write-Host "Realm settings applied."
} else {
    Write-Host "Realm settings already match desired values -- skipping update."
}

# Client
$clients = Invoke-KcApi -Method Get -Path "/realms/$RealmName/clients?clientId=$ClientId"

# Build the JSON payload manually (PS 5.1 ConvertTo-Json unwraps single-element
# arrays inside hashtables, which silently breaks redirectUris and webOrigins).
# Values match the Ed-Fi docs:
#   Root URL                  = the origin
#   Admin URL                 = FE base
#   Valid Redirect URIs       = API callback + FE callback + API post-logout + FE wildcard
#   Valid Post Logout URIs    = FE wildcard + API post-logout endpoint
#                               (Keycloak 26 separates these from Valid Redirect URIs;
#                               multiple URIs joined with "##")
#   Web Origins               = API base (for CORS on the OIDC endpoints)
$fe  = $FeBaseUrl  -replace '/$', ''
$api = $ApiBaseUrl -replace '/$', ''

$dagJson = if ($EnableDirectAccessGrants) { 'true' } else { 'false' }

$clientPayloadJson = @"
{
  "clientId": "$ClientId",
  "secret": "$ClientSecret",
  "rootUrl": "$fe/",
  "baseUrl": "",
  "adminUrl": "$fe",
  "redirectUris": [
    "$api/api/auth/callback/1",
    "$fe/auth/callback",
    "$api/api/auth/post-logout",
    "$fe/*"
  ],
  "webOrigins": ["$api"],
  "attributes": {
    "post.logout.redirect.uris": "$fe/*##$api/api/auth/post-logout"
  },
  "publicClient": false,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": $dagJson,
  "serviceAccountsEnabled": false,
  "implicitFlowEnabled": false,
  "authorizationServicesEnabled": false,
  "protocol": "openid-connect"
}
"@

if ($clients.Count -gt 0) {
    $clientUuid = $clients[0].id
    $existing = $clients[0]
    # Compare key fields; skip the PUT if nothing meaningful differs.
    $expectedRedirect = "$api/api/auth/callback/1"
    $needsUpdate = $false
    if (-not $existing.redirectUris -or ($existing.redirectUris -notcontains $expectedRedirect)) { $needsUpdate = $true }
    if (-not $existing.webOrigins -or ($existing.webOrigins -notcontains $api)) { $needsUpdate = $true }
    if ([bool]$existing.directAccessGrantsEnabled -ne [bool]$EnableDirectAccessGrants) { $needsUpdate = $true }
    if (-not $existing.standardFlowEnabled) { $needsUpdate = $true }
    if (-not $existing.rootUrl) { $needsUpdate = $true }
    if (-not $existing.adminUrl) { $needsUpdate = $true }
    # Doc says these must be off; catch drift if someone toggles them in the UI.
    if ($existing.implicitFlowEnabled) { $needsUpdate = $true }
    if ($existing.authorizationServicesEnabled) { $needsUpdate = $true }

    if ($needsUpdate) {
        Write-Host "Client '$ClientId' exists but needs updating..."
        # Inject the existing id into the JSON so the PUT addresses the right record
        $payloadWithId = $clientPayloadJson -replace '^\{', "{`n  `"id`": `"$clientUuid`","
        Invoke-KcApi -Method Put -Path "/realms/$RealmName/clients/$clientUuid" -Body $payloadWithId | Out-Null
    } else {
        Write-Host "Client '$ClientId' already matches -- skipping update."
        Write-Host "(Note: secret may still be reset if you've passed a new value; this script doesn't verify.)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "Creating client '$ClientId'..."
    Invoke-KcApi -Method Post -Path "/realms/$RealmName/clients" -Body $clientPayloadJson | Out-Null
    $created = Invoke-KcApi -Method Get -Path "/realms/$RealmName/clients?clientId=$ClientId"
    $clientUuid = $created[0].id
}
Write-Host "Client UUID: $clientUuid"

# Audience mapper
if ($IncludeAudienceMapper) {
    $existing = Invoke-KcApi -Method Get -Path "/realms/$RealmName/clients/$clientUuid/protocol-mappers/models"
    $hasMapper = $existing | Where-Object { $_.name -eq "edfiadminapp-api-audience" }
    if ($hasMapper) {
        Write-Host "Audience mapper already exists."
    } else {
        Write-Host "Adding audience mapper (aud=edfiadminapp-api)..."
        $mapper = @{
            name = "edfiadminapp-api-audience"
            protocol = "openid-connect"
            protocolMapper = "oidc-audience-mapper"
            consentRequired = $false
            config = @{
                "included.custom.audience" = "edfiadminapp-api"
                "id.token.claim" = "false"
                "access.token.claim" = "true"
                "userinfo.token.claim" = "false"
            }
        }
        Invoke-KcApi -Method Post -Path "/realms/$RealmName/clients/$clientUuid/protocol-mappers/models" -Body $mapper | Out-Null
    }
}

# Test user. Username intentionally matches email -- the AdminApp's [user]
# table is seeded with username=admin@example.com, so the preferred_username
# claim from Keycloak needs to match that key for the local user lookup.
$users = Invoke-KcApi -Method Get -Path "/realms/$RealmName/users?email=$TestUserEmail&exact=true"
if ($users.Count -gt 0) {
    Write-Host "User '$TestUserEmail' already exists."
    $existingUser = $users[0]
    $userId = $existingUser.id

    # Sync firstName / lastName / emailVerified / enabled on existing users so
    # re-runs apply the doc-recommended profile fields without recreating.
    $userNeedsUpdate = $false
    if ($existingUser.firstName -ne $TestUserFirstName) { $userNeedsUpdate = $true }
    if ($existingUser.lastName  -ne $TestUserLastName)  { $userNeedsUpdate = $true }
    if (-not $existingUser.emailVerified)               { $userNeedsUpdate = $true }
    if (-not $existingUser.enabled)                     { $userNeedsUpdate = $true }
    if ($userNeedsUpdate) {
        $userUpdate = @{
            username      = $TestUserEmail
            email         = $TestUserEmail
            firstName     = $TestUserFirstName
            lastName      = $TestUserLastName
            emailVerified = $true
            enabled       = $true
        }
        Invoke-KcApi -Method Put -Path "/realms/$RealmName/users/$userId" -Body $userUpdate | Out-Null
        Write-Host "Updated profile fields for '$TestUserEmail'."
    }
} else {
    Write-Host "Creating user '$TestUserEmail'..."
    $userBody = @{
        username      = $TestUserEmail
        email         = $TestUserEmail
        firstName     = $TestUserFirstName
        lastName      = $TestUserLastName
        emailVerified = $true
        enabled       = $true
    }
    Invoke-KcApi -Method Post -Path "/realms/$RealmName/users" -Body $userBody | Out-Null
    $newUsers = Invoke-KcApi -Method Get -Path "/realms/$RealmName/users?email=$TestUserEmail&exact=true"
    $userId = $newUsers[0].id
}

# Reset password — only if the current password doesn't already work.
# We probe by trying password grant. Requires Direct Access Grants enabled on
# the client; if not, we always reset since we can't verify.
$passwordWorks = $false
$dagEnabled = $EnableDirectAccessGrants.IsPresent -or ($clients.Count -gt 0 -and $clients[0].directAccessGrantsEnabled)
if ($dagEnabled) {
    try {
        $body = "grant_type=password&client_id=$ClientId&client_secret=$ClientSecret&username=$TestUserEmail&password=$TestUserPassword&scope=openid"
        $probe = Invoke-RestMethod -Uri "$KeycloakBaseUrl/realms/$RealmName/protocol/openid-connect/token" `
            -Method Post -ContentType "application/x-www-form-urlencoded" -Body $body -TimeoutSec 5 -ErrorAction Stop
        if ($probe.access_token) { $passwordWorks = $true }
    } catch {
        $passwordWorks = $false
    }
}

if ($passwordWorks) {
    Write-Host "Password for '$TestUserEmail' already works — skipping reset."
} else {
    $pwBody = @{ type = "password"; value = $TestUserPassword; temporary = $false }
    Invoke-KcApi -Method Put -Path "/realms/$RealmName/users/$userId/reset-password" -Body $pwBody
    Write-Host "Password set for '$TestUserEmail'."
}

Write-Host ""
Write-Host "SUCCESS: Keycloak bootstrap complete." -ForegroundColor Green
Write-Host "  Realm:        $RealmName"
Write-Host "  Client:       $ClientId  (secret you passed in)"
Write-Host "  User:         $TestUserEmail"
Write-Host "  Redirect URIs:"
Write-Host "    $api/api/auth/callback/1"
Write-Host "    $fe/auth/callback"
Write-Host "    $api/api/auth/post-logout"
Write-Host "    $fe/*"
Write-Host "  Web Origin:   $api"
if ($IncludeAudienceMapper) { Write-Host "  Audience mapper: edfiadminapp-api" }
if ($EnableDirectAccessGrants) { Write-Host "  Direct access grants: enabled" }
