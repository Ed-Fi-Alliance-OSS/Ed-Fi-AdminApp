<#
.SYNOPSIS
    Starts the Docker Compose services.

.EXAMPLE
    ./start-local.ps1
    Starts the Docker Compose services

.EXAMPLE
    ./start-local.ps1 -MSSQL
    Starts the Docker Compose services with SQL Server instead of PostgreSQL

    If the edfiadminapp-network does not exist, it will be created.
    If the -Rebuild switch is provided as $true, it will rebuild the AdminApp images before starting them.
    If the -MSSQL switch is provided, it will use SQL Server instead of PostgreSQL for the Admin App database.
#>

param(
    # Rebuild the images before starting
    [Switch]
    $Rebuild,

    # Use SQL Server instead of PostgreSQL for the Admin App database
    [Switch]
    $MSSQL
)

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

$composeProfile = "postgresql"
if ($MSSQL) {
  $composeProfile = "mssql"
}

Write-Host "Starting Docker Compose services with profile $composeProfile, running Admin App..." -ForegroundColor Green
docker compose $files --env-file ".env" --profile $composeProfile --profile adminapp up -d $(if ($Rebuild) { "--build" })
Write-Host "Services started successfully!" -ForegroundColor Green
