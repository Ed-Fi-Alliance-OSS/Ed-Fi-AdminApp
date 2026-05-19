<#
.SYNOPSIS
Creates the edfi realm, edfiadminapp client, test user, and (optionally)
the audience mapper in Keycloak via the admin REST API.

.DESCRIPTION
Idempotent — re-running updates existing resources instead of duplicating them.

Keycloak must already be running. Start it with:
  cd C:\keycloak\bin
  .\kc.bat start-dev

Does NOT require elevation (just HTTP calls to localhost:8080).

.PARAMETER KeycloakBaseUrl
Default: http://localhost:8080.

.PARAMETER AdminUser
Master-realm admin username (set during first Keycloak boot). Default: admin.

.PARAMETER AdminPassword
Master-realm admin password.

.PARAMETER RealmName
Default: edfi.

.PARAMETER ClientId
Default: edfiadminapp.

.PARAMETER ClientSecret
The secret to set on the client. Save this; you'll pass it to 04-deploy-api.ps1.

.PARAMETER RedirectUri
Where Keycloak sends users back after login. Must match the API's MY_URL.
Default: http://localhost:3333/api/auth/callback/1.

.PARAMETER WebOrigin
CORS origin allowed by Keycloak. Default: http://localhost:4200.

.PARAMETER TestUserEmail
User to create. Must match the AdminApp DB's seeded user. Default: admin@example.com.

.PARAMETER TestUserPassword
Password for the test user.

.PARAMETER IncludeAudienceMapper
Switch — adds the audience mapper to the client. Required only for bearer-token
API access (Postman, curl, CI). Not needed for browser-based UI login.

.PARAMETER EnableDirectAccessGrants
Switch — enables password grant on the client. For testing only.

.EXAMPLE
.\06-keycloak-bootstrap.ps1 -AdminPassword 'admin' -ClientSecret 'mysecret123' -TestUserPassword 'TestUser123!'
.\06-keycloak-bootstrap.ps1 -AdminPassword 'admin' -ClientSecret 's3cr3t' -TestUserPassword 'pw' -IncludeAudienceMapper
#>

param(
    [string]$KeycloakBaseUrl = "http://localhost:8080",
    [string]$AdminUser = "admin",

    [Parameter(Mandatory = $true)]
    [string]$AdminPassword,

    [string]$RealmName = "edfi",
    [string]$ClientId = "edfiadminapp",

    [Parameter(Mandatory = $true)]
    [string]$ClientSecret,

    # Defaults assume the HTTPS sub-app deployment. URI list mirrors the docs.
    # For standalone ports, pass single-URL overrides instead.
    [string]$FeBaseUrl = "https://localhost/adminapp",
    [string]$ApiBaseUrl = "https://localhost/adminapp-api",
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
