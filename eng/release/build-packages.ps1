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
4. Renames the tarballs to AdminApp.Api-<version>.tgz and AdminApp.FrontEnd-<version>.tgz

The package.json version changes and copied .nvmrc files are reverted after packing,
so a local run leaves only the tarballs behind. When run in GitHub Actions, the
version is written to $GITHUB_OUTPUT as 'adminApp' and 'adminApp-semver'.

.PARAMETER Version
Version to stamp into the packages. Defaults to the MinVer version of HEAD.

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
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

function Invoke-Native {
  param([string]$Command, [string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE" }
}

function Get-DotnetTool {
  param([string]$Name, [string]$Package, [string]$Version)
  $tool = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $tool) {
    Invoke-Native dotnet @('tool', 'install', '--global', $Package, '--version', $Version) | Out-Host
    # A fresh install may not be on PATH yet in the current session.
    return Join-Path $HOME ".dotnet/tools/$Name"
  }
  return $tool.Source
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
Push-Location $repoRoot
try {
  if (-not $Version) {
    # Pinned: this job holds id-token: write, so it must not pick up a new release unreviewed.
    $minver = Get-DotnetTool -Name minver -Package minver-cli -Version 8.0.0
    # Let minver run on a newer .NET runtime when its target runtime is not installed.
    $rollForward = $env:DOTNET_ROLL_FORWARD
    $env:DOTNET_ROLL_FORWARD = 'Major'
    try {
      $Version = & $minver -t v
    }
    finally {
      $env:DOTNET_ROLL_FORWARD = $rollForward
    }
    if ($LASTEXITCODE -ne 0 -or -not $Version) { throw "minver failed to compute a version" }
  }
  $semver = $Version -replace '^v'
  Write-Output "Admin App version: $Version"

  if ($env:GITHUB_OUTPUT) {
    "adminApp=$Version" >> $env:GITHUB_OUTPUT
    "adminApp-semver=$semver" >> $env:GITHUB_OUTPUT
  }

  if (-not $SkipInstall) {
    Invoke-Native npm @('ci', '--legacy-peer-deps', '--prefer-offline', '--no-audit', '--progress=false')
  }
  Invoke-Native npm @('run', 'build:api')
  Invoke-Native npm @('run', 'build:fe')

  $packages = @(
    @{ Dir = 'packages/api'; Dist = 'dist/packages/api'; Name = 'AdminApp.Api' }
    @{ Dir = 'packages/fe'; Dist = 'dist/packages/fe'; Name = 'AdminApp.FrontEnd' }
  )

  foreach ($package in $packages) {
    $dir = $package.Dir
    $packageJson = Join-Path $dir 'package.json'
    $nvmrc = Join-Path $dir '.nvmrc'
    $original = Get-Content $packageJson -Raw

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
      $target = "$($package.Name)-$semver.tgz"
      Rename-Item $tgz.FullName $target
      Write-Output "Packed $(Join-Path $dir $target)"
    }
    finally {
      Set-Content $packageJson $original -NoNewline
      # -Force: dotfiles count as hidden on Linux and macOS.
      Remove-Item $nvmrc -Force -ErrorAction SilentlyContinue
    }
  }
}
finally {
  Pop-Location
}
