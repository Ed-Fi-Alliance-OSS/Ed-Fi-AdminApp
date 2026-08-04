# Engineering Scripts

This folder contains local engineering and test automation scripts used by Admin App contributors.

## Folder Contents

### `eng\helpers`

- `bootstrap-keycloak-for-tests.ps1` — Bootstraps Keycloak clients/users and can seed test data used by API test flows.
- `create-local-user-keycloak.ps1` — Creates/updates a local Keycloak user for development scenarios.
- `start-all-services-test-docker.ps1` — Starts local Docker services required for API test runs.
- `get-bruno-token.ps1` — Requests an OAuth token from Keycloak container.
- `start-services-target.ps1` — Starts the Docker Compose services required for Admin App development and E2E execution. Selects one or more Ed-Fi target topologies (`v6`, `odsV7-adminV2`, `odsV7-adminV3`), optionally includes Admin App containers, and can rebuild images before startup. Supports `-MSSQL` to use SQL Server instead of PostgreSQL for the Admin App database.

  ```powershell
  pwsh ./eng/helpers/start-services-target.ps1 -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild
  ```

  Requirements: Docker must be installed and running; `compose/.env` must exist before the script runs; run it from a clone of the repository so relative paths resolve correctly.

### `eng\testing`

- `run-bruno.ps1` — Main runner for Bruno API tests, including optional service startup, auth bootstrap, token acquisition, and collection/request filters.
- `run-e2e-ui.ps1` — Main runner for the Playwright BDD UI E2E suite. Downloads the ODS Minimal Template backup, starts Docker Compose services (PostgreSQL or SQL Server for the Admin App database via `-DbEngine`), creates the local Keycloak test user, and runs the suite. Note: this script regenerates `compose/.env` from `compose/.env.example` on every run, overwriting any local customizations you may have made to `compose/.env`.

For full usage, flags, and troubleshooting for `run-bruno.ps1`, see [API Bruno E2E Tests](testing/README.md).
