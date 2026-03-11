<#
.SYNOPSIS
    Ed-Fi AdminApp — Azure Container Apps Teardown Script (PowerShell)

.DESCRIPTION
    Deletes the entire resource group, removing all container apps, storage,
    and associated resources.

.EXAMPLE
    ./teardown.ps1
    Prompts for confirmation before deleting.

.EXAMPLE
    ./teardown.ps1 -Yes
    Skip confirmation prompt.
#>
param(
    [Switch]$Yes
)

$ErrorActionPreference = "Stop"
$ResourceGroup = "edfiadminapp-network"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ed-Fi AdminApp Azure Teardown" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will DELETE the entire resource group: $ResourceGroup" -ForegroundColor Red
Write-Host "All container apps, storage accounts, and data will be permanently removed." -ForegroundColor Red
Write-Host ""

if (-not $Yes) {
    $confirm = Read-Host "Are you sure? Type 'yes' to confirm"
    if ($confirm -ne "yes") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Deleting resource group '$ResourceGroup'..." -ForegroundColor Yellow

az group delete --name $ResourceGroup --yes --no-wait

Write-Host ""
Write-Host "Deletion initiated (running in background)." -ForegroundColor Green
Write-Host "Monitor with: az group show --name $ResourceGroup" -ForegroundColor Green
Write-Host ""
