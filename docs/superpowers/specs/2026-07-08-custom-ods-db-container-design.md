# Custom ODS DB Container for Single-Tenant Admin API v2 (AC-572)

## Context

`compose\edfi-services.yml` currently builds the `odsV7-adminV2-single-db-ods`
container from a public Docker Hub image (`edfialliance/${ODS_DB_IMAGE_7X}:${ODS_DB_TAG_7X}`).
We need to replace this with a locally-built PostgreSQL image so the ODS
database restore process is fully under our control, using
`docs\AC-572\Dockerfile` and `docs\AC-572\init.sh` as reference.

This is phase 1 of a larger effort. Only two containers are in scope for this
spec: `odsV7-adminV2-single-db-ods` and `odsV7-adminV2-single-adminapi`. Other
ODS/API topologies (multi-tenant v2, v3, v6) are explicitly out of scope and
will be addressed in later work once this pattern is validated.

## Goals

1. Build a custom PostgreSQL 16 image (`compose\DB-Ods\Dockerfile`) that
   restores ODS data from user-supplied `.sql` backup files, replacing the
   Docker Hub image for `odsV7-adminV2-single-db-ods`.
2. Preserve current behavior: the container must still produce a database
   named `EdFi_Ods`, since this name is hardcoded elsewhere (e.g.
   `compose\settings\bootstrap.sh`, `compose\settings\pgadmin-servers.json`).
3. Add new connection strings (`ConnectionStrings__EdFi_Ods`,
   `ConnectionStrings__EdFi_Master`) to `odsV7-adminV2-single-adminapi` so it
   can reach the ODS database and the Postgres maintenance database directly.
4. Provide a way to switch which dataset (`minimal` or `populated`) backs the
   `EdFi_Ods` database, via an env var.
5. Document how to obtain/provide backup files, and how the new build-based
   image works, for future developers.

## Non-goals

- Changing any other ODS/API topology (multi-tenant, v3, v6.2) in this spec.
- Automating retrieval of the `.sql` backup files — the user is responsible
  for supplying them.
- Adding TPDM-aware restore logic to `init.sh` (the env var is preserved for
  future use only).

## Design

### 1. `compose\DB-Ods\Dockerfile`

Same as `docs\AC-572\Dockerfile`: `FROM postgres:16-alpine`, copies
`init.sh` into `/app`, normalizes line endings, exposes 5432, and uses
`init.sh` as the entrypoint.

### 2. `compose\DB-Ods\init.sh`

Adapted from `docs\AC-572\init.sh` with one addition. The existing script
already, on first run (`PGDATA/PG_VERSION` absent):

- Validates `MINIMAL_SQL_PATH` and `POPULATED_SQL_PATH` point to existing
  files inside the container.
- Initializes the PostgreSQL data directory and starts Postgres temporarily.
- Sets the `POSTGRES_USER` password.
- Creates `Ods_Minimal_Template` and restores `MINIMAL_SQL_PATH` into it,
  then marks it as a template database (`datistemplate = true`).
- Creates `Ods_Populated_Template` and restores `POPULATED_SQL_PATH` into
  it, then marks it as a template database.
- Stops the temporary instance, then starts PostgreSQL in the foreground.

**New step**, added right after both templates are created and marked as
templates, still inside the first-run block: create the `EdFi_Ods` database
as a fast filesystem-level clone of one of the two templates, based on a new
`EDFI_ODS_DATASET` env var (default `minimal`):

```sh
EDFI_ODS_DATASET="${EDFI_ODS_DATASET:-minimal}"
...
case "$EDFI_ODS_DATASET" in
  populated)
    SOURCE_TEMPLATE="Ods_Populated_Template"
    ;;
  minimal|*)
    SOURCE_TEMPLATE="Ods_Minimal_Template"
    ;;
esac

echo "Creating EdFi_Ods from template '$SOURCE_TEMPLATE'..."
su-exec postgres psql -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
    -c "CREATE DATABASE \"EdFi_Ods\" TEMPLATE \"$SOURCE_TEMPLATE\";"
```

`TPDM_ENABLED` continues to be accepted as an env var for parity with the
previous image and for potential future use, but `init.sh` does not act on
it yet.

### 3. `compose\edfi-services.yml` changes

**`odsV7-adminV2-single-db-ods`**: switch from `image:` to a `build:` +
explicit `image:` tag, add new env vars (with in-file defaults matching the
existing style used for `POSTGRES_PORT`/`TPDM_ENABLED` elsewhere in this
file), and add a read-only bind mount for the backup folder:

```yaml
odsV7-adminV2-single-db-ods:
  build:
    context: ./DB-Ods
  image: edfiadminapp/db-ods:local
  environment:
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_PORT: "${POSTGRES_PORT:-5432}"
    TPDM_ENABLED: '${TPDM_ENABLED:-true}'
    MINIMAL_SQL_PATH: "${MINIMAL_SQL_PATH:-/var/opt/pgsql/data/sql-backups/EdFi.Ods.Minimal.Template.sql}"
    POPULATED_SQL_PATH: "${POPULATED_SQL_PATH:-/var/opt/pgsql/data/sql-backups/EdFi.Ods.Populated.Template.sql}"
    EDFI_ODS_DATASET: "${EDFI_ODS_DATASET:-minimal}"
  restart: always
  volumes:
    - vol-odsV7-adminV2-single-db-ods:/var/lib/postgresql/data
    - ${SQL_BACKUPS_FOLDER}:/var/opt/pgsql/data/sql-backups/:ro
  healthcheck: # unchanged
  networks: # unchanged
```

`SQL_BACKUPS_FOLDER` is only used as the host-side source of the bind mount
— it is not added to the container's `environment:` block since `init.sh`
never reads it directly (only the in-container `MINIMAL_SQL_PATH` /
`POPULATED_SQL_PATH` matter to the script).

**`odsV7-adminV2-single-adminapi`**: add two connection strings and update
`depends_on` to include the ODS db container:

```yaml
ConnectionStrings__EdFi_Ods: 'host=odsV7-adminV2-single-db-ods;port=${POSTGRES_PORT:-5432};username=${POSTGRES_USER};******;database=EdFi_Ods;pooling=true'
ConnectionStrings__EdFi_Master: 'host=odsV7-adminV2-single-db-ods;port=${POSTGRES_PORT:-5432};username=${POSTGRES_USER};******;database=postgres;pooling=true'
```
```yaml
depends_on:
  - odsV7-adminV2-single-db-admin
  - odsV7-adminV2-single-db-ods
```

### 4. `.env.example` / `.env` additions

```
SQL_BACKUPS_FOLDER=./db-backup
MINIMAL_SQL_PATH=/var/opt/pgsql/data/sql-backups/EdFi.Ods.Minimal.Template.sql
POPULATED_SQL_PATH=/var/opt/pgsql/data/sql-backups/EdFi.Ods.Populated.Template.sql
EDFI_ODS_DATASET=minimal
POSTGRES_PORT=5432
```

`SQL_BACKUPS_FOLDER` is a host path the user must set to a folder containing
their own `EdFi.Ods.Minimal.Template.sql` and
`EdFi.Ods.Populated.Template.sql` files; providing these files is the
responsibility of the person running the environment.
Existing `ODS_DB_IMAGE_7X` / `ODS_DB_TAG_7X` vars remain in `.env.example`
for the other topologies still using the Docker Hub image, but are no
longer consumed by `odsV7-adminV2-single-db-ods`.

## Testing plan (manual, run from `compose\`)

```powershell
# Build only the new db-ods image
docker compose -f edfi-services.yml --env-file .env build odsV7-adminV2-single-db-ods

# (Fresh test) Remove old container + volume so init.sh runs from scratch
docker compose -f edfi-services.yml --env-file .env rm -sf odsV7-adminV2-single-db-ods
docker volume rm vol-odsV7-adminV2-single-db-ods

# Start db-ods and watch init logs
docker compose -f edfi-services.yml --env-file .env up -d odsV7-adminV2-single-db-ods
docker compose -f edfi-services.yml --env-file .env logs -f odsV7-adminV2-single-db-ods

# Verify databases were created
docker compose -f edfi-services.yml --env-file .env exec odsV7-adminV2-single-db-ods psql -U postgres -c "\l"

# Bring up admin db + admin API (adminapi now also depends on db-ods)
docker compose -f edfi-services.yml --env-file .env up -d odsV7-adminV2-single-db-admin odsV7-adminV2-single-adminapi
docker compose -f edfi-services.yml --env-file .env logs -f odsV7-adminV2-single-adminapi

# Sanity-check the new connection strings inside adminapi's container env
docker compose -f edfi-services.yml --env-file .env exec odsV7-adminV2-single-adminapi env | Select-String "ConnectionStrings__EdFi_"
```

## Documentation updates (Phase 3, after manual testing passes)

- `compose\readme.md`: document the new `DB-Ods` custom-built container,
  why it replaces the Docker Hub image, the `EDFI_ODS_DATASET` switch, and
  the requirement to supply `.sql` backup files via `SQL_BACKUPS_FOLDER`.
- `docs\ed-fi-development.md`: add a developer setup note about obtaining
  and placing the minimal & populated `.sql` backup files before first run.
- `docs\deployment.md`: note the build-based image and required backup-file
  provisioning for non-local deployments.

## Out of scope / future work

- Applying the same custom-built ODS DB pattern to the multi-tenant v2, v3,
  and v6.2 topologies.
- Automating TPDM-aware restore logic in `init.sh`.
- Automated (non-manual) test coverage for the container restore process.
