# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Generate and check the SPDX 2.2 SBOM for the Admin App release packages.

.DESCRIPTION
Downloads the pinned, self-contained Microsoft sbom-tool release binary for this platform
(sha256-checked, cached in the temp folder, no .NET needed) and runs it against the
packed tarballs, with component detection over
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

# Use the self-contained sbom-tool release binary rather than the .NET global tool. The
# global tool targets .NET 8, and rolled forward to .NET 10 or 11 its component detection
# crashes while writing results, yet sbom-tool still exits 0 with an SBOM that lists no
# dependencies. Digests are from https://github.com/microsoft/sbom-tool/releases/tag/v4.1.5
$sbomToolVersion = '4.1.5'
$sbomToolSha256 = @{
  'linux-x64' = 'bf5d4f99bc98c119d549d08fc02ae92598a7a42772f17317c01031a92632e05b'
  'osx-arm64' = 'bb25842fd707fbe78d3ac9de0d2b27ee2f4a97764f3b8a5c2068c826e75f3535'
  'osx-x64'   = 'e9a45e3ffdcab920c7bbd2987ce0a133f275241e080bb48c1a3dbe6b558e8ee6'
  'win-x64'   = '625767b371b7fdd58f40f618b8a86da0247a33c89e419039c86b4edba1dad4b5'
}

function Get-SbomTool {
  $os = if ($IsWindows) { 'win' } elseif ($IsMacOS) { 'osx' } else { 'linux' }
  $arch = ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture).ToString().ToLowerInvariant()
  $rid = "$os-$arch"
  $sha256 = $sbomToolSha256[$rid]
  if (-not $sha256) { throw "No sbom-tool $sbomToolVersion binary is published for $rid" }

  $name = "sbom-tool-$rid$(if ($IsWindows) { '.exe' })"
  $cacheDir = Join-Path ($env:RUNNER_TEMP ?? [System.IO.Path]::GetTempPath()) "sbom-tool/$sbomToolVersion"
  $path = Join-Path $cacheDir $name

  if (-not (Test-Path $path) -or (Get-FileHash $path -Algorithm SHA256).Hash -ne $sha256) {
    New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    $url = "https://github.com/microsoft/sbom-tool/releases/download/v$sbomToolVersion/$name"
    Write-Output "Downloading $url" | Out-Host
    Invoke-WebRequest $url -OutFile $path
    $hash = (Get-FileHash $path -Algorithm SHA256).Hash
    if ($hash -ne $sha256) {
      Remove-Item $path -Force
      throw "sha256 mismatch for $name. Expected $sha256, got $hash"
    }
    if (-not $IsWindows) { chmod +x $path }
  }
  return $path
}

$sbomTool = Get-SbomTool

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
