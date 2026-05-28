#Requires -RunAsAdministrator
<#
.SYNOPSIS
Master installer for the Ed-Fi Admin App on Windows IIS. Fully automated.

Runs in three phases with no manual interaction required.

  Phase 1 — Prereqs
    01-prereqs-sql.ps1        SQL Server Mixed Mode + TCP/IP + sa
    02-prereqs-iis.ps1        iisnode + HTTPS cert + binding
    03a-prereqs-runtime.ps1    Node.js + npm cache override + Keycloak download

  Phase 2 — Build and start
    03c-build-project.ps1     npm ci + build:api + build:fe (slow)
    03b-keycloak-start.ps1    Bootstrap admin via env vars; start Keycloak detached;
                              wait for readiness

  Phase 3 — Deploy
    06-keycloak-bootstrap.ps1 Realm + client + user (+ audience mapper)
    04-deploy-api.ps1         Deploy API to IIS
    05-deploy-fe.ps1          Deploy FE to IIS

Re-run modes:
  Default               Run all three phases end-to-end
  -SkipPhase1           Skip prereqs (already done)
  -SkipPhase2           Skip build + Keycloak start (artifacts and Keycloak already up)
  -OnlyPhase1           Run prereqs only

If you'd rather build manually or run Keycloak in a foreground terminal, use
-SkipPhase2 and handle those yourself before re-running with -SkipPhase1
-SkipPhase2.

.PARAMETER DbEngine
'mssql' (default) or 'pgsql'. Drives which DB prereq path runs and how
production.js gets patched. 'mssql' requires -SaPassword. 'pgsql' requires
-PostgresAppPassword.

.PARAMETER UsePostgresDocker
Switch. When -DbEngine is 'pgsql', also start the docker-compose Postgres in
windows-install\docker\ before deploying. Generates a docker .env from the
postgres defaults in production.js-edfi + the passwords you provide.

.PARAMETER PostgresAppPassword
Required when -DbEngine is 'pgsql'. Becomes ADMIN_APP_DB_PASSWORD in the
docker .env (when -UsePostgresDocker) and DB_PASSWORD in production.js.

.PARAMETER PostgresSuperuserPassword
Required when -UsePostgresDocker is set. Becomes POSTGRES_PASSWORD in the
docker .env -- used only by docker-entrypoint and the init script that
provisions the dedicated app user.

.PARAMETER PostgresHost / -PostgresPort / -PostgresAppUser
PostgreSQL connection details written into production.js. Defaults match the
docker-compose setup ('localhost', 5432, 'edfiadminapp').

.PARAMETER SaPassword
SQL Server sa password. Required when -DbEngine is 'mssql' (the default).

.PARAMETER KeycloakAdminPassword
Password for the master-realm Keycloak admin user. Used as the bootstrap admin
when Keycloak starts for the first time (script 03b). Subsequent runs of
Keycloak ignore this — make sure it matches an admin that actually exists.

.PARAMETER KeycloakClientSecret
Secret to set on the edfiadminapp Keycloak client. You pick this.

.PARAMETER TestUserPassword
Password for the seeded test user.

.PARAMETER SourcePath
Path to the cloned Ed-Fi-AdminApp repo. Defaults to the parent of the script
directory — i.e., the scripts live in <repo>\windows-install\ and the repo
root is one level up. Override only if your layout differs.

.PARAMETER DatabaseName
SQL Server database name. Default: sbaa. Propagated to 01 (creates the DB) and
04 (patches MSSQL_DB_DATABASE in production.js).

.PARAMETER AdminUsername
Email seeded as the admin user. Default: admin@example.com.

.PARAMETER JdkDownloadUrl
Optional URL to an OpenJDK zip — phase 1 will install + set JAVA_HOME.

.PARAMETER IncludeAudienceMapper
Switch — add the Keycloak audience mapper (needed for bearer-token API access).

.PARAMETER EnableDirectAccessGrants
Switch — enable password grant on the Keycloak client (testing only).

.PARAMETER AcceptRisks
Switch — bypass the y/N confirmation when 00-check-prereqs flags collision
risks (e.g., another app sharing the SQL instance, a non-OpenJDK-21 'java' on
PATH, another IIS site bound to :443). Use for non-interactive runs only after
reviewing the [RISK] items.

.PARAMETER AutoUpgradeNode
Switch — when 00a-fix-node.ps1 detects a too-old Node on PATH, skip the y/N
confirmation and proceed with nvm-windows + Node LTS setup automatically.
For non-interactive runs. Passed through as -AssumeYes to 00a-fix-node.ps1.

.PARAMETER YopassUrl
URL of an EXISTING Yopass service to use for sharing newly-created Ed-Fi API
client credentials. Default empty — Yopass is disabled and the AdminApp falls
back to displaying credentials inline (a supported AdminApp configuration).
Pass e.g. -YopassUrl 'http://yopass.internal:8082' to enable it against a
pre-existing deployment. Mutually exclusive with -SetupYopassDocker.

.PARAMETER SetupYopassDocker
Switch — stand up a local Yopass service (Yopass + memcached) via the bundled
docker\docker-compose.yopass.yml during phase 1, then point the AdminApp at it
(USE_YOPASS=true, YOPASS_URL=http://localhost:<YopassPort>). Requires Docker
Desktop. Mutually exclusive with -YopassUrl. This is the "set up Yopass for me"
path; without either flag Yopass stays disabled.

.PARAMETER YopassPort
Host port to publish the dockerized Yopass on when -SetupYopassDocker is set.
Default 8082. Becomes the YOPASS_URL the API is configured with.

.EXAMPLE
# MSSQL (default)
.\install-all.ps1 `
  -SaPassword 'EdFi-Local!2026' `
  -KeycloakAdminPassword 'admin' `
  -KeycloakClientSecret 'YOUR_CHOSEN_CLIENT_SECRET' `
  -TestUserPassword 'TestUser123!'

.EXAMPLE
# PostgreSQL via the bundled docker-compose
.\install-all.ps1 `
  -DbEngine pgsql `
  -UsePostgresDocker `
  -PostgresSuperuserPassword 'PgSuper!2026' `
  -PostgresAppPassword 'PgApp!2026' `
  -KeycloakAdminPassword 'admin' `
  -KeycloakClientSecret 'YOUR_CHOSEN_CLIENT_SECRET' `
  -TestUserPassword 'TestUser123!'

.EXAMPLE
# MSSQL + stand up a local dockerized Yopass for one-time credential links
.\install-all.ps1 `
  -SaPassword 'EdFi-Local!2026' `
  -KeycloakAdminPassword 'admin' `
  -KeycloakClientSecret 'YOUR_CHOSEN_CLIENT_SECRET' `
  -TestUserPassword 'TestUser123!' `
  -SetupYopassDocker

.EXAMPLE
# Use an EXISTING Yopass deployment instead of standing one up
.\install-all.ps1 `
  -SaPassword 'EdFi-Local!2026' `
  -KeycloakAdminPassword 'admin' `
  -KeycloakClientSecret 'YOUR_CHOSEN_CLIENT_SECRET' `
  -TestUserPassword 'TestUser123!' `
  -YopassUrl 'http://yopass.internal:8082'
#>

param(
    [ValidateSet('mssql','pgsql')]
    [string]$DbEngine = 'mssql',
    [switch]$UsePostgresDocker,

    [string]$SaPassword,
    [string]$PostgresAppPassword,
    [string]$PostgresSuperuserPassword,
    [string]$PostgresHost = "localhost",
    [int]$PostgresPort = 5432,
    [string]$PostgresAppUser = "edfiadminapp",

    [Parameter(Mandatory = $true)]
    [string]$KeycloakAdminPassword,

    [Parameter(Mandatory = $true)]
    [string]$KeycloakClientSecret,

    [Parameter(Mandatory = $true)]
    [string]$TestUserPassword,

    [string]$SourcePath = (Split-Path $PSScriptRoot -Parent),
    [string]$DatabaseName = "sbaa",
    [string]$AdminUsername = "admin@example.com",
    [string]$JdkDownloadUrl,

    [switch]$IncludeAudienceMapper,
    [switch]$EnableDirectAccessGrants,

    [switch]$SkipPhase1,
    [switch]$SkipPhase2,
    [switch]$OnlyPhase1,
    [switch]$SkipPreflightCheck,
    [switch]$AcceptRisks,
    [switch]$AutoUpgradeNode,

    # Yopass: three modes.
    #   (neither flag)        -> disabled, USE_YOPASS=false (credentials inline)
    #   -YopassUrl <url>      -> enable against an existing Yopass
    #   -SetupYopassDocker    -> stand up a local Yopass via docker, auto-URL
    [string]$YopassUrl = "",
    [switch]$SetupYopassDocker,
    [int]$YopassPort = 8082
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot

# Engine-specific required-arg validation. SaPassword was previously a top-level
# Mandatory parameter; it's now conditionally required so the same script can
# drive either engine without prompting for irrelevant credentials.
if ($DbEngine -eq 'mssql' -and -not $SaPassword) {
    throw "-SaPassword is required when -DbEngine is 'mssql' (the default)."
}
if ($DbEngine -eq 'pgsql' -and -not $PostgresAppPassword) {
    throw "-PostgresAppPassword is required when -DbEngine is 'pgsql'."
}
if ($UsePostgresDocker -and $DbEngine -ne 'pgsql') {
    throw "-UsePostgresDocker only applies when -DbEngine is 'pgsql'."
}
if ($UsePostgresDocker -and -not $PostgresSuperuserPassword) {
    throw "-PostgresSuperuserPassword is required when -UsePostgresDocker is set."
}
# Yopass: -SetupYopassDocker (stand one up) and -YopassUrl (use an existing one)
# are two ways to set the same YOPASS_URL, so they can't both be given.
if ($SetupYopassDocker -and $YopassUrl) {
    throw "-SetupYopassDocker and -YopassUrl are mutually exclusive: the first stands up a Yopass and derives its URL, the second points at an existing one. Pass at most one (or neither, to leave Yopass disabled)."
}
# Resolve the effective YOPASS_URL up front so phase 3 can configure the API
# regardless of which phases run. -SetupYopassDocker implies http://localhost:<port>;
# the actual container is brought up in phase 1 below.
$EffectiveYopassUrl = if ($SetupYopassDocker) { "http://localhost:$YopassPort" } else { $YopassUrl }

function Write-Phase {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
}

# Sanity-check that $SourcePath looks like an AdminApp repo before we try to
# build / deploy from it. The user got the scripts by cloning (or unzipping)
# the repo, so this should always pass on the default; only fires if someone
# overrode -SourcePath to a wrong directory.
if (-not (Test-Path "$SourcePath\package.json")) {
    throw "Expected AdminApp repo at '$SourcePath' but no package.json found. Pass -SourcePath if the repo is elsewhere."
}

# Pre-flight: run 00-check-prereqs.ps1 to validate manual prereqs are in place.
# Exit codes from 00:
#   0 = clean
#   1 = blocking FAIL items, install must not proceed
#   2 = ready, but [RISK] items present (collisions with existing software);
#       prompt the user to confirm unless -AcceptRisks was passed
if (-not $SkipPreflightCheck) {
    # Node version remediation runs BEFORE the diagnostic so a stale Node 16
    # doesn't fail the pre-flight on a fixable issue. 00a-fix-node.ps1 is a no-op
    # when Node is missing (03a will install) or already at the floor.
    Write-Phase "Pre-flight: Node version check (00a-fix-node.ps1)"
    $fixNodeArgs = @{ SourcePath = $SourcePath }
    if ($AutoUpgradeNode) { $fixNodeArgs.AssumeYes = $true }
    & "$scriptDir\00a-fix-node.ps1" @fixNodeArgs

    Write-Phase "Pre-flight check (00-check-prereqs.ps1)"
    & "$scriptDir\00-check-prereqs.ps1" -SourcePath $SourcePath -DatabaseName $DatabaseName -DbEngine $DbEngine -SetupYopassDocker:$SetupYopassDocker -YopassPort $YopassPort
    $preflightExit = $LASTEXITCODE
    if ($preflightExit -eq 1) {
        throw "Pre-flight check failed. Fix the [FAIL] items above and re-run, or pass -SkipPreflightCheck to bypass (not recommended)."
    } elseif ($preflightExit -eq 2) {
        if ($AcceptRisks) {
            Write-Host ""
            Write-Host "Collision risks acknowledged via -AcceptRisks. Proceeding." -ForegroundColor Magenta
        } else {
            Write-Host ""
            Write-Host "The pre-flight flagged [RISK] items above -- the install will modify state" -ForegroundColor Magenta
            Write-Host "that another app on this machine may depend on (SQL instance config, PATH" -ForegroundColor Magenta
            Write-Host "ordering of 'java', the HTTPS:443 binding, etc.)." -ForegroundColor Magenta
            $reply = Read-Host "Continue anyway? (y/N)"
            if ($reply -notmatch '^[Yy]') {
                throw "Aborted by user. Re-run with -AcceptRisks to skip this prompt next time."
            }
        }
    } elseif ($preflightExit -ne 0) {
        throw "Pre-flight check returned unexpected exit code $preflightExit."
    }
}

# ---------- Phase 1 — Prereqs ----------
if (-not $SkipPhase1) {
    if ($DbEngine -eq 'mssql') {
        Write-Phase "Phase 1.1: SQL Server prereqs (01-prereqs-sql.ps1)"
        & "$scriptDir\01-prereqs-sql.ps1" -SaPassword $SaPassword -DatabaseName $DatabaseName
    } else {
        Write-Phase "Phase 1.1: PostgreSQL prereqs"
        if ($UsePostgresDocker) {
            # Generate windows-install\docker\.env from the postgres defaults of
            # production.js-edfi (so the docker container, the app config, and
            # the documented defaults all agree on user/db/port), then bring
            # the container up and wait for it to accept connections.
            $dockerDir = Join-Path $scriptDir "docker"
            if (-not (Test-Path "$dockerDir\docker-compose.yml")) {
                throw "docker-compose.yml not found at $dockerDir. Expected the docker folder to ship alongside the install scripts."
            }
            if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
                throw "docker is not on PATH. Install Docker Desktop and ensure 'docker compose' works before re-running with -UsePostgresDocker."
            }

            $envPath = Join-Path $dockerDir ".env"
            $envBody = @"
# Generated by install-all.ps1 -- do not edit by hand. Values mirror
# DB_SECRET_VALUE postgres defaults in production.js-edfi and the args
# passed to install-all.
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$PostgresSuperuserPassword
ADMIN_APP_DB_NAME=$DatabaseName
ADMIN_APP_DB_USER=$PostgresAppUser
ADMIN_APP_DB_PASSWORD=$PostgresAppPassword
POSTGRES_PORT_EXPOSED=$PostgresPort
"@
            Set-Content -Path $envPath -Value $envBody -Encoding UTF8
            Write-Host "Wrote $envPath"

            Push-Location $dockerDir
            try {
                Write-Host "Starting docker compose (postgres)..."
                & docker compose up -d
                if ($LASTEXITCODE -ne 0) {
                    throw "docker compose up failed (exit code $LASTEXITCODE)."
                }

                Write-Host "Waiting for postgres to accept connections..."
                $ready = $false
                for ($i = 0; $i -lt 30; $i++) {
                    & docker exec edfiadminapp-postgres pg_isready -U postgres -d $DatabaseName 2>&1 | Out-Null
                    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
                    Start-Sleep -Seconds 2
                }
                if (-not $ready) {
                    throw "postgres container did not become ready within ~60 seconds. Check 'docker compose logs postgres'."
                }
                Write-Host "Postgres is ready." -ForegroundColor Green

                # Idempotent re-run safety: docker compose only runs init/*.sh
                # on a FRESH data volume, so a persistent volume from an earlier
                # install attempt keeps the old edfiadminapp password and
                # whatever ownership/grants TypeORM left behind. Force-align the
                # password and grant the app user full access to existing AND
                # future objects in public, run as the postgres superuser.
                Write-Host "Synchronizing $PostgresAppUser password + privileges (idempotent)..."
                $syncSql = @"
ALTER USER "$PostgresAppUser" WITH PASSWORD '$PostgresAppPassword';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "$PostgresAppUser";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "$PostgresAppUser";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "$PostgresAppUser";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "$PostgresAppUser";
"@
                $syncSql | & docker exec -i -e "PGPASSWORD=$PostgresSuperuserPassword" edfiadminapp-postgres psql -U postgres -d $DatabaseName 2>&1 | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to sync $PostgresAppUser credentials/privileges (psql exit $LASTEXITCODE). Check that -PostgresSuperuserPassword matches the superuser password the docker container was first initialized with."
                }
                Write-Host "$PostgresAppUser password and privileges synced." -ForegroundColor Green
            } finally {
                Pop-Location
            }
        } else {
            Write-Host "Skipping docker bring-up (-UsePostgresDocker not set). Ensure an external Postgres is reachable at ${PostgresHost}:${PostgresPort} with user '$PostgresAppUser' and the password you passed via -PostgresAppPassword." -ForegroundColor Yellow
        }
    }

    Write-Phase "Phase 1.2: IIS prereqs (02-prereqs-iis.ps1)"
    & "$scriptDir\02-prereqs-iis.ps1"

    Write-Phase "Phase 1.3: Runtime prereqs (03a-prereqs-runtime.ps1)"
    if ($JdkDownloadUrl) {
        & "$scriptDir\03a-prereqs-runtime.ps1" -JdkDownloadUrl $JdkDownloadUrl
    } else {
        & "$scriptDir\03a-prereqs-runtime.ps1"
    }

    # Phase 1.4: stand up Yopass (only when asked). The derived URL was already
    # computed into $EffectiveYopassUrl; this just brings the container up so it
    # is ready by the time phase 3 configures and smoke-tests the API.
    if ($SetupYopassDocker) {
        Write-Phase "Phase 1.4: Yopass via docker (03d-yopass-docker.ps1)"
        & "$scriptDir\03d-yopass-docker.ps1" -YopassPort $YopassPort | Out-Null
    }

    Write-Host ""
    Write-Host "Phase 1 complete." -ForegroundColor Green

    # Refresh the current process's PATH from the registry so subsequent child
    # processes (notably 03c-build-project running npm) inherit Node's bin
    # directory even if winget just installed Node a moment ago in this same shell.
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

if ($OnlyPhase1) {
    Write-Host "Exiting after phase 1 (-OnlyPhase1)." -ForegroundColor Yellow
    return
}

# ---------- Phase 2 — Build + start Keycloak ----------
if (-not $SkipPhase2) {
    Write-Phase "Phase 2.1: Build the project (03c-build-project.ps1)"
    Write-Host "This takes several minutes. Output streams below."
    & "$scriptDir\03c-build-project.ps1" -SourcePath $SourcePath

    Write-Phase "Phase 2.2: Start Keycloak in background (03b-keycloak-start.ps1)"
    & "$scriptDir\03b-keycloak-start.ps1" -AdminPassword $KeycloakAdminPassword
}

# Sanity checks before phase 3
if (-not (Test-Path "$SourcePath\dist\packages\api\main.js")) {
    throw "$SourcePath\dist\packages\api\main.js missing. Build step skipped or failed."
}
if (-not (Test-Path "$SourcePath\dist\packages\fe\index.html")) {
    throw "$SourcePath\dist\packages\fe\index.html missing. Build step skipped or failed."
}
try {
    Invoke-RestMethod -Uri "http://localhost:8080/realms/master/.well-known/openid-configuration" -TimeoutSec 5 | Out-Null
} catch {
    throw "Keycloak isn't reachable at http://localhost:8080. Start it before continuing."
}

# ---------- Phase 3 — Deploy ----------
Write-Phase "Phase 3.1: Keycloak realm + client + user (06-keycloak-bootstrap.ps1)"
$kcArgs = @{
    AdminPassword = $KeycloakAdminPassword
    ClientSecret = $KeycloakClientSecret
    TestUserPassword = $TestUserPassword
    TestUserEmail = $AdminUsername
}
if ($IncludeAudienceMapper) { $kcArgs.IncludeAudienceMapper = $true }
if ($EnableDirectAccessGrants) { $kcArgs.EnableDirectAccessGrants = $true }
& "$scriptDir\06-keycloak-bootstrap.ps1" @kcArgs

Write-Phase "Phase 3.2: Deploy API (04-deploy-api.ps1)"
$apiArgs = @{
    SourcePath           = $SourcePath
    DatabaseName         = $DatabaseName
    KeycloakClientSecret = $KeycloakClientSecret
    AdminUsername        = $AdminUsername
    DbEngine             = $DbEngine
    # Yopass: empty string -> 04 sets USE_YOPASS=false; a URL -> USE_YOPASS=true.
    # (Previously this wasn't forwarded, so -YopassUrl on install-all was a no-op.)
    YopassUrl            = $EffectiveYopassUrl
}
if ($DbEngine -eq 'mssql') {
    $apiArgs.SaPassword = $SaPassword
} else {
    $apiArgs.PgDbHost     = $PostgresHost
    $apiArgs.PgDbPort     = $PostgresPort
    $apiArgs.PgDbUsername = $PostgresAppUser
    $apiArgs.PgDbPassword = $PostgresAppPassword
}
& "$scriptDir\04-deploy-api.ps1" @apiArgs

Write-Phase "Phase 3.3: Deploy FE (05-deploy-fe.ps1)"
& "$scriptDir\05-deploy-fe.ps1" -SourcePath "$SourcePath\dist\packages\fe"

# ---------- Smoke test ----------
Write-Phase "Smoke test: hitting the API"

# Trust self-signed cert for this probe
Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class InstallAllCertTrust : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate c, WebRequest r, int p) { return true; }
}
"@ -ErrorAction SilentlyContinue
[System.Net.ServicePointManager]::CertificatePolicy = New-Object InstallAllCertTrust

# iisnode lazy-starts on first request, so the first hit can be slow. Retry briefly.
$apiOk = $false
for ($i = 0; $i -lt 12; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "https://localhost/adminapp-api/api/teams" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        # Anything non-5xx counts as the app being up (401 expected without a token).
        $apiOk = $true; break
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if ($resp) {
            $code = [int]$resp.StatusCode
            if ($code -lt 500) { $apiOk = $true; break }
        }
        Start-Sleep -Seconds 5
    } catch {
        Start-Sleep -Seconds 5
    }
}

if ($apiOk) {
    Write-Host "API is responding at https://localhost/adminapp-api/" -ForegroundColor Green

    # Wait for the [user] table to exist. TypeORM migrations run during Nest
    # bootstrap, which is triggered by the smoke test, but the smoke test gets
    # its 401 response before TypeORM necessarily finishes the seed migration.
    # Poll for the table for up to 30 seconds. Probe via the engine that
    # production.js is actually pointing at.
    Write-Host "Waiting for migrations to finish creating the [user] table..."
    $userTableReady = $false
    for ($i = 0; $i -lt 15; $i++) {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            if ($DbEngine -eq 'mssql') {
                & sqlcmd -S "tcp:localhost,1433" -U sa -P $SaPassword -d $DatabaseName -Q "SET NOCOUNT ON; SELECT TOP 1 1 FROM [user];" 2>&1 | Out-Null
            } else {
                # Probe via the container's psql (postgres-only -- avoids
                # requiring psql.exe on the host) when docker is in play;
                # otherwise rely on psql being on PATH.
                # Pipe SQL via stdin instead of using -c, because PowerShell's
                # native-arg passing eats the double quotes around "user" (a
                # reserved word in postgres that has to stay quoted).
                $probeSql = 'SELECT 1 FROM "user" LIMIT 1;'
                if ($UsePostgresDocker) {
                    $probeSql | & docker exec -i -e "PGPASSWORD=$PostgresAppPassword" edfiadminapp-postgres psql -U $PostgresAppUser -d $DatabaseName 2>&1 | Out-Null
                } elseif (Get-Command psql -ErrorAction SilentlyContinue) {
                    $env:PGPASSWORD = $PostgresAppPassword
                    $probeSql | & psql -h $PostgresHost -p $PostgresPort -U $PostgresAppUser -d $DatabaseName 2>&1 | Out-Null
                } else {
                    # No way to probe -- assume ready and fall through to the upsert,
                    # which will surface any real failure.
                    $LASTEXITCODE = 0
                }
            }
        } finally {
            $ErrorActionPreference = $prev
        }
        if ($LASTEXITCODE -eq 0) { $userTableReady = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $userTableReady) {
        Write-Host "[user] table didn't appear within 30s. Migrations may have failed -- check iisnode stderr." -ForegroundColor Yellow
    }

    # Ensure the admin user exists with roleId=2. Three scenarios this handles:
    #   1. Seed migration ran and inserted the user with roleId=2 -- both
    #      statements below are no-ops.
    #   2. Migrations created the [user] table but the seed didn't fire (we
    #      observed this on a clean VM run) -- INSERT runs, user gets roleId=2.
    #   3. The user exists but with NULL roleId (auth-flow auto-create path) --
    #      UPDATE corrects it.
    Write-Host "Ensuring '$AdminUsername' exists with admin role..."
    if ($DbEngine -eq 'mssql') {
        $upsertQuery = @"
IF NOT EXISTS (SELECT 1 FROM [user] WHERE username = '$AdminUsername')
    INSERT INTO [user] (username, roleId, isActive) VALUES ('$AdminUsername', 2, 1);
UPDATE [user] SET roleId = 2, isActive = 1
    WHERE username = '$AdminUsername' AND (roleId IS NULL OR isActive = 0);
"@
        & sqlcmd -S "tcp:localhost,1433" -U sa -P $SaPassword -d $DatabaseName -Q $upsertQuery 1>$null 2>$null
        $upsertExit = $LASTEXITCODE
    } else {
        # Postgres equivalent. The "user" identifier is a reserved word, so it
        # has to stay quoted; the column names "roleId"/"isActive" are
        # case-sensitive because TypeORM creates them with double quotes.
        $upsertQuery = @"
INSERT INTO "user" (username, "roleId", "isActive")
    VALUES ('$AdminUsername', 2, true)
    ON CONFLICT (username) DO NOTHING;
UPDATE "user" SET "roleId" = 2, "isActive" = true
    WHERE username = '$AdminUsername' AND ("roleId" IS NULL OR "isActive" = false);
"@
        # Pipe SQL via stdin: PowerShell's native-arg passing strips the
        # inner double quotes around "user" / "roleId" / "isActive" when they
        # ride along on `-c`, which makes psql see `user` (a reserved word)
        # and fail with a syntax error.
        if ($UsePostgresDocker) {
            $upsertQuery | & docker exec -i -e "PGPASSWORD=$PostgresAppPassword" edfiadminapp-postgres psql -U $PostgresAppUser -d $DatabaseName 1>$null 2>$null
            $upsertExit = $LASTEXITCODE
        } elseif (Get-Command psql -ErrorAction SilentlyContinue) {
            $env:PGPASSWORD = $PostgresAppPassword
            $upsertQuery | & psql -h $PostgresHost -p $PostgresPort -U $PostgresAppUser -d $DatabaseName 1>$null 2>$null
            $upsertExit = $LASTEXITCODE
        } else {
            Write-Host "No psql available (and -UsePostgresDocker not set). Skipping admin-user upsert -- run it manually if login loops." -ForegroundColor Yellow
            $upsertExit = -1
        }
    }
    if ($upsertExit -eq 0) {
        Write-Host "Admin user present with roleId=2." -ForegroundColor Green
    } elseif ($upsertExit -gt 0) {
        Write-Host "Couldn't ensure admin user automatically (exit $upsertExit)." -ForegroundColor Yellow
        Write-Host "If login loops, run an INSERT into the [user] / `"user`" table manually with roleId=2 for '$AdminUsername'." -ForegroundColor Yellow
    }
} else {
    Write-Host "API is NOT responding after ~60s of retries." -ForegroundColor Red
    Write-Host "Check the iisnode logs:" -ForegroundColor Yellow
    Write-Host "  Get-ChildItem C:\inetpub\Ed-Fi\adminapp-api\iisnode | Sort LastWriteTime -Desc | Select -First 2 | Get-Content -Tail 30"
    Write-Host "And the IIS app pool state:" -ForegroundColor Yellow
    Write-Host "  Get-WebAppPoolState -Name EdFi-AdminApp-API"
    Write-Host ""
    throw "Install completed but the API smoke test failed. Fix the underlying issue and re-run install-all (idempotent), or run 04-deploy-api.ps1 directly to redeploy."
}

# ---------- Done ----------
Write-Phase "INSTALL COMPLETE"

# Build the DB-specific section of the summary first so the main here-string
# below stays simple.
if ($DbEngine -eq 'mssql') {
    $dbSummary = @"
SQL Server
  Server:             (local) / tcp:localhost,1433
  Login:              sa
  Password:           $SaPassword
  Database:           $DatabaseName
"@
} else {
    $dockerLines = if ($UsePostgresDocker) {
@"

  Container:          edfiadminapp-postgres (docker compose at $scriptDir\docker)
  Superuser password: $PostgresSuperuserPassword
"@
    } else { "" }
    $dbSummary = @"
PostgreSQL
  Host:               ${PostgresHost}:${PostgresPort}
  Database:           $DatabaseName
  App user:           $PostgresAppUser
  App password:       $PostgresAppPassword$dockerLines
"@
}

# Yopass section: reflect which of the three modes was configured.
if ($SetupYopassDocker) {
    $yopassSummary = @"

Yopass (one-time credential links)
  Mode:               Dockerized (docker compose at $scriptDir\docker, file docker-compose.yopass.yml)
  URL:                $EffectiveYopassUrl
  Container:          edfiadminapp-yopass (+ edfiadminapp-yopass-memcached)
"@
} elseif ($EffectiveYopassUrl) {
    $yopassSummary = @"

Yopass (one-time credential links)
  Mode:               External (pre-existing deployment)
  URL:                $EffectiveYopassUrl
"@
} else {
    $yopassSummary = @"

Yopass (one-time credential links)
  Mode:               Disabled (USE_YOPASS=false) -- credentials shown inline in the UI
"@
}

$summary = @"
Ed-Fi Admin App -- Install Summary
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

Admin App
  URL:                https://localhost/adminapp/
  Sign in with:
    Email:            $AdminUsername
    Password:         $TestUserPassword

API
  URL:                https://localhost/adminapp-api/

Keycloak (Identity Provider)
  Admin console:      http://localhost:8080/admin/
  Sign in with:
    Username:         admin
    Password:         $KeycloakAdminPassword
  edfi realm:         http://localhost:8080/realms/edfi/
  Client secret:      $KeycloakClientSecret

$dbSummary
$yopassSummary

Notes
  - The HTTPS cert is self-signed and was added to Trusted Root by 02-prereqs-iis.ps1.
    If the browser still warns, fully close and reopen it once.
  - This file contains passwords in plaintext. Delete or protect it for non-dev use.
"@

# Print to console and persist alongside the source tree (one level above the
# scripts folder by default) so the user can recover values later. Lives
# outside the scripts folder because it's an install artifact, not a script.
Write-Host $summary -ForegroundColor Green
$summaryDir = Split-Path $SourcePath -Parent   # e.g., C:\Ed-Fi
if (-not (Test-Path $summaryDir)) { New-Item -ItemType Directory -Path $summaryDir -Force | Out-Null }
$summaryPath = Join-Path $summaryDir "install-summary.txt"
Set-Content -Path $summaryPath -Value $summary -Encoding UTF8
Write-Host ""
Write-Host "Saved to: $summaryPath" -ForegroundColor Cyan
