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

if ($MSSQL) {
    Write-Host "Starting Docker Compose services with SQL Server..." -ForegroundColor Green
    $env:COMPOSE_PROFILES="mssql"
    docker compose $files up edfiadminapp-mssql -d $(if ($Rebuild) { "--build" })
    Write-Host "SQL Server service started! Starting remaining services..." -ForegroundColor Green
    docker compose $files up -d $(if ($Rebuild) { "--build" }) --scale edfiadminapp-db=0
} else {
    Write-Host "Starting Docker Compose services with PostgreSQL..." -ForegroundColor Green
    docker compose $files up -d $(if ($Rebuild) { "--build" }) --scale edfiadminapp-mssql=0
}
Write-Host "Services started successfully!" -ForegroundColor Green
