# Custom ODS DB Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Docker Hub image used by the `odsV7-adminV2-single-db-ods`
container with a locally-built PostgreSQL image (based on `docs\AC-572`), wire
new `EdFi_Ods`/`EdFi_Master` connection strings into
`odsV7-adminV2-single-adminapi`, verify it all works end-to-end with manual
docker commands, then update the three documentation files.

**Architecture:** A new `compose\DB-Ods\` folder holds a `Dockerfile`
(`FROM postgres:16-alpine`) and an `init.sh` entrypoint script that restores
two user-supplied `.sql` backups into template databases
(`Ods_Minimal_Template`, `Ods_Populated_Template`), then clones one of them
into `EdFi_Ods` based on an `EDFI_ODS_DATASET` env var. `edfi-services.yml` is
updated to build this image instead of pulling from Docker Hub, and to add
new connection strings to the admin API container.

**Tech Stack:** Docker Compose, PostgreSQL 16 (Alpine), POSIX shell (`sh`),
YAML.

**Reference spec:** `docs\superpowers\specs\2026-07-08-custom-ods-db-container-design.md`

---

### Task 1: Create the `DB-Ods` Dockerfile and init.sh

**Files:**
- Create: `compose\DB-Ods\Dockerfile`
- Create: `compose\DB-Ods\init.sh`

- [ ] **Step 1: Create the Dockerfile**

Create `compose\DB-Ods\Dockerfile` with this exact content:

```dockerfile
# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

FROM postgres:16-alpine

LABEL maintainer="Ed-Fi Alliance, LLC and Contributors <techsupport@ed-fi.org>"

WORKDIR /app

COPY --chmod=500 ./init.sh .

# Normalize line endings in case the file was edited on Windows
RUN sed -i 's/\r$//' ./init.sh

EXPOSE 5432
ENTRYPOINT ["/app/init.sh"]
```

- [ ] **Step 2: Create init.sh**

Create `compose\DB-Ods\init.sh` with this exact content (adapted from
`docs\AC-572\init.sh`, with an added step that creates `EdFi_Ods` as a
template clone based on `EDFI_ODS_DATASET`):

```sh
#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

set -e

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-P@ssw0rd}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
PGDATA="${PGDATA:-/var/lib/postgresql/data}"
MINIMAL_SQL_PATH="${MINIMAL_SQL_PATH:-}"
POPULATED_SQL_PATH="${POPULATED_SQL_PATH:-}"
EDFI_ODS_DATASET="${EDFI_ODS_DATASET:-minimal}"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
    # Validate SQL files are provided and accessible before doing any work
    if [ -z "$MINIMAL_SQL_PATH" ]; then
        echo "ERROR: MINIMAL_SQL_PATH environment variable is not set."
        echo "Mount a directory containing your SQL backup files and set MINIMAL_SQL_PATH to the file path inside the container."
        exit 1
    fi
    if [ ! -f "$MINIMAL_SQL_PATH" ]; then
        echo "ERROR: Minimal SQL file not found at '$MINIMAL_SQL_PATH'."
        echo "Ensure the file is mounted into the container at the path specified by MINIMAL_SQL_PATH."
        exit 1
    fi
    if [ -z "$POPULATED_SQL_PATH" ]; then
        echo "ERROR: POPULATED_SQL_PATH environment variable is not set."
        echo "Mount a directory containing your SQL backup files and set POPULATED_SQL_PATH to the file path inside the container."
        exit 1
    fi
    if [ ! -f "$POPULATED_SQL_PATH" ]; then
        echo "ERROR: Populated SQL file not found at '$POPULATED_SQL_PATH'."
        echo "Ensure the file is mounted into the container at the path specified by POPULATED_SQL_PATH."
        exit 1
    fi

    echo "Initializing PostgreSQL data directory..."
    su-exec postgres initdb \
        --username="$POSTGRES_USER" \
        --auth-local=trust \
        --auth-host=md5 \
        -D "$PGDATA"

    # Allow connections from any host (e.g. Docker bridge, host machine)
    echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"

    echo "Starting PostgreSQL for initial setup..."
    su-exec postgres postgres -D "$PGDATA" -p "$POSTGRES_PORT" -c listen_addresses='*' &
    BG_PID=$!

    retries=0
    until su-exec postgres pg_isready -U "$POSTGRES_USER" -p "$POSTGRES_PORT" -h localhost; do
        retries=$((retries + 1))
        if [ "$retries" -ge 30 ]; then
            echo "ERROR: PostgreSQL did not become ready within 60 seconds."
            exit 1
        fi
        echo "Waiting for PostgreSQL to be ready... ($retries/30)"
        sleep 2
    done

    echo "Setting user password..."
    su-exec postgres psql -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -c "ALTER USER \"${POSTGRES_USER}\" WITH PASSWORD '${POSTGRES_PASSWORD}';"

    echo "Creating and restoring Ods_Minimal_Template from $MINIMAL_SQL_PATH..."
    su-exec postgres psql -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -c "CREATE DATABASE \"Ods_Minimal_Template\";"
    PGPASSWORD="$POSTGRES_PASSWORD" su-exec postgres psql \
        --host=localhost \
        --port="$POSTGRES_PORT" \
        --username="$POSTGRES_USER" \
        --dbname="Ods_Minimal_Template" \
        -f "$MINIMAL_SQL_PATH"
    su-exec postgres psql -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -c "UPDATE pg_database SET datistemplate = true WHERE datname = 'Ods_Minimal_Template';"

    echo "Creating and restoring Ods_Populated_Template from $POPULATED_SQL_PATH..."
    su-exec postgres psql -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -c "CREATE DATABASE \"Ods_Populated_Template\";"
    PGPASSWORD="$POSTGRES_PASSWORD" su-exec postgres psql \
        --host=localhost \
        --port="$POSTGRES_PORT" \
        --username="$POSTGRES_USER" \
        --dbname="Ods_Populated_Template" \
        -f "$POPULATED_SQL_PATH"
    su-exec postgres psql -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -c "UPDATE pg_database SET datistemplate = true WHERE datname = 'Ods_Populated_Template';"

    case "$EDFI_ODS_DATASET" in
        populated)
            SOURCE_TEMPLATE="Ods_Populated_Template"
            ;;
        minimal|*)
            SOURCE_TEMPLATE="Ods_Minimal_Template"
            ;;
    esac

    echo "Creating EdFi_Ods from template '$SOURCE_TEMPLATE' (EDFI_ODS_DATASET=$EDFI_ODS_DATASET)..."
    su-exec postgres psql -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -c "CREATE DATABASE \"EdFi_Ods\" TEMPLATE \"$SOURCE_TEMPLATE\";"

    echo "Stopping setup instance..."
    su-exec postgres pg_ctl stop -D "$PGDATA" -m fast
    wait $BG_PID 2>/dev/null || true
    echo "Initial setup complete."
fi

echo "Starting PostgreSQL in foreground..."
exec su-exec postgres postgres -D "$PGDATA" -p "$POSTGRES_PORT" -c listen_addresses='*'
```

- [ ] **Step 3: Verify shell syntax is valid**

Run (requires `sh`/WSL/Git Bash on Windows; if unavailable, use `docker run --rm -v` to check inside an alpine container):

```powershell
docker run --rm -v "${PWD}\compose\DB-Ods\init.sh:/init.sh:ro" alpine:3 sh -n /init.sh
```

Expected: no output (exit code 0 means no syntax errors).

- [ ] **Step 4: Commit**

```powershell
git add compose/DB-Ods/Dockerfile compose/DB-Ods/init.sh
git commit -m "feat: add custom ODS DB Dockerfile and init.sh (AC-572)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Add new environment variables to `.env.example` and `.env`

**Files:**
- Modify: `compose\.env.example`
- Modify: `compose\.env`

- [ ] **Step 1: Update `compose\.env.example`**

Find these lines (around line 16-18):

```
# Next two lines are for the minimal template
ODS_DB_IMAGE_7X=ods-api-db-ods-minimal
ODS_DB_TAG_7X=v7.3@sha256:579a324a39d8439f1b4087112f586ba665ca292e8ddaf3923b6718f11ac8ab0e
```

Replace with (keeping the existing lines, and adding the new block directly
after them):

```
# Next two lines are for the minimal template
ODS_DB_IMAGE_7X=ods-api-db-ods-minimal
ODS_DB_TAG_7X=v7.3@sha256:579a324a39d8439f1b4087112f586ba665ca292e8ddaf3923b6718f11ac8ab0e
# NOTE: ODS_DB_IMAGE_7X / ODS_DB_TAG_7X above are no longer used by the
# odsV7-adminV2-single-db-ods container, which is now built locally from
# compose/DB-Ods. They are still used by the other ODS/API v7 topologies.

# odsV7-adminV2-single-db-ods custom image settings (see compose/DB-Ods)
# SQL_BACKUPS_FOLDER is a host path to a folder containing your own
# EdFi.Ods.Minimal.Template.sql and EdFi.Ods.Populated.Template.sql backup
# files. You must provide these files; they are not included in this repo.
SQL_BACKUPS_FOLDER=./db-backup
MINIMAL_SQL_PATH=/var/opt/pgsql/data/sql-backups/EdFi.Ods.Minimal.Template.sql
POPULATED_SQL_PATH=/var/opt/pgsql/data/sql-backups/EdFi.Ods.Populated.Template.sql
# EDFI_ODS_DATASET controls which template EdFi_Ods is cloned from: minimal | populated
EDFI_ODS_DATASET=minimal
POSTGRES_PORT=5432
```

- [ ] **Step 2: Update `compose\.env`**

Apply the identical change to `compose\.env` (find the same
`ODS_DB_IMAGE_7X`/`ODS_DB_TAG_7X` lines around line 35-37 and add the same
block after them).

- [ ] **Step 3: Verify the folder referenced by `SQL_BACKUPS_FOLDER` exists on your machine**

Before testing in Task 5, create the folder and place your two backup files
in it (filenames must match `MINIMAL_SQL_PATH`/`POPULATED_SQL_PATH` above):

```powershell
New-Item -ItemType Directory -Path C:\GAP\EdFi\AdminApp-v4\Ed-Fi-AdminApp\compose\db-backup -Force
# Copy your own EdFi.Ods.Minimal.Template.sql and EdFi.Ods.Populated.Template.sql
# into that folder before running Task 5.
```

- [ ] **Step 4: Commit**

```powershell
git add compose/.env.example compose/.env
git commit -m "feat: add env vars for custom ODS DB image (AC-572)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Update `odsV7-adminV2-single-db-ods` service definition

**Files:**
- Modify: `compose\edfi-services.yml:6-21`

- [ ] **Step 1: Replace the service block**

Find:

```yaml
  odsV7-adminV2-single-db-ods:
    image: edfialliance/${ODS_DB_IMAGE_7X}:${ODS_DB_TAG_7X}
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      TPDM_ENABLED: '${TPDM_ENABLED:-true}'
    restart: always
    volumes:
      - vol-odsV7-adminV2-single-db-ods:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready  -U ${POSTGRES_USER}']
      start_period: 30s
      retries: 30
      interval: 30s
    networks:
      - edfiadminapp-network
```

Replace with:

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
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready  -U ${POSTGRES_USER}']
      start_period: 30s
      retries: 30
      interval: 30s
    networks:
      - edfiadminapp-network
```

- [ ] **Step 2: Validate compose file syntax**

Run from `compose\`:

```powershell
docker compose -f edfi-services.yml --env-file .env config --quiet
```

Expected: no output, exit code 0 (means YAML + variable interpolation is
valid).

- [ ] **Step 3: Commit**

```powershell
git add compose/edfi-services.yml
git commit -m "feat: build odsV7-adminV2-single-db-ods from custom DB-Ods image

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Add `EdFi_Ods`/`EdFi_Master` connection strings to `odsV7-adminV2-single-adminapi`

**Files:**
- Modify: `compose\edfi-services.yml:80-120`

- [ ] **Step 1: Add the connection strings**

Find (inside the `odsV7-adminV2-single-adminapi` service, in the
`environment:` block):

```yaml
      ConnectionStrings__EdFi_Admin: 'host=odsV7-adminV2-single-db-admin;port=5432;username=${POSTGRES_USER};******;database=EdFi_Admin;'
      ConnectionStrings__EdFi_Security: 'host=odsV7-adminV2-single-db-admin;port=5432;username=${POSTGRES_USER};******;database=EdFi_Security;'
      EdFiApiDiscoveryUrl: ${ODS_V7_ADMIN_V2_SINGLE_API_DISCOVERY_URL}
```

Replace with:

```yaml
      ConnectionStrings__EdFi_Admin: 'host=odsV7-adminV2-single-db-admin;port=5432;username=${POSTGRES_USER};******;database=EdFi_Admin;'
      ConnectionStrings__EdFi_Security: 'host=odsV7-adminV2-single-db-admin;port=5432;username=${POSTGRES_USER};******;database=EdFi_Security;'
      ConnectionStrings__EdFi_Ods: 'host=odsV7-adminV2-single-db-ods;port=${POSTGRES_PORT:-5432};username=${POSTGRES_USER};******;database=EdFi_Ods;pooling=true'
      ConnectionStrings__EdFi_Master: 'host=odsV7-adminV2-single-db-ods;port=${POSTGRES_PORT:-5432};username=${POSTGRES_USER};******;database=postgres;pooling=true'
      EdFiApiDiscoveryUrl: ${ODS_V7_ADMIN_V2_SINGLE_API_DISCOVERY_URL}
```

- [ ] **Step 2: Update `depends_on`**

Find (still inside `odsV7-adminV2-single-adminapi`):

```yaml
    depends_on:
      - odsV7-adminV2-single-db-admin
```

Replace with:

```yaml
    depends_on:
      - odsV7-adminV2-single-db-admin
      - odsV7-adminV2-single-db-ods
```

- [ ] **Step 3: Validate compose file syntax**

Run from `compose\`:

```powershell
docker compose -f edfi-services.yml --env-file .env config --quiet
```

Expected: no output, exit code 0.

- [ ] **Step 4: Confirm the rendered connection strings look correct**

Run from `compose\`:

```powershell
docker compose -f edfi-services.yml --env-file .env config | Select-String "ConnectionStrings__EdFi_"
```

Expected output includes four lines, with the new two showing
`host=odsV7-adminV2-single-db-ods` and `database=EdFi_Ods` /
`database=postgres` respectively (password will show as `postgres` from
`.env`, not masked, since `config` fully interpolates variables).

- [ ] **Step 5: Commit**

```powershell
git add compose/edfi-services.yml
git commit -m "feat: add EdFi_Ods and EdFi_Master connection strings to single-tenant admin API v2

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Manual end-to-end verification

**Files:** none (verification only, run from `compose\`)

- [ ] **Step 1: Build the new image**

```powershell
docker compose -f edfi-services.yml --env-file .env build odsV7-adminV2-single-db-ods
```

Expected: build completes successfully (exit code 0), final output line
similar to `=> => naming to docker.io/edfiadminapp/db-ods:local`.

- [ ] **Step 2: Remove any pre-existing container/volume for a clean first-run test**

```powershell
docker compose -f edfi-services.yml --env-file .env rm -sf odsV7-adminV2-single-db-ods
docker volume rm vol-odsV7-adminV2-single-db-ods
```

Expected: both commands succeed (the volume command may say "no such
volume" if it never existed — that's fine).

- [ ] **Step 3: Start the db-ods container and capture init logs**

```powershell
docker compose -f edfi-services.yml --env-file .env up -d odsV7-adminV2-single-db-ods
docker compose -f edfi-services.yml --env-file .env logs odsV7-adminV2-single-db-ods
```

Expected in the logs: `Initializing PostgreSQL data directory...`, then
`Creating and restoring Ods_Minimal_Template...`, then
`Creating and restoring Ods_Populated_Template...`, then
`Creating EdFi_Ods from template 'Ods_Minimal_Template' (EDFI_ODS_DATASET=minimal)...`,
then `Starting PostgreSQL in foreground...`, with no `ERROR:` lines.

- [ ] **Step 4: Verify the three databases exist**

```powershell
docker compose -f edfi-services.yml --env-file .env exec odsV7-adminV2-single-db-ods psql -U postgres -c "\l"
```

Expected: the database list includes `EdFi_Ods`, `Ods_Minimal_Template`, and
`Ods_Populated_Template`.

- [ ] **Step 5: Verify `EdFi_Ods` contains restored data (not an empty database)**

```powershell
docker compose -f edfi-services.yml --env-file .env exec odsV7-adminV2-single-db-ods psql -U postgres -d EdFi_Ods -c "\dt" 
```

Expected: a non-empty list of tables (exact tables depend on your backup
file content, but the list must not be empty).

- [ ] **Step 6: Bring up the admin db and admin API**

```powershell
docker compose -f edfi-services.yml --env-file .env up -d odsV7-adminV2-single-db-admin odsV7-adminV2-single-adminapi
docker compose -f edfi-services.yml --env-file .env logs odsV7-adminV2-single-adminapi
```

Expected: no fatal startup errors in the adminapi logs (application starts
and begins listening).

- [ ] **Step 7: Confirm the adminapi container resolved the new connection strings**

```powershell
docker compose -f edfi-services.yml --env-file .env exec odsV7-adminV2-single-adminapi env | Select-String "ConnectionStrings__EdFi_"
```

Expected: four `ConnectionStrings__EdFi_*` variables listed, including
`ConnectionStrings__EdFi_Ods` with `host=odsV7-adminV2-single-db-ods` and
`database=EdFi_Ods`, and `ConnectionStrings__EdFi_Master` with
`database=postgres`.

- [ ] **Step 8: Confirm adminapi can reach the ODS database over the network**

```powershell
docker compose -f edfi-services.yml --env-file .env exec odsV7-adminV2-single-adminapi sh -c "apt-get list --installed 2>/dev/null | grep -i postgresql-client || true"
docker compose -f edfi-services.yml --env-file .env exec odsV7-adminV2-single-db-ods psql -U postgres -h odsV7-adminV2-single-db-ods -c "SELECT 1;"
```

Expected: the second command returns `1` (confirms the ODS container is
reachable and accepting connections on its own hostname within the
`edfiadminapp-network`; this stands in for a client tool that may not be
installed in the adminapi image).

- [ ] **Step 9: No commit for this task** — this task only produces verification
evidence. If any step fails, stop and fix Tasks 1-4 before proceeding; do not
move on to documentation until every expected output above is confirmed.

---

### Task 6: Update documentation

**Files:**
- Modify: `compose\readme.md`
- Modify: `docs\ed-fi-development.md`
- Modify: `docs\deployment.md`

- [ ] **Step 1: Update `compose\readme.md` — add a new subsection under "Choosing a Database Template"**

Find (around line 216-218):

```markdown
### Choosing a Database Template

The ODS database can use the "sandbox" or "minimal" container. When using the sandbox image, you must login to the server (e.g. using PgAdmin) and create a new `EdFi_Ods_??` database, choosing either the populated or minimal template.
```

Replace with:

```markdown
### Choosing a Database Template

The ODS database can use the "sandbox" or "minimal" container. When using the sandbox image, you must login to the server (e.g. using PgAdmin) and create a new `EdFi_Ods_??` database, choosing either the populated or minimal template.

### Custom ODS Database Image (Single-Tenant Admin API v2)

The `odsV7-adminV2-single-db-ods` container is built locally from
`compose/DB-Ods` (a custom PostgreSQL 16 image) instead of being pulled from
Docker Hub. On first run, its `init.sh` entrypoint:

1. Restores your `.sql` backup files into two template databases:
   `Ods_Minimal_Template` and `Ods_Populated_Template`.
2. Creates the `EdFi_Ods` database as a clone of one of those templates,
   controlled by the `EDFI_ODS_DATASET` env var (`minimal` by default, or
   `populated`).

**You must provide your own backup files** — they are not included in this
repository. Configure these variables in your `.env` file:

| Variable              | Purpose                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| `SQL_BACKUPS_FOLDER`  | Host folder containing your `.sql` backup files (default `./db-backup`) |
| `MINIMAL_SQL_PATH`    | In-container path to the minimal dataset backup file                    |
| `POPULATED_SQL_PATH`  | In-container path to the populated dataset backup file                  |
| `EDFI_ODS_DATASET`    | Which template `EdFi_Ods` is cloned from: `minimal` or `populated`      |

To rebuild this image after changing `compose/DB-Ods/Dockerfile` or
`init.sh`:

```powershell
docker compose -f edfi-services.yml --env-file .env build odsV7-adminV2-single-db-ods
```

If you need to force a full re-restore (e.g. after changing
`EDFI_ODS_DATASET` or swapping backup files), remove the container and its
data volume first:

```powershell
docker compose -f edfi-services.yml --env-file .env rm -sf odsV7-adminV2-single-db-ods
docker volume rm vol-odsV7-adminV2-single-db-ods
```
```

- [ ] **Step 2: Update `docs\ed-fi-development.md` — add a setup note in the "Running Locally" section**

Find (around line 13-19):

```markdown
## Running Locally

### Setup Local Configuration for Admin App
```

Replace with:

```markdown
## Running Locally

### ODS Database Backup Files (Single-Tenant Admin API v2)

Before starting the `compose` services, the `odsV7-adminV2-single-db-ods`
container needs two PostgreSQL `.sql` backup files (a minimal dataset and a
populated dataset) that you must supply yourself — they are not included in
this repository. Place them in the folder referenced by
`SQL_BACKUPS_FOLDER` in `compose/.env` (default: `compose/db-backup/`), with
filenames matching `MINIMAL_SQL_PATH`/`POPULATED_SQL_PATH`. See
[compose/readme.md — Custom ODS Database Image](../compose/readme.md#custom-ods-database-image-single-tenant-admin-api-v2)
for details.

### Setup Local Configuration for Admin App
```

- [ ] **Step 3: Update `docs\deployment.md` — add a new top-level section**

Find (around line 1-3):

```markdown
# Deployment Notes

## Node.js Deprecation Warnings
```

Replace with:

```markdown
# Deployment Notes

## Custom ODS Database Image

The single-tenant Admin API v2 topology's ODS database
(`odsV7-adminV2-single-db-ods` in `compose/edfi-services.yml`) is built from
a local Dockerfile (`compose/DB-Ods`) rather than pulled from Docker Hub.
When deploying outside of local development:

1. Ensure the deployment pipeline runs `docker compose build` (or an
   equivalent `docker build ./compose/DB-Ods`) so the image is available
   before `up` is run.
2. Provision the two required `.sql` backup files (minimal and populated
   datasets) on the host or deployment volume referenced by
   `SQL_BACKUPS_FOLDER`, and set `MINIMAL_SQL_PATH` / `POPULATED_SQL_PATH`
   to their in-container paths.
3. Set `EDFI_ODS_DATASET` to `minimal` or `populated` depending on which
   dataset the deployed `EdFi_Ods` database should contain.

See [compose/readme.md — Custom ODS Database Image](../compose/readme.md#custom-ods-database-image-single-tenant-admin-api-v2)
for the full variable reference.

## Node.js Deprecation Warnings
```

- [ ] **Step 4: Commit**

```powershell
git add compose/readme.md docs/ed-fi-development.md docs/deployment.md
git commit -m "docs: document custom ODS DB image and backup file requirements

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
