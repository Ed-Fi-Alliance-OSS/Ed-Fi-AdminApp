# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Build and pack the Admin App API and FrontEnd npm packages for a release.

.DESCRIPTION
Performs the same steps as the pack job in .github/workflows/on-prerelease.yml:
1. Computes the version with MinVer (tag prefix 'v'), unless -Version is given
2. Installs dependencies and builds the API and FrontEnd via Nx
3. Stamps the version into packages/api and packages/fe, copies build output and
   .nvmrc under each package root, and runs npm pack
4. Moves the tarballs to -OutputDirectory as AdminApp.Api-<version>.tgz and
   AdminApp.FrontEnd-<version>.tgz

The package.json version changes and copied .nvmrc files (not tracked in git) are
reverted after packing, so a local run leaves only the tarballs behind. When run in
GitHub Actions, the version (without the 'v' prefix) is written to $GITHUB_OUTPUT as
'version'.

.PARAMETER Version
Version to stamp into the packages, with or without a 'v' prefix. Defaults to the
MinVer version of HEAD.

.PARAMETER OutputDirectory
Where the tarballs are written. Defaults to dist/release under the repository root.
Existing tarballs there are removed first.

.PARAMETER SkipInstall
Skip 'npm ci' and reuse the existing node_modules.

.EXAMPLE
# Full build, as in CI
./eng/release/build-packages.ps1

# Rebuild with existing node_modules and an explicit version
./eng/release/build-packages.ps1 -SkipInstall -Version 0.0.0-local.1
#>

param(
  [string]$Version,
  [string]$OutputDirectory,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'ReleaseHelpers.psm1') -Force

# Pinned: this job runs untrusted build code, so it must not pick up a new release unreviewed.
$minverVersion = '8.0.0'
# SemVer 2.0 (https://semver.org), as produced by MinVer.
$semverPattern = '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'

function Get-Minver {
  $tool = Get-Command minver -ErrorAction SilentlyContinue
  if ($tool) { return $tool.Source }
  Invoke-Native dotnet @('tool', 'install', '--global', 'minver-cli', '--version', $minverVersion) | Out-Host
  # A fresh install may not be on PATH yet in the current session.
  Join-Path $HOME ".dotnet/tools/minver$(if ($IsWindows) { '.exe' })"
}

$repoRoot = Get-RepoRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot $DefaultReleaseDirectory }

# Preflight: fail early with a clear message instead of partway through the build.
foreach ($command in @('node', 'npm') + @(if (-not $Version) { 'dotnet' })) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "$command was not found on PATH. See eng/README.md for the requirements."
  }
}

Push-Location $repoRoot
try {
  if (-not $Version) {
    $minver = Get-Minver
    # Let minver run on a newer .NET runtime when its target runtime is not installed.
    $rollForward = $env:DOTNET_ROLL_FORWARD
    $env:DOTNET_ROLL_FORWARD = 'Major'
    try {
      $Version = & $minver -t v
    }
    finally {
      $env:DOTNET_ROLL_FORWARD = $rollForward
    }
    if ($LASTEXITCODE -ne 0) { throw "minver failed with exit code $LASTEXITCODE" }
  }
  $semver = "$Version".Trim() -replace '^v'
  if ($semver -notmatch $semverPattern) { throw "'$Version' is not a SemVer version." }
  Write-Output "Admin App version: $semver"
  Set-GitHubOutput -Name 'version' -Value $semver

  if (-not $SkipInstall) {
    Invoke-LogGroup 'npm ci' {
      Invoke-Native npm @('ci', '--legacy-peer-deps', '--prefer-offline', '--no-audit', '--progress=false')
    }
  }
  Invoke-LogGroup 'Build API' { Invoke-Native npm @('run', 'build:api') }
  Invoke-LogGroup 'Build FrontEnd' { Invoke-Native npm @('run', 'build:fe') }

  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  Get-ChildItem $OutputDirectory -Filter '*.tgz' | Remove-Item

  $packages = @(
    @{ Dir = 'packages/api'; Dist = 'dist/packages/api'; Name = 'AdminApp.Api' }
    @{ Dir = 'packages/fe'; Dist = 'dist/packages/fe'; Name = 'AdminApp.FrontEnd' }
  )

  foreach ($package in $packages) {
    $dir = $package.Dir
    $packageJson = Join-Path $dir 'package.json'
    $nvmrc = Join-Path $dir '.nvmrc'
    $original = Get-Content $packageJson -Raw

    Invoke-LogGroup "Pack $($package.Name)" {
      try {
        Get-ChildItem $dir -Filter '*.tgz' | Remove-Item
        Remove-Item (Join-Path $dir 'dist') -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item $package.Dist (Join-Path $dir 'dist') -Recurse
        Copy-Item .nvmrc $nvmrc

        Push-Location $dir
        try {
          Invoke-Native npm @('pkg', 'set', "version=$semver")
          Invoke-Native npm @('pack')
        }
        finally {
          Pop-Location
        }

        $tgz = Get-ChildItem $dir -Filter '*.tgz' | Select-Object -First 1
        if (-not $tgz) { throw "npm pack produced no tarball in $dir" }
        $target = Join-Path $OutputDirectory "$($package.Name)-$semver.tgz"
        Move-Item $tgz.FullName $target
        Write-Output "Packed $target"
      }
      finally {
        Set-Content $packageJson $original -NoNewline
        # -Force: dotfiles count as hidden on Linux and macOS.
        Remove-Item $nvmrc -Force -ErrorAction SilentlyContinue
      }
    }
  }
}
finally {
  Pop-Location
}
