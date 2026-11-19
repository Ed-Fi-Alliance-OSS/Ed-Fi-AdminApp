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

- `check-ignored-vuln-fixes.ps1` — Reports whether any GHSA ID ignored in `osv-scanner.toml` (the `[[IgnoredVulns]]` entries that suppress OpenSSF Scorecard's "Vulnerabilities" check) now has an upstream fix. Reads the GHSA IDs straight out of `osv-scanner.toml`, resolves each affected package's version(s) from `package-lock.json`, and checks a patched version is reachable (the latest published npm CLI release for packages bundled inside npm itself, or the latest registry release otherwise) before comparing against the GitHub Security Advisories API. Prints a status table and exits non-zero if any entry can now be removed. Read-only — never modifies `osv-scanner.toml`, `package.json`, or `package-lock.json`. Also runs as an informational (non-blocking) step in `.github/workflows/scorecard.yml`.

  ```powershell
  pwsh ./eng/helpers/check-ignored-vuln-fixes.ps1
  ```

  Requirements: `npm` on PATH (queries the registry and unpacks the `npm` CLI package to inspect its bundled dependencies); network access to the npm registry and `api.github.com`. Optionally pass `-GitHubToken` (or set `$env:GITHUB_TOKEN`/`$env:GH_TOKEN`) to raise the unauthenticated GitHub API rate limit.

### `eng\testing`

- `run-bruno.ps1` — Main runner for Bruno API tests, including optional service startup, auth bootstrap, token acquisition, and collection/request filters.
- `run-e2e-ui.ps1` — Main runner for the Playwright BDD UI E2E suite. Checks prerequisites (Node dependencies, Playwright Chromium, TLS certificate), downloads the ODS Minimal Template backup (cached after the first run), regenerates `compose/.env` (patching it for SQL Server when `-DbEngine mssql` is used), starts Docker Compose services via `start-services-target.ps1`, waits for the Admin App API/frontend/Keycloak (and, for MSSQL, the Admin App database) to be ready, creates the local Keycloak test user, and runs `npm run test:e2e:bdd`. Supports `-DbEngine <pgsql|mssql>` to choose the Admin App's database engine (default `pgsql`; ODS/API databases always stay on PostgreSQL), `-Rebuild` to rebuild images first, and `-StopServices` to tear down the stack after the run, `-SkipV1` to skip the Ed-Fi v6 topology and `@v1` scenarios, `-KeepEnvFile` to reuse the existing `compose/.env`, and `-ServiceStartTimeoutMinutes` to bound image pull/start (default 20). Note: unless `-KeepEnvFile` is passed, this script regenerates `compose/.env` from `compose/.env.example` on every run, overwriting any local customizations you may have made to `compose/.env`.

  ```powershell
  pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild -StopServices
  ```

For full usage, flags, and troubleshooting:
- `run-bruno.ps1` — see [API Bruno E2E Tests](testing/README.md#api-bruno-e2e-tests)
- `run-e2e-ui.ps1` — see [UI Playwright E2E Tests](testing/README.md#ui-playwright-e2e-tests)

### `eng\release`

Scripts behind the `pack`, `attest` and `validate-packages` jobs in `.github/workflows/on-prerelease.yml`. They run the same way locally, so release changes can be tested before they reach GitHub. Requirements: PowerShell 7, Node.js (see `.nvmrc`), the .NET SDK (for `minver-cli`, installed on first use) and, for `verify-attestations.ps1`, the GitHub CLI (`gh`). Build output goes to `dist/release`.

- `build-packages.ps1` — Computes the version with MinVer (or takes `-Version`), runs `npm ci` (skip with `-SkipInstall`), builds the API and FrontEnd, and packs `dist/release/AdminApp.Api-<version>.tgz` and `dist/release/AdminApp.FrontEnd-<version>.tgz`. Reverts the `package.json` version changes after packing.
- `new-sbom.ps1` — Generates the SPDX 2.2 SBOM for the tarballs with `sbom-tool` and writes `dist/release/_manifest/` and `dist/release/AdminApp.SBOM.zip`. Fails if `sbom-tool` exits non-zero, or if the manifest is missing, invalid JSON, has no root package, or lists fewer than `-MinDependencies` (default 10) dependencies. Downloads the self-contained `sbom-tool` release binary (pinned version, sha256-checked, cached in the temp folder), so it does not need .NET. The SBOM covers the whole monorepo lockfile, devDependencies included, not only what ships in the tarballs.
- `collect-release-assets.ps1` — Gathers the tarballs, SBOM zip and attestation bundles into `release-assets/`, naming the bundles `<PackageName>.provenance.sigstore.json` and `<PackageName>.SBOM.sigstore.json`.
- `verify-attestations.ps1` — Runs `gh attestation verify` for the provenance and SBOM predicates of each package. Each check requires the attestation to be signed by `on-prerelease.yml` in `-Repository` and, in CI, built from the triggering ref (`-SignerWorkflow`, `-SourceRef`). Checks against the attestations API are retried; pass both `-ProvenanceBundle` and `-SbomBundle` to check the bundles attached to a release instead.
- `tests/run-tests.ps1` — Runs the Pester tests for these scripts (installs the pinned Pester version if needed). `sbom-tool` and `gh` are stubbed, so no network access or token is needed. Runs in CI as the `Release Script Tests` job.

```powershell
# Build, pack and generate the SBOM locally
pwsh ./eng/release/build-packages.ps1 -Version 0.0.0-local.1
pwsh ./eng/release/new-sbom.ps1 -Version 0.0.0-local.1

# Verify tarballs downloaded from a release against its bundles (quote the glob so
# PowerShell expands it, not your shell)
pwsh ./eng/release/verify-attestations.ps1 -PackagePath './AdminApp.*.tgz' -Repository Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp `
  -ProvenanceBundle ./AdminApp.provenance.sigstore.json -SbomBundle ./AdminApp.SBOM.sigstore.json

# Run the tests
pwsh ./eng/release/tests/run-tests.ps1
```

Attestations themselves are only created in GitHub Actions (`actions/attest` needs the workflow's OIDC token).

#### Testing the release workflow on a fork

1. Enable Actions on the fork, and merge the change to a branch there.
2. Create a pre-release on the fork whose tag targets that branch. A release runs the workflow from the tagged commit.
3. `pack`, `attest`, `validate-packages` and `release-assets` run as they do upstream, and the packages, SBOM zip and bundles are attached to the fork's release. Check them with `verify-attestations.ps1 -Repository <you>/Ed-Fi-AdminApp`.
4. `docker-publish` only runs in the `Ed-Fi-Alliance-OSS` organization, because it needs the organization's Docker Hub secrets. On a fork it is skipped, and the run summary says so.

Notes:

- Artifact attestations need a public repository (or GitHub Enterprise Cloud for a private one), so test on a public fork.
- Re-running a failed `release-assets` job replaces the assets already attached (`gh release upload --clobber`).

### `eng` (top level)

- `lint-workflows.ps1` — Lints `.github/workflows` with `actionlint`, downloading the pinned release (sha256-checked) on first use. Shell scripts in `run:` steps are also checked when `shellcheck` is installed. Runs in CI as the `Workflow Lint` job.

  ```powershell
  pwsh ./eng/lint-workflows.ps1
  ```
