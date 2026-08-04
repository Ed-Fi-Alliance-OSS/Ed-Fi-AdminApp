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

  try {
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
  }
  finally {
    Remove-Item -Path $nupkgPath, $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $pkgDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-Host "Backup files ready in $backupDir" -ForegroundColor Green
}

Test-Prerequisites
Get-OdsMinimalTemplateBackup

function Set-AdminAppEnvFile {
  param(
    [ValidateSet('pgsql', 'mssql')]
    [string]$Engine
  )

  $envExamplePath = Join-Path $repoRoot 'compose\.env.example'
  $envPath = Join-Path $repoRoot 'compose\.env'

  Copy-Item -Path $envExamplePath -Destination $envPath -Force

  if ($Engine -ne 'mssql') {
    return
  }

  $mssqlPassword = 'YourStrong!Passw0rd'
  $content = Get-Content -Path $envPath

  $content = $content | ForEach-Object {
    switch -Regex ($_) {
      '^DB_ENGINE=pgsql$' { 'DB_ENGINE=mssql' }
      '^# MSSQL_PORT_EXPOSED=1433$' { 'MSSQL_PORT_EXPOSED=1433' }
      '^# MSSQL_ACCEPT_EULA=Y$' { 'MSSQL_ACCEPT_EULA=Y' }
      '^# MSSQL_SA_PASSWORD=.*$' { "MSSQL_SA_PASSWORD=$mssqlPassword" }
      '^# MSSQL_IMAGE_TAG=2022-latest$' { 'MSSQL_IMAGE_TAG=2022-latest' }
      '^DB_SECRET_VALUE=\{"DB_HOST".*$' { "# $_" }
      '^# DB_SECRET_VALUE=\{"MSSQL_DB_HOST".*$' {
        ($_ -replace '^# ', '') -replace '"MSSQL_DB_PASSWORD":"[^"]*"', "`"MSSQL_DB_PASSWORD`":`"$mssqlPassword`""
      }
      default { $_ }
    }
  }

  Set-Content -Path $envPath -Value $content
  Write-Host "compose/.env patched for MSSQL (DB_ENGINE=mssql)." -ForegroundColor Cyan
}

Set-AdminAppEnvFile -Engine $DbEngine

function Wait-ForAdminAppReadiness {
  $apiUrl = 'https://localhost/adminapp-api/api/healthcheck'
  $feUrl = 'https://localhost/adminapp/'
  $keycloakUrl = 'https://localhost/auth/realms/edfi/.well-known/openid-configuration'
  $keycloakLoginUrl = 'https://localhost/auth/realms/edfi/protocol/openid-connect/auth?client_id=edfiadminapp&redirect_uri=https%3A%2F%2Flocalhost%2Fadminapp-api%2Fapi%2Fauth%2Fcallback%2F1&response_type=code&scope=openid%20profile%20email'

  $requiredStableChecks = 3
  $stableChecks = 0

  for ($i = 1; $i -le 90; $i++) {
    $apiOk = $false
    $feOk = $false
    $keycloakOk = $false
    $keycloakLoginOk = $false

    try { if ((Invoke-WebRequest -Uri $apiUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $apiOk = $true } } catch {}
    try { if ((Invoke-WebRequest -Uri $feUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $feOk = $true } } catch {}
    try { if ((Invoke-WebRequest -Uri $keycloakUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $keycloakOk = $true } } catch {}
    try {
      $loginResponse = Invoke-WebRequest -Uri $keycloakLoginUrl -SkipCertificateCheck -UseBasicParsing
      if ($loginResponse.Content -match 'kc-form-login') { $keycloakLoginOk = $true }
    } catch {}

    if ($apiOk -and $feOk -and $keycloakOk -and $keycloakLoginOk) {
      $stableChecks++
      Write-Host "Readiness OK ($stableChecks/$requiredStableChecks)" -ForegroundColor Green
    } else {
      $stableChecks = 0
      Write-Host "Waiting... API=$apiOk FE=$feOk KEYCLOAK_META=$keycloakOk KEYCLOAK_LOGIN=$keycloakLoginOk ($i/90)" -ForegroundColor Yellow
    }

    if ($stableChecks -ge $requiredStableChecks) {
      Write-Host 'Admin App API, FE, and Keycloak metadata/login are stable' -ForegroundColor Green
      return
    }

    Start-Sleep -Seconds 3
  }

  throw 'Timed out waiting for stable Admin App services'
}

& (Join-Path $repoRoot 'eng\helpers\start-services-target.ps1') -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild:$Rebuild -MSSQL:($DbEngine -eq 'mssql')
if ($LASTEXITCODE -ne 0) { throw 'Failed to start Docker Compose services.' }

Wait-ForAdminAppReadiness
