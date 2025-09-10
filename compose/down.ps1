<#
.SYNOPSIS
    Shuts down the Docker Compose services.
#>
param(
    # Drops existing volumes, except for keycloak
    [Switch]
    $V,

    # Drop Keycloak's volume as well
    [Switch]
    $Keycloak
)

if ($V) {
    # Drop existing volumes
    docker compose down --volumes
}
else {
    # Shuts down the Docker Compose services without dropping volumes
    docker compose down
}

if ($Keycloak) {
  if ($V) {
    # Shut down Keycloak and remove its volume
    docker compose --project-name edfiadminapp-dev-environment -f keycloak.yml down --volumes
  }
  else {
      # Shut down Keycloak without removing its volume
      docker compose --project-name edfiadminapp-dev-environment -f keycloak.yml down
  }
}
