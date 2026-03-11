#!/usr/bin/env bash
# =============================================================================
# Ed-Fi AdminApp — Azure Container Apps Provisioning Script (Bash)
# =============================================================================
# Deploys the full Ed-Fi AdminApp stack (Keycloak, Yopass, ODS/API v6+v7,
# Admin APIs, AdminApp API+FE, nginx reverse proxy) to Azure Container Apps.
#
# Usage:
#   ./deploy.sh                   # PostgreSQL only (default)
#   ./deploy.sh --mssql           # Also deploy MSSQL container
#   ./deploy.sh --use-acr         # Build custom images via Azure Container Registry
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - .env.azure file (copy from .env.azure.example)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
USE_MSSQL_FLAG=false
USE_ACR_FLAG=false
for arg in "$@"; do
  case "$arg" in
    --mssql) USE_MSSQL_FLAG=true ;;
    --use-acr) USE_ACR_FLAG=true ;;
  esac
done

# ---------------------------------------------------------------------------
# Load configuration
# ---------------------------------------------------------------------------
ENV_FILE="${SCRIPT_DIR}/.env.azure"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.azure not found. Copy .env.azure.example to .env.azure and edit it."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Override USE_MSSQL from flag
if [[ "$USE_MSSQL_FLAG" == "true" ]]; then
  USE_MSSQL=true
fi

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
RESOURCE_GROUP="edfiadminapp-network"
LOCATION="${AZURE_LOCATION:-eastus}"
ENVIRONMENT_NAME="edfiadminapp-network"
STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-edfiadminappstore}"

# ---------------------------------------------------------------------------
# Phase 0: Prerequisites
# ---------------------------------------------------------------------------
echo "========================================"
echo "Phase 0: Validating prerequisites"
echo "========================================"

if ! az account show > /dev/null 2>&1; then
  echo "ERROR: Not logged in to Azure CLI. Run 'az login' first."
  exit 1
fi

az extension add --name containerapp --upgrade -y 2>/dev/null || true
az provider register --namespace Microsoft.App --wait 2>/dev/null || true
az provider register --namespace Microsoft.OperationalInsights --wait 2>/dev/null || true

echo "  Azure CLI authenticated."
echo "  containerapp extension ready."

# ---------------------------------------------------------------------------
# Phase 1: Resource Group
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 1: Creating resource group"
echo "========================================"

az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

echo "  Resource group '$RESOURCE_GROUP' created in '$LOCATION'."

# ---------------------------------------------------------------------------
# Phase 2: Container Apps Environment
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 2: Creating Container Apps environment"
echo "========================================"

az containerapp env create \
  --name "$ENVIRONMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --logs-destination none \
  --output none

echo "  Environment '$ENVIRONMENT_NAME' created."

# ---------------------------------------------------------------------------
# Phase 3: Azure Files Storage
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 3: Creating Azure Files storage"
echo "========================================"

az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --output none

STORAGE_KEY=$(az storage account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --account-name "$STORAGE_ACCOUNT" \
  --query "[0].value" -o tsv)

echo "  Storage account '$STORAGE_ACCOUNT' created."

# Create file shares and register with environment
SHARES=(
  vol-edfiadminapp-keycloak
  vol-edfiadminapp-db
  vol-edfiadminapp-mssql
  vol-edfiadminapp-api-logs
  vol-v7-single-db-ods
  vol-db-admin-7x
  vol-v7-tenant1-db-ods
  vol-v7-tenant2-db-ods
  vol-v7-tenant1-db-admin
  vol-v7-tenant2-db-admin
  vol-db-admin-6x
  vol-db-ods-6x-255901
  vol-db-ods-6x-255902
  pgadmin-data
)

for share in "${SHARES[@]}"; do
  az storage share-rm create \
    --storage-account "$STORAGE_ACCOUNT" \
    --name "$share" \
    --quota 5 \
    --output none

  az containerapp env storage set \
    --name "$ENVIRONMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --storage-name "$share" \
    --azure-file-account-name "$STORAGE_ACCOUNT" \
    --azure-file-account-key "$STORAGE_KEY" \
    --azure-file-share-name "$share" \
    --access-mode ReadWrite \
    --output none

  echo "  Share '$share' created and registered."
done

# ---------------------------------------------------------------------------
# Phase 4: Build and push custom images
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 4: Building custom images"
echo "========================================"

if [[ "$USE_ACR_FLAG" == "true" && -n "${ACR_NAME:-}" ]]; then
  echo "  Using Azure Container Registry: $ACR_NAME"

  az acr create \
    --name "$ACR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --sku Basic \
    --admin-enabled true \
    --output none 2>/dev/null || true

  ACR_SERVER="${ACR_NAME}.azurecr.io"

  # Enable ACA environment to pull from ACR
  az containerapp env update \
    --name "$ENVIRONMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --output none || true

  # Build keycloak
  echo "  Building keycloak image..."
  cp "$SCRIPT_DIR/config/realm-config.json" "$SCRIPT_DIR/images/keycloak/"
  cp "$SCRIPT_DIR/config/healthcheck.sh" "$SCRIPT_DIR/images/keycloak/"
  az acr build --registry "$ACR_NAME" \
    --image edfiadminapp-keycloak:latest \
    --file "$SCRIPT_DIR/images/keycloak/Dockerfile" \
    "$SCRIPT_DIR/images/keycloak/" --output none

  # Build nginx
  echo "  Building nginx image..."
  cp "$SCRIPT_DIR/config/default.conf.template" "$SCRIPT_DIR/images/nginx/"
  az acr build --registry "$ACR_NAME" \
    --image edfiadminapp-nginx:latest \
    --file "$SCRIPT_DIR/images/nginx/Dockerfile" \
    "$SCRIPT_DIR/images/nginx/" --output none

  # Build v7-multi-api
  echo "  Building v7-multi-api image..."
  cp "$SCRIPT_DIR/config/appsettings.dockertemplate.json" "$SCRIPT_DIR/images/v7-multi-api/"
  az acr build --registry "$ACR_NAME" \
    --image v7-multi-api:latest \
    --build-arg "ODS_API_TAG=${ODS_API_TAG_7X}" \
    --file "$SCRIPT_DIR/images/v7-multi-api/Dockerfile" \
    "$SCRIPT_DIR/images/v7-multi-api/" --output none

  # Build v7-multi-adminapi
  echo "  Building v7-multi-adminapi image..."
  cp "$SCRIPT_DIR/config/appsettings.dockertemplate.json" "$SCRIPT_DIR/images/v7-multi-adminapi/"
  cp "$SCRIPT_DIR/config/log4net.config" "$SCRIPT_DIR/images/v7-multi-adminapi/"
  az acr build --registry "$ACR_NAME" \
    --image v7-multi-adminapi:latest \
    --build-arg "ADMIN_API_TAG=${ADMIN_API_TAG_7X}" \
    --file "$SCRIPT_DIR/images/v7-multi-adminapi/Dockerfile" \
    "$SCRIPT_DIR/images/v7-multi-adminapi/" --output none

  # Build db-admin
  echo "  Building db-admin image..."
  cp "$SCRIPT_DIR/config/bootstrap.sh" "$SCRIPT_DIR/images/db-admin/"
  az acr build --registry "$ACR_NAME" \
    --image db-admin:latest \
    --build-arg "ADMIN_DB_TAG=${ADMIN_DB_TAG_7X}" \
    --file "$SCRIPT_DIR/images/db-admin/Dockerfile" \
    "$SCRIPT_DIR/images/db-admin/" --output none

  # Build admin-api (log4net wrapper)
  echo "  Building admin-api image..."
  cp "$SCRIPT_DIR/config/log4net.config" "$SCRIPT_DIR/images/admin-api/"
  az acr build --registry "$ACR_NAME" \
    --image admin-api:latest \
    --build-arg "ADMIN_API_TAG=${ADMIN_API_TAG_7X}" \
    --file "$SCRIPT_DIR/images/admin-api/Dockerfile" \
    "$SCRIPT_DIR/images/admin-api/" --output none

  # Build edfiadminapp-fe
  echo "  Building edfiadminapp-fe image..."
  cp "$SCRIPT_DIR/config/nginx.conf" "$SCRIPT_DIR/images/edfiadminapp-fe/"
  az acr build --registry "$ACR_NAME" \
    --image edfiadminapp-fe:latest \
    --build-arg "FE_IMAGE=${ADMINAPP_FE_IMAGE}" \
    --file "$SCRIPT_DIR/images/edfiadminapp-fe/Dockerfile" \
    "$SCRIPT_DIR/images/edfiadminapp-fe/" --output none

  # Set image references
  KEYCLOAK_IMAGE="${ACR_SERVER}/edfiadminapp-keycloak:latest"
  NGINX_IMAGE="${ACR_SERVER}/edfiadminapp-nginx:latest"
  V7_MULTI_API_IMAGE="${ACR_SERVER}/v7-multi-api:latest"
  V7_MULTI_ADMINAPI_IMAGE="${ACR_SERVER}/v7-multi-adminapi:latest"
  DB_ADMIN_IMAGE="${ACR_SERVER}/db-admin:latest"
  ADMIN_API_IMAGE="${ACR_SERVER}/admin-api:latest"
  FE_IMAGE="${ACR_SERVER}/edfiadminapp-fe:latest"

  # Get ACR credentials for container apps
  ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query "username" -o tsv)
  ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
  REGISTRY_ARGS="--registry-server ${ACR_SERVER} --registry-username ${ACR_USERNAME} --registry-password ${ACR_PASSWORD}"
else
  echo "  Using Docker Hub images (no ACR). Custom images require local docker build+push."
  echo "  NOTE: For services needing custom images (keycloak, nginx, multi-api, multi-adminapi,"
  echo "        db-admin, admin-api, fe), build locally and push to Docker Hub, or re-run with --use-acr."
  echo ""
  echo "  Falling back to base images with command overrides where possible."

  KEYCLOAK_IMAGE="quay.io/keycloak/keycloak:${KEYCLOAK_TAG:-26.1}"
  NGINX_IMAGE="nginx:1.28.0-alpine3.21"
  V7_MULTI_API_IMAGE="edfialliance/ods-api-web-api:${ODS_API_TAG_7X}"
  V7_MULTI_ADMINAPI_IMAGE="edfialliance/ods-admin-api:${ADMIN_API_TAG_7X}"
  DB_ADMIN_IMAGE="edfialliance/ods-admin-api-db:${ADMIN_DB_TAG_7X}"
  ADMIN_API_IMAGE="edfialliance/ods-admin-api:${ADMIN_API_TAG_7X}"
  FE_IMAGE="${ADMINAPP_FE_IMAGE:-edfialliance/adminapp-fe:pre}"
  REGISTRY_ARGS=""
fi

# ---------------------------------------------------------------------------
# Helper: create a container app
# ---------------------------------------------------------------------------
create_app() {
  local name="$1"
  local image="$2"
  local cpu="$3"
  local memory="$4"
  local ingress="$5"      # internal or external
  local target_port="$6"
  local transport="$7"    # auto, http, tcp
  shift 7
  # remaining args are --env-vars, --secrets, --command, etc.

  echo "  Deploying: $name"
  az containerapp create \
    --name "$name" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENVIRONMENT_NAME" \
    --image "$image" \
    --cpu "$cpu" --memory "$memory" \
    --min-replicas 1 --max-replicas 1 \
    --ingress "$ingress" --target-port "$target_port" \
    --transport "$transport" \
    $REGISTRY_ARGS \
    "$@" \
    --output none
}

# ---------------------------------------------------------------------------
# Phase 5: Deploy Tier 1 — Databases, Keycloak, Memcached (no dependencies)
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 5: Deploying Tier 1 services"
echo "========================================"

# -- memcached --
create_app "memcached" "memcached:latest" 0.25 0.5Gi internal 11211 tcp

# -- edfiadminapp-postgres --
create_app "edfiadminapp-postgres" "postgres:${POSTGRESQL_IMAGE_TAG:-16.2}" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "POSTGRES_DB=${ADMIN_APP_DB_NAME:-sbaa}" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

# -- MSSQL (optional) --
if [[ "${USE_MSSQL:-false}" == "true" ]]; then
  create_app "edfiadminapp-mssql" "mcr.microsoft.com/mssql/server:${MSSQL_IMAGE_TAG:-2022-latest}" 2.0 4.0Gi internal 1433 tcp \
    --secrets "mssql-sa-password=${MSSQL_SA_PASSWORD}" \
    --env-vars \
      "ACCEPT_EULA=Y" \
      "SA_PASSWORD=secretref:mssql-sa-password" \
      "MSSQL_PID=Express"
fi

# -- edfiadminapp-keycloak --
create_app "edfiadminapp-keycloak" "$KEYCLOAK_IMAGE" 1.0 2.0Gi internal 8080 http \
  --secrets \
    "keycloak-admin-password=${KEYCLOAK_ADMIN_PASSWORD}" \
    "keycloak-client-secret=${KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET}" \
    "keycloak-dev-client-secret=${KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET}" \
  --env-vars \
    "KC_BOOTSTRAP_ADMIN_USERNAME=${KEYCLOAK_ADMIN}" \
    "KC_BOOTSTRAP_ADMIN_PASSWORD=secretref:keycloak-admin-password" \
    "KC_HOSTNAME_BACKCHANNEL_DYNAMIC=false" \
    "KC_HOSTNAME_STRICT=false" \
    "KC_HTTP_RELATIVE_PATH=/auth" \
    "KC_HTTP_ENABLED=true" \
    "KC_PROXY_HEADERS=xforwarded" \
    "KC_LOG_CONSOLE_LEVEL=${KC_LOG_CONSOLE_LEVEL:-error}" \
    "KC_LOG=file,console" \
    "KC_HEALTH_ENABLED=true" \
    "BASE_URL=${BASE_URL:-https://placeholder.azurecontainerapps.io}" \
    "BASE_URL_DEV=${BASE_URL:-https://placeholder.azurecontainerapps.io}" \
    "KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET=secretref:keycloak-client-secret" \
    "KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET=secretref:keycloak-dev-client-secret"

# -- v7 Single Tenant DBs --
create_app "v7-single-db-ods" "edfialliance/${ODS_DB_IMAGE_7X}:${ODS_DB_TAG_7X}" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "TPDM_ENABLED=${TPDM_ENABLED:-true}" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

create_app "v7-single-db-admin" "$DB_ADMIN_IMAGE" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "ODS_PGBOUNCER_PORT=5432" \
    "ODS_POSTGRES_HOST=v7-single-db-ods" \
    "NPG_POOLING_ENABLED=${NPG_POOLING_ENABLED:-true}" \
    "NPG_API_MAX_POOL_SIZE_ODS=${NPG_API_MAX_POOL_SIZE_ODS:-20}" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

# -- v7 Multi-Tenant DBs --
create_app "v7-tenant1-db-ods" "edfialliance/${ODS_DB_IMAGE_7X}:${ODS_DB_TAG_7X}" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "TPDM_ENABLED=${TPDM_ENABLED:-true}" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

create_app "v7-tenant2-db-ods" "edfialliance/${ODS_DB_IMAGE_7X}:${ODS_DB_TAG_7X}" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "TPDM_ENABLED=${TPDM_ENABLED:-true}" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

create_app "v7-tenant1-db-admin" "$DB_ADMIN_IMAGE" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "ODS_PGBOUNCER_PORT=5432" \
    "ODS_POSTGRES_HOST=v7-tenant1-db-ods" \
    "NPG_POOLING_ENABLED=${NPG_POOLING_ENABLED:-true}" \
    "NPG_API_MAX_POOL_SIZE_ODS=${NPG_API_MAX_POOL_SIZE_ODS:-20}" \
    "TENANT_IDENTIFIER=tenant1" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

create_app "v7-tenant2-db-admin" "$DB_ADMIN_IMAGE" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "ODS_PGBOUNCER_PORT=5432" \
    "ODS_POSTGRES_HOST=v7-tenant2-db-ods" \
    "NPG_POOLING_ENABLED=${NPG_POOLING_ENABLED:-true}" \
    "NPG_API_MAX_POOL_SIZE_ODS=${NPG_API_MAX_POOL_SIZE_ODS:-20}" \
    "TENANT_IDENTIFIER=tenant2" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

# -- v6 DBs --
create_app "v6-db-admin" "edfialliance/ods-admin-api-db:${ADMIN_DB_TAG_6X}" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "API_MODE=DistrictSpecific" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

# ACA names cannot have underscores; use hyphens
create_app "v6-edfi-ods-255901" "edfialliance/${ODS_DB_IMAGE_6X}:${ODS_DB_TAG_6X}" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "TPDM_ENABLED=${TPDM_ENABLED:-true}" \
    "ODS_DB=EdFi_Ods_255901" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

create_app "v6-edfi-ods-255902" "edfialliance/${ODS_DB_IMAGE_6X}:${ODS_DB_TAG_6X}" 0.5 1.0Gi internal 5432 tcp \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "TPDM_ENABLED=${TPDM_ENABLED:-true}" \
    "ODS_DB=EdFi_Ods_255902" \
    "PGDATA=/var/lib/postgresql/data/pgdata"

echo "  Tier 1 complete."

# ---------------------------------------------------------------------------
# Phase 6: Wait for Tier 1 readiness
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 6: Waiting for Tier 1 services"
echo "========================================"

wait_for_app() {
  local name="$1"
  local max_wait="${2:-300}"
  local elapsed=0
  echo -n "  Waiting for $name..."
  while [[ $elapsed -lt $max_wait ]]; do
    local status
    status=$(az containerapp show \
      --name "$name" \
      --resource-group "$RESOURCE_GROUP" \
      --query "properties.runningStatus" -o tsv 2>/dev/null || echo "Unknown")
    if [[ "$status" == "Running" ]]; then
      echo " Running."
      return 0
    fi
    sleep 10
    elapsed=$((elapsed + 10))
    echo -n "."
  done
  echo " TIMEOUT (may still be starting)."
}

wait_for_app "edfiadminapp-postgres"
wait_for_app "edfiadminapp-keycloak" 600
wait_for_app "memcached"
wait_for_app "v7-single-db-ods"
wait_for_app "v7-single-db-admin"
wait_for_app "v7-tenant1-db-ods"
wait_for_app "v7-tenant2-db-ods"
wait_for_app "v7-tenant1-db-admin"
wait_for_app "v7-tenant2-db-admin"
wait_for_app "v6-db-admin"
wait_for_app "v6-edfi-ods-255901"
wait_for_app "v6-edfi-ods-255902"

# ---------------------------------------------------------------------------
# Phase 7: Deploy Tier 2 — APIs and Yopass
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 7: Deploying Tier 2 services"
echo "========================================"

# Placeholder BASE_URL for initial deploy — updated in Phase 11
PLACEHOLDER_BASE="https://placeholder.azurecontainerapps.io"
EFFECTIVE_BASE="${BASE_URL:-$PLACEHOLDER_BASE}"

# -- yopass --
create_app "edfiadminapp-yopass" "jhaals/yopass" 0.25 0.5Gi internal 80 http \
  --args "--memcached=memcached:11211" "--port" "80"

# -- v7 Single API --
create_app "v7-single-api" "edfialliance/ods-api-web-api:${ODS_API_TAG_7X}" 1.0 2.0Gi internal 80 http \
  --secrets \
    "postgres-password=${POSTGRES_PASSWORD}" \
    "ods-encryption-key=${ODS_CONNECTION_STRING_ENCRYPTION_KEY}" \
  --env-vars \
    "ADMIN_POSTGRES_HOST=v7-single-db-admin" \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "POSTGRES_PORT=5432" \
    "PATH_BASE=${V7_SINGLE_API_VIRTUAL_NAME}" \
    "TPDM_ENABLED=${TPDM_ENABLED:-true}" \
    "ODS_WAIT_POSTGRES_HOSTS=v7-single-db-ods" \
    "NPG_POOLING_ENABLED=${NPG_POOLING_ENABLED:-true}" \
    "NPG_API_MAX_POOL_SIZE_ODS=${NPG_API_MAX_POOL_SIZE_ODS:-20}" \
    "NPG_API_MAX_POOL_SIZE_ADMIN=${NPG_API_MAX_POOL_SIZE_ADMIN:-20}" \
    "NPG_API_MAX_POOL_SIZE_SECURITY=${NPG_API_MAX_POOL_SIZE_SECURITY:-20}" \
    "NPG_API_MAX_POOL_SIZE_MASTER=${NPG_API_MAX_POOL_SIZE_MASTER:-20}" \
    "ODS_CONNECTION_STRING_ENCRYPTION_KEY=secretref:ods-encryption-key" \
    "ASPNETCORE_ENVIRONMENT=docker" \
    "FeatureManagement__MultiTenancy=false" \
    "ApiSettings__OdsContextRouteTemplate={instanceId}"

# -- v7 Single AdminAPI --
create_app "v7-single-adminapi" "$ADMIN_API_IMAGE" 0.5 1.0Gi internal 80 http \
  --secrets \
    "postgres-password=${POSTGRES_PASSWORD}" \
    "signing-key=${SIGNING_KEY}" \
    "ods-encryption-key=${ODS_CONNECTION_STRING_ENCRYPTION_KEY}" \
  --env-vars \
    "ADMIN_POSTGRES_HOST=v7-single-db-admin" \
    "POSTGRES_PORT=5432" \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "ASPNETCORE_ENVIRONMENT=docker" \
    "AppSettings__DatabaseEngine=PostgreSql" \
    "AppSettings__PathBase=${V7_SINGLE_ADMIN_API_VIRTUAL}" \
    "Authentication__Authority=${EFFECTIVE_BASE}/${V7_SINGLE_ADMIN_API_VIRTUAL}" \
    "Authentication__IssuerUrl=${EFFECTIVE_BASE}/${V7_SINGLE_ADMIN_API_VIRTUAL}" \
    "Authentication__SigningKey=secretref:signing-key" \
    "Authentication__AllowRegistration=true" \
    "AppSettings__DefaultPageSizeOffset=${PAGING_OFFSET:-0}" \
    "AppSettings__DefaultPageSizeLimit=${PAGING_LIMIT:-25}" \
    "AppSettings__MultiTenancy=false" \
    "AppSettings__EncryptionKey=secretref:ods-encryption-key" \
    "SwaggerSettings__EnableSwagger=true" \
    "SwaggerSettings__DefaultTenant=${SWAGGER_DEFAULT_TENANT:-tenant1}" \
    "Log4NetCore__Log4NetConfigFileName=./log4net/log4net.config" \
    "EnableDockerEnvironment=true" \
    "AppSettings__AllowedOrigins=${EFFECTIVE_BASE}" \
    "AppSettings__EnableApplicationResetEndpoint=${ENABLE_APPLICATION_RESET_ENDPOINT:-true}" \
    "ConnectionStrings__EdFi_Admin=host=v7-single-db-admin;port=5432;username=${POSTGRES_USER};password=${POSTGRES_PASSWORD};database=EdFi_Admin;" \
    "ConnectionStrings__EdFi_Security=host=v7-single-db-admin;port=5432;username=${POSTGRES_USER};password=${POSTGRES_PASSWORD};database=EdFi_Security;" \
    "EdFiApiDiscoveryUrl=${EFFECTIVE_BASE}/v7-single-api"

# -- v7 Multi API --
create_app "v7-multi-api" "$V7_MULTI_API_IMAGE" 1.0 2.0Gi internal 80 http \
  --secrets \
    "postgres-password=${POSTGRES_PASSWORD}" \
    "ods-encryption-key=${ODS_CONNECTION_STRING_ENCRYPTION_KEY}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "POSTGRES_PORT=5432" \
    "PATH_BASE=${V7_MULTI_API_VIRTUAL_NAME}" \
    "TPDM_ENABLED=${TPDM_ENABLED:-true}" \
    "ODS_WAIT_POSTGRES_HOSTS=v7-tenant1-db-ods v7-tenant2-db-ods" \
    "NPG_POOLING_ENABLED=${NPG_POOLING_ENABLED:-true}" \
    "NPG_API_MAX_POOL_SIZE_ODS=${NPG_API_MAX_POOL_SIZE_ODS:-20}" \
    "NPG_API_MAX_POOL_SIZE_ADMIN=${NPG_API_MAX_POOL_SIZE_ADMIN:-20}" \
    "NPG_API_MAX_POOL_SIZE_SECURITY=${NPG_API_MAX_POOL_SIZE_SECURITY:-20}" \
    "NPG_API_MAX_POOL_SIZE_MASTER=${NPG_API_MAX_POOL_SIZE_MASTER:-20}" \
    "ODS_CONNECTION_STRING_ENCRYPTION_KEY=secretref:ods-encryption-key" \
    "ASPNETCORE_ENVIRONMENT=docker"

# -- v7 Multi AdminAPI --
create_app "v7-multi-adminapi" "$V7_MULTI_ADMINAPI_IMAGE" 0.5 1.0Gi internal 80 http \
  --secrets \
    "postgres-password=${POSTGRES_PASSWORD}" \
    "signing-key=${SIGNING_KEY}" \
    "ods-encryption-key=${ODS_CONNECTION_STRING_ENCRYPTION_KEY}" \
  --env-vars \
    "ADMIN_WAIT_POSTGRES_HOSTS=v7-tenant1-db-admin v7-tenant2-db-admin" \
    "POSTGRES_PORT=5432" \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "ASPNETCORE_ENVIRONMENT=multitenantdocker" \
    "AppSettings__DatabaseEngine=PostgreSql" \
    "AppSettings__PathBase=${V7_MULTI_ADMINAPI_VIRTUAL_NAME}" \
    "Authentication__Authority=${EFFECTIVE_BASE}/${V7_MULTI_ADMINAPI_VIRTUAL_NAME}" \
    "Authentication__IssuerUrl=${EFFECTIVE_BASE}/${V7_MULTI_ADMINAPI_VIRTUAL_NAME}" \
    "Authentication__SigningKey=secretref:signing-key" \
    "Authentication__AllowRegistration=true" \
    "AppSettings__DefaultPageSizeOffset=${PAGING_OFFSET:-0}" \
    "AppSettings__DefaultPageSizeLimit=${PAGING_LIMIT:-25}" \
    "AppSettings__MultiTenancy=${MULTITENANCY_ENABLED:-true}" \
    "AppSettings__EnableApplicationResetEndpoint=${ENABLE_APPLICATION_RESET_ENDPOINT:-true}" \
    "AppSettings__EncryptionKey=secretref:ods-encryption-key" \
    "SwaggerSettings__EnableSwagger=true" \
    "SwaggerSettings__DefaultTenant=${SWAGGER_DEFAULT_TENANT:-tenant1}" \
    "Log4NetCore__Log4NetConfigFileName=./log4net/log4net.config" \
    "EnableDockerEnvironment=true" \
    "AppSettings__AllowedOrigins=${EFFECTIVE_BASE}" \
    "IpRateLimiting__GeneralRules__0__Limit=25" \
    "EdFiApiDiscoveryUrl=${EFFECTIVE_BASE}/v7-multi-api"

# -- v6 API --
create_app "v6-api" "edfialliance/ods-api-web-api:${ODS_API_TAG_6X}" 1.0 2.0Gi internal 80 http \
  --secrets "postgres-password=${POSTGRES_PASSWORD}" \
  --env-vars \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "POSTGRES_PORT=5432" \
    "ODS_POSTGRES_HOST=v6-edfi-{0}" \
    "ADMIN_POSTGRES_HOST=v6-db-admin" \
    "API_MODE=DistrictSpecific" \
    "ApiSettings__PathBase=${V6_ODS_VIRTUAL_NAME}" \
    "TPDM_ENABLED=${TPDM_ENABLED:-true}" \
    "ODS_WAIT_POSTGRES_HOSTS=v6-edfi-ods-255901 v6-edfi-ods-255902" \
    "NPG_POOLING_ENABLED=${NPG_POOLING_ENABLED:-true}" \
    "NPG_API_MAX_POOL_SIZE_ODS=${NPG_API_MAX_POOL_SIZE_ODS:-20}" \
    "NPG_API_MAX_POOL_SIZE_ADMIN=${NPG_API_MAX_POOL_SIZE_ADMIN:-20}" \
    "NPG_API_MAX_POOL_SIZE_SECURITY=${NPG_API_MAX_POOL_SIZE_SECURITY:-20}" \
    "NPG_API_MAX_POOL_SIZE_MASTER=${NPG_API_MAX_POOL_SIZE_MASTER:-20}"

# -- v6 AdminAPI --
create_app "v6-adminapi" "$ADMIN_API_IMAGE" 0.5 1.0Gi internal 80 http \
  --secrets \
    "postgres-password=${POSTGRES_PASSWORD}" \
    "signing-key=${SIGNING_KEY}" \
    "ods-encryption-key=${ODS_CONNECTION_STRING_ENCRYPTION_KEY}" \
  --env-vars \
    "ADMIN_POSTGRES_HOST=v6-db-admin" \
    "POSTGRES_PORT=5432" \
    "POSTGRES_USER=${POSTGRES_USER}" \
    "POSTGRES_PASSWORD=secretref:postgres-password" \
    "ASPNETCORE_ENVIRONMENT=docker" \
    "AppSettings__DatabaseEngine=PostgreSql" \
    "AppSettings__ApiStartupType=DistrictSpecific" \
    "AppSettings__ProductionApiUrl=http://v6-api:80" \
    "AppSettings__PathBase=${V6_ADMIN_API_VIRTUAL_NAME}" \
    "Authentication__Authority=${EFFECTIVE_BASE}/${V6_ADMIN_API_VIRTUAL_NAME}" \
    "Authentication__IssuerUrl=${EFFECTIVE_BASE}/${V6_ADMIN_API_VIRTUAL_NAME}" \
    "Authentication__SigningKey=secretref:signing-key" \
    "Authentication__AllowRegistration=true" \
    "SwaggerSettings__EnableSwagger=true" \
    "SwaggerSettings__DefaultTenant=${SWAGGER_DEFAULT_TENANT:-default}" \
    "AppSettings__DefaultPageSizeOffset=${PAGING_OFFSET:-0}" \
    "AppSettings__DefaultPageSizeLimit=${PAGING_LIMIT:-25}" \
    "AppSettings__MultiTenancy=false" \
    "AppSettings__EnableApplicationResetEndpoint=${ENABLE_APPLICATION_RESET_ENDPOINT:-true}" \
    "AppSettings__adminApiMode=v1" \
    "AppSettings__EncryptionKey=secretref:ods-encryption-key" \
    "AppSettings__EnableAdminConsoleAPI=false" \
    "Log4NetCore__Log4NetConfigFileName=./log4net/log4net.config" \
    "EnableDockerEnvironment=true" \
    "AppSettings__AllowedOrigins=${EFFECTIVE_BASE}" \
    "EdFiApiDiscoveryUrl=${EFFECTIVE_BASE}/v6-api" \
    "ConnectionStrings__EdFi_Admin=host=v6-db-admin;database=EdFi_Admin;username=${POSTGRES_USER};password=${POSTGRES_PASSWORD}" \
    "ConnectionStrings__EdFi_Security=host=v6-db-admin;database=EdFi_Security;username=${POSTGRES_USER};password=${POSTGRES_PASSWORD}"

echo "  Tier 2 complete."

# ---------------------------------------------------------------------------
# Phase 8: Deploy Tier 3 — AdminApp API, pgAdmin
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 8: Deploying Tier 3 services"
echo "========================================"

create_app "edfiadminapp-api" "${ADMINAPP_API_IMAGE:-edfialliance/adminapp-api:pre}" 1.0 2.0Gi internal 3333 http \
  $REGISTRY_ARGS \
  --env-vars \
    "DB_SSL=${DB_SSL:-false}" \
    "DB_ENGINE=${DB_ENGINE:-pgsql}" \
    "DB_TRUST_CERTIFICATE=${DB_TRUST_CERTIFICATE:-false}" \
    "DB_TTL_IN_MINUTES=${DB_TTL_IN_MINUTES:-120}" \
    "USE_YOPASS=${USE_YOPASS:-true}" \
    "YOPASS_URL=http://edfiadminapp-yopass:80"

create_app "pgadmin4" "dpage/pgadmin4:9.5.0" 0.5 1.0Gi internal 80 http \
  --secrets "pgadmin-password=${PGADMIN_DEFAULT_PASSWORD:-admin}" \
  --env-vars \
    "PGADMIN_DEFAULT_EMAIL=${PGADMIN_DEFAULT_EMAIL:-admin@example.com}" \
    "PGADMIN_DEFAULT_PASSWORD=secretref:pgadmin-password"

echo "  Tier 3 complete."

# ---------------------------------------------------------------------------
# Phase 9: Deploy Tier 4 — AdminApp Frontend
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 9: Deploying Tier 4 services"
echo "========================================"

create_app "edfiadminapp-fe" "$FE_IMAGE" 0.5 1.0Gi internal 4200 http \
  --env-vars \
    "VITE_API_URL=${EFFECTIVE_BASE}/adminapp-api" \
    "VITE_OIDC_ID=${VITE_OIDC_ID:-1}" \
    "VITE_BASE_PATH=${VITE_BASE_PATH:-/adminapp/}" \
    "VITE_HELP_GUIDE=${VITE_HELP_GUIDE:-https://docs.ed-fi.org/reference/admin-app-v4}" \
    "VITE_IDP_ACCOUNT_URL=${EFFECTIVE_BASE}/auth/realms/edfi/account/" \
    "VITE_STARTING_GUIDE=${VITE_HELP_GUIDE:-https://docs.ed-fi.org/reference/admin-app-v4}/system-administrators/global-administration-tasks" \
    "VITE_CONTACT=${VITE_CONTACT:-https://community.ed-fi.org}" \
    "VITE_APPLICATION_NAME=${VITE_APPLICATION_NAME:-Ed-Fi Admin App}"

echo "  Tier 4 complete."

# ---------------------------------------------------------------------------
# Phase 10: Deploy nginx (external ingress)
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 10: Deploying nginx (external)"
echo "========================================"

create_app "nginx" "$NGINX_IMAGE" 0.5 1.0Gi external 80 http \
  --env-vars \
    "ODS_v6_VIRTUAL_NAME=${V6_ODS_VIRTUAL_NAME}" \
    "ADMIN_API_v6_VIRTUAL_NAME=${V6_ADMIN_API_VIRTUAL_NAME}" \
    "V7_MULTI_API_VIRTUAL_NAME=${V7_MULTI_API_VIRTUAL_NAME}" \
    "V7_MULTI_ADMINAPI_VIRTUAL_NAME=${V7_MULTI_ADMINAPI_VIRTUAL_NAME}" \
    "V7_SINGLE_API_VIRTUAL_NAME=${V7_SINGLE_API_VIRTUAL_NAME}" \
    "V7_SINGLE_ADMIN_API_VIRTUAL=${V7_SINGLE_ADMIN_API_VIRTUAL}" \
    "EXTERNAL_PORT=443"

echo "  nginx deployed with external ingress."

# ---------------------------------------------------------------------------
# Phase 11: Capture nginx FQDN and update services
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 11: Updating services with nginx FQDN"
echo "========================================"

NGINX_FQDN=$(az containerapp show \
  --name "nginx" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

ACTUAL_BASE="https://${NGINX_FQDN}"

# If user set a custom BASE_URL, use that instead
if [[ -n "${BASE_URL:-}" && "${BASE_URL}" != "" ]]; then
  ACTUAL_BASE="${BASE_URL}"
  echo "  Using custom BASE_URL: $ACTUAL_BASE"
else
  echo "  nginx FQDN: $NGINX_FQDN"
  echo "  BASE_URL: $ACTUAL_BASE"
fi

# Update Keycloak
echo "  Updating edfiadminapp-keycloak..."
az containerapp update \
  --name "edfiadminapp-keycloak" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    "BASE_URL=${ACTUAL_BASE}" \
    "BASE_URL_DEV=${ACTUAL_BASE}" \
  --output none

# Update services that reference BASE_URL
SERVICES_WITH_BASE_URL=(
  "v7-single-adminapi"
  "v7-multi-adminapi"
  "v6-adminapi"
)

for svc in "${SERVICES_WITH_BASE_URL[@]}"; do
  echo "  Updating $svc..."
  # Determine the path base for this service
  case "$svc" in
    v7-single-adminapi)
      PATH_BASE_VAL="${V7_SINGLE_ADMIN_API_VIRTUAL}"
      DISCOVERY_URL="${ACTUAL_BASE}/v7-single-api"
      ;;
    v7-multi-adminapi)
      PATH_BASE_VAL="${V7_MULTI_ADMINAPI_VIRTUAL_NAME}"
      DISCOVERY_URL="${ACTUAL_BASE}/v7-multi-api"
      ;;
    v6-adminapi)
      PATH_BASE_VAL="${V6_ADMIN_API_VIRTUAL_NAME}"
      DISCOVERY_URL="${ACTUAL_BASE}/v6-api"
      ;;
  esac

  az containerapp update \
    --name "$svc" \
    --resource-group "$RESOURCE_GROUP" \
    --set-env-vars \
      "Authentication__Authority=${ACTUAL_BASE}/${PATH_BASE_VAL}" \
      "Authentication__IssuerUrl=${ACTUAL_BASE}/${PATH_BASE_VAL}" \
      "AppSettings__AllowedOrigins=${ACTUAL_BASE}" \
      "EdFiApiDiscoveryUrl=${DISCOVERY_URL}" \
    --output none
done

# Update frontend
echo "  Updating edfiadminapp-fe..."
az containerapp update \
  --name "edfiadminapp-fe" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    "VITE_API_URL=${ACTUAL_BASE}/adminapp-api" \
    "VITE_IDP_ACCOUNT_URL=${ACTUAL_BASE}/auth/realms/edfi/account/" \
  --output none

# ---------------------------------------------------------------------------
# Phase 12: Summary
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "  Resource Group:    $RESOURCE_GROUP"
echo "  Environment:       $ENVIRONMENT_NAME"
echo "  Location:          $LOCATION"
echo ""
echo "  Endpoints:"
echo "    Admin App:       ${ACTUAL_BASE}/adminapp/"
echo "    Admin App API:   ${ACTUAL_BASE}/adminapp-api/api/healthcheck"
echo "    Keycloak:        ${ACTUAL_BASE}/auth"
echo "    v7 Single API:   ${ACTUAL_BASE}/v7-single-api"
echo "    v7 Single Admin: ${ACTUAL_BASE}/v7-single-adminapi"
echo "    v7 Multi API:    ${ACTUAL_BASE}/v7-multi-api"
echo "    v7 Multi Admin:  ${ACTUAL_BASE}/v7-multi-adminapi"
echo "    v6 API:          ${ACTUAL_BASE}/v6-api"
echo "    v6 Admin API:    ${ACTUAL_BASE}/v6-adminapi"
echo "    pgAdmin:         ${ACTUAL_BASE}/pgadmin"
echo ""
echo "  Useful commands:"
echo "    az containerapp list -g $RESOURCE_GROUP -o table"
echo "    az containerapp logs show -n <name> -g $RESOURCE_GROUP --follow"
echo "    az containerapp exec -n <name> -g $RESOURCE_GROUP"
echo ""
