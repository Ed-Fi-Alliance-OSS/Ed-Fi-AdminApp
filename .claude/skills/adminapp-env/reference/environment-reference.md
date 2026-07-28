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
