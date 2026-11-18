# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Generate and check the SPDX 2.2 SBOM for the Admin App release packages.

.DESCRIPTION
Runs Microsoft sbom-tool against the packed tarballs, with component detection over
the repository root (package-lock.json and node_modules), then fails if:
- sbom-tool exits non-zero (pwsh does not stop on a native command failure), or
- the manifest is not valid JSON, or lists fewer than -MinDependencies packages
  besides the root package (a green sbom-tool run can still produce an empty SBOM).

Writes <OutputDirectory>/_manifest/spdx_2.2/manifest.spdx.json and
<OutputDirectory>/<PackageName>.SBOM.zip. When run in GitHub Actions, the paths are
written to $GITHUB_OUTPUT as 'manifest-path' and 'zip-path'.

Run after npm ci and build-packages.ps1, so node_modules and the tarballs exist.

.PARAMETER PackagePath
Tarballs the SBOM describes. Wildcards are allowed.

.PARAMETER Version
Package version recorded in the SBOM.

.PARAMETER PackageName
Base name for the SBOM package ('EdFi.<PackageName>') and zip. Defaults to 'AdminApp'.

.PARAMETER MinDependencies
Minimum number of non-root packages the SBOM must list. Defaults to 10.

.PARAMETER OutputDirectory
Where the manifest and zip are written. Defaults to the repository root.

.EXAMPLE
./eng/release/new-sbom.ps1 -PackagePath packages/*/AdminApp.*.tgz -Version 0.0.0-local.1

# Negative test: the content check must fail
./eng/release/new-sbom.ps1 -PackagePath packages/*/AdminApp.*.tgz -Version 0.0.0-local.1 -MinDependencies 99999
#>

param(
  [Parameter(Mandatory)]
  [string[]]$PackagePath,

  [Parameter(Mandatory)]
  [string]$Version,

  [string]$PackageName = 'AdminApp',

  [int]$MinDependencies = 10,

  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not $OutputDirectory) { $OutputDirectory = $repoRoot }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$OutputDirectory = (Resolve-Path $OutputDirectory).Path

$packages = @(Resolve-Path $PackagePath | ForEach-Object Path)
if ($packages.Count -eq 0) { throw "No packages found for: $($PackagePath -join ', ')" }

$sbomTool = Get-Command sbom-tool -ErrorAction SilentlyContinue
if ($sbomTool) {
  $sbomTool = $sbomTool.Source
}
else {
  dotnet tool install --global Microsoft.Sbom.DotNetTool --version 4.1.5 | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "Installing sbom-tool failed with exit code $LASTEXITCODE" }
  # A fresh install may not be on PATH yet in the current session.
  $sbomTool = Join-Path $HOME '.dotnet/tools/sbom-tool'
}

$manifestDir = Join-Path $OutputDirectory '_manifest'
$manifest = Join-Path $manifestDir 'spdx_2.2/manifest.spdx.json'
$zip = Join-Path $OutputDirectory "$PackageName.SBOM.zip"

# sbom-tool refuses to overwrite an existing manifest; clear leftovers from a previous run.
Remove-Item $manifestDir -Recurse -Force -ErrorAction SilentlyContinue

$buildFileList = New-TemporaryFile
try {
  $packages | Set-Content $buildFileList

  & $sbomTool generate `
    -b $repoRoot `
    -bl $buildFileList `
    -bc $repoRoot `
    -pn "EdFi.$PackageName" `
    -pv $Version `
    -nsb https://ed-fi.org `
    -m $OutputDirectory `
    -ps "Ed-Fi Alliance"

  if ($LASTEXITCODE -ne 0) { throw "sbom-tool failed with exit code $LASTEXITCODE" }
}
finally {
  Remove-Item $buildFileList -ErrorAction SilentlyContinue
}

if (-not (Test-Path $manifest)) { throw "sbom-tool did not write $manifest" }

try {
  $sbom = Get-Content $manifest -Raw | ConvertFrom-Json
}
catch {
  throw "SBOM is not valid JSON: $manifest. $_"
}

$root = ($sbom.packages | Where-Object SPDXID -eq 'SPDXRef-RootPackage').name
$dependencies = @($sbom.packages | Where-Object name -ne $root).Count
Write-Output "SBOM: $(@($sbom.packages).Count) packages, $dependencies dependencies (root: $root)"

if ($dependencies -lt $MinDependencies) {
  throw "SBOM lists $dependencies dependencies (minimum $MinDependencies). Was sbom-tool run without build output?"
}

Compress-Archive $manifest -DestinationPath $zip -Force
Write-Output "SBOM zip: $zip"

if ($env:GITHUB_OUTPUT) {
  "manifest-path=$manifest" >> $env:GITHUB_OUTPUT
  "zip-path=$zip" >> $env:GITHUB_OUTPUT
}
