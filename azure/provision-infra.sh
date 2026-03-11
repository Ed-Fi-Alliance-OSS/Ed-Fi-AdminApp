#!/usr/bin/env bash
# =============================================================================
# Ed-Fi AdminApp — Azure Infrastructure Provisioning (Bash)
# =============================================================================
# Provisions only the prerequisite infrastructure for the Ed-Fi AdminApp stack:
#   - Resource group
#   - Azure Container Apps environment
#   - Storage account with all required Azure Files shares
#   - Azure Container Registry (ACR)
#
# Run this before deploy.sh to pre-create shared infrastructure, or use it
# independently in CI/CD pipelines where the full deployment is handled
# separately.
#
# Usage:
#   ./provision-infra.sh                  # Provision storage account and ACR
#   ./provision-infra.sh --skip-acr       # Provision only the storage account
#   ./provision-infra.sh --skip-storage   # Provision only the ACR
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
SKIP_ACR=false
SKIP_STORAGE=false
for arg in "$@"; do
  case "$arg" in
    --skip-acr)     SKIP_ACR=true ;;
    --skip-storage) SKIP_STORAGE=true ;;
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

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
RESOURCE_GROUP="edfiadminapp-network"
LOCATION="${AZURE_LOCATION:-eastus}"
ENVIRONMENT_NAME="edfiadminapp-network"
STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-edfiadminappstore}"
ACR_NAME="${ACR_NAME:-}"

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

if [[ "$SKIP_ACR" == "false" && -z "$ACR_NAME" ]]; then
  echo "ERROR: ACR_NAME is not set in .env.azure. Set it or run with --skip-acr."
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

az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
echo "  Resource group '$RESOURCE_GROUP' ready in '$LOCATION'."

# ---------------------------------------------------------------------------
# Phase 2: Container Apps Environment
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Phase 2: Creating Container Apps environment"
echo "========================================"

if az containerapp env show \
    --name "$ENVIRONMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "name" -o tsv > /dev/null 2>&1; then
  echo "  Environment '$ENVIRONMENT_NAME' already exists, skipping."
else
  az containerapp env create \
    --name "$ENVIRONMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --logs-destination none \
    --output none

  echo "  Environment '$ENVIRONMENT_NAME' created."
fi

# ---------------------------------------------------------------------------
# Phase 3: Storage Account and File Shares
# ---------------------------------------------------------------------------
if [[ "$SKIP_STORAGE" == "true" ]]; then
  echo ""
  echo "  Skipping storage account (--skip-storage specified)."
else
  echo ""
  echo "========================================"
  echo "Phase 3: Creating storage account and file shares"
  echo "========================================"

  if az storage account show \
      --name "$STORAGE_ACCOUNT" \
      --resource-group "$RESOURCE_GROUP" \
      --query "name" -o tsv > /dev/null 2>&1; then
    echo "  Storage account '$STORAGE_ACCOUNT' already exists, skipping creation."
  else
    az storage account create \
      --name "$STORAGE_ACCOUNT" \
      --resource-group "$RESOURCE_GROUP" \
      --location "$LOCATION" \
      --sku Standard_LRS \
      --kind StorageV2 \
      --output none

    echo "  Storage account '$STORAGE_ACCOUNT' created."
  fi

  STORAGE_KEY=$(az storage account keys list \
    --resource-group "$RESOURCE_GROUP" \
    --account-name "$STORAGE_ACCOUNT" \
    --query "[0].value" -o tsv)

  SHARES=(
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

  for share in "${SHARES[@]}"; do
    if az storage share-rm show \
        --storage-account "$STORAGE_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --name "$share" \
        --query "name" -o tsv > /dev/null 2>&1; then
      echo "  Share '$share' already exists, skipping creation."
    else
      az storage share-rm create \
        --storage-account "$STORAGE_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --name "$share" \
        --quota 5 \
        --output none

      echo "  Share '$share' created."
    fi

    registered_account=$(az containerapp env storage show \
      --name "$ENVIRONMENT_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --storage-name "$share" \
      --query "properties.azureFile.accountName" -o tsv 2>/dev/null || true)

    registered_share=$(az containerapp env storage show \
      --name "$ENVIRONMENT_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --storage-name "$share" \
      --query "properties.azureFile.shareName" -o tsv 2>/dev/null || true)

    if [[ -n "$registered_account" && -n "$registered_share" ]]; then
      if [[ "$registered_account" != "$STORAGE_ACCOUNT" || "$registered_share" != "$share" ]]; then
        echo "  Storage mapping '$share' points to '$registered_account/$registered_share'. Replacing mapping..."
        az containerapp env storage remove \
          --name "$ENVIRONMENT_NAME" \
          --resource-group "$RESOURCE_GROUP" \
          --storage-name "$share" \
          --output none
      else
        echo "  Storage mapping '$share' already registered with expected values; updating key."
      fi
    fi

    az containerapp env storage set \
      --name "$ENVIRONMENT_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --storage-name "$share" \
      --azure-file-account-name "$STORAGE_ACCOUNT" \
      --azure-file-account-key "$STORAGE_KEY" \
      --azure-file-share-name "$share" \
      --access-mode ReadWrite \
      --output none

    echo "  Share '$share' registered with Container Apps environment."
  done

  echo "  Storage provisioning complete."
fi

# ---------------------------------------------------------------------------
# Phase 4: Azure Container Registry
# ---------------------------------------------------------------------------
if [[ "$SKIP_ACR" == "true" ]]; then
  echo ""
  echo "  Skipping ACR (--skip-acr specified)."
else
  echo ""
  echo "========================================"
  echo "Phase 4: Creating Azure Container Registry"
  echo "========================================"

  if az acr show \
      --name "$ACR_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --query "name" -o tsv > /dev/null 2>&1; then
    echo "  ACR '$ACR_NAME' already exists, skipping creation."
  else
    az acr create \
      --name "$ACR_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --sku Basic \
      --admin-enabled true \
      --output none

    echo "  ACR '$ACR_NAME' created."
  fi

  ACR_SERVER="${ACR_NAME}.azurecr.io"
  ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query "username" -o tsv)

  echo "  ACR provisioning complete."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "Infrastructure Provisioning Complete!"
echo "========================================"
echo ""
echo "  Resource Group:   $RESOURCE_GROUP"
echo "  Location:         $LOCATION"
echo "  Environment:      $ENVIRONMENT_NAME"

if [[ "$SKIP_STORAGE" == "false" ]]; then
  echo ""
  echo "  Storage Account:  $STORAGE_ACCOUNT"
  echo "  File Shares:      ${#SHARES[@]} shares registered with Container Apps environment"
fi

if [[ "$SKIP_ACR" == "false" ]]; then
  echo ""
  echo "  ACR Login Server: $ACR_SERVER"
  echo "  ACR Username:     $ACR_USERNAME"
  echo "  ACR Password:     (use 'az acr credential show --name $ACR_NAME' to retrieve)"
  echo ""
  echo "  To build images against this registry, run deploy.sh with --use-acr:"
  echo "    ./deploy.sh --use-acr"
fi

echo ""
echo "  Useful commands:"
echo "    az storage share-rm list --storage-account $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP -o table"
if [[ "$SKIP_ACR" == "false" ]]; then
  echo "    az acr repository list --name $ACR_NAME -o table"
fi
echo "    az containerapp env storage list -n $ENVIRONMENT_NAME -g $RESOURCE_GROUP -o table"
echo ""
