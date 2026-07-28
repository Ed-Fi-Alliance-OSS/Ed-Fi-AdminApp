# Adminapp-Env Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `.claude/skills/adminapp-env/`, a self-improving Claude Code skill that configures,
runs, validates, and fixes the Ed-Fi Admin App's local Docker environment — replacing
`how to configure.md` as the living source of this knowledge.

**Architecture:** One skill, pure instructions (no bundled scripts). `SKILL.md` holds the
entry-point flow and behavioral policy; three reference files under `reference/` hold the
concrete facts (`environment-reference.md`), experiential troubleshooting knowledge
(`known-issues.md`), and concept explanations (`glossary.md`). Ground truth (compose files, `.env`,
package.json) is always re-derived live by the agent reading the skill, never hardcoded as a
permanent claim — `environment-reference.md` is an explicitly-labeled *cache* of that derivation.

**Tech Stack:** Markdown only (Claude Code skill format). No code, no build step, no test runner.
"Testing" for this project means (a) a completeness check against the source material for each
migrated file, and (b) one live dry-run of the finished skill's validate flow against the actual
running Docker stack — see Task 6.

## Global Constraints

- Every fact migrated from `how to configure.md` must carry a **Verified-live** or
  **Documented-only** tag, copied forward from whether it was personally exercised during the
  investigation that produced the source document (per `docs/superpowers/specs/2026-07-28-adminapp-env-skill-design.md`).
- The skill must never use unscoped Docker cleanup. Any reset/removal instruction must explicitly
  name `edfiadminapp`-prefixed resources, `nginx`, and `edfiadminapp/db-ods:local` — never a bare
  `docker volume ls | ForEach-Object { docker volume rm ... }` without that name filter, and never
  `compose/stop.ps1 -V` (its `Remove-Volumes` function has no project filter).
- The skill must never rebuild a container-mode image on its own initiative — only when the user
  explicitly asks, per the design's "Source changes in container mode" section.
- New known-issue entries require asking the user before writing; corrective/maintenance edits
  (typos, stale paths, drifted cache values) do not.
- `how to configure.md` is not deleted until Task 6 (the live dry-run) passes.

---

### Task 1: `reference/environment-reference.md` — concrete facts & recipes

**Files:**
- Create: `.claude/skills/adminapp-env/reference/environment-reference.md`

**Interfaces:**
- Consumes: source content from `how to configure.md` §1, §2, §3, §4, §5, §8, §9.1, §9.2, §9.5,
  §10 (repo-root file, read-only source for this task).
- Produces: section anchors `#prerequisites`, `#one-time-setup`, `#starting-modes`,
  `#verified-service-urls`, `#access-credentials`, `#container-health-baseline`,
  `#endpoint-smoke-test`, `#oidc-login-verification`, `#full-reset-recipe`,
  `#oauth-client-registration` — `SKILL.md` (Task 4) links to these by name, so they must match
  exactly.

- [ ] **Step 1: Write the file**

Create `.claude/skills/adminapp-env/reference/environment-reference.md` with this exact content:

```markdown
# Environment Reference

Concrete facts and command recipes for the Ed-Fi Admin App's local Docker stack. This is a
**cache** of what's derivable from `compose/*.yml` and `compose/.env` — not a second source of
truth. Whenever `SKILL.md`'s validate flow runs, re-check the live compose files against this
file and correct any drift directly (corrective-maintenance tier — no confirmation needed).

Every fact below is tagged **Verified-live** (personally exercised and confirmed working) or
**Documented-only** (written down but not yet personally exercised through this skill). When a
Documented-only path is exercised for the first time and works, upgrade its tag here.

## Prerequisites

**Status: Verified-live**

- Docker Desktop. Binding host port `443` works without admin rights — Docker Desktop on Windows
  runs its daemon inside a WSL2/Hyper-V VM, so no elevation is needed for low ports.
- Node.js ≥ 24, npm — only needed for local-dev mode (`npm run start:*:dev`), not for the
  fully-containerized flow.
- User-supplied `EdFi.Ods.Minimal.Template.sql` and `EdFi.Ods.Populated.Template.sql` backup files
  (Postgres format) — not included in this repo. The ODS DB containers restore from these on first
  run. `.bak` files (SQL Server format) are a different mechanism, not consumed by the same
  restore path.

## One-time setup

**Status: Verified-live**

1. **SSL certificate** — `compose/ssl/generate-certificate.sh` (Windows: WSL/Git Bash). Produces
   `server.crt`, `server.key`, `dhparam.pem`. Expires 365 days from generation — see
   `known-issues.md`'s SSL certificate entry for what happens when it lapses.
2. **`compose/.env`** — copy from `compose/.env.example`.
3. **`packages/api/config/local.js`** — copy from `packages/api/config/local.js-edfi` (NOT
   `local-development.js.copyme`, which does not exist in this repo despite older notes
   referencing it).
4. **`packages/fe/.env`** — copy from a `.env` template in `packages/fe` (NOT
   `.copyme.env.local`, which does not exist in this checkout either).
5. **`compose/.env` → `SQL_BACKUPS_FOLDER`** — must point directly at the folder containing
   `EdFi.Ods.Minimal.Template.sql` / `EdFi.Ods.Populated.Template.sql`, not a parent folder.
6. Node dependencies: `npm i` at the repo root — only needed for local-dev mode.

Ask the user only for whichever of these are actually missing; never re-ask for values already
present in `.env`/config files.

## Starting modes

**Status: Verified-live for container mode; Documented-only for local-dev mode**

The default Compose profile is `postgresql` (matches Postgres-format `.sql` backups). The `mssql`
profile needs different `.env` setup — see `compose/readme.md` — and is Documented-only here.

**Full container mode** (fe + api run as Docker containers):

```powershell
cd compose
.\start-services.ps1 -Rebuild   # first run / after code changes to fe or api
.\start-services.ps1            # subsequent runs, no rebuild needed
```

Builds `packages/api/Dockerfile` and `packages/fe/Dockerfile` (full `npm ci` + Nx production build
inside Docker — several minutes on a cold cache) and starts everything: ODS/API, Admin API,
Keycloak, nginx, and the Admin App's own `fe`/`api` containers.

**Local dev mode** (fe + api run via `npm`, hot reload) — Documented-only:

```powershell
cd compose
.\start-local-dev.ps1
```

Starts the same supporting services but excludes the `fe`/`api` containers (via Compose profile).
Then, in separate terminals:

```powershell
# Terminal 1
$env:NODE_EXTRA_CA_CERTS="<repo-path>\compose\ssl\server.crt"
npm run start:api:dev

# Terminal 2
npm run start:fe:dev
```

To stop services: `.\stop.ps1` (`-LocalDev`, `-MainServices`, or no flag for all). **Never use
`-V`** — see `known-issues.md`'s scope-safety entry.

After changing `.env`, `docker compose restart` does **not** re-read it — recreate the affected
container: `docker compose up -d --no-deps <service-name>`.

## Verified service URLs

**Status: Verified-live (container mode); Documented-only (local dev mode)**

Container mode:

| Service | URL |
| --- | --- |
| Admin App UI | `https://localhost/adminapp/` |
| Admin App API healthcheck | `https://localhost/adminapp-api/api/healthcheck` |
| ODS/API (single, v2) | `https://localhost/odsv7-adminv2-single-api/` |
| Admin API (single, v2) | `https://localhost/odsv7-adminv2-single-adminapi/` |
| Keycloak (via nginx) | `https://localhost/auth/admin/master/console/` |
| Keycloak (direct) | `http://localhost:8080/auth/admin/master/console/` |
| PGAdmin4 (via nginx) | `https://localhost/pgadmin` |
| PGAdmin4 (direct) | `http://localhost:5050` |
| Postgres (host, Admin App's own DB only) | `localhost:5432` |

The `fe`/`api` containers publish **no direct host port** — only reachable via nginx. Direct
`:4200`/`:3333` only applies in local dev mode:

| Service | URL |
| --- | --- |
| Admin App UI (local) | `http://localhost:4200` |
| Admin App API (local) | `http://localhost:3333` |
| Admin App API healthcheck | `http://localhost:3333/api/healthcheck` |

All other URLs (ODS/API, Admin API, Keycloak, PGAdmin) are identical in both modes, since those
supporting services run the same way regardless.

## Access credentials

**Status: Verified-live**

### Keycloak

| What | Value |
| --- | --- |
| Admin console (via nginx) | `https://localhost/auth/admin/master/console/` |
| Admin console (direct) | `http://localhost:8080/auth/admin/master/console/` |
| Admin login | `${KEYCLOAK_ADMIN}` / `${KEYCLOAK_ADMIN_PASSWORD}` from `.env` — default `admin` / `admin` |
| Realm | `edfi` (auto-created — see `glossary.md`) |

Realm and client provisioning is fully automatic (`edfiadminapp-keycloak` imports
`compose/adminapp/realm-config.json` at every startup) — no manual realm creation needed.

To create the user you'll log into the Admin App with, two options (both verified):

**Scripted (recommended)**:

```powershell
eng\helpers\create-local-user-keycloak.ps1
```

Creates Keycloak user `edfi-adminapp-test` / password `123`, email `admin@example.com`, in the
`edfi` realm. The email is what matters for login (see "Admin App UI" below). Safe to re-run.
Override `-Email`/`-Password`/`-Username`/`-Realm` if `ADMIN_USERNAME` differs from the default.

**Manual**: sign into the admin console with `admin`/`admin` → switch to the `edfi` realm → Users
→ Add user → username/email `admin@example.com` (must match `ADMIN_USERNAME` in
`packages/api/config/local.js`) → Credentials tab → set a password → toggle Temporary off → Save.

### Admin App UI

Log in with the Keycloak user's email + password above — there is no separate Admin App
credential store. The Admin App API auto-seeds an initial admin user on first startup matching
`ADMIN_USERNAME` (default `admin@example.com`, set in `packages/api/config/production.js-edfi` /
`local.js-edfi`) — no manual database insert is needed. Confirm with:

```powershell
docker exec edfiadminapp-postgres psql -U postgres -d sbaa -c "select id, username, \"roleId\", \"isActive\" from public.\"user\";"
```

Expect one row: `admin@example.com`, `roleId=2`, `isActive=t`. First sign-in lands in "Global
scope" for initial configuration. If a different bootstrap email is wanted, change
`ADMIN_USERNAME` in `local.js` **before** first starting the API against a fresh database — the
seed only runs once.

### Database

| What | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` (`${POSTGRES_PORT_EXPOSED}` in `.env`) |
| User | `${POSTGRES_USER}` — default `postgres` |
| Password | `${POSTGRES_PASSWORD}` — default `postgres` |
| Database (Admin App's own) | `${ADMIN_APP_DB_NAME}` — default `sbaa` |

These same credentials are shared across every Postgres instance in the stack, but **only the
Admin App's own database** (`edfiadminapp-postgres`, `sbaa`) publishes a host port
(`localhost:5432`):

```powershell
psql -h localhost -p 5432 -U postgres -d sbaa
# password: postgres
```

The per-topology ODS/Admin databases (`EdFi_Ods` / `EdFi_Admin` for v2/v3 single/multi, v6) publish
no host port — reachable via:

**pgAdmin4** (recommended): `https://localhost/pgadmin` (via nginx) or `http://localhost:5050`
(direct). Login `admin@example.com` / `admin` (hardcoded in `adminapp-services.yml`'s `pgadmin4`
service — not from `.env`). Every topology's connection is pre-configured as a server (from
`compose/settings/pgadmin-servers.json`) — clicking one prompts for the password above.

**`docker exec` directly**:

```powershell
docker exec -it edfiadminapp-odsV7-adminV3-single-db-admin-1 psql -U postgres -d EdFi_Admin
docker exec -it edfiadminapp-odsV7-adminV2-single-db-ods-1 psql -U postgres -d EdFi_Ods
```

Substitute the container name for whichever topology is needed — see `docker ps` for the full
list.

If `.env`'s DB engine/profile is `mssql` instead of `postgresql` (Documented-only, not personally
verified), the same structure applies but with SQL Server connection details from `.env`
(`MSSQL_SA_PASSWORD`, `MSSQL_PORT_EXPOSED`) instead of the Postgres values above.

## Container health baseline

**Status: Verified-live**

```powershell
docker ps -a --format "table {{.Names}}\t{{.Status}}"
```

Expect every `edfiadminapp-*` container to show `Up ... (healthy)`, except `nginx`, `yopass`,
`memcached`, and `pgadmin4` — these four don't define a healthcheck, so they only ever show `Up`.
Anything `Restarting`, `Exited`, or `(unhealthy)` for more than ~2 minutes after the last `up -d`
needs investigation — check `known-issues.md` first.

Container count for the default (`postgresql` + `adminapp` profiles) stack: **32** — 6 `db-ods` +
6 `db-admin` (v2 single/multi×2, v3 single/multi×2, v6) + 7 `api`/`adminapi` app containers (v2
single/multi, v3 single/multi, v6 api, v6 adminapi) + keycloak + postgres + nginx + yopass +
memcached + pgadmin4 + `edfiadminapp-api` + `edfiadminapp-fe`.

## Endpoint smoke test

**Status: Verified-live**

| Check | Command | Expect |
| --- | --- | --- |
| Admin App UI | `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/adminapp/` | `200` |
| Admin App API healthcheck | `curl.exe -sk https://localhost/adminapp-api/api/healthcheck` | `{"status":"healthy",...,"database":{"status":"healthy"...}}` |
| ODS/API v2 single | `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/odsv7-adminv2-single-api/` | `200` |
| Admin API v2 single | `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/odsv7-adminv2-single-adminapi/` | `200` |
| Admin API v3 single | `curl.exe -sk https://localhost/odsv7-adminv3-single-adminapi/health` | `{"status":"Healthy","results":[{"name":"Databases","status":"Healthy"}]}` |
| Admin API v3 multi | `curl.exe -sk https://localhost/odsv7-adminv3-multi-adminapi/health` | same as above |
| Keycloak | `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/auth/admin/master/console/` | `200` |
| PGAdmin4 | `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/pgadmin` | `308` (redirect to login — expected) |

The v2 and v3 Admin API topologies use different healthcheck paths: v2 is a plain `200` on the
root, v3 exposes a JSON `/health` endpoint — don't assume they're the same shape.

Also check the v3 topologies' logs for schema errors (see `known-issues.md`'s image-drift entry):

```powershell
docker logs edfiadminapp-odsV7-adminV3-single-adminapi-1 2>&1 | Select-String -Pattern "does not exist","FormatException","Unhandled exception"
docker logs edfiadminapp-odsV7-adminV3-multi-adminapi-1 2>&1 | Select-String -Pattern "does not exist","FormatException","Unhandled exception"
```

Expect no output.

## OIDC login verification

**Status: Verified-live**

Before ever touching a browser, check the API actually registered its OIDC strategy at startup:

```powershell
docker logs edfiadminapp-api 2>&1 | Select-String -Pattern "Registering OIDC provider","Error registering OIDC provider"
```

Expect the success line: `Registering OIDC provider https://localhost/auth/realms/edfi with id 1`.
Any error on that line (e.g. `certificate has expired`) means the `oidc-1` passport strategy was
never created for the lifetime of that API process — restarting alone won't help until the
underlying cause is fixed (registration runs once, in the constructor, no retry). See
`known-issues.md`.

To verify login end-to-end without a browser:

```powershell
# 1. Follow the login redirect to Keycloak's login form, capture cookies + form action URL
curl.exe -sk -c cookies.txt -b cookies.txt -L "https://localhost/adminapp-api/api/auth/login/1" -o login.html
# extract the "action" attribute from login.html — contains session_code/execution/tab_id

# 2. Submit credentials to that form action (username = Keycloak username, NOT email)
curl.exe -sk -c cookies.txt -b cookies.txt -D headers.txt -o /dev/null `
  --data-urlencode "username=edfi-adminapp-test" --data-urlencode "password=123" --data-urlencode "credentialId=" `
  "<form action URL from step 1>"
# response is a 302 with Location pointing at .../adminapp-api/api/auth/callback/1?code=...

# 3. Follow that callback — the API exchanges the code, creates a session, redirects to the FE
curl.exe -sk -c cookies.txt -b cookies.txt "<callback Location from step 2>"

# 4. Confirm the session is actually authenticated
curl.exe -sk -b cookies.txt "https://localhost/adminapp-api/api/auth/me"
```

Expect step 4 to return the full user object (`"username":"admin@example.com","roleId":2,...`)
with HTTP `200`. A `LOGIN_ERROR No team memberships assigned for User [...]` warning in the API
logs at this point is expected and non-blocking.

## Full reset recipe

**Status: Verified-live**

```powershell
cd compose

# 1. Stop and remove this project's containers only
docker compose -f edfi-services.yml -f nginx-compose.yml -f adminapp-services.yml --env-file .env --profile "*" down

# 2. Remove this project's volumes only (NOT compose/stop.ps1 -V — see known-issues.md)
docker volume ls --format "{{.Name}}" | Select-String -Pattern "^vol-(edfiadminapp|odsV7|db-ods|db-admin)" | ForEach-Object { docker volume rm $_.ToString() }
docker volume rm pgadmin-data

# 3. Remove this project's images (forces a fresh pull/rebuild of everything)
docker rmi edfialliance/ods-admin-api:pre edfialliance/ods-admin-api-db:pre edfialliance/ods-api-web-api:v7.3 `
  edfiadminapp/db-ods:local edfiadminapp-edfiadminapp-api edfiadminapp-edfiadminapp-fe `
  quay.io/keycloak/keycloak:26.1 postgres:16.2 nginx:1.28.0-alpine3.21 `
  jhaals/yopass:12.5.0 memcached:1.6 dpage/pgadmin4 2>$null

# 4. Rebuild from scratch
.\start-services.ps1 -Rebuild
```

Step 4 will hit the Keycloak first-boot race (see `known-issues.md`) — expected. Re-run once
`docker ps` shows `edfiadminapp-keycloak` as `healthy`:

```powershell
docker compose -f edfi-services.yml -f nginx-compose.yml -f adminapp-services.yml --env-file .env --profile postgresql --profile adminapp up -d
```

After it settles, re-run the endpoint smoke test and container health baseline above.

**Scope note**: this project's Docker resources are identifiable by the `edfiadminapp`
prefix/name, `nginx`, and `edfiadminapp/db-ods:local`. Never touch anything named `adminapi`,
`ed-fi-db-admin-adminapi`, `ed-fi-gateway-adminapi`, `vol-db-admin-adminapi`, or
`singletenant-*` — those belong to the unrelated `ODS-Admin-API` repo's own standalone Compose
setup, if it happens to be checked out on the same machine.

## OAuth client registration

**Status: Verified-live**

Before registering an environment in the Admin App UI, create an OAuth client against the Admin
API to manage:

```bash
curl -X POST https://localhost/odsv7-adminv2-single-adminapi/connect/register \
  -H "Content-Type: application/json" \
  -k \
  -d '{
    "ClientId": "adminapp-client",
    "ClientSecret": "AdminApp-Secret123!@#secure456789",
    "DisplayName": "Admin App Local"
  }'

curl -X POST https://localhost/odsv7-adminv2-single-adminapi/connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -k \
  -d "client_id=adminapp-client&client_secret=AdminApp-Secret123!%21%40%23secure456789&grant_type=client_credentials&scope=edfi_admin_api/full_access"
```

Secret must be 32+ chars with uppercase, lowercase, digit, and special character.
`/connect/register` has rate limiting — wait ~30s between retries on a 429. Adjust the path for
whichever topology is being targeted (`odsv7-adminv2-multi-adminapi`,
`odsv7-adminv3-single-adminapi`, etc.).
```

- [ ] **Step 2: Verify completeness against the source**

Confirm every one of these items from `how to configure.md` appears somewhere in the new file:
prerequisites list, the 6 one-time-setup items (including the `local-development.js.copyme`/
`.copyme.env.local` non-existence notes), both starting-mode command blocks, both URL tables, the
Keycloak access table + both user-creation options, the first-login DB check, the Postgres
credentials table + both database-connection options, the 32-container baseline, the endpoint
smoke test table, the OIDC login verification recipe, the full reset recipe with scope note, and
the OAuth client registration recipe. If anything is missing, add it before proceeding.

- [ ] **Step 3: Commit**

```bash
git add ".claude/skills/adminapp-env/reference/environment-reference.md"
git commit -m "feat: add adminapp-env skill environment reference"
```

---

### Task 2: `reference/known-issues.md` — experiential troubleshooting knowledge

**Files:**
- Create: `.claude/skills/adminapp-env/reference/known-issues.md`

**Interfaces:**
- Consumes: `how to configure.md` §11 (known issues table) and the troubleshooting-relevant
  entries of §12 (FAQ).
- Produces: this file is referenced by name from `SKILL.md` (Task 4) as the first thing checked
  when validation finds something broken. Each entry's heading must be a literal symptom string
  a future search would match against (e.g. grep-able phrases from error messages).

- [ ] **Step 1: Write the file**

Create `.claude/skills/adminapp-env/reference/known-issues.md` with this exact content:

```markdown
# Known Issues

Experiential findings that cannot be derived by reading the compose files — this is where
"self-improving" actually happens. Two write rules:

1. **Corrective maintenance** (a fix here goes stale, a command's syntax changes) — edit directly,
   no confirmation needed.
2. **New entries** (a freshly diagnosed root cause) — always ask the user before adding.

Check this file first whenever validation finds something broken, before starting a fresh
investigation.

## Scope safety: unrelated repo sharing the same Docker Desktop instance

**Status: Verified-live**

If the `ODS-Admin-API` repo is also checked out on this machine, it has its own standalone Compose
setup with Docker resources named `adminapi`, `ed-fi-db-admin-adminapi`, `ed-fi-gateway-adminapi`,
`vol-db-admin-adminapi`, `singletenant-*`. **Never** run `compose/stop.ps1 -V` — its
`Remove-Volumes` function calls `docker volume ls` with no project filter and deletes every volume
on the machine, including that other repo's. Any reset must explicitly name only
`edfiadminapp`-prefixed resources, `nginx`, and `edfiadminapp/db-ods:local` — see
`environment-reference.md`'s full reset recipe for the safe version.

## Keycloak shows unhealthy right after `up -d`, dependent containers fail to start

**Status: Verified-live**

**Symptom**: `edfiadminapp-keycloak` shows `(unhealthy)`, `edfiadminapp-api`/`edfiadminapp-fe`
fail to start, the overall `docker compose up` command exits with an error — but
`start-services.ps1`/`start-local-dev.ps1` still print `"Services started successfully!"`
regardless (that message is unconditional, not a real success signal — always verify with
`docker ps` instead).

**Root cause**: Keycloak's first-boot Quarkus build takes ~90-150 seconds (two augmentation
passes: `kc.sh import` then `kc.sh start-dev`). The dependency healthcheck window is shorter, so
`docker compose up` can report failure before Keycloak finishes booting — even though Keycloak
keeps running and becomes healthy shortly after.

**Fix**: Not a real failure. Check `docker ps`; once `edfiadminapp-keycloak` shows `healthy`,
re-run the same `up -d` command (no rebuild needed, images already built/pulled) and it picks up
where it left off. Reproduced on both an original run and a from-scratch clean-room rebuild — this
is expected behavior, not a regression.

## Admin API v3 (single/multi) crash-loop or throw database schema errors

**Status: Verified-live**

**Symptom**: `odsV7-adminV3-single-adminapi-1` / `-multi-adminapi-1` crash-loop (exit 137/134,
`core dumped`) with `v3 is not a valid value for AdminApiMode`, or run but log
`column j.createdat does not exist` / `relation adminapi.dbinstances does not exist`.

**Root cause**: `ADMIN_API_TAG_7X=pre` and `ADMIN_DB_TAG_7X=pre` in `.env` are both floating tags
pointing at two *separately*-published images: `edfialliance/ods-admin-api` (the app) and
`edfialliance/ods-admin-api-db` (a separate, pre-built database image that bakes in the
`adminapi` schema — see `edfi-services.yml`'s `odsV7-adminV3-single-db-admin` service). Docker
doesn't auto-refresh a floating tag once cached locally, so the two can drift out of sync with
each other over time — confirmed once with both stuck 5 months stale, from the same date. **This
is unrelated to the user's `SQL_BACKUPS_FOLDER`/`.sql` files** — those only feed the completely
separate `EdFi_Ods` database via `compose/DB-Ods/init.sh`, never `EdFi_Admin`.

**Fix**: Confirmed fixed by a full clean-room rebuild (`environment-reference.md`'s full reset
recipe) — fresh pulls of both images in lockstep produced all-healthy containers with zero manual
schema patching. Lighter-weight alternative: `docker pull edfialliance/ods-admin-api:pre
edfialliance/ods-admin-api-db:pre`, but re-pulling the DB image alone won't retroactively fix an
*existing* persistent volume (Postgres only runs init scripts against an empty data directory) —
that needs either the official `Artifacts/PgSql/Structure/Admin/*.sql` scripts applied by hand
against the running database, or wiping that specific `db-admin` volume to reinitialize from the
fresh image. General takeaway: since several services here use floating tags, re-`pull` before
assuming a crash is a real product bug.

## `SQL_BACKUPS_FOLDER` mismatch — ODS DB containers fail to restore on first run

**Status: Verified-live**

**Root cause**: the env var pointed at the parent folder instead of the folder actually
containing `EdFi.Ods.Minimal.Template.sql` / `EdFi.Ods.Populated.Template.sql`.

**Fix**: point it directly at the folder with those two `.sql` files. The `SQLServer` subfolder's
`.bak` files are a different format, not consumed by this restore mechanism.

## `https://localhost/adminapp-api/api/` (Swagger root, trailing slash) returns 404

**Status: Verified-live**

The API itself 404s at that exact path (confirmed by hitting the container directly, bypassing
nginx) — the readme's documented Swagger URL appears stale. Use
`https://localhost/adminapp-api/api/healthcheck` to verify the API is up instead; Swagger's actual
path needs separate confirmation from the API's route table if it's specifically needed.

## Clicking "Log in" 404s with `{"message":"Not Found","statusCode":404}`

**Status: Verified-live**

**Symptom**: browser URL changes to `.../adminapp-api/api/auth/login/<id>`, page shows
`{"message":"Not Found","statusCode":404}`.

**Root cause**: `compose/ssl/server.crt` (the self-signed dev cert) had **expired**. It's
generated with only a 365-day validity (`generate-certificate.sh -days 365`). `edfiadminapp-api`'s
`RegisterOidcIdpsService` (`packages/api/src/auth/login/oidc.strategy.ts`) does OIDC discovery
(`Issuer.discover`) against `https://localhost/auth/realms/edfi/...` **once, in its constructor,
with no retry** — an expired cert makes that HTTPS call fail (`Error: certificate has expired`),
so the `oidc-1` passport strategy is never registered for the API process's entire lifetime.
`AuthController.oidcLogin` (`auth.controller.ts:60-83`) then throws `NotFoundException()` on
`"Unknown authentication strategy"` — that's the literal 404. Confirm via
`docker logs edfiadminapp-api | Select-String "registering oidc"` and
`openssl x509 -in compose/ssl/server.crt -noout -dates`. **Not related to a missing Keycloak
user** — this blocks login before Keycloak is ever reached.

**Fix**: regenerate the cert, then restart the two containers that use it:

```powershell
cd compose/ssl
env -u OPENSSL_CONF bash generate-certificate.sh   # see the OPENSSL_CONF entry below if plain `bash generate-certificate.sh` fails
docker restart nginx edfiadminapp-api
```

Confirm via `docker logs edfiadminapp-api | Select-String "Registering OIDC provider"` — expect
the success line, not the error one. Verified end-to-end afterward using the OIDC login
verification recipe in `environment-reference.md`. Since the cert is only valid 365 days, **this
will recur annually** on any long-lived local environment.

## `generate-certificate.sh` silently fails, cert dates unchanged

**Status: Verified-live**

**Symptom**: running `generate-certificate.sh` prints `Can't open ".../psqlODBC/etc/openssl.cnf"`
/ `BIO_new_file` errors, and `server.crt`/`server.key` are left unchanged — `set -e` doesn't catch
it, so the script appears to finish, but `openssl x509 -in server.crt -noout -dates` shows the
same old (possibly still-expired) dates as before.

**Root cause**: a stale, machine-wide `OPENSSL_CONF` environment variable (observed pointing at
`C:\Program Files\PostgreSQL\psqlODBC\etc\openssl.cnf`, likely left behind by a PostgreSQL/psqlODBC
installer) overrides OpenSSL's default config lookup with a path that doesn't exist. Unrelated to
this repo.

**Fix**: don't edit the global env var. Unset it for just the one command:
`env -u OPENSSL_CONF bash generate-certificate.sh`. Always verify the regenerated dates afterward
— a failed run leaves old files in place without erroring loudly.

## `The Nx Daemon is unsupported in WebAssembly environments`

**Status: Documented-only**

OS-mismatched binary in `package-lock.json`. Fix:
`rm -r node_modules package-lock.json .nx && npm cache clear --force && npm install`.

## `ERESOLVE unable to resolve dependency tree`

**Status: Documented-only**

Deep peer-dependency conflict. Fix: `npm install --legacy-peer-deps`.

## FAQ-derived troubleshooting notes

**Status: Verified-live**

- **Container `(unhealthy)` isn't always a problem**: `edfiadminapp-keycloak` routinely reports
  unhealthy for the first 1.5-2.5 minutes on boot — normal, see the Keycloak entry above. Anything
  still unhealthy after ~3 minutes with no further log progress is worth investigating.
- **`docker compose up -d` printing success doesn't mean it succeeded**: `start-services.ps1`/
  `start-local-dev.ps1` print `"Services started successfully!"` unconditionally regardless of
  actual exit code. Always verify with `docker ps`.
- **Login redirects to Keycloak fine but no user exists there**: lands on Keycloak's own login
  form with no valid credentials — a different failure than the 404 above. Create a user first
  (`environment-reference.md`'s access credentials section).
- **Login was working, now 404s again after some time**: check the SSL certificate's expiration
  first (`openssl x509 -in compose/ssl/server.crt -noout -dates`) before assuming something else
  broke — see the cert-expiry entry above.
```

- [ ] **Step 2: Verify completeness against the source**

Confirm all 8 rows of `how to configure.md` §11's table are represented as sections here (Keycloak
race, Admin API v3 crash-loop, `SQL_BACKUPS_FOLDER`, Swagger 404, SSL cert 404, `OPENSSL_CONF`,
Nx Daemon, ERESOLVE), plus the scope-safety warning and the 4 troubleshooting-relevant FAQ
entries (unhealthy-is-ok, false-success-message, login-without-Keycloak-user,
cert-recurs-annually). The 3 purely-conceptual FAQ entries (migrations, ODS-Admin-API repo
separation, profile choice, rebuild timing) belong in `glossary.md` instead — confirm they are
NOT duplicated here.

- [ ] **Step 3: Commit**

```bash
git add ".claude/skills/adminapp-env/reference/known-issues.md"
git commit -m "feat: add adminapp-env skill known-issues reference"
```

---

### Task 3: `reference/glossary.md` — concept explanations for teaching

**Files:**
- Create: `.claude/skills/adminapp-env/reference/glossary.md`

**Interfaces:**
- Consumes: domain knowledge surfaced throughout the investigation (not a single source section —
  this file is new content, not a migration) plus the 4 purely-conceptual FAQ entries from
  `how to configure.md` §12 (migrations, ODS-Admin-API repo separation, profile choice, rebuild
  timing).
- Produces: entries referenced by term name from `SKILL.md` (Task 4)'s teaching behavior — term
  headings must be the exact words a user or the agent would say (e.g. "Keycloak", not "identity
  provider").

- [ ] **Step 1: Write the file**

Create `.claude/skills/adminapp-env/reference/glossary.md` with this exact content:

```markdown
# Glossary

Plain-language explanations for non-obvious concepts in this stack. Pulled from here rather than
invented inline each time, so explanations stay consistent session to session. Corrections here
are corrective-maintenance tier — edit directly, no confirmation needed.

## Keycloak

An open-source identity provider (IdP). It's where actual login credentials live — the Admin App
itself never stores a password. When a user "logs in," they're really being redirected to
Keycloak, authenticating there, and being redirected back with proof of who they are. In this
stack, Keycloak's `edfi` realm and its two clients (`edfiadminapp`, `edfiadminapp-dev`) are
created automatically every time the `edfiadminapp-keycloak` container starts.

## OIDC (OpenID Connect)

The protocol Keycloak and the Admin App API speak to each other. At API startup, the app performs
"OIDC discovery" — it asks the identity provider (Keycloak) for its configuration (where to send
users to log in, where to validate tokens) by fetching a `.well-known/openid-configuration`
document over HTTPS. This discovery happens once, at startup, with no retry — which is why an
expired SSL certificate breaking that one HTTPS call has such an outsized, persistent effect (see
`known-issues.md`).

## Ed-Fi ODS/API vs. Ed-Fi Admin API

Two different things this stack runs, both per "topology" (v1/v2/v3, single/multi-tenant):
- **ODS/API** — the actual student/school data API (Ed-Fi's core data model). Backed by the
  `EdFi_Ods` database.
- **Admin API** — manages the ODS/API instances themselves (creating databases, managing OAuth
  clients, claim sets) rather than student data. Backed by the `EdFi_Admin` database. This is
  what the `AdminApiMode` setting (v1/v2/v3) configures — it's a mode of the Admin API, not of the
  ODS/API.

## Docker Compose profiles

A way to group services in one Compose file so they only start when explicitly requested. This
stack uses profiles for two independent choices: `postgresql` vs. `mssql` (which database engine
backs everything) and `adminapp` (whether the Admin App's own `fe`/`api` run as containers, vs.
being excluded so they can run locally via `npm` instead).

## Why nginx fronts everything

nginx acts as a reverse proxy: a single entry point (`https://localhost`) that routes requests to
whichever backend container actually handles them, based on the URL path (e.g. `/adminapp-api/`
routes to `edfiadminapp-api:3333`, stripping the `/adminapp-api` prefix along the way). This is
why most services have no direct host-published port — they're only meant to be reached through
nginx, which also handles the self-signed TLS termination in one place instead of every service
needing its own cert.

## Floating vs. pinned Docker image tags

A "pinned" tag (like `postgres:16.2`, or a tag with a `@sha256:...` digest) always refers to the
exact same image bytes. A "floating" tag (like `edfialliance/ods-admin-api:pre`) gets
re-published over time to point at newer builds — but Docker only re-pulls it if asked to; a
locally cached copy can silently go stale for months. This stack uses floating tags for
`ADMIN_API_TAG_7X` and `ADMIN_DB_TAG_7X`, which is why the two can drift out of sync with each
other (see `known-issues.md`).

## Self-signed SSL certificates

A certificate this repo generates itself (`compose/ssl/generate-certificate.sh`) rather than one
issued by a public certificate authority — necessary for local HTTPS since there's no real domain
to get a "real" cert for. It still has a validity period like any certificate (365 days here), and
once it expires, HTTPS clients (including the Admin App API talking to Keycloak) reject it exactly
as they would reject an expired cert from any public site.

## Do I need to run migrations manually?

No dedicated migration step exists in this repo's Docker flow for the Admin App itself — its API
applies its own TypeORM migrations and pg-boss (background job queue) schema setup on startup
automatically. For the Ed-Fi Admin API's `adminapi` schema, there's also no migration *step* — that
schema comes fully baked into the `edfialliance/ods-admin-api-db` image at build time; see
`known-issues.md`'s Admin API v3 entry for what happens when that image is stale relative to the
app image.

## Do I need to touch the `ODS-Admin-API` repo at all?

No. This repo's `compose/` setup is fully self-contained and pulls pre-built images for ODS/API
and the Admin API rather than building from that repo's source. If it's checked out on the same
machine, its Docker resources are entirely separate — see `known-issues.md`'s scope-safety entry.

## Which profile should I use, `postgresql` or `mssql`?

Use whichever matches the `.sql`/`.bak` backup files actually available. Postgres-format (`.sql`)
backups mean `postgresql` (the default, no flag needed). The `mssql` profile needs
`MSSQL_SA_PASSWORD` and related vars set in `.env` and the `-MSSQL` flag on the start scripts —
Documented-only in this skill, not personally verified end-to-end.

## How long should a full rebuild take?

Highly dependent on network speed and whether images are already cached. Personally verified: a
cold rebuild (`start-services.ps1 -Rebuild` after a full reset) completed in roughly 4-5 minutes
end-to-end once images were pulled; the `fe`/`api` Docker image builds (`npm ci` + Nx production
build) are typically the longest single step on a cold Docker build cache.
```

- [ ] **Step 2: Verify completeness against the source**

Confirm all 4 purely-conceptual FAQ entries from `how to configure.md` §12 (migrations,
ODS-Admin-API repo separation, profile choice, rebuild timing) are present here and were NOT also
duplicated into `known-issues.md`.

- [ ] **Step 3: Commit**

```bash
git add ".claude/skills/adminapp-env/reference/glossary.md"
git commit -m "feat: add adminapp-env skill glossary reference"
```

---

### Task 4: `SKILL.md` — entry point, routing, behavioral policy

**Files:**
- Create: `.claude/skills/adminapp-env/SKILL.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-07-28-adminapp-env-skill-design.md` (the approved design
  — every section of that spec must be represented here), and links to
  `reference/environment-reference.md`, `reference/known-issues.md`, `reference/glossary.md` by
  their exact relative paths (all three exist after Tasks 1-3).
- Produces: the skill's frontmatter `name: adminapp-env` — this is the identifier Task 6's dry run
  invokes, and what `AGENTS.md` (Task 5) will point to by name.

- [ ] **Step 1: Write the file**

Create `.claude/skills/adminapp-env/SKILL.md` with this exact content:

````markdown
---
name: adminapp-env
description: Configure, run, validate, and troubleshoot the Ed-Fi Admin App's local Docker environment (fe, api, ODS/API, Ed-Fi Admin API, Keycloak, Postgres/MSSQL, nginx, pgAdmin). Use when the user wants to set up, start, check the health of, fix, or ask how to access this repo's local dev stack.
---

# Ed-Fi Admin App Local Environment

You are operating this repo's local Docker Compose environment: the Admin App (`fe` + `api`),
ODS/API, the Ed-Fi Admin API, Keycloak, Postgres/MSSQL, nginx, and pgAdmin.

**Ground rules, before anything else:**

- **Ground truth is always live.** Never trust a hardcoded claim about container counts, ports,
  or env var names from memory — read `compose/*.yml` and `compose/.env` fresh. `reference/
  environment-reference.md` is a cache of that, not a second source of truth: if validation finds
  it's drifted from the live files, correct it directly (no confirmation needed).
- **Never rebuild a container-mode image on your own initiative.** `packages/api`/`packages/fe`
  are baked into `edfiadminapp-api`/`edfiadminapp-fe` at build time — a source edit has no effect
  on running containers until rebuilt. If you notice `packages/api` or `packages/fe` has changes
  newer than the running image's build time, say so as an observation ("your source has changed
  since this image was built") but only rebuild if the user explicitly asks.
- **Never use unscoped Docker cleanup.** See `reference/known-issues.md`'s scope-safety entry
  before running any reset — this machine may also have the unrelated `ODS-Admin-API` repo's own
  Compose resources.
- **Infer expertise/tone from how the user talks; never ask for it directly.** If they ask
  clarifying "what does X mean" questions or seem new to this stack, explain more (pull concise
  explanations from `reference/glossary.md` rather than inventing them inline). If they use precise
  technical language and move fast, skip explanations and act. Check memory for an existing
  `user`-type note about this before the session starts guessing; if the user's current behavior
  clearly contradicts what's stored, update that memory rather than trusting the stale label
  forever — this is a running best-guess, not a permanent verdict.

## Entry-point flow

Unless the user's own request already makes the choice obvious, follow this on invocation:

1. **Read `compose/.env`.**
   - Missing or missing required values (e.g. `SQL_BACKUPS_FOLDER` unset) → walk through
     `reference/environment-reference.md`'s "One-time setup" section, asking the user only for
     whichever specific values are actually missing. Never re-ask for values already present.
   - Present and populated → proceed to step 2.

2. **Ask, unless the user's phrasing already answered these:**
   - **State**: "Start fresh (full reset: remove containers/images/volumes, then rebuild)" vs.
     "Just check current state / fix what's broken."
   - **Mode**: "Full containers (fe + api as Docker containers)" vs. "Local dev (fe + api via
     `npm run start:*:dev`, hot reload)."
   - If nothing is running yet and the request is genuinely ambiguous, check `docker ps` first —
     only ask if that doesn't resolve the ambiguity.

3. **Act on the combination:**
   - **Fresh + Container** → run `reference/environment-reference.md`'s full reset recipe, then
     `start-services.ps1 -Rebuild`, then the full validation checklist (step 5 below).
   - **Fresh + Local dev** → run the same reset for supporting services, then
     `start-local-dev.ps1`, then walk the user through `npm run start:api:dev` /
     `npm run start:fe:dev` in separate terminals, then validate.
   - **Validate + either mode** → run the validation checklist (step 5) against whatever's
     currently running.

4. **If validation finds something broken:**
   - Check `reference/known-issues.md` for a matching symptom first — apply its documented fix if
     one matches.
   - No match found → invoke `superpowers:systematic-debugging` **inline, in this same
     conversation** — do not delegate to a background subagent. This keeps the user able to
     interject on a risky step before it runs (this mattered concretely once: a user stopped an
     unscoped `docker volume ls`-based removal before it could delete an unrelated project's
     volumes).
   - Once a root cause and fix are confirmed → apply the fix, then **ask the user before adding a
     new entry to `reference/known-issues.md`** describing it (this is different from correcting
     an existing entry that's gone stale, which needs no confirmation).

5. **Validation checklist** (from `reference/environment-reference.md`, run in this order):
   - Container health baseline (`docker ps`, expect the documented healthy/non-healthchecked
     split).
   - Endpoint smoke test table.
   - v3 Admin API log sanity check (schema-error grep).
   - First-login database check.
   - OIDC login verification (log check, and the full curl-based login simulation if the user
     wants end-to-end confirmation without opening a browser).

6. **On any successful setup/run/validate, always print an access summary** — see below.

## Always surface access info

After any successful setup/run/validate, print a concise summary sourced from
`reference/environment-reference.md`, reflecting what's actually configured (read `.env`'s DB
engine/profile live — don't assume Postgres):

- **Admin App UI** — the active URL (container-mode or local-dev, whichever is running) and how
  to log in (a Keycloak user's email/password — not a separate credential store).
- **Keycloak** — admin console URL, admin credentials, realm.
- **Database** — Postgres or SQL Server, whichever `.env` actually selects — host/port/user/
  password/database, plus how to reach the per-topology databases that don't publish a host port.

## Explaining concepts

When introducing something non-obvious (Keycloak, OIDC discovery, Compose profiles, why nginx
fronts everything, `AdminApiMode` v1/v2/v3, floating vs. pinned image tags), pull the explanation
from `reference/glossary.md` rather than writing a new one inline. If an explanation there is
wrong or unclear, fix it directly — that's corrective-maintenance tier.

## When you learn something new

A freshly diagnosed root cause (the kind of finding that takes real investigation, not just
reading a compose file) is exactly what makes this skill self-improving. Once you've confirmed a
root cause and fix:

1. Ask the user: "Want me to add this to the known-issues reference?"
2. If yes, add a new section to `reference/known-issues.md` following the existing format
   (Symptom / Root cause / Fix, tagged Verified-live), and mention what you added.
3. Never commit the change yourself — leave it for the user to review via `git diff` and commit
   when they're ready, per this repo's standard git workflow.
````

- [ ] **Step 2: Verify every design section is represented**

Re-read `docs/superpowers/specs/2026-07-28-adminapp-env-skill-design.md` section by section and
confirm `SKILL.md` covers each one: audience/scope decisions (implicit in "pure instructions, no
scripts" — no script files exist), architecture (reference file layout referenced by path),
entry-point flow, source-changes-in-container-mode, knowledge-base write rules (two tiers),
memory & adaptation, teaching & explaining concepts, always-surface-access-info, and the custom
subagent rejection (reflected in "invoke inline, not via a background subagent"). If any section
has no counterpart in `SKILL.md`, add it before proceeding.

- [ ] **Step 3: Commit**

```bash
git add ".claude/skills/adminapp-env/SKILL.md"
git commit -m "feat: add adminapp-env SKILL.md entry point"
```

---

### Task 5: `AGENTS.md` pointer

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: nothing new — just needs the skill to exist (Task 4 complete) so the pointer is
  accurate.
- Produces: nothing consumed by later tasks; this is a leaf change.

- [ ] **Step 1: Add the pointer section**

In `AGENTS.md`, insert a new section immediately after the existing `## Project Structure`
section (before `## Key Technologies & Dependencies`):

```markdown
## Local Environment Setup

To configure, run, validate, or troubleshoot the local Docker environment (ODS/API, Ed-Fi Admin
API, Keycloak, Postgres/MSSQL, and the Admin App itself), ask Claude Code to use the
`adminapp-env` skill (`.claude/skills/adminapp-env/`). It handles first-time setup, starting in
container or local-dev mode, health validation, and known-issue troubleshooting, and keeps its own
knowledge base updated as new issues are found.
```

- [ ] **Step 2: Verify placement**

Read the file back and confirm the new section sits between `## Project Structure` and
`## Key Technologies & Dependencies`, with correct heading level (`##`) and no broken adjacent
spacing (one blank line before and after, matching the rest of the file's style).

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: point AGENTS.md at the adminapp-env skill"
```

---

### Task 6: Live dry-run validation

**Files:** none created or modified — this task exercises Tasks 1-5's output against the real
environment.

**Interfaces:**
- Consumes: the fully-assembled skill from Tasks 1-5, and the actual current state of the Docker
  stack on this machine.
- Produces: either confirmation the skill works, or specific corrections fed back into Tasks 1-4's
  files (loop back if needed — see Step 3).

This is the plan's real test cycle, per the design's "Validating the finished skill" section:
there is no separate test suite for markdown instructions, so the test is exercising the skill for
real.

- [ ] **Step 1: Check current stack state**

```powershell
docker ps -a --format "table {{.Names}}\t{{.Status}}"
```

Note whether the stack is currently up (from earlier work) or stopped. Either is a valid starting
point for this dry run.

- [ ] **Step 2: Invoke the skill and observe the entry-point flow**

Start a message to Claude Code such as: "Use the adminapp-env skill to check whether the
environment is healthy." Observe:
- If the stack is up: does it correctly skip the state/mode question (since the request already
  specified "check whether... is healthy" = validate) and run the validation checklist?
- If the stack is down: does it correctly detect that via `docker ps` and offer the state/mode
  choice rather than asking a redundant question or failing silently?
- Does the container-health check, endpoint smoke test, and (if applicable) v3 log check all run
  and report accurately, matching what a manual check of the same commands would show?
- Does it print the access-info summary at the end, with correct URLs/credentials matching
  `reference/environment-reference.md`?

- [ ] **Step 3: Fix any discrepancies found**

If the skill's actual behavior diverges from the entry-point flow or reference content (e.g. a
command that doesn't work as written, a URL that's changed, a step that's ambiguous to follow) —
these are corrective-maintenance edits to whichever of Tasks 1-4's files is wrong. Fix directly,
re-run Step 2 to confirm, and commit each fix separately:

```bash
git add ".claude/skills/adminapp-env/<file that was fixed>"
git commit -m "fix: correct adminapp-env skill after live dry-run"
```

Repeat Steps 2-3 until a validate-flow invocation produces output that matches manual verification
with no corrections needed.

---

### Task 7: Delete `how to configure.md`

**Files:**
- Delete: `how to configure.md`

**Interfaces:**
- Consumes: Task 6 passing cleanly (no discrepancies found on the final iteration) — this task
  must not run before that.

- [ ] **Step 1: Confirm Task 6 passed cleanly**

Re-confirm the most recent Step 2/3 iteration of Task 6 needed zero corrections. If it didn't,
stop here and return to Task 6.

- [ ] **Step 2: Delete the file**

```bash
git rm "how to configure.md"
```

- [ ] **Step 3: Verify nothing else in the repo links to it**

```bash
grep -rl "how to configure.md" --include="*.md" .
```

Expect no output (or only references inside `.claude/skills/adminapp-env/` explicitly noting it
as the migration source, if any were left — remove those too if found, since the file no longer
exists).

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: remove how to configure.md, superseded by adminapp-env skill

All content migrated to .claude/skills/adminapp-env/ across the prior
commits in this series; the skill is self-contained and self-improving
going forward.
EOF
)"
```
