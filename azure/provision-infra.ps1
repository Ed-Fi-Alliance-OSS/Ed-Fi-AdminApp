<#
.SYNOPSIS
    Ed-Fi AdminApp — Azure Infrastructure Provisioning (PowerShell)

.DESCRIPTION
    Provisions only the prerequisite infrastructure for the Ed-Fi AdminApp stack:
      - Resource group
      - Azure Container Apps environment
      - Storage account with all required Azure Files shares
      - Azure Container Registry (ACR)

    Run this before deploy.ps1 to pre-create shared infrastructure, or use it
    independently in CI/CD pipelines where the full deployment is handled
    separately.

.EXAMPLE
    ./provision-infra.ps1
    Provision storage account and ACR using settings from .env.azure.

.EXAMPLE
    ./provision-infra.ps1 -SkipACR
    Provision only the storage account (skip ACR creation).

.EXAMPLE
    ./provision-infra.ps1 -SkipStorage
    Provision only the ACR (skip storage account and file shares).
#>
param(
    [Switch]$SkipACR,
    [Switch]$SkipStorage
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

function Get-EnvOrDefault($Name, $Default = "") {
    $val = $envVars[$Name]
    if ([string]::IsNullOrEmpty($val)) { return $Default }
    return $val
}

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
$ResourceGroup   = "edfiadminapp-network"
$Location        = Get-EnvOrDefault "AZURE_LOCATION" "eastus"
$EnvironmentName = "edfiadminapp-network"
$StorageAccount  = Get-EnvOrDefault "AZURE_STORAGE_ACCOUNT" "edfiadminappstore"
$AcrName         = Get-EnvOrDefault "ACR_NAME" ""

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

if (-not $SkipACR -and [string]::IsNullOrEmpty($AcrName)) {
    Write-Error "ERROR: ACR_NAME is not set in .env.azure. Set it or run with -SkipACR."
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
Write-Host "  Resource group '$ResourceGroup' ready in '$Location'." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Phase 2: Container Apps Environment
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 2: Creating Container Apps environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$envExists = az containerapp env show `
    --name $EnvironmentName `
    --resource-group $ResourceGroup `
    --query "name" -o tsv 2>$null

if ($envExists) {
    Write-Host "  Environment '$EnvironmentName' already exists, skipping." -ForegroundColor Yellow
}
else {
    az containerapp env create `
        --name $EnvironmentName `
        --resource-group $ResourceGroup `
        --location $Location `
        --logs-destination none `
        --output none

    Write-Host "  Environment '$EnvironmentName' created." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Phase 3: Storage Account and File Shares
# ---------------------------------------------------------------------------
if ($SkipStorage) {
    Write-Host ""
    Write-Host "  Skipping storage account (--SkipStorage specified)." -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Phase 3: Creating storage account and file shares" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    $acctExists = az storage account show `
        --name $StorageAccount `
        --resource-group $ResourceGroup `
        --query "name" -o tsv 2>$null

    if ($acctExists) {
        Write-Host "  Storage account '$StorageAccount' already exists, skipping creation." -ForegroundColor Yellow
    }
    else {
        az storage account create `
            --name $StorageAccount `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku Standard_LRS `
            --kind StorageV2 `
            --output none

        Write-Host "  Storage account '$StorageAccount' created." -ForegroundColor Green
    }

    $StorageKey = az storage account keys list `
        --resource-group $ResourceGroup `
        --account-name $StorageAccount `
        --query "[0].value" -o tsv

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
        $shareExists = az storage share-rm show `
            --storage-account $StorageAccount `
            --resource-group $ResourceGroup `
            --name $share `
            --query "name" -o tsv 2>$null

        if (-not $shareExists) {
            az storage share-rm create `
                --storage-account $StorageAccount `
                --resource-group $ResourceGroup `
                --name $share `
                --quota 5 `
                --output none

            Write-Host "  Share '$share' created." -ForegroundColor Green
        }
        else {
            Write-Host "  Share '$share' already exists, skipping creation." -ForegroundColor Yellow
        }

        $registeredAccount = az containerapp env storage show `
            --name $EnvironmentName `
            --resource-group $ResourceGroup `
            --storage-name $share `
            --query "properties.azureFile.accountName" -o tsv 2>$null

        $registeredShare = az containerapp env storage show `
            --name $EnvironmentName `
            --resource-group $ResourceGroup `
            --storage-name $share `
            --query "properties.azureFile.shareName" -o tsv 2>$null

        if (-not [string]::IsNullOrWhiteSpace($registeredAccount) -and -not [string]::IsNullOrWhiteSpace($registeredShare)) {
            if ($registeredAccount -ne $StorageAccount -or $registeredShare -ne $share) {
                Write-Host "  Storage mapping '$share' points to '$registeredAccount/$registeredShare'. Replacing mapping..." -ForegroundColor Yellow
                az containerapp env storage remove `
                    --name $EnvironmentName `
                    --resource-group $ResourceGroup `
                    --storage-name $share `
                    --output none
            }
            else {
                Write-Host "  Storage mapping '$share' already registered with expected values; updating key." -ForegroundColor Yellow
            }
        }

        az containerapp env storage set `
            --name $EnvironmentName `
            --resource-group $ResourceGroup `
            --storage-name $share `
            --azure-file-account-name $StorageAccount `
            --azure-file-account-key $StorageKey `
            --azure-file-share-name $share `
            --access-mode ReadWrite `
            --output none

        Write-Host "  Share '$share' registered with Container Apps environment." -ForegroundColor Green
    }

    Write-Host "  Storage provisioning complete." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Phase 4: Azure Container Registry
# ---------------------------------------------------------------------------
if ($SkipACR) {
    Write-Host ""
    Write-Host "  Skipping ACR (-SkipACR specified)." -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Phase 4: Creating Azure Container Registry" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    $acrExists = az acr show `
        --name $AcrName `
        --resource-group $ResourceGroup `
        --query "name" -o tsv 2>$null

    if ($acrExists) {
        Write-Host "  ACR '$AcrName' already exists, skipping creation." -ForegroundColor Yellow
    }
    else {
        az acr create `
            --name $AcrName `
            --resource-group $ResourceGroup `
            --sku Basic `
            --admin-enabled true `
            --output none

        Write-Host "  ACR '$AcrName' created." -ForegroundColor Green
    }

    $AcrServer   = "${AcrName}.azurecr.io"
    $AcrUsername = az acr credential show --name $AcrName --query "username" -o tsv
    $AcrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

    Write-Host "  ACR provisioning complete." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Infrastructure Provisioning Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Resource Group:   $ResourceGroup"
Write-Host "  Location:         $Location"
Write-Host "  Environment:      $EnvironmentName"

if (-not $SkipStorage) {
    Write-Host ""
    Write-Host "  Storage Account:  $StorageAccount" -ForegroundColor Yellow
    Write-Host "  Storage Key:      (retrieved; used to register file shares above)"
    Write-Host "  File Shares:      $($Shares.Count) shares registered with Container Apps environment"
}

if (-not $SkipACR) {
    Write-Host ""
    Write-Host "  ACR Login Server: $AcrServer" -ForegroundColor Yellow
    Write-Host "  ACR Username:     $AcrUsername"
    Write-Host "  ACR Password:     (use 'az acr credential show --name $AcrName' to retrieve)"
    Write-Host ""
    Write-Host "  To build images against this registry, run deploy.ps1 with -UseACR:" -ForegroundColor Cyan
    Write-Host "    ./deploy.ps1 -UseACR"
}

Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor Yellow
Write-Host "    az storage share-rm list --storage-account $StorageAccount --resource-group $ResourceGroup -o table"
Write-Host "    az acr repository list --name $AcrName -o table"
Write-Host "    az containerapp env storage list -n $EnvironmentName -g $ResourceGroup -o table"
Write-Host ""
