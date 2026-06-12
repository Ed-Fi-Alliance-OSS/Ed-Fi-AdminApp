<#
.SYNOPSIS
Run Bruno API E2E tests (all/tag/request) with optional compose start, auth bootstrap, and seed data.

.DESCRIPTION
Orchestrates Bruno test runs with Keycloak token acquisition, optional docker compose services
startup, auth bootstrap, and data seeding. Supports filtered execution by tag or request name.

.PARAMETER Env
Environment to run against ('local' or 'ci'). Defaults to 'local'.

.PARAMETER StartServices
If specified, starts docker compose services before running tests.

.PARAMETER BootstrapAuth
If specified, runs the Keycloak bootstrap script to set up clients and test users.

.PARAMETER SeedData
If specified, seeds test data (teams, memberships) via API.

.PARAMETER GrantType
OAuth grant type for token acquisition ('client_credentials' or 'password'). Defaults to 'client_credentials'.

.PARAMETER Tag
Run only requests with this tag ('App' or 'Auth'). If not specified, runs all requests.

.PARAMETER Request
Run only the request with this name.

.PARAMETER Collection
Run only requests in this collection/folder.

.EXAMPLE
# Run all tests in local environment with services, bootstrap, and seed
powershell -File tests/api/run-bruno.ps1 -StartServices -BootstrapAuth -SeedData -Env local

# Run only App tag tests
powershell -File tests/api/run-bruno.ps1 -Env local -Tag App

# Run specific request
powershell -File tests/api/run-bruno.ps1 -Env local -Request auth-me
#>

param(
  [string]$Env = 'local',
  [switch]$StartServices,
  [switch]$BootstrapAuth,
  [switch]$SeedData,
  [ValidateSet('client_credentials','password')][string]$GrantType = 'client_credentials',
  [ValidateSet('App','Auth')][string]$Tag,
  [string]$Request,
  [string]$Collection
)

$ErrorActionPreference = 'Stop'

# Step 1: Start docker compose services if requested
if ($StartServices) {
  Write-Host "Starting docker compose services..." -ForegroundColor Cyan
  & powershell -File (Join-Path $PSScriptRoot '..\..\compose\start-services.ps1') -Rebuild
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "Services started." -ForegroundColor Green
}

# Step 2: Run Keycloak bootstrap if requested
if ($BootstrapAuth) {
  Write-Host "Running Keycloak bootstrap..." -ForegroundColor Cyan
  & powershell -File (Join-Path $PSScriptRoot '..\..\eng\bootstrap-keycloak-for-tests.ps1')
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "Keycloak bootstrap complete." -ForegroundColor Green
}

# Step 3: Set OIDC defaults if not already set
if (-not $env:OIDC_ISSUER) {
  $env:OIDC_ISSUER = 'https://localhost/auth/realms/edfi'
}
if (-not $env:OIDC_CLIENT_ID) {
  $env:OIDC_CLIENT_ID = 'edfiadminapp-dev'
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

# Step 4: Acquire access token
Write-Host "Acquiring access token from $($env:OIDC_ISSUER)..." -ForegroundColor Cyan
$tokenEndpoint = "$($env:OIDC_ISSUER.TrimEnd('/'))/protocol/openid-connect/token"

$body = if ($GrantType -eq 'client_credentials') {
  @{
    grant_type = 'client_credentials'
    client_id = $env:OIDC_CLIENT_ID
    client_secret = $env:OIDC_CLIENT_SECRET
  }
} else {
  @{
    grant_type = 'password'
    client_id = $env:OIDC_CLIENT_ID
    client_secret = $env:OIDC_CLIENT_SECRET
    username = $env:OIDC_USERNAME
    password = $env:OIDC_PASSWORD
  }
}

try {
  # Create WebRequest for certificate bypass on older PowerShell
  [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
  
  $tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenEndpoint -Body $body -ContentType 'application/x-www-form-urlencoded' -ErrorAction Stop
  $token = $tokenResponse.access_token
  if (-not $token) { throw 'No access token in response.' }
  $env:ACCESS_TOKEN = $token
  Write-Host "Token acquired successfully." -ForegroundColor Green
} catch {
  Write-Host "Failed to acquire token: $_" -ForegroundColor Red
  Write-Host "Proceeding without token. Tests may fail if authentication is required." -ForegroundColor Yellow
}

# Step 4: Seed data if requested
if ($SeedData) {
  Write-Host "Seeding test data..." -ForegroundColor Cyan
  & powershell -File (Join-Path $PSScriptRoot '..\..\eng\bootstrap-keycloak-for-tests.ps1') -SeedDataOnly
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "Data seeded successfully." -ForegroundColor Green
}

# Step 5: Build Bruno command with filters
$workspacePath = Resolve-Path (Join-Path $PSScriptRoot '.')
$bruArgs = @('run', '.', '--env', $Env, '--insecure')

if ($Tag) {
  $bruArgs += @('--tags', $Tag)
}
if ($Collection) {
  $bruArgs += @('--tags', $Collection)
}
if ($Request) {
  $bruArgs += @('--tags', $Request)
}

# Step 6: Run Bruno tests from the workspace directory
Write-Host "Running Bruno tests from $workspacePath..." -ForegroundColor Cyan
Push-Location $workspacePath
& bru @bruArgs
$bruExitCode = $LASTEXITCODE
Pop-Location

if ($bruExitCode -ne 0) { exit $bruExitCode }

Write-Host "Tests completed successfully." -ForegroundColor Green
