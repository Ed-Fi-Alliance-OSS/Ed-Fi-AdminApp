# E2E Testing

This folder contains two independent end-to-end test suites for the Admin App:

- **[API Bruno E2E Tests](#api-bruno-e2e-tests)** (`run-bruno.ps1`) — Bruno CLI-driven API endpoint tests.
- **[UI Playwright E2E Tests](#ui-playwright-e2e-tests)** (`run-e2e-ui.ps1`) — Playwright BDD-driven browser UI tests.

It also holds one static check that starts nothing:

- **[Compose Config Validation](#compose-config-validation)** (`check-compose-config.ps1`) — asserts the Docker Compose stack still renders from `compose/.env.example`.

## API Bruno E2E Tests

Bruno CLI-driven end-to-end test suite for Admin App API App/Auth endpoints with Keycloak OIDC authentication bootstrap and local runner automation.

### Prerequisites

- **Bruno CLI** installed and available in PATH
- **PowerShell** (Windows PowerShell 5.1+)
- **Docker & Docker Compose** for running services locally
- Local development environment set up (optionally via `eng\helpers\start-all-services-test-docker.ps1`)

### Configuration

#### Environment Variables

The runner script uses these environment variables (with defaults for local development):

```powershell
# Keycloak/OIDC Configuration
$env:OIDC_ISSUER = 'https://localhost/auth/realms/edfi'          # Keycloak issuer URL
$env:OIDC_CLIENT_ID = 'edfiadminapp-machine'                     # Client ID
$env:OIDC_CLIENT_SECRET = 'edfi-machine-secret-456'              # Client secret
$env:OIDC_USERNAME = 'edfi-admin'                                # Test user username
$env:OIDC_PASSWORD = '123'                                       # Test user password
$env:OIDC_ADMIN_USER = 'admin'                                   # Keycloak admin user
$env:OIDC_ADMIN_PASSWORD = 'admin'                               # Keycloak admin password

# API Configuration
$env:API_BASE_URL = 'https://localhost/adminapp-api/api'         # Admin App API base URL
$env:BASE_URL = 'https://localhost/adminapp-api/api'             # Alternative API base (set by runner)
$env:ACCESS_TOKEN = ''                                           # Bearer token (acquired by runner)
$env:TEAM_ID = ''                                                # Test team ID (set by bootstrap)
$env:TENANT = ''                                                 # Multi-tenant identifier (if needed)
```

#### Environments

Two Bruno environment configurations are provided:

- **`environments/local.bru`** — Local development defaults
- **`environments/ci.bru`** — CI/CD defaults (non-secret values)

### Quick Start

Run these commands from the repository root.

#### Run All Tests

```powershell
.\eng\testing\run-bruno.ps1 -Env local
```

#### Run Tests with Services & Bootstrap

Starts Docker Compose, bootstraps Keycloak, seeds test data, and runs all tests:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -StartServices -BootstrapAuth -SeedData
```

#### Run by Tag

Run only App endpoints:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -Tag App
```

Run only Auth endpoints:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -Tag Auth
```

#### Run Specific Request

Run a single request by name:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -Request auth-me
```

#### Run the certification step collection (AC-466)

`collections/certification` validates credentials, starts (or reuses) the data store's open SIS run and runs steps on it against a real ODS/API. Every request skips itself unless `CERT_TEAM_ID` is set, so the default suite is unaffected. The ODS must contain data matching the inputs. Locally, refresh the ODS databases to Data Model 5.2 templates first (otherwise every data call returns 500), or point the environment at certification.ed-fi.org. The `ACCESS_TOKEN` user needs `team.sb-environment.edfi-tenant.ods.certification:run` on the data store, as a member of the team that owns it.

Certification run statuses use uppercase database/API values: `DRAFT`, `READY_FOR_REVIEW`,
`IN_REVIEW`, `CHANGES_REQUESTED`, `READY_FOR_REVIEW_WITH_CHANGES`, `APPROVED`, and `REJECTED`.
Steps can execute only in `DRAFT` and `CHANGES_REQUESTED`. Migration `1794000000002` converts
existing run statuses and rebuilds the open-run indexes without deleting runs or results; its
rollback restores lowercase values. Deploy this migration with the matching API build. Scenario
and step result statuses are unchanged. When editing test statuses through SQL Server's `sqlcmd`,
use `-I` so quoted identifiers are enabled for the filtered indexes.

Run-status updates reject competing decisions with a conflict instead of overwriting them.
Saving step results rechecks the executable status inside the transaction, before any evidence
is written. A 409 response refreshes the page's run status so a stale tab becomes read-only.
Step-result and response-snapshot caches are scoped to the open run, so a new attempt cannot
reuse a previous attempt's cached results or inputs.

The Domain rename includes database and API names, not just labels. This AC-649 scope change
was approved and recorded in [Jira comment 100370](https://edfi.atlassian.net/browse/AC-649?focusedCommentId=100370).

Catalog upgrades during an open run are not supported in this MVP. Finish or clean up existing
test runs before changing the certification artifact. Catalog-pinned inspection and execution
of older artifacts require follow-up work.

Look up the v5 Students step ids after the API has synced the catalog:

```sql
SELECT s."stepId", s."fileName"
FROM cert.step_catalog s
JOIN cert.scenario_catalog sc ON sc."scenarioId" = s."scenarioId"
JOIN cert.domain_catalog d ON d."domainId" = sc."domainId"
JOIN cert.catalog_version v ON v."catalogVersionId" = d."catalogVersionId"
WHERE v."isActive" AND v."dataStandardVersion" = 'v5' AND d.name = 'Student' AND sc.name = 'Students'
ORDER BY s."displayOrder";
```

```powershell
$env:CERT_TEAM_ID = '1'                # the team that owns the data store
$env:CERT_EDFI_TENANT_ID = '1'
$env:CERT_ODS_ID = '1'
$env:CERT_ODS_KEY = '<ODS/API key>'
$env:CERT_ODS_SECRET = '<ODS/API secret>'
$env:CERT_STEP_01_ID = '<stepId of 01 - 1st Student is valid.bru>'
$env:CERT_STEP_03_ID = '<stepId of 03 - 1st Student - birthDate was Updated.bru>'
$env:CERT_STUDENT_UNIQUE_ID = '<a studentUniqueId in that ODS>'
$env:CERT_EXPECT_SUCCESS = 'true'      # optional: also assert step 01 passes
.\eng\testing\run-bruno.ps1 -Env local -Collection collections/certification
```

When `CERT_ODS_SECRET` is set, the runner adds `--reporter-skip-request-body`, `--reporter-skip-response-body` and `--reporter-skip-all-headers` so the key/secret, tokens and headers stay out of `test-results/`.

#### Send a run to review without running every scenario (AC-659)

"Send to Review" on a run's Scenarios page is enabled only when the run is `DRAFT` or
`CHANGES_REQUESTED` and every enabled scenario of the run's catalog version is `completed`. The
API checks both again. To demo it without running each scenario, start a run from My products,
then run [`sql/cert-complete-run-scenarios.pgsql.sql`](sql/cert-complete-run-scenarios.pgsql.sql)
against the Admin App PostgreSQL database with the run ID set at the top. It marks every
enabled scenario of the run as completed. It doesn't write step results, so opening a scenario
still shows its steps as not run. An optional block in the script puts the run in
`CHANGES_REQUESTED`, which a review normally does, so you can see "Ready for review with new
changes". Comments at the end of the script fail one scenario again, put the run back to
`DRAFT`, or remove the run's scenario results. Use it only on test databases: it skips the
workflow rules.

#### Fill the team's Run history with demo runs (AC-701)

The team's Run history page lists every run of the team, newest first, with its status and
"X / Y scenarios completed". To see it with several runs without starting them one by one, run
[`sql/cert-demo-run-history.pgsql.sql`](sql/cert-demo-run-history.pgsql.sql) (or the
[`.mssql.sql`](sql/cert-demo-run-history.mssql.sql) twin) against the Admin App database, with
the team, Ed-Fi tenant and ODS IDs set at the top. It adds five runs in different statuses
(approved, rejected, draft, in review, ready for review) with different progress. Pick a data
store with no open runs of the SIS, MTSS or ASSESSMENTS models, because a data store can have
only one open run per model. Use it only on test databases.

#### Demo the Audit history (AC-650)

The Scenarios page of a run shows an "Audit history" table below the scenarios that lists every
status change of the run, newest first, with who made it and when. An entry with a reviewer's
comment has a "View comment" button that opens the full comment in a dialog. To see it with seven
entries, use `cert-complete-run-scenarios` (above) to get past the scenarios and do this. Leave the
script's optional `CHANGES_REQUESTED` block commented out: a status set by SQL records no Audit
history entry, so request the changes from the reviewer's page instead.

1. Start a run from My products.
2. Send it to review.
3. Pick it up as a reviewer.
4. Request changes, with a comment.
5. Send it to review again.
6. Pick it up again.
7. Approve it.

Open the run's Scenarios page. The table shows the seven entries newest first (approved, picked
up, sent to review, changes requested, picked up, sent to review, started). Select "View comment"
on "Changes requested" to read the reviewer's comment.

#### Custom OIDC Grant Type

Use password grant instead of client_credentials:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -GrantType password
```

### Available Requests

#### App Collection (`tests/api/collections/app/`)

| Request | Description | Tag | Auth |
|---------|-------------|-----|------|
| `app-healthcheck` | GET `/healthcheck` — API health check | App | None |
| `app-secret` | GET `/secret/{id}` — Secret retrieval | App | None |

#### Auth Collection (`tests/api/collections/auth/`)

| Request | Description | Tag | Auth |
|---------|-------------|-----|------|
| `auth-me` | GET `/auth/me` with Bearer token | Auth | Required |
| `auth-me-no-token` | GET `/auth/me` without token (negative test) | Auth | None |
| `auth-my-teams` | GET `/auth/my-teams` — User's team list | Auth | Required |
| `auth-cache` | GET `/auth/cache` — Cache status | Auth | Required |
| `auth-cache-team` | GET `/auth/cache/{teamId}` — Team cache status | Auth | Required |

### Bootstrap & Seed Process

#### Keycloak Bootstrap (`eng\helpers\bootstrap-keycloak-for-tests.ps1`)

Automatically called by the runner with `-BootstrapAuth`:

1. **Acquires admin token** from Keycloak (`admin-cli` client)
2. **Creates/updates client** `edfiadminapp-machine` with service-account and `login:app` scope configuration
3. **Upserts test users** for the browser login (`edfi-admin`) and machine client (`edfiadminapp-machine`)
4. **Seeds test data** directly in the database (teams, memberships)

#### Idempotency

All bootstrap operations are idempotent:
- Existing clients and users are detected and skipped
- Team creation checks for duplicates by name
- Membership creation handles "already exists" errors gracefully

#### Fallback Behavior

If Keycloak is unavailable:
- Machine-user seeding and team/membership setup happen directly in the database
- Keycloak client provisioning errors are logged as warnings

### Troubleshooting

#### Services Not Running

**Error:** `Failed to acquire token: Unable to connect to the remote server`

**Solution:** Start services first:

```powershell
.\eng\helpers\start-all-services-test-docker.ps1
```

#### BASE_URL Not Resolved

**Error:** `app-healthcheck` request fails with URL resolution error

**Solution:** Ensure the environment file is loaded:

```powershell
.\eng\testing\run-bruno.ps1 -Env local
```

#### Token Acquisition Fails

**Error:** `Failed to acquire access token: ...`

**Causes:**
- Keycloak not running
- Wrong `OIDC_CLIENT_SECRET`
- Client `edfiadminapp-machine` not configured in Keycloak

**Solutions:**
1. Verify Keycloak is running: `docker ps | grep keycloak`
2. Run bootstrap: `.\eng\testing\run-bruno.ps1 -BootstrapAuth`
3. Check Keycloak admin console at `https://localhost/auth/`

#### Tests Failing with 502 Bad Gateway

**Cause:** API is not running or misconfigured

**Solution:**
```powershell
# Rebuild and restart services
.\eng\helpers\start-all-services-test-docker.ps1

# Wait a few seconds for services to be ready
Start-Sleep -Seconds 10

# Run tests
.\eng\testing\run-bruno.ps1 -Env local
```

#### Access Token Invalid or Expired

**Error:** Tests fail with 401/403

**Solution:** Token is automatically acquired fresh for each run. If persisting, clear and retry:

```powershell
# Clear cached token
$env:ACCESS_TOKEN = ''

# Run again (acquires new token)
.\eng\testing\run-bruno.ps1 -Env local
```

### Runner Script Options

```powershell
-Env <string>
    Environment: 'local' or 'ci'. Default: 'local'

-StartServices
    Start Docker Compose services before running tests.

-BootstrapAuth
    Bootstrap Keycloak: create client, user, acquire token.

-SeedData
    Seed test data (teams, memberships). If TEAM_ID is still missing for auth runs, seeding is triggered automatically.

-TeamId <int>
    Explicit TEAM_ID to pass to Bruno requests (for tests requiring team-scoped auth data).

-GrantType <string>
    OAuth grant: 'client_credentials' or 'password'. Default: 'client_credentials'

-Tag <string>
    Filter by tag: 'App' or 'Auth'. Default: all requests

-Request <string>
    Run single request by name (e.g., 'auth-me', 'app-healthcheck', or full prefixed names).

-Collection <string>
    Run requests in a collection/folder (e.g., 'collections/auth')
```

### Development

#### Adding New Tests

1. Create a new `.bru` file in `tests/api/`:
   ```
   meta {
     name: unique-name
     type: http
     seq: <number>
     tags: App   # or Auth
   }

   <METHOD> {
     url: {{BASE_URL}}/<endpoint>
   }

   tests {
     test("description", function() { ... });
   }
   ```

2. Run the test:
   ```powershell
   .\eng\testing\run-bruno.ps1 -Env local -Request unique-name
   ```

#### Modifying Bootstrap Logic

Edit `eng\helpers\bootstrap-keycloak-for-tests.ps1`:
- Keycloak client configuration (step 2)
- Test user creation (step 3)
- API team/membership seeding (step 4)

#### Environment Variables

Add new variables to:
- `tests/api/environments/local.bru` (local defaults)
- `tests/api/environments/ci.bru` (CI defaults)
- Runner script initialization (for computed values like `ACCESS_TOKEN`)

### Integration with CI/CD

See `.github/workflows/api-bruno-e2e.yml` for GitHub Actions workflow that:
1. Checks out code
2. Starts services with Docker Compose
3. Runs bootstrap and seed
4. Executes all tests by tag
5. Publishes test results

The workflow uses the same `run-bruno.ps1` script with `-Env ci`.

### References

- **Bruno CLI Docs:** https://docs.usebruno.com
- **Admin App API:** `/adminapp-api/api` (local URL)
- **Keycloak Admin:** `https://localhost/auth/` (admin / admin)
- **Architecture:** See `docs/design/2026-06-12-bruno-api-e2e-design.md`

## UI Playwright E2E Tests

Playwright + [playwright-bdd](https://github.com/vitalets/playwright-bdd)-driven end-to-end test suite for the Admin App frontend, run via `run-e2e-ui.ps1`. Unlike the Bruno suite, this runner also provisions the entire stack it tests against: it downloads the ODS Minimal Template backup, starts every Docker Compose service the Admin App needs (choosing PostgreSQL or SQL Server for the Admin App's own database), waits for the stack to become healthy, creates the local Keycloak test user, and then runs the suite.

### Prerequisites

The script self-checks these on every run and reports exactly what's missing (with the command to fix it) before doing anything else:

- **Docker & Docker Compose**, running locally
- **Node dependencies installed**: `npm ci --legacy-peer-deps`
- **Playwright Chromium browser installed**: `npx playwright install --with-deps chromium`
- **Local TLS certificate generated**: `bash ./compose/ssl/generate-certificate.sh`

### Quick Start

Run these commands from the repository root.

#### Run Against PostgreSQL (default)

```powershell
./eng/testing/run-e2e-ui.ps1
```

#### Run Against SQL Server

```powershell
./eng/testing/run-e2e-ui.ps1 -DbEngine mssql
```

#### Rebuild Images First

Rebuilds the Admin App images before starting services — useful after pulling in local code changes:

```powershell
./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild
```

#### Stop Services After the Run

By default the stack is left running after the suite finishes (pass or fail), so you can inspect it or re-run tests quickly. Add `-StopServices` to tear it down automatically (this is what CI uses):

```powershell
./eng/testing/run-e2e-ui.ps1 -DbEngine pgsql -Rebuild -StopServices
```

### What It Does

1. Checks prerequisites (Node dependencies, Playwright Chromium, TLS certificate).
2. Downloads the ODS Minimal and Populated Template backups into `compose/db-backup/` (skipped if already cached).
3. Regenerates `compose/.env` from `compose/.env.example` and, for `-DbEngine mssql`, patches `DB_ENGINE`, the `MSSQL_*` settings, and the active `DB_SECRET_VALUE` line, and generates real values for the `change-me` placeholders (session secret, database password, encryption key, Keycloak client secrets) so `compose/.env` is never run with publicly known secrets.
4. Starts Docker Compose services (the `v6` — unless `-SkipV1` — and `odsV7-adminV2` topologies plus the Admin App) via `eng/helpers/start-services-target.ps1`.
5. Waits for the Admin App API, frontend, and Keycloak to be stable — and, for `-DbEngine mssql`, also waits for the Admin App's `sbaa` database to actually exist inside the SQL Server container.
6. Creates/updates the local Keycloak test user via `eng/helpers/create-local-user-keycloak.ps1`.
7. Runs `npm run test:e2e:bdd` (the Playwright BDD suite).
8. Optionally stops all Docker Compose services (`-StopServices`), then exits with the suite's own exit code.

### Runner Script Options

```powershell
-DbEngine <pgsql|mssql>
    Admin App database engine to provision and test against. Default: 'pgsql'.
    ODS/API databases always run on PostgreSQL regardless of this value — only
    the Admin App's own database engine changes.

-Rebuild
    Rebuild Admin App images before starting services.

-StopServices
    Stop Docker Compose services after the test run (success or failure).

-SkipV1
    Skip the Ed-Fi v6 ("v1" environment) topology: its containers are not started
    and scenarios tagged @v1 are excluded from the Playwright run. CI uses this.

-KeepEnvFile
    Use the existing compose/.env as-is instead of regenerating it. Fails if the
    file is missing or its DB_ENGINE does not match -DbEngine. Without it, an
    existing compose/.env is also reused as is. In both cases a warning is printed
    when CERT_ENABLED, VITE_SHOW_REQUEST_CERTIFICATION or TPDM_ENABLED do not have
    the values the certification E2E needs (true, true, false).

-OdsDataStandard <string>
    Data Standard of the ODS template packages to download. Default: '5.2.0',
    matching the default ODS image in compose/.env.example. Template files already
    in compose/db-backup are used as they are unless this or -OdsTemplateVersion
    is passed.

-OdsTemplateVersion <string>
    NuGet package version of the ODS templates. Default: '7.3.20057'.

-OdsTemplateSqlFolder <path>
    Folder with EdFi.Ods.Minimal.Template.sql and EdFi.Ods.Populated.Template.sql
    to use instead of the NuGet feed. Written to SQL_BACKUPS_FOLDER in the
    generated compose/.env (a warning is printed when an existing compose/.env
    is reused). Both files must exist in the folder. A .source marker next to the
    populated template (<standard>/<version>) lets the runner skip certification
    for a non-5 Data Standard; without it certification runs.

-OdsApiTag <string>
    ODS/API image tag written to ODS_API_TAG_7X in the generated compose/.env
    (a warning is printed when an existing compose/.env is reused).

-ServiceStartTimeoutMinutes <int>
    Abort 'docker compose pull' / 'up' if either exceeds this many minutes
    (each). Default: 20.
```

### Notes

- **Data Standard 5 by default.** Certification E2E coverage is supported only on Data Standard 5; on a stack below Data Standard 5 the certification scenario times out because the request modal excludes those environments. With `-OdsDataStandard` set to another major version (for example 4 or 6), `run-e2e-ui.ps1` skips the certification feature so the other suites still run; for a manual run set `E2E_SKIP_CERTIFICATION=1` for the same effect. Changing the standard also needs a fresh `compose/.env` or matching edits to `ODS_API_TAG_7X` / `SQL_BACKUPS_FOLDER` there: a reused `compose/.env` keeps its image tag and template folder. The stack runs the Data Standard 5 ODS image with the 5.2.0 templates, which the certification E2E needs. For the Data Standard 6 image (the commented `ODS_API_TAG_7X` in `compose/.env.example`), pass the matching templates and the digest: `pwsh ./eng/testing/run-e2e-ui.ps1 -OdsDataStandard <6.x.x> -OdsTemplateVersion <version> -OdsApiTag 'v7.3.2@sha256:64ec898075da58824ab8a0f91f445abbf3cc8c225bfc7c69ed34fe84d6ef230f'`. Downloaded templates are tagged with a `.sql.source` marker next to the file. Templates already in `compose/db-backup` are used as they are when neither `-OdsDataStandard` nor `-OdsTemplateVersion` is passed and they have a marker (a warning is printed when the marker says they are another Data Standard); a template with no marker was cached by an older runner (Data Standard 4) and is downloaded again; when either is passed, a different standard or version downloads again instead of reusing a stale file. The ODS init script runs only once per volume: after changing the standard, image or templates, remove the ODS volumes (`vol-odsV7-adminV2-*`, `vol-odsV7-adminV3-*`), otherwise the stack silently stays on the previous Data Standard.
- **Retries preserve `compose/.env`.** Secrets, image tags and dataset choices remain unchanged after a timeout or failed test. For MSSQL, the existing SA password is restored into the runner's process environment and readiness checks.
- **Unsafe configuration stops provisioning.** Existing `change-me` placeholders or a mismatched `DB_ENGINE` cause an error without overwriting the file. If the file is missing but previous stack volumes exist, restore the original configuration or deliberately provision a separate clean environment. The runner does not rotate stored credentials, replace encryption keys or delete volumes automatically.
- **ODS/API databases are unaffected by `-DbEngine`.** The `v6`, `odsV7-adminV2`, and `odsV7-adminV3` topologies always run on PostgreSQL; only the Admin App's own database switches between PostgreSQL and SQL Server.
- **CI runs this script against both engines.** `.github/workflows/run-e2e-ui.yml` uses a `db-engine: [pgsql, mssql]` matrix that calls `run-e2e-ui.ps1 -DbEngine <pgsql|mssql> -Rebuild -StopServices -SkipV1` once per engine, after a Docker Hub login (`vars.DOCKER_USERNAME` / `secrets.DOCKER_HUB_TOKEN`) to avoid pull rate limits. Image pulls are capped at 4 in parallel (`COMPOSE_PARALLEL_LIMIT`) and retried 3 times.

- **The suite needs a raised API rate limit.** `playwright.config.ts` runs 4 workers against one API from one IP, which exceeds the default `RATE_LIMIT_LIMIT=100` (requests per `RATE_LIMIT_TTL`, 60000 ms) and produces 429s on `/auth/me`. `run-e2e-ui.ps1` sets `RATE_LIMIT_LIMIT=100000` for its own run unless you already set it, and the API container keeps that value after the script exits unless you pass `-StopServices`. If you start the stack yourself (for example with `eng/helpers/start-services-target.ps1`) and run `npm run test:e2e:bdd` directly, set `RATE_LIMIT_LIMIT` (for example `$env:RATE_LIMIT_LIMIT = '100000'`) before starting the services. It must be a positive whole number.
- **Timeouts.** Each test has a 120 s timeout (180 s for the environment setup project, which waits for a full sync, and 90 s for `chromium-environmentv2andApi`). A single click, fill or navigation fails after 30 s (`actionTimeout`, `navigationTimeout`) instead of waiting for the whole test timeout. Set `PW_SLOW_MO` (milliseconds) to slow the browser down when debugging.
- **Test project order.** Projects run as independent lanes in parallel, and projects inside a lane run one after the other. A failure in one project skips the projects that depend on it. See the comments in `playwright.config.ts` before moving a spec between lanes.

### Troubleshooting

**Missing prerequisites** — the script prints exactly which one and the command to fix it; run that command and re-run the script.

**Timed out waiting for stable Admin App services** — the error message names which check(s) were still failing (`API`, `FE`, `KEYCLOAK_META`, `KEYCLOAK_LOGIN`, and for MSSQL, `MSSQL_SBAA_DB`). Check `docker ps` and `docker compose logs` for the corresponding container.

**SQL Server test flakiness** — some Playwright BDD test failures against `-DbEngine mssql` are a known, pre-existing app-level UI/timing issue under SQL Server, not caused by this runner script. A PostgreSQL run failing the same way is not expected and should be investigated as a real regression.

**Re-running against existing volumes** — the old passwords are still stored in the existing PostgreSQL, SQL Server, Keycloak, and ODS/Admin volumes, so freshly generated secrets will not match them. When the runner detects existing volumes it prints a warning with the exact reset command. To reset, first stop and remove the stack with `docker compose ... down -v` (this permanently deletes the stack's volumes and all data in them, which is acceptable for the disposable e2e stack), then re-run the runner.

**Smoke-testing the secret generator** — `eng/testing/test-env-secrets.ps1` is a no-Docker smoke test for the generator in `eng/helpers/env-secrets.ps1`. Run it with `pwsh ./eng/testing/test-env-secrets.ps1`.

### References

- **Architecture:** See `docs/design/2026-08-03-mssql-e2e-ui-runner-design.md`
- **Playwright BDD:** https://github.com/vitalets/playwright-bdd

## Compose Config Validation

`check-compose-config.ps1` renders the Docker Compose stack from `compose/.env.example`
and asserts it is still coherent. It starts nothing and needs no Docker daemon —
`docker compose config` only parses and interpolates. Takes ~15 s locally on Windows, less on CI.

```bash
npm run compose:check
```

CI runs the same script in the `Compose Config Validation` job of
`.github/workflows/on-pullrequest.yml`, so local and CI behaviour cannot drift.

### What it asserts

1. **Every compose file parses on its own**, so a YAML error names the file it is in.
2. **No referenced-but-undeclared variables**, for every profile. The failure names them.
3. **Healthcheck commands match `compose-healthchecks.golden`**, which is what catches a service
   pointed at the wrong `x-healthcheck-*` anchor - that renders as valid YAML and would otherwise
   pass unnoticed.

After a deliberate probe change, re-record the golden file and review the diff:

```bash
npm run compose:check:update
```

### Full documentation

[COMPOSE-VALIDATION.md](./COMPOSE-VALIDATION.md) is the reference for this check: the dependency
direction it asserts, what it deliberately does **not** catch, exactly when the golden file needs
regenerating, and which files a new environment variable touches.

### References

- **Full reference:** [COMPOSE-VALIDATION.md](./COMPOSE-VALIDATION.md)
- **Audit and rationale:** [`docs/design/2026-09-10-ac-520-env-example-audit.md`](../../docs/design/2026-09-10-ac-520-env-example-audit.md)
