<#
.SYNOPSIS
    Shuts down the Docker Compose services.
#>

param(
    # Drops existing volumes
    [Switch] $V,

    # Keep Keycloak volume
    [Switch] $KeepKeycloakVolume,

    # Stop only local-dev services
    [Switch] $LocalDev,

    # Stop only main services
    [Switch] $MainServices
)

function Remove-Volumes {
  param (
    [Switch]$KeepKeycloakVolume
  )
  # List all volumes
  $volumes = docker volume ls --format "{{.Name}}"

  # Filter out volumes that do not contain 'keycloak' if needed
  if ($KeepKeycloakVolume) {
      $volumesToRemove = $volumes | Where-Object { $_ -notlike "*keycloak*" }
  } else {
      $volumesToRemove = $volumes
  }

  # Remove the filtered volumes
  if ($volumesToRemove) {
      docker volume rm $volumesToRemove
  } else {
      Write-Host "No volumes to remove." -ForegroundColor Yellow
  }
}


try {
    $files = @(
        "-f", "edfi-services.yml",
        "-f", "nginx-compose.yml",
        "-f", "adminapp-services.yml"
    )
    docker compose $files --env-file ".env"  --profile "*" down
    if ($V) {
        Remove-Volumes -KeepKeycloakVolume:$KeepKeycloakVolume
    }
    Write-Host "SUCCESS! Services stopped successfully." -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "ERROR! Services failed to stop." -ForegroundColor Red
    exit 1
}
