#!/usr/bin/env bash
# =============================================================================
# Ed-Fi AdminApp — Azure Container Apps Teardown Script (Bash)
# =============================================================================
# Deletes the entire resource group, removing all container apps, storage,
# and associated resources.
#
# Usage:
#   ./teardown.sh              # Prompts for confirmation
#   ./teardown.sh --yes        # Skip confirmation
# =============================================================================
set -euo pipefail

RESOURCE_GROUP="edfiadminapp-network"
SKIP_CONFIRM=false

for arg in "$@"; do
  case "$arg" in
    --yes|-y) SKIP_CONFIRM=true ;;
  esac
done

echo "========================================"
echo "Ed-Fi AdminApp Azure Teardown"
echo "========================================"
echo ""
echo "This will DELETE the entire resource group: $RESOURCE_GROUP"
echo "All container apps, storage accounts, and data will be permanently removed."
echo ""

if [[ "$SKIP_CONFIRM" != "true" ]]; then
  read -rp "Are you sure? Type 'yes' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo ""
echo "Deleting resource group '$RESOURCE_GROUP'..."
az group delete \
  --name "$RESOURCE_GROUP" \
  --yes \
  --no-wait

echo ""
echo "Deletion initiated (running in background)."
echo "Monitor with: az group show --name $RESOURCE_GROUP"
echo ""
