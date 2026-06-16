# Ed-Fi Admin App — Windows IIS Installation Scripts

Automates the gaps in the official [Windows IIS Installation docs](https://docs.ed-fi.org/reference/admin-app/getting-started/windows-iis-installation). Designed to run on a clean Windows VM and produce a working Admin App at `http://localhost:4200/` with no manual workarounds.

Local dev runs over **HTTP** (no TLS): the API and the frontend deploy as two independent IIS sites, `http://localhost:3333` (API) and `http://localhost:4200` (FE). See [What these scripts don't do](#what-these-scripts-dont-do) for the TLS trade-off.

---

## Getting the scripts onto the VM

The scripts live in this repo. On a fresh VM, get the source there first by either:

- `git clone https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp.git C:\Ed-Fi\Ed-Fi-AdminApp` (needs Git — install manually with `winget install --id Git.Git -e`, or use the ZIP option below), **or**
- Download the repo as a ZIP from GitHub and extract to `C:\Ed-Fi\Ed-Fi-AdminApp`. `setup-vm-prereqs.ps1` will install Git for you afterwards.

Then open an **elevated PowerShell** and `cd C:\Ed-Fi\Ed-Fi-AdminApp\windows-install`.

## Before you start

- **Windows 10/11 Pro or Windows Server 2016+**, with **administrator rights** (every command runs in an *elevated* PowerShell). The standalone-site environment variables require **IIS 10 or newer**.
- **Internet access** — the scripts download Node, Keycloak, and npm packages.
- **~10 GB free disk**.
- **Docker Desktop** — *only* if you use `-UsePostgresDocker` or `-SetupYopassDocker`. It must be **installed, running, and in Linux-container mode**. The pre-flight check verifies this when those flags are set; without them, Docker isn't needed at all.
- **Allow 15–20 minutes** for a fresh end-to-end install (the build phase alone takes several minutes).
- The passwords below are **yours to choose** — wherever you see `'your-…'`, replace it with a password you pick.

## Quick start (local Keycloak)

`install-all.ps1` is the "run everything" path. Pick the identity provider with the mandatory **`-IdpProvider`** (`keycloak` | `microsoft` | `google` | `other`). `keycloak` stands up a local Keycloak as the example IdP; for an external provider see [Other identity providers](#other-identity-providers).

```powershell
# One-time bypass to let the first script run
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# 1. OS prereqs (IIS, SQL Server, Git). ONLY on a fresh VM. Scans before it
#    installs, so re-running on a prepared VM is a no-op. Reboot if winget asks.
.\setup-vm-prereqs.ps1

# 2. Full Admin App install (local Keycloak). The pre-flight check tells you if
#    step 1 was actually needed.
.\install-all.ps1 -IdpProvider keycloak -SaPassword 'your-sa-password' -KeycloakAdminPassword 'your-keycloak-admin-password' -OidcClientSecret 'your-client-secret' -TestUserPassword 'your-keycloak-user-password'
```

When `install-all.ps1` finishes, open `http://localhost:4200/` and sign in with `admin@example.com` (or whatever you passed to `-AdminUsername`) and your `-TestUserPassword`. A green `INSTALL COMPLETE` banner and a written `install-summary.txt` (in the parent of the repo dir, e.g. `C:\Ed-Fi\install-summary.txt`) confirm success.

### Notes on the parameters

- **`-SaPassword`**: SQL Server `sa` login password. Any string works (the script sets `CHECK_POLICY = OFF`).
- **`-IdpProvider`** *(mandatory)*: `keycloak` | `microsoft` | `google` | `other`. `keycloak` runs the local example IdP; the others target an external OIDC provider (see [Other identity providers](#other-identity-providers)).
- **`-OidcClientSecret`** *(all modes)*: the OIDC client secret. For `keycloak` it's the secret set on the `edfiadminapp` client (you pick it, 32+ chars recommended); for external providers it's the secret from your app registration.
- **`-KeycloakAdminPassword`** *(keycloak only)*: Password for the master-realm admin user auto-created when Keycloak first starts.
- **`-TestUserPassword`** *(keycloak only)*: Password for the seeded `admin@example.com` user in the `edfi` realm — what you type on the Keycloak login screen.

#### Database engine selection

- **`-DbEngine`**: `mssql` (default) or `pgsql`. Drives the database prereq path and how `production.js` gets patched. Everything else is identical.

---

## The scripts

Numbered scripts map to the official guide's section order. The **generic path** (00–06) is all the Admin App itself needs; the **local IdP example** (`idp-keycloak-*`) is optional.

### Generic path

| Script | Purpose |
|---|---|
| `00-check-prereqs.ps1` | Read-only diagnostic. `[PASS]`/`[FAIL]`/`[INFO]`/`[RISK]` per prereq. `[RISK]` flags collisions with existing software (shared SQL instance, older `java` on PATH, ports 3333/4200 in use). Exit 0 = clean, 1 = blocking, 2 = ready-with-risks. |
| `01-prereqs-iis.ps1` | URL Rewrite Module + iisnode install; unlocks `handlers` and the `HTTP_X_ORIGINAL_URL` server variable. No cert, no HTTPS binding. |
| `02-prereqs-sql.ps1` | SQL Server config: Mixed Mode + TCP/IP + `sa` login + creates the `sbaa` database. |
| `03-prereqs-node.ps1` | Node.js install (if missing) and nvm-windows remediation of a too-old version. No Java, no Keycloak. |
| `04-build.ps1` | `npm ci --legacy-peer-deps`, then `build:api` and `build:fe`. Seeds `packages\fe\.env` (VITE_*) before building. Skips if artifacts are current (override with `-Force`). |
| `05-deploy-api.ps1` | Deploys the API to the standalone HTTP site `EdFi-AdminApp-API` (port 3333). Seeds/patches `production.js`, writes `web.config`, configures the App Pool, and sets `NPM_CONFIG_CACHE` on the App Pool. |
| `06-deploy-fe.ps1` | Deploys the FE to the standalone HTTP site `EdFi-AdminApp-FE` (port 4200) with a SPA-fallback `web.config`. |

### Local IdP example (optional — Keycloak)

| Script | Purpose |
|---|---|
| `idp-keycloak-setup.ps1` | One run = a ready local Keycloak: installs a JDK if needed, downloads Keycloak, starts it (via `idp-keycloak-start.ps1`), then provisions the `edfi` realm, `edfiadminapp` client, and test user. |
| `idp-keycloak-start.ps1` | Starts Keycloak in the background (bootstraps the master admin on first run, waits for readiness). Use to relaunch after a reboot. |

### Transversal

| Script | Purpose |
|---|---|
| `setup-vm-prereqs.ps1` | OS-level installs only: IIS features, SQL Server Developer, Git. Scans first, installs only what's missing. |
| `install-all.ps1` | Master orchestrator. Pick the IdP with `-IdpProvider` (keycloak/microsoft/google/other). Pre-flight check + all phases + smoke test. |
| `yopass-docker.ps1` | Optional. Stands up a local Yopass + memcached stack via `docker\docker-compose.yopass.yml`. Only runs with `install-all -SetupYopassDocker` (or directly). |
| `uninstall.ps1` | Reverses the generic install: IIS sites/App Pool/files, the `sbaa` DB, docker Postgres + Yopass stacks, `C:\npm-cache`. Detects Keycloak leftovers and suggests `uninstall-keycloak.ps1` (does not touch them). Per-step OK/SKIP/WARN/FAIL ledger. |
| `uninstall-keycloak.ps1` | Tears down the local Keycloak IdP: stops the process, deletes the install dir, unsets `JAVA_HOME`. Leaves the JDK install in place. |

### Per-section mapping to the official guide

| Guide section/step | Script(s) |
|---|---|
| Prereqs: IIS + URL Rewrite + iisnode | `01-prereqs-iis.ps1` |
| Prereqs: Node.js | `03-prereqs-node.ps1` |
| Prereqs: SQL Server / PostgreSQL (+ `sbaa`) | `02-prereqs-sql.ps1` |
| Prereqs: Identity Provider | `idp-keycloak-setup.ps1` (local example) or your own IdP |
| Backend API → build | `04-build.ps1` (also builds the FE) |
| Backend API → deploy (site, web.config, handler mappings, App Pool, dirs) | `05-deploy-api.ps1` (handler-mapping unlock done by `01-prereqs-iis.ps1`) |
| Frontend → configure `.env` + build | `04-build.ps1` (Vite bakes vars at **build** time, not deploy) |
| Frontend → deploy (site, SPA rewrite) | `06-deploy-fe.ps1` |

> The guide's "configure Handler Mappings manually in IIS Manager" step is automated: `01-prereqs-iis.ps1` unlocks the `handlers` section and `05-deploy-api.ps1` declares the `iisnode` handler in `web.config`.

---

## Other identity providers

The Admin App's auth engine is provider-agnostic (generic OIDC discovery). Keycloak is only the example IdP. To use an external provider, run `install-all.ps1` with `-IdpProvider microsoft | google | other`: it deploys everything and **skips** the local Keycloak step, configuring the API against your provider instead.

```powershell
.\install-all.ps1 -IdpProvider microsoft `
  -SaPassword 'your-sa-password' `
  -OidcIssuer 'https://login.microsoftonline.com/<tenant-id>/v2.0' `
  -OidcClientId '<application-id>' `
  -OidcClientSecret 'your-client-secret' `
  -AdminUsername 'you@yourtenant.onmicrosoft.com'
```

- `keycloak`/`google` default `-OidcIssuer`; `microsoft`/`other` require it. `-ViteIdpAccountUrl` is defaulted per provider (`other` requires it). `-OidcScope` defaults to `openid email profile`.
- **Where to find `-OidcIssuer`:** for Entra, the App Registration → *Endpoints* → "OpenID Connect metadata document" URL, minus the trailing `/.well-known/openid-configuration` (typically `https://login.microsoftonline.com/<tenant-id>/v2.0`). For Google it's `https://accounts.google.com` (the default).
- **You register the OIDC client yourself** in the provider's portal (no script can provision Entra/Google). `install-all` validates the issuer's discovery endpoint and prints the URIs to register: redirect `http://localhost:3333/api/auth/callback/1`, post-logout `http://localhost:3333/api/auth/post-logout`, origin `http://localhost:4200`.
- A user must exist in the provider whose **email/username claim equals `-AdminUsername`** — the script seeds that user in the `[user]` table with the admin role, but the identity lives in your IdP. (Entra's email-claim handling is a known gotcha.)

You can also drive the per-section scripts manually (`00`→`06`), passing `-Oidc*` to `05-deploy-api.ps1` and `-ViteIdpAccountUrl` to `04-build.ps1`.

---

## Uninstalling

```powershell
.\uninstall.ps1                                       # prompts before doing anything
.\uninstall.ps1 -SaPassword 'your-sa-password' -Force # SQL Auth to drop the DB + non-interactive
.\uninstall.ps1 -KeepDatabase -KeepNpmCache           # selective teardown

.\uninstall-keycloak.ps1                              # remove the local Keycloak IdP (separate)
```

`uninstall.ps1` covers the generic install and, at the end, flags any Keycloak leftovers and points you at `uninstall-keycloak.ps1`. See `Get-Help .\uninstall.ps1 -Full` / `Get-Help .\uninstall-keycloak.ps1 -Full` for all flags.

---

## What `install-all.ps1` does, in order

1. **Node runtime** (`03-prereqs-node.ps1`) — installs/remediates Node up front (idempotent), so a stale Node doesn't fail the pre-flight.
2. **Pre-flight check** (`00-check-prereqs.ps1`) — aborts on FAIL; prompts on RISK (unless `-AcceptRisks`). Skipped with `-SkipPreflightCheck`.
3. **Phase 1 — prereqs**: database (mssql Mixed Mode + TCP/IP + `sbaa`, or pgsql/docker) and IIS (`01-prereqs-iis.ps1`). Optional Yopass docker with `-SetupYopassDocker`.
4. **Phase 2 — build** (`04-build.ps1`): `npm ci` + `build:api` + `build:fe`.
5. **Phase 3 — deploy**: `idp-keycloak-setup.ps1` (JDK + Keycloak download + start + realm/client/user), then `05-deploy-api.ps1` and `06-deploy-fe.ps1`.
6. **Smoke test**: hits `http://localhost:3333/api/teams` (expects 401), waits for the `[user]` table, and ensures the admin user has `roleId=2`.
7. **Writes** `install-summary.txt` in the parent of the repo directory.

Re-running on a working install is mostly a no-op — most steps detect existing state and skip.

### Re-run flags

- `-OnlyPhase1` — stop after prereqs
- `-SkipPhase1` — prereqs already done
- `-SkipPhase2` — build artifacts already present
- `-SkipPreflightCheck` — skip `00-check-prereqs`
- `-AcceptRisks` — bypass the y/N confirmation on `[RISK]` items (non-interactive)
- `-AutoUpgradeNode` — when `03-prereqs-node.ps1` finds a too-old Node, skip its y/N prompt and remediate via nvm-windows automatically

### Advanced flags

- **Yopass** (one-time-sharing of newly-created Ed-Fi API client credentials): **disabled** by default; `-YopassUrl '<url>'` to use an existing Yopass; `-SetupYopassDocker` to stand one up locally (`-YopassPort`, default 8082). The two are mutually exclusive. See the [Yopass administrator's guide](https://docs.ed-fi.org/reference/admin-app/system-administrators/yopass-administrators-guide/).
- `-IncludeAudienceMapper` — adds a Keycloak audience mapper; only needed for direct bearer-token API access (Postman/curl/CI). The browser login flow doesn't need it.
- `-EnableDirectAccessGrants` — enables the OAuth password grant on the Keycloak client. **Testing only.**

---

## End-state URLs

- **Admin App (FE)**: `http://localhost:4200/`
- **API**: `http://localhost:3333/`
- **Keycloak admin console**: `http://localhost:8080/admin/`
- **Keycloak `edfi` realm**: `http://localhost:8080/realms/edfi/`

---

## Known issues / things to know

### Keycloak bootstrap admin is first-run only

`KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD` are honored only the **first time** Keycloak starts against an empty data directory. Re-running later with a different `-KeycloakAdminPassword` leaves the existing master admin unchanged and provisioning fails to authenticate. `idp-keycloak-setup.ps1` detects this (`invalid_grant`) and prints recovery options:

- **A:** Re-run with the original admin password.
- **B:** Wipe Keycloak state and bootstrap fresh (loses realm/client/user — recreated automatically):

```powershell
.\uninstall-keycloak.ps1 -Force
.\install-all.ps1 ... -KeycloakAdminPassword '<new-pw>' -SkipPhase1
```

`-OidcClientSecret` and `-TestUserPassword` are idempotently updatable on every re-run.

### Rate limit can trip during heavy debugging

Default in `production.js` is 10 requests / 60s. Recycle the App Pool to clear state, or bump it for dev:

```powershell
$f = "C:\inetpub\EdFi-AdminApp-API\packages\api\config\production.js"
(Get-Content $f -Raw).Replace("RATE_LIMIT_LIMIT: 10,", "RATE_LIMIT_LIMIT: 1000,") | Set-Content $f -Encoding UTF8
Restart-WebAppPool -Name "EdFi-AdminApp-API"
```

### npm cache is scoped to the App Pool

`05-deploy-api.ps1` sets `NPM_CONFIG_CACHE` on the `EdFi-AdminApp-API` App Pool's environment (not machine-wide) and grants that identity write access, so npm under iisnode has a writable cache without affecting other npm usage on the machine. Requires IIS 10+.

### iisnode is unmaintained

iisnode v0.2.26 (2020) is the latest release. Works with Node 22+, but won't get upstream fixes.

### Node version requirement

`package.json` declares `engines.node: ">=22.0.0"` (practical floor ~22.12+). `03-prereqs-node.ps1` reads `engines.node` at runtime and tracks whatever the repo declares. If a too-old Node is found, it sets up nvm-windows + installs the latest patch on the required major; if AV/EDR consumes the nvm-extracted files, it **falls back to a direct download from nodejs.org**.

### What these scripts don't do

- **Local TLS / HTTPS** — local dev is HTTP only (two standalone sites on 3333/4200). There is no self-signed cert or 443 binding. Front the sites with TLS (a reverse proxy or real certs) for anything beyond local dev.
- **Production hardening** — real certs, secrets management, log rotation, etc. The optional dockerized Yopass runs HTTP-only behind localhost and is not production-hardened.
- **Keycloak as a Windows service** — started via `Start-Process`. Use `nssm` or a service wrapper to survive reboots.
- **Secret rotation** — not enabled; the AdminApp has no automation to pick up rotated secrets.

---

## Defaults

| Parameter | Default |
| --- | --- |
| `-DbEngine` | `mssql` |
| `-SourcePath` | Parent of `windows-install\` (typically `C:\Ed-Fi\Ed-Fi-AdminApp`) |
| `-DatabaseName` | `sbaa` |
| `-AdminUsername` | `admin@example.com` |
| `-PostgresHost` / `-PostgresPort` / `-PostgresAppUser` | `localhost` / `5432` / `edfiadminapp` *(pgsql only)* |

Per-script parameters (ports, OIDC settings, Keycloak install path, etc.) have defaults documented in each script's `param()` block — run `Get-Help .\<script>.ps1 -Full`.
