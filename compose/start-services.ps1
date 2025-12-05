<#
.SYNOPSIS
    Starts the Docker Compose services.

.EXAMPLE
    ./start-local.ps1
    Starts the Docker Compose services
    If the edfiadminapp-network does not exist, it will be created.
    If the -Rebuild switch is provided as $true, it will rebuild the AdminApp images before starting them.
#>

param(
    # Rebuild the images before starting
    [Switch]
    $Rebuild
)

# Import environment utilities
. "$PSScriptRoot\env-utils.ps1"

# Check if .env file exists
$envFilePath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFilePath)) {
    Write-Host ".env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file from .env.example with your configuration." -ForegroundColor Yellow
    exit 1
}

# Load environment variables from .env file
Import-EnvFile -Path $envFilePath

# Process configuration files with environment variable substitution
# This creates .bak backups of the original template files before substitution
$templateFiles = @(
    "./adminapp/realm-config.json"
)
$backupFiles = Invoke-SafeEnvSubstitution -TemplateFiles $templateFiles -WarnOnMissing

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
    "adminapp-services.yml"
)

Write-Host "Starting Docker Compose services..." -ForegroundColor Green
docker compose $files --env-file ".env" up -d $(if ($Rebuild) { "--build" })
Write-Host "Services started successfully!" -ForegroundColor Green

# Note: For bind-mounted files, Docker creates live filesystem links, NOT copies.
# This means changes to host files immediately affect container files.
# To work around this, we copy substituted files into containers before restoring host files.

# Wait for Keycloak container to be running
Write-Host "Waiting for Keycloak container to start..." -ForegroundColor Cyan
$maxWaitSeconds = 30
$startTime = Get-Date
$keycloakRunning = $false

while (((Get-Date) - $startTime).TotalSeconds -lt $maxWaitSeconds) {
    $containerState = docker inspect --format='{{.State.Running}}' edfiadminapp-keycloak 2>$null
    if ($containerState -eq "true") {
        $keycloakRunning = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $keycloakRunning) {
    Write-Host "⚠ Warning: Keycloak container did not start within $maxWaitSeconds seconds." -ForegroundColor Yellow
}

# Copy substituted realm-config.json into Keycloak container's data directory
# This creates a persistent copy that won't be affected by host file restoration
if ($keycloakRunning) {
    Write-Host "Copying substituted configuration files into Keycloak container..." -ForegroundColor Cyan
    try {
        # Copy realm-config.json to a location Keycloak will read on startup
        docker cp "./adminapp/realm-config.json" "edfiadminapp-keycloak:/opt/keycloak/data/import/realm-config.json" 2>&1 | Out-Null
        Write-Host "✓ Configuration files copied successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠ Warning: Failed to copy configuration files: $_" -ForegroundColor Yellow
    }
}

# Restore template files from backups (moves .bak files back to originals)
# This ensures the git-tracked files retain their placeholders without relying on git restore
Write-Host "Restoring template files with placeholders..." -ForegroundColor Cyan
Restore-TemplateFiles -BackupFiles $backupFiles
