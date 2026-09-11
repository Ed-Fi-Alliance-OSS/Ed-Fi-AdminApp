# AC-520 — `compose/.env.example` audit

**Ticket:** [AC-520](https://edfi.atlassian.net/browse/AC-520) — Remove duplicate and/or unused variables in the `.env.example`
**Date:** 2026-09-10
**Status:** Resolved — see [Resolution](#resolution). Sections 1–4 below describe the state **before**
this change; line-number citations are relative to the pre-change tree.

## Method

Extracted all 88 active and 12 commented keys from `compose/.env.example`, then cross-referenced
each against every surface that can consume it:

| Surface | Mechanism |
|---|---|
| `compose/*.yml` | Compose `${VAR}` interpolation, before containers start |
| `compose/settings/*`, `compose/adminapp/*`, `compose/DB-Ods/*` | `sed`/`envsubst` template rendering and shell scripts |
| `eng/**/*.ps1` | Line-regex patching (see "CI coupling" below) |
| `packages/**` | Runtime `process.env` reads |

A variable is "used" only if it appears in one of these. Declaring it in `.env.example` alone does
nothing.

## Verified non-issues

Checked and ruled out, so they are not re-investigated later:

- **No literal duplicate keys.** Every key appears exactly once.
- **Inline comments are safe.** Verified with `docker compose config`: `A=pre # comment` resolves to
  `pre`. Compose's dotenv parser strips inline comments for both quoted and unquoted values.
- **`.env` self-interpolation works.** `ALLOWED_ORIGINS=${BASE_URL}` resolves to `https://localhost`.
- **Nothing hard-required is missing.** Every `${VAR}` lacking a `:-` fallback is declared.
- **Formatting is `.editorconfig`-clean.** LF, UTF-8, final newline, no trailing whitespace.

## Findings

### 1. Unused — zero references repo-wide

| Entry | Evidence |
|---|---|
| `ODS_API_VERSION_6X=6.1` | 0 hits outside `.env*` |
| `ODS_DB_IMAGE_6X=ods-api-db-ods` | 0 hits. `edfi-services.yml:665,684` hardcodes `edfialliance/ods-api-db-ods:${ODS_DB_TAG_6X}` |
| `#ODS_DB_IMAGE_6X=ods-api-db-ods-sandbox` | Broken instruction — uncommenting it does nothing, since the image name is not interpolated |
| `#ODS_DB_IMAGE_7X`, `#ODS_DB_TAG_7X` | Dead. v7 ODS DBs are `edfiadminapp/db-ods:local`, built from `compose/DB-Ods` |

The NOTE at lines 16–21 also contains a false claim: it states the 7X variables "are still used by the
v6.2 topology's own `ODS_DB_IMAGE_6X` / `ODS_DB_TAG_6X`", but `ODS_DB_IMAGE_6X` is used by nothing.

### 2. Duplicated values — 10 variables, 2 distinct strings

Eight variables hold `"wget --no-check-certificate --spider http://localhost/health"`; two hold the
`--header="tenant: tenant1"` variant. These are constants — they have never differed per environment,
so they are not configuration. All 10 are consumed at `edfi-services.yml:80–776` with **no `:-`
default**, meaning their absence is a hard failure rather than a fallback.

Naming is also inconsistent for the same concept: `*_API_HEALTHCHECK` (single-tenant) vs
`*_API_HEALTHCHECK_TEST` (multi-tenant).

`V6_API_HEALTHCHECK_TEST` has two consumers, not one: the healthcheck at `edfi-services.yml:728` and
an `API_HEALTHCHECK_TEST` container env passthrough at `edfi-services.yml:713`.

### 3. Wrong or misleading

1. **`## PostgreSQL Configuration (uncomment to use PostgreSQL instead of SQL Server)`** sits above
   three already-uncommented lines, and `POSTGRES_USER` / `POSTGRES_PASSWORD` are not engine-optional
   — every ODS and Admin database container uses them regardless of `DB_ENGINE`. Following the
   header's advice would break the whole ODS stack.
2. **`VITE_SHOW_REQUEST_CERTIFICATION=false` is inert.** `packages/fe/entrypoint.sh:15` reads it, but
   `adminapp-services.yml:193–202` never forwards it to the container. Tracked under
   [AC-603](https://edfi.atlassian.net/browse/AC-603), not fixed here.
3. **Misplaced tag comments.** The "Admin API 2.4" note sits above `ADMIN_DB_TAG_7X` (the Admin
   *database* image, not the API). The "Admin API 2.3 / use `pre`" note sits above
   `ADMIN_DB_TAG_6X=v1.4.3@sha…`, which is pinned, not `pre`; the actual `pre` is on `ADMIN_TAG_6X`.
4. **Section header drift.** `# Ed-Fi v7.3.0` while `ODS_API_TAG_7X=v7.3.2`. That block is the Admin
   API v2 topology but only the following block is labelled by Admin API version.
5. **`DB_SSL=false`** here vs `${DB_SSL:-true}` in `adminapp-services.yml:155` — divergent defaults
   for the same knob.

### 4. Missing — supported by compose, documented nowhere

`API_NODE_OPTIONS`, `KEYCLOAK_HOSTNAME`, `KEYCLOAK_HOSTNAME_PROTOCOL`, `KEYCLOAK_PORT_EXPOSED`,
`KEYCLOAK_REALM_CONFIG_TEMPLATE`, `MSSQL_PID`, `POSTGRESQL_IMAGE_TAG`. All have `:-` defaults, so they
are optional — but undiscoverable.

**Deliberately not documented: `MSSQL_DB`.** `adminapp-services.yml:91` sets it as a *container*
variable from `ADMIN_APP_DB_NAME`, but line 99's `${MSSQL_DB:-sbaa}` is interpolated by Compose from
the *host* environment. Declaring it in `.env` would desync the created database name from
`ADMIN_APP_DB_NAME`. Same token, two different resolvers.

## CI coupling — constrains any reformat

`eng/testing/run-e2e-ui.ps1:132–175` (`Set-AdminAppEnvFile`) regenerates `compose/.env` from this
file on every E2E run and, for `-DbEngine mssql`, line-regex patches it. It **throws** if fewer than
6 substitutions fire (raised to 7 by this change — see [Resolution](#resolution)). These 7 lines must
survive byte-for-byte:

```
DB_ENGINE=pgsql
# MSSQL_PORT_EXPOSED=1433
# MSSQL_ACCEPT_EULA=Y
# MSSQL_SA_PASSWORD=…
# MSSQL_IMAGE_TAG=2022-latest
DB_SECRET_VALUE={"DB_HOST"…
# DB_SECRET_VALUE={"MSSQL_DB_HOST"…
```

`.env.example` is therefore not just documentation — it is a build input for the MSSQL E2E matrix.

## Out of scope

- **Certification artifact checksum** and the `CERT_BRUNO_*` quoted-default bug — see
  [AC-603](https://edfi.atlassian.net/browse/AC-603).
- `packages/api/typings/config.d.ts:99` types `CERT_BRUNO_ON_DOWNLOAD_ERROR` as
  `'error' | 'warn' | 'skip'`, but code and config use `'error' | 'warning'`.
- ~~`eng/testing/run-e2e-ui.ps1:173` sets `$expectedSubstitutions = 6` against 7 patterns~~ — pulled
  into scope and fixed, see [Resolution](#resolution).
- Values duplicated between `ADMIN_APP_DB_NAME` / `POSTGRES_USER` / `POSTGRES_PASSWORD` and the JSON
  inside `DB_SECRET_VALUE`, which must be kept in sync by hand.

## Resolution

### Closed by this change

| Finding | What was done |
|---|---|
| §1 Unused | `ODS_API_VERSION_6X`, `ODS_DB_IMAGE_6X` (active + commented sandbox variant), `#ODS_DB_IMAGE_7X`, `#ODS_DB_TAG_7X` removed, along with the NOTE containing the false "still used by the v6.2 topology" claim. The populated-template instruction now carries the sandbox image's own digest, which the old commented entry supplied. |
| §2 Duplicated healthchecks | All 10 variables removed; the two distinct commands are inlined at the 11 consumption sites in `edfi-services.yml` (10 `healthcheck.test` + the `API_HEALTHCHECK_TEST` passthrough at the v6 ODS API). `compose/readme.md` updated to point at the new location. |
| §3.1 PostgreSQL header | `POSTGRES_USER` / `POSTGRES_PASSWORD` moved to the Shared section with an explicit note that every ODS and Admin database container needs them regardless of `DB_ENGINE`. |
| §3.3 Misplaced tag comments | Each tag now carries a comment describing the image it actually selects. |
| §3.4 Section header drift | Sections renamed by topology (`Admin API v2` / `Admin API v3` / `v6.2`) rather than by a version string that drifts. |
| §3.5 `DB_SSL` divergent defaults | Annotated in place — the file now states that compose falls back to `true` when the key is absent. |
| §4 Missing variables | All seven documented as commented entries alongside their compose fallbacks. `MSSQL_DB` deliberately still omitted, for the reason given in §4. |

### Also fixed, found during review of this change

- **`MSSQL_SA_PASSWORD` was booby-trapped.** The line read `# MSSQL_SA_PASSWORD=  # Required — …`.
  Compose's dotenv parser only strips an inline `#` when a value precedes it, so uncommenting the
  line verbatim set the SA password to the comment prose — which satisfies SQL Server's complexity
  rules, so the container came up healthy and the API then failed to connect for no visible reason.
  The warning now sits on its own line above the key.
- **Switching to SQL Server needs three edits, not one.** The block header now names all three
  (`DB_ENGINE`, `MSSQL_SA_PASSWORD`, `DB_SECRET_VALUE`) and states that the remaining `MSSQL_*`
  lines merely mirror compose defaults. The `DB_SECRET_VALUE` sync note now covers the MSSQL pair.
- **The CI coupling is documented where it binds.** A warning above the SQL Server block names
  `Set-AdminAppEnvFile` and the reformat that would break the `mssql` matrix leg — previously this
  constraint lived only in this document.
- **Two commented entries violated the file's own `# VAR=value` convention.** `#ADMIN_API_TAG_7X`
  and `#ADMIN_TAG_6X` lacked the space. Left as-is they invited a future maintainer to normalise in
  the wrong direction and break the `Set-AdminAppEnvFile` regexes.
- **The tag-pinning instruction contradicted itself** ("comment the active line out *and* uncomment
  the digest below — the alternative must come last"). Reworded to one action, with the last-key-wins
  mechanism stated inline rather than 60 lines away in the header.
- **`$expectedSubstitutions` raised from 6 to 7** (`eng/testing/run-e2e-ui.ps1`). The slack mattered
  because `MSSQL_IMAGE_TAG`, `MSSQL_PORT_EXPOSED` and `MSSQL_ACCEPT_EULA` have compose defaults
  identical to the values the patcher writes, so a broken regex on any of those three would have
  produced no observable difference.

### Deferred

- **§3.2 `VITE_SHOW_REQUEST_CERTIFICATION` is inert** — annotated in the file, fix tracked under
  [AC-603](https://edfi.atlassian.net/browse/AC-603).
- **`POSTGRES_PORT` is pseudo-configuration too.** `edfi-services.yml` honours `${POSTGRES_PORT:-5432}`
  at 12 sites but hardcodes `POSTGRES_PORT: 5432` at 10 others, so changing it half-works. Same class
  as §2; missed by this audit. Needs its own ticket.
- **The 11 inlined healthcheck blocks are candidates for a YAML anchor** (`x-api-healthcheck: &…`),
  which would collapse ~50 lines to ~14. Deferred deliberately: no compose file in this repo uses
  anchors today, so adopting them is a convention decision that deserves its own review rather than
  riding along with an `.env.example` audit.

## Verification

Behavioural neutrality was established by rendering the full stack configuration before and after and
diffing it, rather than by reasoning about parser behaviour:

```bash
docker compose -f edfi-services.yml -f nginx-compose.yml -f adminapp-services.yml \
  --env-file <version> --project-directory compose \
  --profile postgresql --profile mssql --profile adminapp config
```

- **Rendered output is byte-identical** before and after, for both the `postgresql` and `mssql`
  profile sets. Warning output is identical too: the same three pre-existing
  `MSSQL_SA_PASSWORD is not set` lines on each side, and no new interpolation warnings.
- **All 11 healthcheck sites render the same strings**, including the `--header="tenant: tenant1"`
  variant — compose-go's dotenv unescapes `\"` to `"`, so the old quoted `.env` value and the new
  single-quoted YAML scalar resolve identically, double space and all.
- **All 7 `Set-AdminAppEnvFile` regexes still match, and 7/7 substitutions fire** against the new
  file — verified by replaying the actual `switch -Regex` block.
- **Zero dangling references**: none of the 14 removed variables appears anywhere in `compose/`,
  `eng/`, `packages/` or `.github/`. The only surviving mentions repo-wide are prose in
  `docs/design/custom-ods-db-container-summary.md` and this document.
