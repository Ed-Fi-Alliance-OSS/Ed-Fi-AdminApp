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
