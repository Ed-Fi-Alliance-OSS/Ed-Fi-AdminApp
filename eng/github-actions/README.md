# GitHub Actions Helper Scripts

This folder contains scripts used by GitHub Actions workflows and local workflow debugging.

## start-services-target.ps1

`start-services-target.ps1` starts the Docker Compose services required for Admin App development and E2E execution. It selects one or more Ed-Fi target topologies, optionally includes Admin App containers, and can rebuild images before startup.

### What it does

- Creates the shared Docker network if it does not already exist.
- Starts common support services such as nginx, Keycloak, cache, and database containers.
- Starts one or more Ed-Fi target topologies.
- Optionally starts Admin App API and FE containers.
- Optionally rebuilds Docker images before startup.

### How to run it

From the repository root:

```powershell
pwsh ./eng/github-actions/start-services-target.ps1 -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild
```

You can also run only Admin App services:

```powershell
pwsh ./eng/github-actions/start-services-target.ps1 -IncludeAdminApp
```

### Common options

- `-V6` enables the Ed-Fi v6 topology.
- `-OdsV7AdminV2` enables the Ed-Fi v7 Admin API v2 topology.
- `-OdsV7AdminV3` enables the Ed-Fi v7 Admin API v3 topology.
- `-IncludeAdminApp` starts Admin App API and FE containers.
- `-Rebuild` rebuilds Docker images before startup.
- `-MSSQL` uses SQL Server instead of PostgreSQL for the Admin App database.

### Requirements

- Docker must be installed and running.
- `compose/.env` must exist before the script runs.
- Run the script from a clone of the repository so relative paths resolve correctly.