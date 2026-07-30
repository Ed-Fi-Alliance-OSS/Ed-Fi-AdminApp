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

## `-Rebuild` fails with a Docker Desktop connection error (`EOF`, `http2 ... pipe-closed`)

**Status: Verified-live**

**Symptom**: `start-services.ps1 -Rebuild` (or an equivalent `docker compose ... up -d --build`)
fails partway through building `edfiadminapp-api`/`edfiadminapp-fe`, with an error like
`target edfiadminapp-api: failed to receive status: rpc error: code = Unavailable desc = error
reading from server: EOF`, or the more specific `http2: server: error reading preface from client
//./pipe/dockerDesktopLinuxEngine: file has already been closed`. `docker ps`/`docker buildx ls`
show Docker Desktop's engine and builder as otherwise fine immediately after, and
`com.docker.backend.exe`'s process start time shows it hasn't actually restarted — so this isn't a
full Docker Desktop crash, just its build connection dying under load. Confirmed reproducible:
happened 3 times in a row on one machine, always during the same step (both `api` and `fe`'s Nx
production builds running concurrently).

**Root cause**: `up -d --build` lets Compose/BuildKit build `edfiadminapp-api` and
`edfiadminapp-fe` **concurrently** by default, and each runs a memory-heavy Nx/TypeScript/Vite
production build. On a machine with Docker Desktop's memory allocation on the low side (observed:
~5.8GB / 4 CPUs via `docker info`), building both at once appears to push the WSL2/Linux VM into
memory pressure severe enough to drop BuildKit's connection to the Docker Desktop engine, without
crashing the engine itself.

**Fix**: build `api` and `fe` **sequentially** instead of letting Compose parallelize them:

```powershell
cd compose
docker compose -f edfi-services.yml -f nginx-compose.yml -f adminapp-services.yml --env-file .env --profile postgresql --profile adminapp build edfiadminapp-api
docker compose -f edfi-services.yml -f nginx-compose.yml -f adminapp-services.yml --env-file .env --profile postgresql --profile adminapp build edfiadminapp-fe
docker compose -f edfi-services.yml -f nginx-compose.yml -f adminapp-services.yml --env-file .env --profile postgresql --profile adminapp up -d
```

Verified: both builds succeeded individually on the first try immediately after 3 consecutive
failures of the combined/parallel build. If this recurs even building sequentially, the underlying
fix is increasing Docker Desktop's memory allocation (Settings → Resources) rather than anything
in this repo.

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
user** — this blocks login before Keycloak is ever reached. On a container that's been running
across a cert regeneration, that log grep can surface **both** the old error line and a newer
success line — the most recent matching line is authoritative, not the mere presence of an error
somewhere in the history; check timestamps or scope with `docker logs --since <window>`.

**Fix**: regenerate the cert, then restart the two containers that use it:

```powershell
cd compose/ssl
env -u OPENSSL_CONF bash generate-certificate.sh   # see the OPENSSL_CONF entry below if plain `bash generate-certificate.sh` fails
docker restart nginx edfiadminapp-api
```

Confirm via `docker logs edfiadminapp-api | Select-String "Registering OIDC provider"` — expect
the success line, not the error one. Since a restart doesn't clear prior log lines, if an old error
line is still present, confirm the **latest** matching line is the success one (e.g. `docker logs
--since 5m` right after the restart) rather than concluding it's still broken because an error
appears earlier in the history. Verified end-to-end afterward using the OIDC login verification
recipe in `environment-reference.md`. Since the cert is only valid 365 days, **this will recur
annually** on any long-lived local environment.

## OIDC registration fails with `502 Bad Gateway` instead of a cert error

**Status: Verified-live**

**Symptom**: same login-breaking effect as the cert-expiry entry above (clicking "Log in" 404s,
`docker logs edfiadminapp-api | Select-String "Registering OIDC provider"` shows an error, not the
success line) — but the error is `OPError: expected 200 OK, got: 502 Bad Gateway` instead of
`certificate has expired`. Confirmed this isn't stale historical noise by testing the route
directly: `curl -sk https://localhost/auth/realms/edfi/.well-known/openid-configuration` also
returns `502` right now, even though `edfiadminapp-keycloak` itself reports `(healthy)` — Keycloak's
own healthcheck talks to it directly on port 8080, bypassing nginx entirely, so Keycloak can be
genuinely healthy while nginx's route to it is broken.

**Root cause**: `nginx` can hold a stale/dead connection to Keycloak's container address after
Keycloak restarts independently of nginx (e.g. `docker restart edfiadminapp-keycloak` alone, or a
container recreation that doesn't also touch nginx) — observed with `nginx` at 15 hours uptime
and `edfiadminapp-keycloak` at only 28 minutes uptime. This compounds the same underlying fragility
as the cert-expiry entry: `RegisterOidcIdpsService` only attempts OIDC discovery **once, at API
startup, with no retry**, so if nginx's route to Keycloak happens to be broken at that exact
moment — for any reason, not just an expired cert — the `oidc-1` strategy never gets registered for
that process's entire lifetime.

**Fix**: restart nginx first (forces it to drop the stale connection and re-resolve), confirm the
route actually works, then restart the API to force it to retry registration:

```powershell
docker restart nginx
curl -sk -o NUL -w "%{http_code}" https://localhost/auth/realms/edfi/.well-known/openid-configuration   # expect 200 before proceeding
docker restart edfiadminapp-api
```

Confirm the same way as the cert-expiry entry: check the **latest** `docker logs edfiadminapp-api`
line matching `"Registering OIDC provider"` is the success one, then verify
`https://localhost/adminapp-api/api/auth/login/1` returns `302`, not `404`. **General takeaway**:
whenever the API's OIDC registration has failed for any reason, restarting the API alone often
isn't enough — check whether nginx's route to Keycloak actually works first, since a broken
upstream will just make the retry fail the same way.

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
  broke — see the cert-expiry entry above. If also checking `edfiadminapp-api`'s logs for the OIDC
  registration line, remember a long-lived container's logs can hold both an old error and a newer
  success line — trust the most recent matching line (check timestamps, or scope with `docker logs
  --since <window>`), not just whether an error is present anywhere in the history.
