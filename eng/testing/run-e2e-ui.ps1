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

function Get-OdsMinimalTemplateBackup {
  $backupDir = Join-Path $repoRoot 'compose\db-backup'
  $minimalSqlPath = Join-Path $backupDir 'EdFi.Ods.Minimal.Template.sql'
  $populatedSqlPath = Join-Path $backupDir 'EdFi.Ods.Populated.Template.sql'

  if ((Test-Path $minimalSqlPath) -and (Test-Path $populatedSqlPath)) {
    Write-Host 'ODS Minimal Template backup already present, skipping download.' -ForegroundColor Cyan
    return
  }

  $packageName = 'EdFi.Suite3.Ods.Minimal.Template.PostgreSQL.Standard.4.0.0'
  $packageVersion = '7.3.20068'
  $feedUrl = "https://pkgs.dev.azure.com/ed-fi-alliance/Ed-Fi-Alliance-OSS/_packaging/EdFi/nuget/v3/flat2/$packageName/$packageVersion/$packageName.$packageVersion.nupkg"

  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

  Write-Host "Downloading $packageName v$packageVersion..." -ForegroundColor Cyan
  $nupkgPath = Join-Path $backupDir 'package.nupkg'
  $zipPath = Join-Path $backupDir 'package.zip'
  $pkgDir = Join-Path $backupDir 'pkg'

  Invoke-WebRequest -Uri $feedUrl -OutFile $nupkgPath
  Copy-Item -Path $nupkgPath -Destination $zipPath -Force
  Expand-Archive -Path $zipPath -DestinationPath $pkgDir -Force

  $srcSql = Get-ChildItem -Path $pkgDir -Filter '*.sql' -Recurse | Select-Object -First 1
  if (-not $srcSql) {
    throw 'ERROR: No .sql file found inside the NuGet package'
  }
  Write-Host "Found: $($srcSql.FullName)" -ForegroundColor Cyan

  Copy-Item -Path $srcSql.FullName -Destination $minimalSqlPath -Force
  Copy-Item -Path $minimalSqlPath -Destination $populatedSqlPath -Force

  Remove-Item -Path $nupkgPath, $zipPath -Force
  Remove-Item -Path $pkgDir -Recurse -Force

  Write-Host "Backup files ready in $backupDir" -ForegroundColor Green
}

Test-Prerequisites
Get-OdsMinimalTemplateBackup
