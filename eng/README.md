# Engineering Scripts

This folder contains local engineering and test automation scripts used by Admin App contributors.

## Folder Contents

### `eng\helpers`

- `bootstrap-keycloak-for-tests.ps1` — Bootstraps Keycloak clients/users and can seed test data used by API test flows.
- `create-local-user-keycloak.ps1` — Creates/updates a local Keycloak user for development scenarios.
- `start-all-services-test-docker.ps1` — Starts local Docker services required for API test runs.
- `get-bruno-token.ps1` — Requests an OAuth token from Keycloak container.

### `eng\github-actions`

- `start-services-target.ps1` — Starts the Docker Compose topologies used by GitHub Actions and local E2E workflow debugging.

For full usage, flags, and examples, see [GitHub Actions Helper Scripts](github-actions/README.md).

### `eng\testing`

- `run-bruno.ps1` — Main runner for Bruno API tests, including optional service startup, auth bootstrap, token acquisition, and collection/request filters.

For full usage, flags, and troubleshooting for `run-bruno.ps1`, see [API Bruno E2E Tests](testing/README.md).