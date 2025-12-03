<#
.SYNOPSIS
    Starts Docker Compose for edfi and adminapp supporting services.

.EXAMPLE
    ./start-local-dev.ps1
    Starts the Docker Compose services
    If the edfiadminapp-network does not exist, it will be created.
#>

# Import environment utilities
. "$PSScriptRoot\env-utils.ps1"

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host ".env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file from .env.example with your configuration." -ForegroundColor Yellow
    exit 1
}

# Load environment variables from .env file
Import-EnvFile -Path ".env"

# Process configuration files with environment variable substitution
$templateFiles = @(
    "./settings/keycloak_edfiadminapp_machine_client.json",
    "./adminapp/realm-config.json"
)
Invoke-BulkEnvSubstitution -TemplateFiles $templateFiles -WarnOnMissing

$networkExists = docker network ls --filter name=edfiadminapp-network --format '{{.Name}}' | Select-String -Pattern 'edfiadminapp-network'
if (-not $networkExists) {
    Write-Host "Creating edfiadminapp-network..." -ForegroundColor Yellow
    docker network create edfiadminapp-network --driver bridge
}
$files = @(
    "-f",
    "edfi-services.yml",
    "-f",
    "nginx-compose.yml",
    "-f",
    "adminapp-local-dev.yml"
)

Write-Host "Starting Docker Compose services..." -ForegroundColor Green
docker compose $files --env-file ".env" up -d
Write-Host "Services started successfully!" -ForegroundColor Green

# Restore template files to keep placeholders in git
Write-Host "Restoring template files with placeholders..." -ForegroundColor Cyan
foreach ($file in $templateFiles) {
    git restore $file 2>$null
}
Write-Host "Template files restored." -ForegroundColor Green
