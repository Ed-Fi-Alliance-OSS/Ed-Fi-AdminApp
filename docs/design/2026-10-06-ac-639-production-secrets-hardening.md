# AC-639: Remove baked-in secrets from the production image

Status: draft for review
Base: stacked on PR 404 (AC-637, branch `AC-637`), which is still open

## Problem

`packages/api/Dockerfile` copies `packages/api/config/production.js-edfi` into the image as
`production.js`, which node-config loads whenever `NODE_ENV=production` (the production build
swaps `modes/dev.ts` for `modes/prod.ts`, which sets it). The file contains credential-bearing
defaults:

- `DB_ENCRYPTION_SECRET_VALUE.KEY`, a publicly known AES-256 key. It protects
  `sb_environment.configPrivate`, which holds Admin API client secrets for connected ODS
  environments. Anyone with a database dump, a backup or read access to `sb_environment` can
  decrypt every stored downstream credential.
- `SAMPLE_OIDC_CONFIG.clientSecret` and `AUTH0_CONFIG_SECRET_VALUE.CLIENT_SECRET`
  (`big-secret-123`).
- `DB_SECRET_VALUE.DB_PASSWORD` (`postgres`) and `MSSQL_DB_PASSWORD` (`YourStrong!Passw0rd`).

Overriding these through environment variables was unreliable. `DB_ENCRYPTION_SECRET_VALUE` was
mapped as a plain string in `custom-environment-variables.js` but spread as an object in
`default.js`, so an operator override produced a broken configuration rather than a secure one.

## What PR 404 already covers (not repeated here)

- `DB_ENCRYPTION_SECRET_VALUE` is mapped as JSON using `__name`/`__format`. config v5 ignores
  plain `name`/`format`, so the ticket's suggested `{ name, format }` form would not work.
- `assertValidDbEncryptionSecret` (`packages/api/src/app/db-encryption-secret.ts`) rejects a
  KEY that is not 64 hex characters or that matches `KNOWN_SAMPLE_KEYS`; `main.ts` calls it.
- `SESSION_SECRET` support, `assertValidSessionSecret`, `SESSION_SECRET_VALUE=[]` in
  `compose/.env.example`, and session-secret generation in `eng/testing/run-e2e-ui.ps1`.
- compose passes `DB_ENCRYPTION_SECRET_VALUE` into the API container.

## Goals

1. No secret value is baked into the production image.
2. In production, a missing or known-sample secret makes the API fail at startup with a message
   naming the variable and what to do.
3. `compose/` and the `eng/` e2e runner keep working end to end.
4. Operators who ever ran with the published key have a documented rotation procedure.

Non-goals: a re-encryption tool (documentation only), changes to the test-only Keycloak machine
client in `eng/helpers/bootstrap-keycloak-for-tests.ps1` and `get-bruno-token.ps1`
(`edfi-machine-secret-456`), changes to `local.js-edfi`, and an "allow insecure" escape flag.

## Design

### 1. Image and template

`production.js-edfi` keeps its name and the Dockerfile `COPY` line is unchanged. The file is
the real production defaults file, not a sample, so a rename adds churn (Dockerfile,
`.gitignore`, docs, PR 404 comments) without a benefit. It keeps non-secret settings (URLs,
flags, hosts, ports, usernames, database names) and loses:

- `DB_ENCRYPTION_SECRET_VALUE` (entire block)
- `DB_SECRET_VALUE.DB_PASSWORD` and `MSSQL_DB_PASSWORD`
- `SAMPLE_OIDC_CONFIG.clientSecret`
- `AUTH0_CONFIG_SECRET_VALUE.CLIENT_SECRET`. It is never read in `packages/api/src`; only
  `ISSUER` and `MACHINE_AUDIENCE` are used.

A comment at the top of the file states that every secret must come from environment variables
or AWS Secrets Manager.

### 2. Config mapping

In `custom-environment-variables.js`:

- `SAMPLE_OIDC_CONFIG` and `AUTH0_CONFIG_SECRET_VALUE` become
  `{ __name, __format: 'json' }` so a partial JSON override (for example only `clientSecret`)
  deep-merges over the non-secret fields from `production.js`.
- `DB_SECRET_VALUE` currently uses `{ name, format }`. Verify against the installed config
  version whether that form is ignored. If it is, change it to `__name`/`__format`; if it
  works, leave it and record why in the spec's implementation notes.

### 3. Runtime validator

New `packages/api/src/app/production-secrets.ts`, called from `main.ts` next to PR 404's
asserts, after config values are resolved.

- Gated on `process.env.NODE_ENV === 'production'`, so `nx serve` and local dev with sample
  values keep working. (PR 404's key assertion is unconditional and stays so.)
- Collects every problem and throws one error naming each variable, for example
  `DB_SECRET_VALUE.DB_PASSWORD is missing or a known sample value; set a real value via
  environment variable or AWS Secrets Manager`.
- Checks the DB password for the active `DB_ENGINE` (`DB_PASSWORD` for pgsql,
  `MSSQL_DB_PASSWORD` for mssql) and `SAMPLE_OIDC_CONFIG.clientSecret`. The OIDC check applies
  only when `SAMPLE_OIDC_CONFIG` is present, since it only feeds the first-run seeding
  migration.
- Rejects empty values, `<set-me>`, anything starting with `change-me`, `postgres`,
  `YourStrong!Passw0rd` and `big-secret-123`.
- The encryption key check stays PR 404's helper. Add the former `.env.example` key
  (`4bb5c8ddaee19b8734675193868cd83511b04ee29ed7cc9aebc0dff5b3079dda`) to
  `KNOWN_SAMPLE_KEYS`; PR 404 documents it as rejected but does not reject it.

### 4. `compose/.env.example` and `compose/adminapp-services.yml`

- Secrets become `change-me-...` placeholders: `DB_ENCRYPTION_SECRET_VALUE.KEY`,
  `POSTGRES_PASSWORD`, the passwords inside both `DB_SECRET_VALUE` lines,
  `MSSQL_SA_PASSWORD` and `KEYCLOAK_EDFIADMINAPP_*_CLIENT_SECRET`. Comments say that copying the
  file unchanged makes the API refuse to start, and show how to generate each value.
- `adminapp-services.yml` passes
  `SAMPLE_OIDC_CONFIG={"clientSecret":"${KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET}"}` to the API so
  the seeded IdP row matches the Keycloak client; it merges over `issuer` and `clientId` from
  `production.js`.

### 5. `eng/` scripts

- `eng/testing/run-e2e-ui.ps1` `Set-AdminAppEnvFile` extends PR 404's session-secret patching,
  using the same "must match exactly once, else throw" guard per line. It generates a 64-hex
  key, a DB password and a Keycloak client secret. The DB password is alphanumeric for pgsql
  and has a guaranteed upper/lower/digit/symbol mix for MSSQL complexity rules. It is written
  consistently to `POSTGRES_PASSWORD` and the pgsql `DB_SECRET_VALUE`, or to
  `MSSQL_SA_PASSWORD` and the mssql `DB_SECRET_VALUE`. The existing mssql block, which sets a
  fixed password today, is folded into this.
- `eng/helpers/start-services-target.ps1` and `compose/start-services.ps1` warn when `.env`
  still contains placeholders, listing which variables, in the style of the existing
  `DB_ENGINE` warnings.

### 6. Documentation

Update `compose/readme.md`, `docs/setup-private-server.md` (it says to edit
`production.js-edfi` and calls out `big-secret-123`), `docs/development.md` and
`eng/testing/README.md`. Add a "Secret rotation" section for deployments that ever ran with
the published key:

1. Generate a new key (`openssl rand -hex 32`).
2. Decrypt and re-encrypt `sb_environment.configPrivate` with it.
3. Rotate the downstream Admin API client secrets that column protected.
4. Rotate the DB and OIDC secrets that shipped as defaults.

## Risks

- Existing local Postgres volumes keep the old password after `.env` regeneration. The runner
  output and docs say to reset volumes (`docker compose down -v`).
- Existing deployments that relied on the baked-in defaults will fail to start after upgrade
  until secrets are supplied. This is the intended behavior and is called out in the release
  notes and docs.
- This worktree has no `node_modules`; `npm ci` is needed before tests or the build can run.
- The PowerShell changes cannot be fully verified without the Docker stack. The Playwright e2e
  suite is not run as part of this change; the patch logic is covered by its exactly-once
  guards and, where feasible, a dry run.

## Testing

- `production-secrets.spec.ts`: each secret case, the aggregated message, the non-production
  skip, and engine selection.
- `custom-environment-variables.spec.ts`: JSON-mapping assertions for the OIDC and DB entries.
- `db-encryption-secret.spec.ts`: the `4bb5...` key is rejected.
- A guard spec that reads `production.js-edfi` and `compose/.env.example` and fails if a known
  sample secret reappears, and checks the Dockerfile still copies only the sanitized template.
- `npm run build` and `npm run lint:check`, as required by `AGENTS.md`.

## Delivery

Three commits: config and template; validator and tests; compose, `eng/` and docs. One PR,
based on AC-637 and targeting it, retargeted to `main` once PR 404 merges.
