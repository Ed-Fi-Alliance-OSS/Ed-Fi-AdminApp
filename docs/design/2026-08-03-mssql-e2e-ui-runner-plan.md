# MSSQL-Capable Playwright E2E Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single reusable `eng/testing/run-e2e-ui.ps1` script that provisions the stack (PostgreSQL or SQL Server for the Admin App database) and runs the Playwright BDD E2E suite, then wire CI to use it against both engines.

**Architecture:** `start-services-target.ps1` moves from `eng/github-actions` to `eng/helpers` (it's a general-purpose helper, not CI-specific). The new `run-e2e-ui.ps1` orchestrates: preflight checks → download ODS Minimal Template backup (skip if cached) → regenerate and, for `-DbEngine mssql`, patch `compose/.env` → start services via `start-services-target.ps1` → wait for readiness → create the local Keycloak test user → run `npm run test:e2e:bdd` → optionally stop services. `run-e2e-ui.yml` gets a `db-engine: [pgsql, mssql]` matrix and calls the script once per engine on isolated runner VMs.

**Tech Stack:** PowerShell 7 (`pwsh`), Docker Compose, Playwright + playwright-bdd, GitHub Actions.

## Global Constraints

- Spec: `docs/design/2026-08-03-mssql-e2e-ui-runner-design.md`. All parameter names, step order, and file paths below come from that spec verbatim — don't rename anything without updating the spec.
- The Bruno API E2E suite (`eng/testing/run-bruno.ps1`) is untouched by this work.
- ODS/API databases (v6, odsV7-adminV2, odsV7-adminV3) always run on PostgreSQL regardless of `-DbEngine` — only the Admin App's own database engine changes. Do not touch `compose/DB-Ods` or the ODS backup package name.
- No automated test framework exists for these `.ps1` scripts in this repo (none of `eng/helpers/*.ps1` or `eng/testing/*.ps1` have unit tests). Verification for each task is a real manual invocation with concrete expected output, matching how `run-bruno.ps1` and `start-services-target.ps1` are verified today — not a mocked unit test.
- All scripts in this repo use `$ErrorActionPreference = 'Stop'` plus `$LASTEXITCODE` checks after `&`-invoking nested `.ps1` files (see `run-bruno.ps1`). Follow the same convention — don't introduce a different error-handling style.

---

### Task 1: Relocate `start-services-target.ps1` to `eng/helpers`

**Files:**
- Move: `eng/github-actions/start-services-target.ps1` → `eng/helpers/start-services-target.ps1`
- Delete: `eng/github-actions/README.md`, then the now-empty `eng/github-actions/` folder
- Modify: `eng/README.md`
- Modify: `.github/workflows/run-e2e-ui.yml:97` (path only — the rest of this file is rewritten in Task 7)

**Interfaces:**
- Produces: `eng/helpers/start-services-target.ps1` — same CLI surface as before: `-Target <v6|odsV7-adminV2|odsV7-adminV3>[]`, `-V6`, `-OdsV7AdminV2`, `-OdsV7AdminV3`, `-MSSQL`, `-Rebuild`, `-IncludeAdminApp` switches. No internal code changes; `$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)` still resolves to the repo root since `eng/helpers` is one level under `eng/`, same as `eng/github-actions` was.

- [ ] **Step 1: Move the script with git so history is preserved**

```bash
git mv eng/github-actions/start-services-target.ps1 eng/helpers/start-services-target.ps1
```

- [ ] **Step 2: Fold the github-actions README content into `eng/README.md`, then delete the old folder**

Replace the full contents of `eng/README.md` with:

```markdown
# Engineering Scripts

This folder contains local engineering and test automation scripts used by Admin App contributors.

## Folder Contents

### `eng\helpers`

- `bootstrap-keycloak-for-tests.ps1` — Bootstraps Keycloak clients/users and can seed test data used by API test flows.
- `create-local-user-keycloak.ps1` — Creates/updates a local Keycloak user for development scenarios.
- `start-all-services-test-docker.ps1` — Starts local Docker services required for API test runs.
- `get-bruno-token.ps1` — Requests an OAuth token from Keycloak container.
- `start-services-target.ps1` — Starts the Docker Compose services required for Admin App development and E2E execution. Selects one or more Ed-Fi target topologies (`v6`, `odsV7-adminV2`, `odsV7-adminV3`), optionally includes Admin App containers, and can rebuild images before startup. Supports `-MSSQL` to use SQL Server instead of PostgreSQL for the Admin App database.

  ```powershell
  pwsh ./eng/helpers/start-services-target.ps1 -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild
  ```

  Requirements: Docker must be installed and running; `compose/.env` must exist before the script runs; run it from a clone of the repository so relative paths resolve correctly.

### `eng\testing`

- `run-bruno.ps1` — Main runner for Bruno API tests, including optional service startup, auth bootstrap, token acquisition, and collection/request filters.
- `run-e2e-ui.ps1` — Main runner for the Playwright BDD UI E2E suite. Downloads the ODS Minimal Template backup, starts Docker Compose services (PostgreSQL or SQL Server for the Admin App database via `-DbEngine`), creates the local Keycloak test user, and runs the suite.

For full usage, flags, and troubleshooting for `run-bruno.ps1`, see [API Bruno E2E Tests](testing/README.md).
```

```bash
git rm eng/github-actions/README.md
rmdir eng/github-actions
```

- [ ] **Step 3: Update the path reference in the CI workflow**

In `.github/workflows/run-e2e-ui.yml`, find:

```yaml
          ../eng/github-actions/start-services-target.ps1 -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild
```

Replace with:

```yaml
          ../eng/helpers/start-services-target.ps1 -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild
```

(This whole step block is replaced wholesale in Task 7 — this is a minimal fix so the workflow still works if this task is committed on its own.)

- [ ] **Step 4: Verify the moved script still runs**

Run (requires Docker running, from repo root):

```powershell
pwsh ./eng/helpers/start-services-target.ps1 -IncludeAdminApp
```

Expected: `Starting Docker Compose services with profile postgresql for targets none (Admin App only)...` followed by `Services started successfully!`, with no path-resolution errors. Stop it afterward: `pwsh ./compose/stop.ps1`.

- [ ] **Step 5: Commit**

```bash
git add eng/helpers/start-services-target.ps1 eng/README.md .github/workflows/run-e2e-ui.yml
git commit -m "Move start-services-target.ps1 from eng/github-actions to eng/helpers"
```

---

### Task 2: Scaffold `run-e2e-ui.ps1` with parameters and preflight checks

**Files:**
- Create: `eng/testing/run-e2e-ui.ps1`

**Interfaces:**
- Produces: `run-e2e-ui.ps1` accepting `-DbEngine <pgsql|mssql>` (default `pgsql`), `-Rebuild` (switch), `-StopServices` (switch). Defines `$repoRoot` (absolute path to repo root) and a `Test-Prerequisites` function used by later tasks — no parameters, throws nothing, calls `exit 1` directly if prerequisites are missing.

- [ ] **Step 1: Create the file with the header, params, and preflight function**

```powershell
# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Runs the Playwright BDD E2E UI test suite against a freshly provisioned stack.

.DESCRIPTION
Downloads the ODS Minimal Template backup (if missing), starts Docker Compose
services (PostgreSQL or SQL Server for the Admin App database), waits for
readiness, creates the local Keycloak test user, and runs the Playwright BDD
suite.

.PARAMETER DbEngine
Admin App database engine: 'pgsql' or 'mssql'. Defaults to 'pgsql'.

.PARAMETER Rebuild
Rebuild Admin App images before starting services.

.PARAMETER StopServices
Stop Docker Compose services after the test run (success or failure).

.EXAMPLE
./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild -StopServices
#>

param(
  [ValidateSet('pgsql', 'mssql')]
  [string]$DbEngine = 'pgsql',
  [switch]$Rebuild,
  [switch]$StopServices
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Test-Prerequisites {
  $missing = @()

  if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
    $missing += 'node_modules not found. Run: npm ci --legacy-peer-deps'
  }

  $playwrightBrowsersPath = if ($env:PLAYWRIGHT_BROWSERS_PATH) {
    $env:PLAYWRIGHT_BROWSERS_PATH
  } else {
    Join-Path $env:USERPROFILE '.cache\ms-playwright'
  }
  $chromiumInstalled = $false
  if (Test-Path $playwrightBrowsersPath) {
    $chromiumInstalled = @(Get-ChildItem -Path $playwrightBrowsersPath -Directory -Filter 'chromium-*' -ErrorAction SilentlyContinue).Count -gt 0
  }
  if (-not $chromiumInstalled) {
    $missing += 'Playwright Chromium browser not found. Run: npx playwright install --with-deps chromium'
  }

  $certPath = Join-Path $repoRoot 'compose\ssl\server.crt'
  if (-not (Test-Path $certPath)) {
    $missing += 'Local TLS certificate not found at compose/ssl/server.crt. Run: bash ./compose/ssl/generate-certificate.sh'
  }

  if ($missing.Count -gt 0) {
    Write-Host 'ERROR! Missing prerequisites:' -ForegroundColor Red
    foreach ($item in $missing) {
      Write-Host "  - $item" -ForegroundColor Red
    }
    exit 1
  }
}

Test-Prerequisites
Write-Host 'All prerequisites satisfied.' -ForegroundColor Green
```

- [ ] **Step 2: Verify the missing-prerequisite path**

Temporarily rename `node_modules` to force a failure:

```powershell
Rename-Item node_modules node_modules.bak
pwsh ./eng/testing/run-e2e-ui.ps1
```

Expected: exits with code 1 and prints `ERROR! Missing prerequisites:` followed by a line naming `node_modules` and the `npm ci` command. Then restore:

```powershell
Rename-Item node_modules.bak node_modules
```

- [ ] **Step 3: Verify the happy path**

```powershell
pwsh ./eng/testing/run-e2e-ui.ps1
```

Expected: prints `All prerequisites satisfied.` and exits 0 (assuming deps/browsers/cert are already present locally, as required by earlier project setup).

- [ ] **Step 4: Commit**

```bash
git add eng/testing/run-e2e-ui.ps1
git commit -m "Scaffold run-e2e-ui.ps1 with parameters and preflight checks"
```

---

### Task 3: Add ODS Minimal Template backup download

**Files:**
- Modify: `eng/testing/run-e2e-ui.ps1`

**Interfaces:**
- Consumes: `$repoRoot` from Task 2.
- Produces: `Get-OdsMinimalTemplateBackup` function (no params) — ensures `compose/db-backup/EdFi.Ods.Minimal.Template.sql` and `compose/db-backup/EdFi.Ods.Populated.Template.sql` exist, downloading and extracting the NuGet package only if either is missing.

- [ ] **Step 1: Add the function and call it after the prerequisites check**

Replace:

```powershell
Test-Prerequisites
Write-Host 'All prerequisites satisfied.' -ForegroundColor Green
```

with:

```powershell
function Get-OdsMinimalTemplateBackup {
  $backupDir = Join-Path $repoRoot 'compose\db-backup'
  $minimalSqlPath = Join-Path $backupDir 'EdFi.Ods.Minimal.Template.sql'
  $populatedSqlPath = Join-Path $backupDir 'EdFi.Ods.Populated.Template.sql'

  if ((Test-Path $minimalSqlPath) -and (Test-Path $populatedSqlPath)) {
    Write-Host 'ODS Minimal Template backup already present, skipping download.' -ForegroundColor Cyan
    return
  }

  $packageName = 'EdFi.Suite3.Ods.Minimal.Template.PostgreSQL.Standard.4.0.0'
  $packageVersion = '7.3.20068'
  $feedUrl = "https://pkgs.dev.azure.com/ed-fi-alliance/Ed-Fi-Alliance-OSS/_packaging/EdFi/nuget/v3/flat2/$packageName/$packageVersion/$packageName.$packageVersion.nupkg"

  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

  Write-Host "Downloading $packageName v$packageVersion..." -ForegroundColor Cyan
  $nupkgPath = Join-Path $backupDir 'package.nupkg'
  $zipPath = Join-Path $backupDir 'package.zip'
  $pkgDir = Join-Path $backupDir 'pkg'

  Invoke-WebRequest -Uri $feedUrl -OutFile $nupkgPath
  Copy-Item -Path $nupkgPath -Destination $zipPath -Force
  Expand-Archive -Path $zipPath -DestinationPath $pkgDir -Force

  $srcSql = Get-ChildItem -Path $pkgDir -Filter '*.sql' -Recurse | Select-Object -First 1
  if (-not $srcSql) {
    throw 'ERROR: No .sql file found inside the NuGet package'
  }
  Write-Host "Found: $($srcSql.FullName)" -ForegroundColor Cyan

  Copy-Item -Path $srcSql.FullName -Destination $minimalSqlPath -Force
  Copy-Item -Path $minimalSqlPath -Destination $populatedSqlPath -Force

  Remove-Item -Path $nupkgPath, $zipPath -Force
  Remove-Item -Path $pkgDir -Recurse -Force

  Write-Host "Backup files ready in $backupDir" -ForegroundColor Green
}

Test-Prerequisites
Get-OdsMinimalTemplateBackup
```

- [ ] **Step 2: Verify the download path**

Temporarily move any existing backup files aside, then run:

```powershell
Rename-Item compose/db-backup compose/db-backup.bak -ErrorAction SilentlyContinue
pwsh ./eng/testing/run-e2e-ui.ps1
```

Expected: prints `Downloading EdFi.Suite3.Ods.Minimal.Template.PostgreSQL.Standard.4.0.0 v7.3.20068...`, then `Found: ...`, then `Backup files ready in ...`. Confirm both files now exist:

```powershell
Test-Path compose/db-backup/EdFi.Ods.Minimal.Template.sql
Test-Path compose/db-backup/EdFi.Ods.Populated.Template.sql
```

Expected: both `True`.

- [ ] **Step 3: Verify the skip-if-cached path**

Run again immediately:

```powershell
pwsh ./eng/testing/run-e2e-ui.ps1
```

Expected: prints `ODS Minimal Template backup already present, skipping download.` and does not re-download.

If you had a prior `compose/db-backup.bak` from Step 2, remove the new one and restore the original: `Remove-Item compose/db-backup -Recurse -Force; Rename-Item compose/db-backup.bak compose/db-backup`.

- [ ] **Step 4: Commit**

```bash
git add eng/testing/run-e2e-ui.ps1
git commit -m "Add ODS Minimal Template backup download to run-e2e-ui.ps1"
```

---

### Task 4: Add `.env` setup and MSSQL patch logic

**Files:**
- Modify: `eng/testing/run-e2e-ui.ps1`

**Interfaces:**
- Consumes: `$repoRoot`, `$DbEngine` from Task 2.
- Produces: `Set-AdminAppEnvFile` function taking `-Engine <pgsql|mssql>` — regenerates `compose/.env` from `compose/.env.example` and, for `mssql`, patches `DB_ENGINE`, uncomments the `MSSQL_*` lines, sets `MSSQL_SA_PASSWORD`, and swaps the active `DB_SECRET_VALUE` line.

- [ ] **Step 1: Add the function and call it**

Replace:

```powershell
Test-Prerequisites
Get-OdsMinimalTemplateBackup
```

with:

```powershell
Test-Prerequisites
Get-OdsMinimalTemplateBackup

function Set-AdminAppEnvFile {
  param(
    [ValidateSet('pgsql', 'mssql')]
    [string]$Engine
  )

  $envExamplePath = Join-Path $repoRoot 'compose\.env.example'
  $envPath = Join-Path $repoRoot 'compose\.env'

  Copy-Item -Path $envExamplePath -Destination $envPath -Force

  if ($Engine -ne 'mssql') {
    return
  }

  $mssqlPassword = 'YourStrong!Passw0rd'
  $content = Get-Content -Path $envPath

  $content = $content | ForEach-Object {
    switch -Regex ($_) {
      '^DB_ENGINE=pgsql$' { 'DB_ENGINE=mssql' }
      '^# MSSQL_PORT_EXPOSED=1433$' { 'MSSQL_PORT_EXPOSED=1433' }
      '^# MSSQL_ACCEPT_EULA=Y$' { 'MSSQL_ACCEPT_EULA=Y' }
      '^# MSSQL_SA_PASSWORD=.*$' { "MSSQL_SA_PASSWORD=$mssqlPassword" }
      '^# MSSQL_IMAGE_TAG=2022-latest$' { 'MSSQL_IMAGE_TAG=2022-latest' }
      '^DB_SECRET_VALUE=\{"DB_HOST".*$' { "# $_" }
      '^# DB_SECRET_VALUE=\{"MSSQL_DB_HOST".*$' {
        ($_ -replace '^# ', '') -replace '"MSSQL_DB_PASSWORD":"[^"]*"', "`"MSSQL_DB_PASSWORD`":`"$mssqlPassword`""
      }
      default { $_ }
    }
  }

  Set-Content -Path $envPath -Value $content
  Write-Host "compose/.env patched for MSSQL (DB_ENGINE=mssql)." -ForegroundColor Cyan
}

Set-AdminAppEnvFile -Engine $DbEngine
```

- [ ] **Step 2: Verify the pgsql path**

```powershell
pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine pgsql
Select-String -Path compose/.env -Pattern '^DB_ENGINE='
```

Expected: `DB_ENGINE=pgsql`.

- [ ] **Step 3: Verify the mssql path**

```powershell
pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine mssql
Select-String -Path compose/.env -Pattern '^DB_ENGINE=|^MSSQL_SA_PASSWORD=|^MSSQL_PORT_EXPOSED=|^DB_SECRET_VALUE='
```

Expected output includes:
```
DB_ENGINE=mssql
MSSQL_PORT_EXPOSED=1433
MSSQL_SA_PASSWORD=YourStrong!Passw0rd
DB_SECRET_VALUE={"MSSQL_DB_HOST":"edfiadminapp-mssql","MSSQL_DB_PORT":1433,"MSSQL_DB_USERNAME":"sa","MSSQL_DB_PASSWORD":"YourStrong!Passw0rd","MSSQL_DB_DATABASE":"sbaa"}
```
and the PostgreSQL `DB_SECRET_VALUE` line is now commented out (`Select-String -Path compose/.env -Pattern '^# DB_SECRET_VALUE=\{"DB_HOST"'` should match).

- [ ] **Step 4: Commit**

```bash
git add eng/testing/run-e2e-ui.ps1
git commit -m "Add .env setup and MSSQL patch logic to run-e2e-ui.ps1"
```

---

### Task 5: Add service startup and readiness wait

**Files:**
- Modify: `eng/testing/run-e2e-ui.ps1`

**Interfaces:**
- Consumes: `$repoRoot`, `$DbEngine`, `$Rebuild` from Task 2; `eng/helpers/start-services-target.ps1` from Task 1.
- Produces: `Wait-ForAdminAppReadiness` function (no params) — polls until the Admin App API, FE, Keycloak metadata, and Keycloak login are stable for 3 consecutive checks, or throws after 90 attempts (~4.5 minutes at 3s intervals).

- [ ] **Step 1: Add the function and the service-startup call**

Replace:

```powershell
Set-AdminAppEnvFile -Engine $DbEngine
```

with:

```powershell
Set-AdminAppEnvFile -Engine $DbEngine

function Wait-ForAdminAppReadiness {
  $apiUrl = 'https://localhost/adminapp-api/api/healthcheck'
  $feUrl = 'https://localhost/adminapp/'
  $keycloakUrl = 'https://localhost/auth/realms/edfi/.well-known/openid-configuration'
  $keycloakLoginUrl = 'https://localhost/auth/realms/edfi/protocol/openid-connect/auth?client_id=edfiadminapp&redirect_uri=https%3A%2F%2Flocalhost%2Fadminapp-api%2Fapi%2Fauth%2Fcallback%2F1&response_type=code&scope=openid%20profile%20email'

  $requiredStableChecks = 3
  $stableChecks = 0

  for ($i = 1; $i -le 90; $i++) {
    $apiOk = $false
    $feOk = $false
    $keycloakOk = $false
    $keycloakLoginOk = $false

    try { if ((Invoke-WebRequest -Uri $apiUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $apiOk = $true } } catch {}
    try { if ((Invoke-WebRequest -Uri $feUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $feOk = $true } } catch {}
    try { if ((Invoke-WebRequest -Uri $keycloakUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $keycloakOk = $true } } catch {}
    try {
      $loginResponse = Invoke-WebRequest -Uri $keycloakLoginUrl -SkipCertificateCheck -UseBasicParsing
      if ($loginResponse.Content -match 'kc-form-login') { $keycloakLoginOk = $true }
    } catch {}

    if ($apiOk -and $feOk -and $keycloakOk -and $keycloakLoginOk) {
      $stableChecks++
      Write-Host "Readiness OK ($stableChecks/$requiredStableChecks)" -ForegroundColor Green
    } else {
      $stableChecks = 0
      Write-Host "Waiting... API=$apiOk FE=$feOk KEYCLOAK_META=$keycloakOk KEYCLOAK_LOGIN=$keycloakLoginOk ($i/90)" -ForegroundColor Yellow
    }

    if ($stableChecks -ge $requiredStableChecks) {
      Write-Host 'Admin App API, FE, and Keycloak metadata/login are stable' -ForegroundColor Green
      return
    }

    Start-Sleep -Seconds 3
  }

  throw 'Timed out waiting for stable Admin App services'
}

& (Join-Path $repoRoot 'eng\helpers\start-services-target.ps1') -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild:$Rebuild -MSSQL:($DbEngine -eq 'mssql')
if ($LASTEXITCODE -ne 0) { throw 'Failed to start Docker Compose services.' }

Wait-ForAdminAppReadiness
```

- [ ] **Step 2: Verify against PostgreSQL**

```powershell
pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine pgsql -Rebuild
```

Expected: Docker Compose services start, then `Waiting...` lines appear until 3 consecutive `Readiness OK` lines print, ending with `Admin App API, FE, and Keycloak metadata/login are stable`. Then stop services manually: `pwsh ./compose/stop.ps1`.

- [ ] **Step 3: Verify against SQL Server**

```powershell
pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild
```

Expected: same readiness output as Step 2, confirming the Admin App API comes up correctly against the `edfiadminapp-mssql` container. Then stop services manually: `pwsh ./compose/stop.ps1`.

- [ ] **Step 4: Commit**

```bash
git add eng/testing/run-e2e-ui.ps1
git commit -m "Add service startup and readiness wait to run-e2e-ui.ps1"
```

---

### Task 6: Add Keycloak user creation, Playwright run, and cleanup

**Files:**
- Modify: `eng/testing/run-e2e-ui.ps1`

**Interfaces:**
- Consumes: `$repoRoot`, `$StopServices` from Task 2; `eng/helpers/create-local-user-keycloak.ps1` (unchanged); `npm run test:e2e:bdd` (from `package.json:22`); `compose/stop.ps1` (unchanged).
- Produces: the script's final exit code equals the Playwright run's exit code (0 on success, non-zero on failure or timeout).

- [ ] **Step 1: Wrap the remaining steps in try/finally and add the final exit code**

Replace:

```powershell
Wait-ForAdminAppReadiness
```

with:

```powershell
Wait-ForAdminAppReadiness

$testExitCode = 1
try {
  & (Join-Path $repoRoot 'eng\helpers\create-local-user-keycloak.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create local Keycloak user.' }

  Push-Location $repoRoot
  npm run test:e2e:bdd
  $testExitCode = $LASTEXITCODE
  Pop-Location
}
finally {
  if ($StopServices) {
    Write-Host 'Stopping Docker Compose services...' -ForegroundColor Cyan
    & (Join-Path $repoRoot 'compose\stop.ps1')
  }
}

exit $testExitCode
```

- [ ] **Step 2: Full local run against PostgreSQL**

```powershell
pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine pgsql -Rebuild -StopServices
```

Expected: preflight passes → backup download/skip → `.env` regenerated with `DB_ENGINE=pgsql` → services start and become ready → Keycloak test user created → `npm run test:e2e:bdd` runs the full Playwright BDD suite and all tests pass → `Stopping Docker Compose services...` prints and containers are stopped (`docker ps` shows none of the Admin App stack running afterward) → script exits 0.

- [ ] **Step 3: Full local run against SQL Server**

```powershell
pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild -StopServices
```

Expected: identical flow to Step 2, but `.env` has `DB_ENGINE=mssql` and the Admin App API connects to `edfiadminapp-mssql`; the full Playwright BDD suite passes against the SQL-Server-backed Admin App database; services stop at the end; script exits 0.

- [ ] **Step 4: Commit**

```bash
git add eng/testing/run-e2e-ui.ps1
git commit -m "Add Keycloak user creation, Playwright run, and cleanup to run-e2e-ui.ps1"
```

---

### Task 7: Update CI workflow to a pgsql/mssql matrix

**Files:**
- Modify: `.github/workflows/run-e2e-ui.yml`

**Interfaces:**
- Consumes: `eng/testing/run-e2e-ui.ps1 -DbEngine <pgsql|mssql> -Rebuild -StopServices` from Task 6.

- [ ] **Step 1: Replace the full workflow file**

Replace the entire contents of `.github/workflows/run-e2e-ui.yml` with:

```yaml
# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

name: UI Playwright E2E

on:
  workflow_dispatch:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
    branches: [main, 'patch-v*']
    paths:
      - .github/workflows/run-e2e-ui.yml
      - tests/e2e/**
      - playwright.config.ts
      - package.json
      - package-lock.json
      - compose/**
      - eng/helpers/**
      - eng/testing/**
      - packages/api/**
      - packages/fe/**

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  playwright-e2e:
    runs-on: ubuntu-latest
    defaults:
      run:
        shell: bash
    strategy:
      fail-fast: false
      matrix:
        db-engine: [pgsql, mssql]

    steps:
      - name: Checkout code
        uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3

      - name: Setup Node (from .nvmrc)
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
        with:
          node-version-file: '.nvmrc'
          cache: npm

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Install Playwright browser dependencies
        run: npx playwright install --with-deps chromium

      - name: Create local TLS certificate
        working-directory: ./compose/ssl
        run: bash ./generate-certificate.sh

      - name: Run E2E UI tests
        shell: pwsh
        env:
          CI: true
          PLAYWRIGHT_CHROMIUM_ARGS: --ignore-certificate-errors
        run: ./eng/testing/run-e2e-ui.ps1 -DbEngine ${{ matrix.db-engine }} -Rebuild -StopServices

      - name: Upload Allure and JUnit results
        if: always()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: e2e-allure-results-${{ matrix.db-engine }}
          path: test-results
          retention-days: 5
```

- [ ] **Step 2: Verify YAML is well-formed**

```powershell
node -e "const fs=require('fs'); const yaml=require('js-yaml'); yaml.load(fs.readFileSync('.github/workflows/run-e2e-ui.yml','utf8')); console.log('OK')"
```

Expected: prints `OK`. (If `js-yaml` isn't resolvable at the top level, run `npm ls js-yaml` to find its installed path, or install it ad hoc with `npm install --no-save js-yaml` before running the check, then it's safe to leave uninstalled afterward since it's not added to `package.json`.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/run-e2e-ui.yml
git commit -m "Run UI Playwright E2E workflow against both pgsql and mssql via matrix"
```

- [ ] **Step 4: Push and confirm both matrix jobs pass in CI**

Push the branch and either open/update a PR or trigger `workflow_dispatch` manually. Expected: two parallel jobs, `playwright-e2e (pgsql)` and `playwright-e2e (mssql)`, both complete successfully, each uploading its own `e2e-allure-results-pgsql` / `e2e-allure-results-mssql` artifact.

---

## Self-Review Notes

- **Spec coverage:** §1 (file moves) → Task 1. §2 (script parameters, preflight, ODS backup, env setup, service startup, readiness wait, Keycloak user, Playwright run, cleanup) → Tasks 2–6. §3 (CI matrix, artifact naming) → Task 7. §4 (testing/validation plan) → verification steps embedded in Tasks 2, 3, 5, 6, 7. §5 is explicitly future work and has no task, by design.
- **Type/name consistency:** `$DbEngine` / `-DbEngine` (script param) matches `${{ matrix.db-engine }}` (workflow matrix key) passed positionally as the CLI value — the workflow's `db-engine` (kebab-case, GitHub Actions convention) and the script's `-DbEngine` (PascalCase, PowerShell convention) are intentionally different spellings for the same value, not a typo. `Set-AdminAppEnvFile`, `Get-OdsMinimalTemplateBackup`, `Wait-ForAdminAppReadiness`, `Test-Prerequisites` are each defined once (Tasks 2–5) and called once, in the same order they're defined in the final file.
