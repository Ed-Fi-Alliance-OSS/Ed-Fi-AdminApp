<#
.SYNOPSIS
    Starts Docker Compose for edfi and adminapp supporting services.

.EXAMPLE
    ./start-local-dev.ps1
    Starts the Docker Compose services
    If the edfiadminapp-network does not exist, it will be created.
#>

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
