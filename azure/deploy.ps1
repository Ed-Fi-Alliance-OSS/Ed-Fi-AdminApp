<#
.SYNOPSIS
    Ed-Fi AdminApp — Azure Container Apps Provisioning Script (PowerShell)

.DESCRIPTION
    Deploys the full Ed-Fi AdminApp stack (Keycloak, Yopass, ODS/API v6+v7,
    Admin APIs, AdminApp API+FE, nginx reverse proxy) to Azure Container Apps.

.EXAMPLE
    ./deploy.ps1
    Deploy with PostgreSQL only (default).

.EXAMPLE
    ./deploy.ps1 -MSSQL
    Also deploy MSSQL container.

.EXAMPLE
    ./deploy.ps1 -UseACR
    Build custom images via Azure Container Registry.
#>
param(
    [Switch]$MSSQL,
    [Switch]$UseACR
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---------------------------------------------------------------------------
# Load configuration
# ---------------------------------------------------------------------------
$EnvFile = Join-Path $ScriptDir ".env.azure"
if (-not (Test-Path $EnvFile)) {
    Write-Error "ERROR: .env.azure not found. Copy .env.azure.example to .env.azure and edit it."
    exit 1
}

$envVars = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $parts = $line -split '=', 2
        if ($parts.Count -eq 2) {
            $key = $parts[0].Trim()
            $val = $parts[1].Trim().Trim('"').Trim("'")
            $envVars[$key] = $val
            [Environment]::SetEnvironmentVariable($key, $val)
        }
    }
}

# Helper to get env var with default
function Get-EnvOrDefault($Name, $Default = "") {
    $val = $envVars[$Name]
    if ([string]::IsNullOrEmpty($val)) { return $Default }
    return $val
}

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
$ResourceGroup = "edfiadminapp-network"
$Location = Get-EnvOrDefault "AZURE_LOCATION" "eastus"
$EnvironmentName = "edfiadminapp-network"
$StorageAccount = Get-EnvOrDefault "AZURE_STORAGE_ACCOUNT" "edfiadminappstore"

$PostgresUser = Get-EnvOrDefault "POSTGRES_USER" "postgres"
$PostgresPassword = Get-EnvOrDefault "POSTGRES_PASSWORD" "postgres"
$AdminAppDbName = Get-EnvOrDefault "ADMIN_APP_DB_NAME" "sbaa"

# ---------------------------------------------------------------------------
# Phase 0: Prerequisites
# ---------------------------------------------------------------------------
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 0: Validating prerequisites" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

try { az account show | Out-Null }
catch {
    Write-Error "ERROR: Not logged in to Azure CLI. Run 'az login' first."
    exit 1
}

az extension add --name containerapp --upgrade -y 2>$null | Out-Null
az provider register --namespace Microsoft.App --wait 2>$null | Out-Null
az provider register --namespace Microsoft.OperationalInsights --wait 2>$null | Out-Null

Write-Host "  Azure CLI authenticated." -ForegroundColor Green
Write-Host "  containerapp extension ready." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 1: Resource Group
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 1: Creating resource group" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

az group create --name $ResourceGroup --location $Location --output none
Write-Host "  Resource group '$ResourceGroup' created in '$Location'." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 2: Container Apps Environment
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 2: Creating Container Apps environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

az containerapp env create `
    --name $EnvironmentName `
    --resource-group $ResourceGroup `
    --location $Location `
    --logs-destination none `
    --output none

Write-Host "  Environment '$EnvironmentName' created." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 3: Azure Files Storage
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 3: Creating Azure Files storage" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

az storage account create `
    --name $StorageAccount `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Standard_LRS `
    --kind StorageV2 `
    --output none

$StorageKey = az storage account keys list `
    --resource-group $ResourceGroup `
    --account-name $StorageAccount `
    --query "[0].value" -o tsv

Write-Host "  Storage account '$StorageAccount' created." -ForegroundColor Green

$Shares = @(
    "vol-edfiadminapp-keycloak"
    "vol-edfiadminapp-db"
    "vol-edfiadminapp-mssql"
    "vol-edfiadminapp-api-logs"
    "vol-v7-single-db-ods"
    "vol-db-admin-7x"
    "vol-v7-tenant1-db-ods"
    "vol-v7-tenant2-db-ods"
    "vol-v7-tenant1-db-admin"
    "vol-v7-tenant2-db-admin"
    "vol-db-admin-6x"
    "vol-db-ods-6x-255901"
    "vol-db-ods-6x-255902"
    "pgadmin-data"
)

foreach ($share in $Shares) {
    az storage share-rm create `
        --storage-account $StorageAccount `
        --name $share `
        --quota 5 `
        --output none

    az containerapp env storage set `
        --name $EnvironmentName `
        --resource-group $ResourceGroup `
        --storage-name $share `
        --azure-file-account-name $StorageAccount `
        --azure-file-account-key $StorageKey `
        --azure-file-share-name $share `
        --access-mode ReadWrite `
        --output none

    Write-Host "  Share '$share' created and registered." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Phase 4: Build custom images
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 4: Building custom images" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$AcrName = Get-EnvOrDefault "ACR_NAME" ""
$RegistryArgs = @()

if ($UseACR -and $AcrName) {
    Write-Host "  Using Azure Container Registry: $AcrName" -ForegroundColor Green

    az acr create --name $AcrName --resource-group $ResourceGroup --sku Basic --admin-enabled true --output none 2>$null

    $AcrServer = "${AcrName}.azurecr.io"

    # Build keycloak
    Write-Host "  Building keycloak image..."
    Copy-Item "$ScriptDir/config/realm-config.json" "$ScriptDir/images/keycloak/"
    Copy-Item "$ScriptDir/config/healthcheck.sh" "$ScriptDir/images/keycloak/"
    az acr build --registry $AcrName --image edfiadminapp-keycloak:latest --file "$ScriptDir/images/keycloak/Dockerfile" "$ScriptDir/images/keycloak/" --output none

    # Build nginx
    Write-Host "  Building nginx image..."
    Copy-Item "$ScriptDir/config/default.conf.template" "$ScriptDir/images/nginx/"
    az acr build --registry $AcrName --image edfiadminapp-nginx:latest --file "$ScriptDir/images/nginx/Dockerfile" "$ScriptDir/images/nginx/" --output none

    # Build v7-multi-api
    Write-Host "  Building v7-multi-api image..."
    Copy-Item "$ScriptDir/config/appsettings.dockertemplate.json" "$ScriptDir/images/v7-multi-api/"
    az acr build --registry $AcrName --image v7-multi-api:latest --build-arg "ODS_API_TAG=$(Get-EnvOrDefault 'ODS_API_TAG_7X' 'v7.3')" --file "$ScriptDir/images/v7-multi-api/Dockerfile" "$ScriptDir/images/v7-multi-api/" --output none

    # Build v7-multi-adminapi
    Write-Host "  Building v7-multi-adminapi image..."
    Copy-Item "$ScriptDir/config/appsettings.dockertemplate.json" "$ScriptDir/images/v7-multi-adminapi/"
    Copy-Item "$ScriptDir/config/log4net.config" "$ScriptDir/images/v7-multi-adminapi/"
    az acr build --registry $AcrName --image v7-multi-adminapi:latest --build-arg "ADMIN_API_TAG=$(Get-EnvOrDefault 'ADMIN_API_TAG_7X' 'pre')" --file "$ScriptDir/images/v7-multi-adminapi/Dockerfile" "$ScriptDir/images/v7-multi-adminapi/" --output none

    # Build db-admin
    Write-Host "  Building db-admin image..."
    Copy-Item "$ScriptDir/config/bootstrap.sh" "$ScriptDir/images/db-admin/"
    az acr build --registry $AcrName --image db-admin:latest --build-arg "ADMIN_DB_TAG=$(Get-EnvOrDefault 'ADMIN_DB_TAG_7X' 'pre')" --file "$ScriptDir/images/db-admin/Dockerfile" "$ScriptDir/images/db-admin/" --output none

    # Build admin-api
    Write-Host "  Building admin-api image..."
    Copy-Item "$ScriptDir/config/log4net.config" "$ScriptDir/images/admin-api/"
    az acr build --registry $AcrName --image admin-api:latest --build-arg "ADMIN_API_TAG=$(Get-EnvOrDefault 'ADMIN_API_TAG_7X' 'pre')" --file "$ScriptDir/images/admin-api/Dockerfile" "$ScriptDir/images/admin-api/" --output none

    # Build edfiadminapp-fe
    Write-Host "  Building edfiadminapp-fe image..."
    Copy-Item "$ScriptDir/config/nginx.conf" "$ScriptDir/images/edfiadminapp-fe/"
    az acr build --registry $AcrName --image edfiadminapp-fe:latest --build-arg "FE_IMAGE=$(Get-EnvOrDefault 'ADMINAPP_FE_IMAGE' 'edfialliance/adminapp-fe:pre')" --file "$ScriptDir/images/edfiadminapp-fe/Dockerfile" "$ScriptDir/images/edfiadminapp-fe/" --output none

    $KeycloakImage = "${AcrServer}/edfiadminapp-keycloak:latest"
    $NginxImage = "${AcrServer}/edfiadminapp-nginx:latest"
    $V7MultiApiImage = "${AcrServer}/v7-multi-api:latest"
    $V7MultiAdminapiImage = "${AcrServer}/v7-multi-adminapi:latest"
    $DbAdminImage = "${AcrServer}/db-admin:latest"
    $AdminApiImage = "${AcrServer}/admin-api:latest"
    $FeImage = "${AcrServer}/edfiadminapp-fe:latest"

    $AcrUsername = az acr credential show --name $AcrName --query "username" -o tsv
    $AcrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv
    $RegistryArgs = @("--registry-server", $AcrServer, "--registry-username", $AcrUsername, "--registry-password", $AcrPassword)
}
else {
    Write-Host "  Using Docker Hub images (no ACR)." -ForegroundColor Yellow

    $KeycloakImage = "quay.io/keycloak/keycloak:$(Get-EnvOrDefault 'KEYCLOAK_TAG' '26.1')"
    $NginxImage = "nginx:1.28.0-alpine3.21"
    $V7MultiApiImage = "edfialliance/ods-api-web-api:$(Get-EnvOrDefault 'ODS_API_TAG_7X' 'v7.3')"
    $V7MultiAdminapiImage = "edfialliance/ods-admin-api:$(Get-EnvOrDefault 'ADMIN_API_TAG_7X' 'pre')"
    $DbAdminImage = "edfialliance/ods-admin-api-db:$(Get-EnvOrDefault 'ADMIN_DB_TAG_7X' 'pre')"
    $AdminApiImage = "edfialliance/ods-admin-api:$(Get-EnvOrDefault 'ADMIN_API_TAG_7X' 'pre')"
    $FeImage = Get-EnvOrDefault "ADMINAPP_FE_IMAGE" "edfialliance/adminapp-fe:pre"
}

# ---------------------------------------------------------------------------
# Helper: Create a container app
# ---------------------------------------------------------------------------
function New-ContainerApp {
    param(
        [string]$Name,
        [string]$Image,
        [string]$Cpu,
        [string]$Memory,
        [string]$Ingress,
        [int]$TargetPort,
        [string]$Transport = "http",
        [string[]]$ExtraArgs = @()
    )

    Write-Host "  Deploying: $Name" -ForegroundColor Green

    $args = @(
        "containerapp", "create",
        "--name", $Name,
        "--resource-group", $ResourceGroup,
        "--environment", $EnvironmentName,
        "--image", $Image,
        "--cpu", $Cpu, "--memory", $Memory,
        "--min-replicas", "1", "--max-replicas", "1",
        "--ingress", $Ingress, "--target-port", $TargetPort,
        "--transport", $Transport,
        "--output", "none"
    )
    $args += $RegistryArgs
    $args += $ExtraArgs

    & az @args
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  WARNING: $Name may not have deployed successfully."
    }
}

# ---------------------------------------------------------------------------
# Phase 5: Deploy Tier 1 — Databases, Keycloak, Memcached
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 5: Deploying Tier 1 services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$PlaceholderBase = "https://placeholder.azurecontainerapps.io"
$EffectiveBase = if ($envVars["BASE_URL"]) { $envVars["BASE_URL"] } else { $PlaceholderBase }

# memcached
New-ContainerApp -Name "memcached" -Image "memcached:latest" -Cpu "0.25" -Memory "0.5Gi" -Ingress "internal" -TargetPort 11211 -Transport "tcp"

# edfiadminapp-postgres
New-ContainerApp -Name "edfiadminapp-postgres" -Image "postgres:$(Get-EnvOrDefault 'POSTGRESQL_IMAGE_TAG' '16.2')" `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "POSTGRES_DB=$AdminAppDbName",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

# MSSQL (optional)
if ($MSSQL -or (Get-EnvOrDefault "USE_MSSQL" "false") -eq "true") {
    $MssqlPassword = Get-EnvOrDefault "MSSQL_SA_PASSWORD" "YourStrong!Passw0rd"
    New-ContainerApp -Name "edfiadminapp-mssql" -Image "mcr.microsoft.com/mssql/server:$(Get-EnvOrDefault 'MSSQL_IMAGE_TAG' '2022-latest')" `
        -Cpu "2.0" -Memory "4.0Gi" -Ingress "internal" -TargetPort 1433 -Transport "tcp" `
        -ExtraArgs @(
            "--secrets", "mssql-sa-password=$MssqlPassword",
            "--env-vars",
                "ACCEPT_EULA=Y",
                "SA_PASSWORD=secretref:mssql-sa-password",
                "MSSQL_PID=Express"
        )
}

# edfiadminapp-keycloak
$KeycloakAdminPw = Get-EnvOrDefault "KEYCLOAK_ADMIN_PASSWORD" "admin"
$KeycloakClientSecret = Get-EnvOrDefault "KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET" "big-secret-123"
$KeycloakDevClientSecret = Get-EnvOrDefault "KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET" "big-secret-123"

New-ContainerApp -Name "edfiadminapp-keycloak" -Image $KeycloakImage `
    -Cpu "1.0" -Memory "2.0Gi" -Ingress "internal" -TargetPort 8080 -Transport "http" `
    -ExtraArgs @(
        "--secrets",
            "keycloak-admin-password=$KeycloakAdminPw",
            "keycloak-client-secret=$KeycloakClientSecret",
            "keycloak-dev-client-secret=$KeycloakDevClientSecret",
        "--env-vars",
            "KC_BOOTSTRAP_ADMIN_USERNAME=$(Get-EnvOrDefault 'KEYCLOAK_ADMIN' 'admin')",
            "KC_BOOTSTRAP_ADMIN_PASSWORD=secretref:keycloak-admin-password",
            "KC_HOSTNAME_BACKCHANNEL_DYNAMIC=false",
            "KC_HOSTNAME_STRICT=false",
            "KC_HTTP_RELATIVE_PATH=/auth",
            "KC_HTTP_ENABLED=true",
            "KC_PROXY_HEADERS=xforwarded",
            "KC_LOG_CONSOLE_LEVEL=$(Get-EnvOrDefault 'KC_LOG_CONSOLE_LEVEL' 'error')",
            "KC_LOG=file,console",
            "KC_HEALTH_ENABLED=true",
            "BASE_URL=$EffectiveBase",
            "BASE_URL_DEV=$EffectiveBase",
            "KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET=secretref:keycloak-client-secret",
            "KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET=secretref:keycloak-dev-client-secret"
    )

# v7 Single Tenant DBs
$OdsDbImage7x = "edfialliance/$(Get-EnvOrDefault 'ODS_DB_IMAGE_7X' 'ods-api-db-ods-minimal'):$(Get-EnvOrDefault 'ODS_DB_TAG_7X' 'v7.3')"

New-ContainerApp -Name "v7-single-db-ods" -Image $OdsDbImage7x `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "TPDM_ENABLED=$(Get-EnvOrDefault 'TPDM_ENABLED' 'true')",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

New-ContainerApp -Name "v7-single-db-admin" -Image $DbAdminImage `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "ODS_PGBOUNCER_PORT=5432",
            "ODS_POSTGRES_HOST=v7-single-db-ods",
            "NPG_POOLING_ENABLED=$(Get-EnvOrDefault 'NPG_POOLING_ENABLED' 'true')",
            "NPG_API_MAX_POOL_SIZE_ODS=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ODS' '20')",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

# v7 Multi-Tenant DBs
New-ContainerApp -Name "v7-tenant1-db-ods" -Image $OdsDbImage7x `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "TPDM_ENABLED=$(Get-EnvOrDefault 'TPDM_ENABLED' 'true')",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

New-ContainerApp -Name "v7-tenant2-db-ods" -Image $OdsDbImage7x `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "TPDM_ENABLED=$(Get-EnvOrDefault 'TPDM_ENABLED' 'true')",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

New-ContainerApp -Name "v7-tenant1-db-admin" -Image $DbAdminImage `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "ODS_PGBOUNCER_PORT=5432",
            "ODS_POSTGRES_HOST=v7-tenant1-db-ods",
            "NPG_POOLING_ENABLED=$(Get-EnvOrDefault 'NPG_POOLING_ENABLED' 'true')",
            "NPG_API_MAX_POOL_SIZE_ODS=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ODS' '20')",
            "TENANT_IDENTIFIER=tenant1",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

New-ContainerApp -Name "v7-tenant2-db-admin" -Image $DbAdminImage `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "ODS_PGBOUNCER_PORT=5432",
            "ODS_POSTGRES_HOST=v7-tenant2-db-ods",
            "NPG_POOLING_ENABLED=$(Get-EnvOrDefault 'NPG_POOLING_ENABLED' 'true')",
            "NPG_API_MAX_POOL_SIZE_ODS=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ODS' '20')",
            "TENANT_IDENTIFIER=tenant2",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

# v6 DBs
$OdsDbImage6x = "edfialliance/$(Get-EnvOrDefault 'ODS_DB_IMAGE_6X' 'ods-api-db-ods'):$(Get-EnvOrDefault 'ODS_DB_TAG_6X' 'v2.3.5')"
$AdminDbImage6x = "edfialliance/ods-admin-api-db:$(Get-EnvOrDefault 'ADMIN_DB_TAG_6X' 'v1.4.3')"

New-ContainerApp -Name "v6-db-admin" -Image $AdminDbImage6x `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "API_MODE=DistrictSpecific",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

New-ContainerApp -Name "v6-edfi-ods-255901" -Image $OdsDbImage6x `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "TPDM_ENABLED=$(Get-EnvOrDefault 'TPDM_ENABLED' 'true')",
            "ODS_DB=EdFi_Ods_255901",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

New-ContainerApp -Name "v6-edfi-ods-255902" -Image $OdsDbImage6x `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 5432 -Transport "tcp" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "TPDM_ENABLED=$(Get-EnvOrDefault 'TPDM_ENABLED' 'true')",
            "ODS_DB=EdFi_Ods_255902",
            "PGDATA=/var/lib/postgresql/data/pgdata"
    )

Write-Host "  Tier 1 complete." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 6: Wait for Tier 1 readiness
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 6: Waiting for Tier 1 services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

function Wait-ForApp {
    param([string]$Name, [int]$MaxWait = 300)
    Write-Host -NoNewline "  Waiting for $Name..."
    $elapsed = 0
    while ($elapsed -lt $MaxWait) {
        $status = az containerapp show --name $Name --resource-group $ResourceGroup --query "properties.runningStatus" -o tsv 2>$null
        if ($status -eq "Running") {
            Write-Host " Running." -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 10
        $elapsed += 10
        Write-Host -NoNewline "."
    }
    Write-Host " TIMEOUT (may still be starting)." -ForegroundColor Yellow
}

Wait-ForApp "edfiadminapp-postgres"
Wait-ForApp "edfiadminapp-keycloak" 600
Wait-ForApp "memcached"
Wait-ForApp "v7-single-db-ods"
Wait-ForApp "v7-single-db-admin"
Wait-ForApp "v7-tenant1-db-ods"
Wait-ForApp "v7-tenant2-db-ods"
Wait-ForApp "v7-tenant1-db-admin"
Wait-ForApp "v7-tenant2-db-admin"
Wait-ForApp "v6-db-admin"
Wait-ForApp "v6-edfi-ods-255901"
Wait-ForApp "v6-edfi-ods-255902"

# ---------------------------------------------------------------------------
# Phase 7: Deploy Tier 2 — APIs and Yopass
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 7: Deploying Tier 2 services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$OdsApiTag7x = Get-EnvOrDefault "ODS_API_TAG_7X" "v7.3"
$OdsApiTag6x = Get-EnvOrDefault "ODS_API_TAG_6X" "v2.3.5"
$SigningKey = Get-EnvOrDefault "SIGNING_KEY" ""
$OdsEncKey = Get-EnvOrDefault "ODS_CONNECTION_STRING_ENCRYPTION_KEY" ""
$V7SingleApiVn = Get-EnvOrDefault "V7_SINGLE_API_VIRTUAL_NAME" "v7-single-api"
$V7SingleAdminApiVn = Get-EnvOrDefault "V7_SINGLE_ADMIN_API_VIRTUAL" "v7-single-adminapi"
$V7MultiApiVn = Get-EnvOrDefault "V7_MULTI_API_VIRTUAL_NAME" "v7-multi-api"
$V7MultiAdminApiVn = Get-EnvOrDefault "V7_MULTI_ADMINAPI_VIRTUAL_NAME" "v7-multi-adminapi"
$V6OdsVn = Get-EnvOrDefault "V6_ODS_VIRTUAL_NAME" "v6-api"
$V6AdminApiVn = Get-EnvOrDefault "V6_ADMIN_API_VIRTUAL_NAME" "v6-adminapi"

# yopass
New-ContainerApp -Name "edfiadminapp-yopass" -Image "jhaals/yopass" `
    -Cpu "0.25" -Memory "0.5Gi" -Ingress "internal" -TargetPort 80 -Transport "http" `
    -ExtraArgs @("--args", "--memcached=memcached:11211", "--port", "80")

# v7-single-api
New-ContainerApp -Name "v7-single-api" -Image "edfialliance/ods-api-web-api:$OdsApiTag7x" `
    -Cpu "1.0" -Memory "2.0Gi" -Ingress "internal" -TargetPort 80 -Transport "http" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword", "ods-encryption-key=$OdsEncKey",
        "--env-vars",
            "ADMIN_POSTGRES_HOST=v7-single-db-admin",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "POSTGRES_PORT=5432",
            "PATH_BASE=$V7SingleApiVn",
            "TPDM_ENABLED=$(Get-EnvOrDefault 'TPDM_ENABLED' 'true')",
            "ODS_WAIT_POSTGRES_HOSTS=v7-single-db-ods",
            "NPG_POOLING_ENABLED=$(Get-EnvOrDefault 'NPG_POOLING_ENABLED' 'true')",
            "NPG_API_MAX_POOL_SIZE_ODS=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ODS' '20')",
            "NPG_API_MAX_POOL_SIZE_ADMIN=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ADMIN' '20')",
            "NPG_API_MAX_POOL_SIZE_SECURITY=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_SECURITY' '20')",
            "NPG_API_MAX_POOL_SIZE_MASTER=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_MASTER' '20')",
            "ODS_CONNECTION_STRING_ENCRYPTION_KEY=secretref:ods-encryption-key",
            "ASPNETCORE_ENVIRONMENT=docker",
            "FeatureManagement__MultiTenancy=false",
            "ApiSettings__OdsContextRouteTemplate={instanceId}"
    )

# v7-single-adminapi
New-ContainerApp -Name "v7-single-adminapi" -Image $AdminApiImage `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 80 -Transport "http" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword", "signing-key=$SigningKey", "ods-encryption-key=$OdsEncKey",
        "--env-vars",
            "ADMIN_POSTGRES_HOST=v7-single-db-admin",
            "POSTGRES_PORT=5432",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "ASPNETCORE_ENVIRONMENT=docker",
            "AppSettings__DatabaseEngine=PostgreSql",
            "AppSettings__PathBase=$V7SingleAdminApiVn",
            "Authentication__Authority=$EffectiveBase/$V7SingleAdminApiVn",
            "Authentication__IssuerUrl=$EffectiveBase/$V7SingleAdminApiVn",
            "Authentication__SigningKey=secretref:signing-key",
            "Authentication__AllowRegistration=true",
            "AppSettings__DefaultPageSizeOffset=$(Get-EnvOrDefault 'PAGING_OFFSET' '0')",
            "AppSettings__DefaultPageSizeLimit=$(Get-EnvOrDefault 'PAGING_LIMIT' '25')",
            "AppSettings__MultiTenancy=false",
            "AppSettings__EncryptionKey=secretref:ods-encryption-key",
            "SwaggerSettings__EnableSwagger=true",
            "SwaggerSettings__DefaultTenant=$(Get-EnvOrDefault 'SWAGGER_DEFAULT_TENANT' 'tenant1')",
            "Log4NetCore__Log4NetConfigFileName=./log4net/log4net.config",
            "EnableDockerEnvironment=true",
            "AppSettings__AllowedOrigins=$EffectiveBase",
            "AppSettings__EnableApplicationResetEndpoint=$(Get-EnvOrDefault 'ENABLE_APPLICATION_RESET_ENDPOINT' 'true')",
            "ConnectionStrings__EdFi_Admin=host=v7-single-db-admin;port=5432;username=$PostgresUser;password=$PostgresPassword;database=EdFi_Admin;",
            "ConnectionStrings__EdFi_Security=host=v7-single-db-admin;port=5432;username=$PostgresUser;password=$PostgresPassword;database=EdFi_Security;",
            "EdFiApiDiscoveryUrl=$EffectiveBase/v7-single-api"
    )

# v7-multi-api
New-ContainerApp -Name "v7-multi-api" -Image $V7MultiApiImage `
    -Cpu "1.0" -Memory "2.0Gi" -Ingress "internal" -TargetPort 80 -Transport "http" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword", "ods-encryption-key=$OdsEncKey",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "POSTGRES_PORT=5432",
            "PATH_BASE=$V7MultiApiVn",
            "TPDM_ENABLED=$(Get-EnvOrDefault 'TPDM_ENABLED' 'true')",
            "ODS_WAIT_POSTGRES_HOSTS=v7-tenant1-db-ods v7-tenant2-db-ods",
            "NPG_POOLING_ENABLED=$(Get-EnvOrDefault 'NPG_POOLING_ENABLED' 'true')",
            "NPG_API_MAX_POOL_SIZE_ODS=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ODS' '20')",
            "NPG_API_MAX_POOL_SIZE_ADMIN=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ADMIN' '20')",
            "NPG_API_MAX_POOL_SIZE_SECURITY=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_SECURITY' '20')",
            "NPG_API_MAX_POOL_SIZE_MASTER=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_MASTER' '20')",
            "ODS_CONNECTION_STRING_ENCRYPTION_KEY=secretref:ods-encryption-key",
            "ASPNETCORE_ENVIRONMENT=docker"
    )

# v7-multi-adminapi
New-ContainerApp -Name "v7-multi-adminapi" -Image $V7MultiAdminapiImage `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 80 -Transport "http" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword", "signing-key=$SigningKey", "ods-encryption-key=$OdsEncKey",
        "--env-vars",
            "ADMIN_WAIT_POSTGRES_HOSTS=v7-tenant1-db-admin v7-tenant2-db-admin",
            "POSTGRES_PORT=5432",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "ASPNETCORE_ENVIRONMENT=multitenantdocker",
            "AppSettings__DatabaseEngine=PostgreSql",
            "AppSettings__PathBase=$V7MultiAdminApiVn",
            "Authentication__Authority=$EffectiveBase/$V7MultiAdminApiVn",
            "Authentication__IssuerUrl=$EffectiveBase/$V7MultiAdminApiVn",
            "Authentication__SigningKey=secretref:signing-key",
            "Authentication__AllowRegistration=true",
            "AppSettings__DefaultPageSizeOffset=$(Get-EnvOrDefault 'PAGING_OFFSET' '0')",
            "AppSettings__DefaultPageSizeLimit=$(Get-EnvOrDefault 'PAGING_LIMIT' '25')",
            "AppSettings__MultiTenancy=$(Get-EnvOrDefault 'MULTITENANCY_ENABLED' 'true')",
            "AppSettings__EnableApplicationResetEndpoint=$(Get-EnvOrDefault 'ENABLE_APPLICATION_RESET_ENDPOINT' 'true')",
            "AppSettings__EncryptionKey=secretref:ods-encryption-key",
            "SwaggerSettings__EnableSwagger=true",
            "SwaggerSettings__DefaultTenant=$(Get-EnvOrDefault 'SWAGGER_DEFAULT_TENANT' 'tenant1')",
            "Log4NetCore__Log4NetConfigFileName=./log4net/log4net.config",
            "EnableDockerEnvironment=true",
            "AppSettings__AllowedOrigins=$EffectiveBase",
            "IpRateLimiting__GeneralRules__0__Limit=25",
            "EdFiApiDiscoveryUrl=$EffectiveBase/v7-multi-api"
    )

# v6-api
New-ContainerApp -Name "v6-api" -Image "edfialliance/ods-api-web-api:$OdsApiTag6x" `
    -Cpu "1.0" -Memory "2.0Gi" -Ingress "internal" -TargetPort 80 -Transport "http" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword",
        "--env-vars",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "POSTGRES_PORT=5432",
            "ODS_POSTGRES_HOST=v6-edfi-{0}",
            "ADMIN_POSTGRES_HOST=v6-db-admin",
            "API_MODE=DistrictSpecific",
            "ApiSettings__PathBase=$V6OdsVn",
            "TPDM_ENABLED=$(Get-EnvOrDefault 'TPDM_ENABLED' 'true')",
            "ODS_WAIT_POSTGRES_HOSTS=v6-edfi-ods-255901 v6-edfi-ods-255902",
            "NPG_POOLING_ENABLED=$(Get-EnvOrDefault 'NPG_POOLING_ENABLED' 'true')",
            "NPG_API_MAX_POOL_SIZE_ODS=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ODS' '20')",
            "NPG_API_MAX_POOL_SIZE_ADMIN=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_ADMIN' '20')",
            "NPG_API_MAX_POOL_SIZE_SECURITY=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_SECURITY' '20')",
            "NPG_API_MAX_POOL_SIZE_MASTER=$(Get-EnvOrDefault 'NPG_API_MAX_POOL_SIZE_MASTER' '20')"
    )

# v6-adminapi
$AdminTag6x = Get-EnvOrDefault "ADMIN_TAG_6X" "pre"
New-ContainerApp -Name "v6-adminapi" -Image "edfialliance/ods-admin-api:$AdminTag6x" `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 80 -Transport "http" `
    -ExtraArgs @(
        "--secrets", "postgres-password=$PostgresPassword", "signing-key=$SigningKey", "ods-encryption-key=$OdsEncKey",
        "--env-vars",
            "ADMIN_POSTGRES_HOST=v6-db-admin",
            "POSTGRES_PORT=5432",
            "POSTGRES_USER=$PostgresUser",
            "POSTGRES_PASSWORD=secretref:postgres-password",
            "ASPNETCORE_ENVIRONMENT=docker",
            "AppSettings__DatabaseEngine=PostgreSql",
            "AppSettings__ApiStartupType=DistrictSpecific",
            "AppSettings__ProductionApiUrl=http://v6-api:80",
            "AppSettings__PathBase=$V6AdminApiVn",
            "Authentication__Authority=$EffectiveBase/$V6AdminApiVn",
            "Authentication__IssuerUrl=$EffectiveBase/$V6AdminApiVn",
            "Authentication__SigningKey=secretref:signing-key",
            "Authentication__AllowRegistration=true",
            "SwaggerSettings__EnableSwagger=true",
            "SwaggerSettings__DefaultTenant=$(Get-EnvOrDefault 'SWAGGER_DEFAULT_TENANT' 'default')",
            "AppSettings__DefaultPageSizeOffset=$(Get-EnvOrDefault 'PAGING_OFFSET' '0')",
            "AppSettings__DefaultPageSizeLimit=$(Get-EnvOrDefault 'PAGING_LIMIT' '25')",
            "AppSettings__MultiTenancy=false",
            "AppSettings__EnableApplicationResetEndpoint=$(Get-EnvOrDefault 'ENABLE_APPLICATION_RESET_ENDPOINT' 'true')",
            "AppSettings__adminApiMode=v1",
            "AppSettings__EncryptionKey=secretref:ods-encryption-key",
            "AppSettings__EnableAdminConsoleAPI=false",
            "Log4NetCore__Log4NetConfigFileName=./log4net/log4net.config",
            "EnableDockerEnvironment=true",
            "AppSettings__AllowedOrigins=$EffectiveBase",
            "EdFiApiDiscoveryUrl=$EffectiveBase/v6-api",
            "ConnectionStrings__EdFi_Admin=host=v6-db-admin;database=EdFi_Admin;username=$PostgresUser;password=$PostgresPassword",
            "ConnectionStrings__EdFi_Security=host=v6-db-admin;database=EdFi_Security;username=$PostgresUser;password=$PostgresPassword"
    )

Write-Host "  Tier 2 complete." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 8: Deploy Tier 3 — AdminApp API, pgAdmin
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 8: Deploying Tier 3 services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$AdminAppApiImage = Get-EnvOrDefault "ADMINAPP_API_IMAGE" "edfialliance/adminapp-api:pre"

New-ContainerApp -Name "edfiadminapp-api" -Image $AdminAppApiImage `
    -Cpu "1.0" -Memory "2.0Gi" -Ingress "internal" -TargetPort 3333 -Transport "http" `
    -ExtraArgs @(
        "--env-vars",
            "DB_SSL=$(Get-EnvOrDefault 'DB_SSL' 'false')",
            "DB_ENGINE=$(Get-EnvOrDefault 'DB_ENGINE' 'pgsql')",
            "DB_TRUST_CERTIFICATE=$(Get-EnvOrDefault 'DB_TRUST_CERTIFICATE' 'false')",
            "DB_TTL_IN_MINUTES=$(Get-EnvOrDefault 'DB_TTL_IN_MINUTES' '120')",
            "USE_YOPASS=$(Get-EnvOrDefault 'USE_YOPASS' 'true')",
            "YOPASS_URL=http://edfiadminapp-yopass:80"
    )

New-ContainerApp -Name "pgadmin4" -Image "dpage/pgadmin4:9.5.0" `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 80 -Transport "http" `
    -ExtraArgs @(
        "--secrets", "pgadmin-password=$(Get-EnvOrDefault 'PGADMIN_DEFAULT_PASSWORD' 'admin')",
        "--env-vars",
            "PGADMIN_DEFAULT_EMAIL=$(Get-EnvOrDefault 'PGADMIN_DEFAULT_EMAIL' 'admin@example.com')",
            "PGADMIN_DEFAULT_PASSWORD=secretref:pgadmin-password"
    )

Write-Host "  Tier 3 complete." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 9: Deploy Tier 4 — AdminApp Frontend
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 9: Deploying Tier 4 services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

New-ContainerApp -Name "edfiadminapp-fe" -Image $FeImage `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "internal" -TargetPort 4200 -Transport "http" `
    -ExtraArgs @(
        "--env-vars",
            "VITE_API_URL=$EffectiveBase/adminapp-api",
            "VITE_OIDC_ID=$(Get-EnvOrDefault 'VITE_OIDC_ID' '1')",
            "VITE_BASE_PATH=$(Get-EnvOrDefault 'VITE_BASE_PATH' '/adminapp/')",
            "VITE_HELP_GUIDE=$(Get-EnvOrDefault 'VITE_HELP_GUIDE' 'https://docs.ed-fi.org/reference/admin-app-v4')",
            "VITE_IDP_ACCOUNT_URL=$EffectiveBase/auth/realms/edfi/account/",
            "VITE_STARTING_GUIDE=$(Get-EnvOrDefault 'VITE_HELP_GUIDE' 'https://docs.ed-fi.org/reference/admin-app-v4')/system-administrators/global-administration-tasks",
            "VITE_CONTACT=$(Get-EnvOrDefault 'VITE_CONTACT' 'https://community.ed-fi.org')",
            "VITE_APPLICATION_NAME=$(Get-EnvOrDefault 'VITE_APPLICATION_NAME' 'Ed-Fi Admin App')"
    )

Write-Host "  Tier 4 complete." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 10: Deploy nginx (external ingress)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 10: Deploying nginx (external)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

New-ContainerApp -Name "nginx" -Image $NginxImage `
    -Cpu "0.5" -Memory "1.0Gi" -Ingress "external" -TargetPort 80 -Transport "http" `
    -ExtraArgs @(
        "--env-vars",
            "ODS_v6_VIRTUAL_NAME=$V6OdsVn",
            "ADMIN_API_v6_VIRTUAL_NAME=$V6AdminApiVn",
            "V7_MULTI_API_VIRTUAL_NAME=$V7MultiApiVn",
            "V7_MULTI_ADMINAPI_VIRTUAL_NAME=$V7MultiAdminApiVn",
            "V7_SINGLE_API_VIRTUAL_NAME=$V7SingleApiVn",
            "V7_SINGLE_ADMIN_API_VIRTUAL=$V7SingleAdminApiVn",
            "EXTERNAL_PORT=443"
    )

Write-Host "  nginx deployed with external ingress." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 11: Capture nginx FQDN and update services
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 11: Updating services with nginx FQDN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$NginxFqdn = az containerapp show `
    --name "nginx" `
    --resource-group $ResourceGroup `
    --query "properties.configuration.ingress.fqdn" -o tsv

$ActualBase = "https://$NginxFqdn"

if ($envVars["BASE_URL"]) {
    $ActualBase = $envVars["BASE_URL"]
    Write-Host "  Using custom BASE_URL: $ActualBase" -ForegroundColor Green
}
else {
    Write-Host "  nginx FQDN: $NginxFqdn" -ForegroundColor Green
    Write-Host "  BASE_URL: $ActualBase" -ForegroundColor Green
}

# Update Keycloak
Write-Host "  Updating edfiadminapp-keycloak..."
az containerapp update --name "edfiadminapp-keycloak" --resource-group $ResourceGroup `
    --set-env-vars "BASE_URL=$ActualBase" "BASE_URL_DEV=$ActualBase" --output none

# Update Admin APIs
$ServicesToUpdate = @(
    @{ Name = "v7-single-adminapi"; PathBase = $V7SingleAdminApiVn; Discovery = "$ActualBase/v7-single-api" },
    @{ Name = "v7-multi-adminapi";  PathBase = $V7MultiAdminApiVn;  Discovery = "$ActualBase/v7-multi-api" },
    @{ Name = "v6-adminapi";        PathBase = $V6AdminApiVn;       Discovery = "$ActualBase/v6-api" }
)

foreach ($svc in $ServicesToUpdate) {
    Write-Host "  Updating $($svc.Name)..."
    az containerapp update --name $svc.Name --resource-group $ResourceGroup `
        --set-env-vars `
            "Authentication__Authority=$ActualBase/$($svc.PathBase)" `
            "Authentication__IssuerUrl=$ActualBase/$($svc.PathBase)" `
            "AppSettings__AllowedOrigins=$ActualBase" `
            "EdFiApiDiscoveryUrl=$($svc.Discovery)" `
        --output none
}

# Update frontend
Write-Host "  Updating edfiadminapp-fe..."
az containerapp update --name "edfiadminapp-fe" --resource-group $ResourceGroup `
    --set-env-vars `
        "VITE_API_URL=$ActualBase/adminapp-api" `
        "VITE_IDP_ACCOUNT_URL=$ActualBase/auth/realms/edfi/account/" `
    --output none

# ---------------------------------------------------------------------------
# Phase 12: Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Resource Group:    $ResourceGroup"
Write-Host "  Environment:       $EnvironmentName"
Write-Host "  Location:          $Location"
Write-Host ""
Write-Host "  Endpoints:" -ForegroundColor Yellow
Write-Host "    Admin App:       $ActualBase/adminapp/"
Write-Host "    Admin App API:   $ActualBase/adminapp-api/api/healthcheck"
Write-Host "    Keycloak:        $ActualBase/auth"
Write-Host "    v7 Single API:   $ActualBase/v7-single-api"
Write-Host "    v7 Single Admin: $ActualBase/v7-single-adminapi"
Write-Host "    v7 Multi API:    $ActualBase/v7-multi-api"
Write-Host "    v7 Multi Admin:  $ActualBase/v7-multi-adminapi"
Write-Host "    v6 API:          $ActualBase/v6-api"
Write-Host "    v6 Admin API:    $ActualBase/v6-adminapi"
Write-Host "    pgAdmin:         $ActualBase/pgadmin"
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor Yellow
Write-Host "    az containerapp list -g $ResourceGroup -o table"
Write-Host "    az containerapp logs show -n <name> -g $ResourceGroup --follow"
Write-Host "    az containerapp exec -n <name> -g $ResourceGroup"
Write-Host ""
