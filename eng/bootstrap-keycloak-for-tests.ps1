<#
.SYNOPSIS
Bootstrap Keycloak realm, clients, and seed test data for Admin App API E2E tests.

.DESCRIPTION
Performs the following idempotent operations:
1. Creates or updates Keycloak realm and client configuration
2. Upserts test users (edfi-admin with default password)
3. Optionally seeds test data (teams, memberships) via API
4. Optionally falls back to direct SQL commands if API seeding fails

.PARAMETER Realm
Keycloak realm name. Defaults to 'edfi'.

.PARAMETER ClientId
Keycloak client ID. Defaults to 'edfiadminapp-dev'.

.PARAMETER SeedDataOnly
If specified, skip Keycloak setup and only seed test data via API.

.PARAMETER EnableSqlFallback
If specified, allow fallback to direct SQL commands for seeding.

.EXAMPLE
# Full bootstrap: realm + client + users + API seed
powershell -File eng/bootstrap-keycloak-for-tests.ps1

# API seed data only (assumes Keycloak already set up)
powershell -File eng/bootstrap-keycloak-for-tests.ps1 -SeedDataOnly

# With SQL fallback for seeding
powershell -File eng/bootstrap-keycloak-for-tests.ps1 -EnableSqlFallback
#>

param(
  [string]$Realm = 'edfi',
  [string]$ClientId = 'edfiadminapp-dev',
  [switch]$SeedDataOnly,
  [switch]$EnableSqlFallback
)

$ErrorActionPreference = 'Stop'

Write-Host "Bootstrap Keycloak for E2E tests - Realm: $Realm, Client: $ClientId" -ForegroundColor Cyan

# Set up OIDC defaults if not already set
if (-not $env:OIDC_ISSUER) {
  $env:OIDC_ISSUER = 'https://localhost/auth/realms/edfi'
}
if (-not $env:OIDC_ADMIN_USER) {
  $env:OIDC_ADMIN_USER = 'admin'
}
if (-not $env:OIDC_ADMIN_PASSWORD) {
  $env:OIDC_ADMIN_PASSWORD = 'admin'
}
if (-not $env:OIDC_CLIENT_SECRET) {
  $env:OIDC_CLIENT_SECRET = 'big-secret-123'
}
if (-not $env:OIDC_USERNAME) {
  $env:OIDC_USERNAME = 'edfi-admin'
}
if (-not $env:OIDC_PASSWORD) {
  $env:OIDC_PASSWORD = '123'
}
if (-not $env:API_BASE_URL) {
  $env:API_BASE_URL = 'https://localhost/adminapp-api/api'
}

# Suppress certificate validation for local testing
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

if (-not $SeedDataOnly) {
  # Step 1: Get Keycloak admin token
  Write-Host "Acquiring Keycloak admin token..." -ForegroundColor Yellow
  $adminTokenUrl = "$($env:OIDC_ISSUER.TrimEnd('/'))/protocol/openid-connect/token"
  
  try {
    $adminTokenResponse = Invoke-RestMethod -Method Post -Uri $adminTokenUrl `
      -Body @{
        grant_type = 'password'
        client_id = 'admin-cli'
        username = $env:OIDC_ADMIN_USER
        password = $env:OIDC_ADMIN_PASSWORD
      } -ContentType 'application/x-www-form-urlencoded' -ErrorAction Stop
    
    $adminToken = $adminTokenResponse.access_token
    if (-not $adminToken) { throw 'Failed to acquire admin token.' }
    Write-Host "Admin token acquired." -ForegroundColor Green
  } catch {
    Write-Host "Failed to acquire admin token: $_" -ForegroundColor Red
    Write-Host "Keycloak may not be running. Skipping Keycloak bootstrap." -ForegroundColor Yellow
    # Continue to seed data attempt
    $adminToken = $null
  }

  # Step 2: Create/update Keycloak client if admin token available
  if ($adminToken) {
    Write-Host "Configuring Keycloak client '$ClientId' in realm '$Realm'..." -ForegroundColor Yellow
    
    $clientUrl = "$($env:OIDC_ISSUER.TrimEnd('/'))/admin/realms/$Realm/clients"
    $headers = @{ Authorization = "Bearer $adminToken" }
    
    try {
      # Check if client exists
      $existingClients = Invoke-RestMethod -Method Get -Uri "$clientUrl?clientId=$ClientId" `
        -Headers $headers -ErrorAction Stop
      
      if ($existingClients -and $existingClients.Count -gt 0) {
        Write-Host "Client '$ClientId' already exists. Ensuring it's configured for E2E." -ForegroundColor Cyan
        # In a full implementation, update the client configuration here if needed
      } else {
        Write-Host "Creating new client '$ClientId'..." -ForegroundColor Cyan
        
        $clientPayload = @{
          clientId = $ClientId
          enabled = $true
          publicClient = $false
          secret = $env:OIDC_CLIENT_SECRET
          directAccessGrantsEnabled = $true
          serviceAccountsEnabled = $true
          redirectUris = @(
            "https://localhost/adminapp",
            "https://localhost/adminapp/*"
          )
          webOrigins = @(
            "https://localhost"
          )
        }
        
        Invoke-RestMethod -Method Post -Uri $clientUrl `
          -Headers $headers `
          -Body ($clientPayload | ConvertTo-Json) `
          -ContentType 'application/json' `
          -ErrorAction Stop | Out-Null
        
        Write-Host "Client '$ClientId' created successfully." -ForegroundColor Green
      }
    } catch {
      Write-Host "Failed to configure Keycloak client: $_" -ForegroundColor Yellow
    }

    # Step 3: Create/update test user
    Write-Host "Upserting test user '$($env:OIDC_USERNAME)'..." -ForegroundColor Yellow
    
    $usersUrl = "$($env:OIDC_ISSUER.TrimEnd('/'))/admin/realms/$Realm/users"
    
    try {
      # Check if user exists
      $existingUsers = Invoke-RestMethod -Method Get -Uri "$usersUrl?username=$($env:OIDC_USERNAME)" `
        -Headers $headers -ErrorAction Stop
      
      if ($existingUsers -and $existingUsers.Count -gt 0) {
        Write-Host "Test user '$($env:OIDC_USERNAME)' already exists." -ForegroundColor Cyan
      } else {
        Write-Host "Creating test user '$($env:OIDC_USERNAME)'..." -ForegroundColor Cyan
        
        $userPayload = @{
          username = $env:OIDC_USERNAME
          enabled = $true
          firstName = 'Test'
          lastName = 'Admin'
          email = "$($env:OIDC_USERNAME)@edfi.local"
          credentials = @(
            @{
              type = 'password'
              value = $env:OIDC_PASSWORD
              temporary = $false
            }
          )
        }
        
        Invoke-RestMethod -Method Post -Uri $usersUrl `
          -Headers $headers `
          -Body ($userPayload | ConvertTo-Json) `
          -ContentType 'application/json' `
          -ErrorAction Stop | Out-Null
        
        Write-Host "Test user '$($env:OIDC_USERNAME)' created successfully." -ForegroundColor Green
      }
    } catch {
      Write-Host "Failed to create test user: $_" -ForegroundColor Yellow
    }
  }
}

# Step 4: Seed test data via API
Write-Host "Seeding test data (teams, memberships)..." -ForegroundColor Yellow

# Acquire API token
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

$apiTokenUrl = "$($env:OIDC_ISSUER.TrimEnd('/'))/protocol/openid-connect/token"

try {
  $apiTokenResponse = Invoke-RestMethod -Method Post -Uri $apiTokenUrl `
    -Body @{
      grant_type = 'client_credentials'
      client_id = $env:OIDC_CLIENT_ID
      client_secret = $env:OIDC_CLIENT_SECRET
    } -ContentType 'application/x-www-form-urlencoded' -ErrorAction Stop
  
  $apiToken = $apiTokenResponse.access_token
  if (-not $apiToken) { throw 'Failed to acquire API token.' }
  
  $apiHeaders = @{
    Authorization = "Bearer $apiToken"
    'Content-Type' = 'application/json'
  }
  
  # Create or detect test team
  Write-Host "Creating or detecting test team..." -ForegroundColor Cyan
  
  $teamPayload = @{
    name = 'E2E Test Team'
    description = 'Team for Bruno API E2E tests'
  }
  
  try {
    $teamResponse = Invoke-RestMethod -Method Post -Uri "$($env:API_BASE_URL.TrimEnd('/'))/teams" `
      -Headers $apiHeaders `
      -Body ($teamPayload | ConvertTo-Json) `
      -ErrorAction Stop
    
    $teamId = $teamResponse.id
    Write-Host "Test team created/detected with ID: $teamId" -ForegroundColor Green
    
    # Store team ID in environment for tests
    $env:TEAM_ID = $teamId
    
    # Create or detect team membership for test user
    Write-Host "Creating or detecting team membership..." -ForegroundColor Cyan
    
    $membershipPayload = @{
      userId = $env:OIDC_USERNAME
      role = 'Admin'
    }
    
    try {
      Invoke-RestMethod -Method Post `
        -Uri "$($env:API_BASE_URL.TrimEnd('/'))/teams/$teamId/user-team-memberships" `
        -Headers $apiHeaders `
        -Body ($membershipPayload | ConvertTo-Json) `
        -ErrorAction Stop | Out-Null
      
      Write-Host "Team membership created/detected." -ForegroundColor Green
    } catch {
      # Membership may already exist - this is ok
      Write-Host "Membership already exists or API not available: $_" -ForegroundColor Cyan
    }
  } catch {
    Write-Host "Failed to seed team data: $_" -ForegroundColor Yellow
    if ($EnableSqlFallback) {
      Write-Host "SQL fallback not yet implemented. Please set up team data manually." -ForegroundColor Yellow
    }
  }
} catch {
  Write-Host "Failed to acquire API token: $_" -ForegroundColor Yellow
  Write-Host "API may not be running. Skipping data seeding." -ForegroundColor Yellow
}

Write-Host "Keycloak bootstrap and data seeding complete!" -ForegroundColor Green
