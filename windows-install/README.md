# Ed-Fi Admin App — Windows IIS Installation Scripts

Automates the gaps in the official [Windows IIS Installation docs](https://docs.ed-fi.org/reference/admin-app/system-administrators/installing#windows-iis-installation). Designed to run on a clean Windows VM and produce a working Admin App at `https://localhost/adminapp/` with no manual workarounds.

---

## Getting the scripts onto the VM

The scripts live in this repo. On a fresh VM, get the source there first by either:

- `git clone https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp.git C:\Ed-Fi\Ed-Fi-AdminApp` (needs Git — install manually with `winget install --id Git.Git -e`, or use the ZIP option below), **or**
- Download the repo as a ZIP from GitHub and extract to `C:\Ed-Fi\Ed-Fi-AdminApp`. `setup-vm-prereqs.ps1` will install Git for you afterwards.

Then open an **elevated PowerShell** and `cd C:\Ed-Fi\Ed-Fi-AdminApp\windows-install`.

## Before you start

- **Windows 10/11 Pro or Windows Server**, with **administrator rights** (every command below runs in an *elevated* PowerShell — right-click → "Run as administrator").
- **Internet access** — the scripts download Node, Keycloak, and npm packages.
- **~10 GB free disk**.
- **Allow 15–20 minutes** for a fresh end-to-end install (the build phase alone takes several minutes).
- The passwords below are **yours to choose** — wherever you see `'your-…'`, replace it with a password you pick. SQL Server doesn't enforce complexity here (the script sets `CHECK_POLICY = OFF`), but pick something you'd be willing to reuse.

## Quick start

```powershell
# One-time bypass to let the first script run
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# 1. OS prereqs (IIS, SQL Server, Git). ONLY on a fresh VM — skip this if
#    IIS features, SQL Server, and Git are already installed. The script
#    scans before it installs, so re-running on a prepared VM is a no-op
#    but takes a minute. Reboot if winget asks.
.\setup-vm-prereqs.ps1

# 2. Full Admin App install. The pre-flight check at the start will tell
#    you if step 1 was actually needed (it FAILs with a clear message if
#    IIS / SQL / Git are missing).
.\install-all.ps1 -SaPassword 'your-sa-password' -KeycloakAdminPassword 'your-keycloak-admin-password' -KeycloakClientSecret 'your-keycloak-client-secret' -TestUserPassword 'your-keycloak-user-password'
```

On an already-prepared VM (IIS features enabled, SQL Server running, Git installed), step 1 is optional — `install-all.ps1` alone is enough. If anything's missing, the pre-flight will fail with a pointer to `setup-vm-prereqs.ps1`.

When `install-all.ps1` finishes, open `https://localhost/adminapp/` in the VM's browser and sign in with `admin@example.com` (or whatever you passed to `-AdminUsername`) and the password you passed to `-TestUserPassword`. A green `INSTALL COMPLETE` banner and a written `install-summary.txt` (in the parent of the repo dir, e.g. `C:\Ed-Fi\install-summary.txt`) confirm success.

A summary with all URLs and credentials is saved to `install-summary.txt` in the parent of the repo directory (e.g. `C:\Ed-Fi\install-summary.txt` for the default clone path).

### Notes on the parameters

- **`-SaPassword`**: SQL Server `sa` login password. Any string works (the script disables Windows password policy with `CHECK_POLICY = OFF`).
- **`-KeycloakAdminPassword`**: Password for the master-realm admin user that gets auto-created when Keycloak first starts.
- **`-KeycloakClientSecret`**: Secret for the `edfiadminapp` Keycloak client. Keycloak itself accepts any non-empty string, but **32+ alphanumeric characters is recommended** for entropy. The same value goes into both Keycloak and `production.js`.
- **`-TestUserPassword`**: Password for the seeded `admin@example.com` user in the `edfi` realm. This is what you type on the Keycloak login screen to enter the AdminApp.

#### Database engine selection

- **`-DbEngine`**: `mssql` (default) or `pgsql`. Drives which Phase 1.1 path runs and how `production.js` gets patched. Everything else (IIS, Node, Keycloak, build, deploy) is identical between the two.

| Script | Purpose |
|---|---|
| `setup-vm-prereqs.ps1` | OS-level installs only: IIS features, SQL Server Developer, Git. Scans first, then installs only what's missing. |
| `install-all.ps1` | Master orchestrator. Verifies the repo location, runs the pre-flight check, then all install phases. |
| `00-check-prereqs.ps1` | Read-only diagnostic. Reports `[PASS]` / `[FAIL]` / `[INFO]` / `[RISK]` for each prereq. `[RISK]` items flag collisions with existing software (shared SQL instance, non-21 `java` on PATH, another site on :443, etc.). Exit 0 = clean, 1 = blocking, 2 = ready-with-risks. `install-all` runs this as its first step and prompts on exit 2. |
| `00a-fix-node.ps1` | Guided Node upgrade helper. No-op when Node is missing or already at the floor; otherwise prompts to install nvm-windows + Node LTS, keeping the previous version recoverable via `nvm install <ver>`. `install-all` runs this before `00-check-prereqs` so a stale Node doesn't fail the pre-flight. |
| `01-prereqs-sql.ps1` | SQL Server config: Mixed Mode + TCP/IP + `sa` login + creates `sbaa` database. |
| `02-prereqs-iis.ps1` | URL Rewrite + iisnode install. Unlocks `handlers` and `HTTP_X_ORIGINAL_URL`. Generates self-signed cert and binds HTTPS:443 to the `Ed-Fi` site. |
| `03a-prereqs-runtime.ps1` | Node.js install (if missing). For Java: uses any existing JDK ≥17 already on PATH (respects users on JDK 25/26); only installs OpenJDK 21 if Java is missing or older than 17. npm cache override. Keycloak download to `C:\keycloak`. |
| `03b-keycloak-start.ps1` | Starts Keycloak in the background with `KC_BOOTSTRAP_ADMIN_*` env vars so the master admin is auto-created on first run. Waits for readiness. |
| `03c-build-project.ps1` | `npm ci --legacy-peer-deps`, then `build:api` and `build:fe`. Skips if artifacts are already current (override with `-Force`). |
| `04-deploy-api.ps1` | Deploys the API to `C:\inetpub\Ed-Fi\adminapp-api` as an IIS application under the `Ed-Fi` site. Seeds `production.js` from the `-edfi` template, patches it with bare-metal values, writes `web.config` with the right iisnode + URL rewrite setup, sets App Pool config and permissions. |
| `05-deploy-fe.ps1` | Deploys the FE to `C:\inetpub\Ed-Fi\adminapp` as an IIS application under the `Ed-Fi` site with a SPA-fallback `web.config`. |
| `06-keycloak-bootstrap.ps1` | Creates the `edfi` realm, the `edfiadminapp` client (with all the required URIs/origins), and the test user. |
| `uninstall.ps1` | Reverses the install: stops Keycloak, tears down IIS App Pool / site / bindings / deployed files, removes the self-signed cert, drops the `sbaa` DB, deletes `C:\keycloak` + `C:\npm-cache`, unsets `JAVA_HOME` and `NPM_CONFIG_CACHE`. Leaves Node.js, JDK, SQL Server, IIS engine, URL Rewrite, iisnode, and the source repo alone. Best-effort with a per-step OK/SKIP/WARN/FAIL ledger and a final summary. |

---

## Uninstalling

To roll back an install on the same VM:

```powershell
.\uninstall.ps1                                          # Windows Auth to drop the DB; prompts before doing anything
.\uninstall.ps1 -SaPassword 'your-sa-password' -Force    # SQL Auth + non-interactive
.\uninstall.ps1 -KeepDatabase -KeepKeycloakDownload      # selective teardown
```

After uninstall, **open a fresh PowerShell window** before re-running `install-all.ps1` so the cleared `JAVA_HOME` / `NPM_CONFIG_CACHE` env vars are picked up.

See `Get-Help .\uninstall.ps1 -Full` for the full flag list (`-KeepDatabase`, `-KeepKeycloakDownload`, `-KeepNpmCache`, `-KeepCert`, `-RemoveSummary`, etc.).

---

## What `install-all.ps1` does, in order

1. **Sanity-check the source path** — verifies `$SourcePath\package.json` exists. Default `-SourcePath` auto-resolves to the parent of `windows-install\`.
2. **Node version check** (`00a-fix-node.ps1`) — no-op when Node is missing or already at the floor; otherwise prompts to upgrade via nvm-windows. Skipped with `-SkipPreflightCheck`.
3. **Pre-flight check** (`00-check-prereqs.ps1`) — aborts on FAIL; prompts on RISK (unless `-AcceptRisks`).
4. **Phase 1**: SQL config + creates `sbaa`; IIS prereqs + cert + HTTPS binding; Node + JDK + npm cache override + Keycloak download.
**Phase 1.1**: database prereqs.
   - `-DbEngine mssql` -> SQL Server Mixed Mode + TCP/IP + `sa` + creates `sbaa`.
   - `-DbEngine pgsql -UsePostgresDocker` -> writes `docker\.env` from your args, runs `docker compose up -d`, waits for `pg_isready`.
   - `-DbEngine pgsql` without `-UsePostgresDocker` -> no DB action; you're expected to point `-PostgresHost`/`-PostgresPort` at an existing Postgres.
5. **Phase 2**: `npm ci` + builds; start Keycloak detached with bootstrap admin.
6. **Phase 3**: Keycloak realm/client/user; deploy API; deploy FE.
7. **Smoke test**: hits `https://localhost/adminapp-api/api/teams` (expects 401).
8. **Post-install**: waits for `[user]` table to exist, ensures admin user with `roleId=2` (idempotent INSERT-or-UPDATE).
9. **Writes** `install-summary.txt` in the parent of the repo directory, with URLs and credentials.

Re-running on a working install is mostly a no-op — most steps detect existing state and skip.

### Re-run flags

- `-OnlyPhase1` — stop after the OS-prereq phase
- `-SkipPhase1` — prereqs already done
- `-SkipPhase2` — build artifacts and Keycloak already in place
- `-SkipPreflightCheck` — skip `00-check-prereqs` (useful when debugging a partial install)
- `-AcceptRisks` — bypass the y/N confirmation when `00-check-prereqs` flags `[RISK]` items (collisions with existing software). Use only after reviewing the risks; intended for non-interactive runs.
- `-AutoUpgradeNode` — when `00a-fix-node.ps1` finds a too-old Node on PATH, skip its y/N prompt and proceed with the nvm-windows + Node LTS setup automatically. For non-interactive runs.

### Advanced flags

You don't need any of these for a working AdminApp install — they enable integrations and Keycloak features used by specific testing or production setups.

- `-YopassUrl '<url>'` — point the AdminApp at a pre-existing Yopass service for one-time-sharing of newly-created Ed-Fi API client credentials. Default is empty: Yopass is disabled and credentials are shown inline (the AdminApp's documented fallback when `USE_YOPASS=false`). The install scripts do not stand up Yopass for you — pass a URL only if a deployment already exists.
- `-IncludeAudienceMapper` — adds a Keycloak protocol mapper that injects `aud: "edfiadminapp-api"` into access tokens. Needed only for **direct bearer-token API access** (Postman / curl / CI hitting the API with a Keycloak-issued token, where the API enforces audience). The browser UI login flow doesn't need this — the AdminApp validates `client_id`, not `aud`.
- `-EnableDirectAccessGrants` — enables the OAuth password grant on the Keycloak client, letting you POST username+password to Keycloak's token endpoint directly without the OIDC redirect flow. Useful for scripted API tests; explicitly an anti-pattern in production. **Testing only.**

---

## End-state URLs

- **Admin App**: `https://localhost/adminapp/`
- **API**: `https://localhost/adminapp-api/`
- **Keycloak admin console**: `http://localhost:8080/admin/` (HTTP, not proxied — by design for the default install)
- **Keycloak `edfi` realm**: `http://localhost:8080/realms/edfi/`

---

## Known issues / things to know

### Keycloak bootstrap admin is first-run only

`KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD` are only honored the **first time** Keycloak starts against an empty data directory. If you re-run `install-all.ps1` later with a different `-KeycloakAdminPassword`, the existing master admin is unchanged and script 06 will fail to authenticate.

`06-keycloak-bootstrap.ps1` detects this case (`invalid_grant` on the admin token request) and prints the recovery options inline. The two paths are:

- **A:** Re-run with the original admin password.
- **B:** Wipe Keycloak state and bootstrap fresh (loses realm/client/user — `install-all` recreates them automatically):

```powershell
Stop-Process -Name java -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force C:\keycloak\data
.\install-all.ps1 ... -KeycloakAdminPassword '<new-pw>' -SkipPhase1
```

Unlike the admin password, `-KeycloakClientSecret` and `-TestUserPassword` are **idempotently updatable** via the admin REST API on every re-run — mismatches there are benign (the values just get reset to whatever you passed).

### Rate limit can trip during heavy debugging

Default in `production.js` is 10 requests per 60 seconds. If you hit it, recycle the App Pool to clear state:

```powershell
Restart-WebAppPool -Name "EdFi-AdminApp-API"
```

For dev convenience, bump it to 1000:

```powershell
$f = "C:\inetpub\Ed-Fi\adminapp-api\packages\api\config\production.js"
(Get-Content $f -Raw).Replace("RATE_LIMIT_LIMIT: 10,", "RATE_LIMIT_LIMIT: 1000,") | Set-Content $f -Encoding UTF8
Restart-WebAppPool -Name "EdFi-AdminApp-API"
```

### Self-signed cert

The HTTPS cert at port 443 is self-signed, generated by `02-prereqs-iis.ps1`, and added to the LocalMachine Trusted Root store. If the browser still warns after install, fully close and reopen it.

### iisnode is unmaintained

iisnode v0.2.26 (2020) is the latest release. Works with the current required Node (22+), but won't get bug fixes upstream.

### Node version requirement

The AdminApp's `package.json` declares `engines.node: ">=22.0.0"`, and transitive deps push the practical floor to **22.12+**. `00a-fix-node.ps1` reads `engines.node` at runtime and tracks whatever the repo declares — bumping the AdminApp's requirement automatically updates the script's floor.

If a too-old Node is detected, `00a-fix-node.ps1` offers to set up nvm-windows + install the latest patch on the required major. nvm-windows occasionally reports "Installation complete" while AV/EDR silently consumes the extracted files; the script detects this (no `vX.Y.Z\` directory appeared in nvm's root) and **falls back to a direct download from `nodejs.org`** without user intervention.

### What these scripts don't do

- **Cert distribution** beyond the local machine — clients on other machines won't trust the cert.
- **Production hardening** — these target a local dev install. Production would want real certs, Yopass for credential sharing, secrets management, log rotation, etc.
- **Keycloak as a Windows service** — started in the background via `Start-Process`. To survive a reboot, use `nssm` or another service wrapper.
- **Secret rotation** — Keycloak supports client-secret rotation as a preview feature; it's not enabled here. The AdminApp doesn't have automation to pick up rotated secrets, so enabling rotation without that complementary work would break login when the old secret expires.

---

## Defaults

Most paths and URLs have sensible defaults you can override on `install-all.ps1`:

| Parameter             | Default                                                    |
| --------------------- | ---------------------------------------------------------- |
| `-DbEngine`           | `mssql`                                                    |
| `-SourcePath`         | Auto-resolved to parent of `windows-install\` (typically `C:\Ed-Fi\Ed-Fi-AdminApp`) |
| `-DatabaseName`       | `sbaa`                                                     |
| `-AdminUsername`      | `admin@example.com`                                        |
| `-PostgresHost`       | `localhost` *(pgsql only)*                                 |
| `-PostgresPort`       | `5432` *(pgsql only)*                                      |
| `-PostgresAppUser`    | `edfiadminapp` *(pgsql only; matches the docker init script)* |

Per-script parameters (cert hostnames, Keycloak install path, ports, etc.) all have defaults documented in each script's `param()` block — run `Get-Help .\<script>.ps1 -Full` for the full list.
