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
