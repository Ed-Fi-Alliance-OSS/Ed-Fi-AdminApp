# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Runs the Playwright BDD E2E UI test suite against a freshly provisioned stack.

.DESCRIPTION
Downloads the ODS Minimal Template backup (if missing), starts Docker Compose
services (PostgreSQL or SQL Server for the Admin App database), waits for
readiness, creates the local Keycloak test user, and runs the Playwright BDD
suite.

.PARAMETER DbEngine
Admin App database engine: 'pgsql' or 'mssql'. Defaults to 'pgsql'.

.PARAMETER Rebuild
Rebuild Admin App images before starting services.

.PARAMETER StopServices
Stop Docker Compose services after the test run (success or failure).

.EXAMPLE
./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild -StopServices
#>

param(
  [ValidateSet('pgsql', 'mssql')]
  [string]$DbEngine = 'pgsql',
  [switch]$Rebuild,
  [switch]$StopServices
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Test-Prerequisites {
  $missing = @()

  if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
    $missing += 'node_modules not found. Run: npm ci --legacy-peer-deps'
  }

  $playwrightBrowsersPath = if ($env:PLAYWRIGHT_BROWSERS_PATH) {
    $env:PLAYWRIGHT_BROWSERS_PATH
  } else {
    if ($IsWindows) {
      Join-Path $env:LOCALAPPDATA 'ms-playwright'
    } else {
      Join-Path $env:USERPROFILE '.cache\ms-playwright'
    }
  }
  $chromiumInstalled = $false
  if (Test-Path $playwrightBrowsersPath) {
    $chromiumInstalled = @(Get-ChildItem -Path $playwrightBrowsersPath -Directory -Filter 'chromium-*' -ErrorAction SilentlyContinue).Count -gt 0
  }
  if (-not $chromiumInstalled) {
    $missing += 'Playwright Chromium browser not found. Run: npx playwright install --with-deps chromium'
  }

  $certPath = Join-Path $repoRoot 'compose\ssl\server.crt'
  if (-not (Test-Path $certPath)) {
    $missing += 'Local TLS certificate not found at compose/ssl/server.crt. Run: bash ./compose/ssl/generate-certificate.sh'
  }

  if ($missing.Count -gt 0) {
    Write-Host 'ERROR! Missing prerequisites:' -ForegroundColor Red
    foreach ($item in $missing) {
      Write-Host "  - $item" -ForegroundColor Red
    }
    exit 1
  }
}

Test-Prerequisites
Write-Host 'All prerequisites satisfied.' -ForegroundColor Green
