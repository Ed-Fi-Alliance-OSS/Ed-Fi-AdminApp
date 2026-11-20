# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Gather the files attached to an Admin App release into one folder.

.DESCRIPTION
Copies into -OutputDirectory:
- the npm package tarballs (*.tgz) from -SourceDirectory
- <PackageName>.SBOM.zip from -SourceDirectory
- the provenance and SBOM attestation bundles, renamed to
  <PackageName>.provenance.sigstore.json and <PackageName>.SBOM.sigstore.json

The folder is emptied first, so it holds only this release's assets. When run in
GitHub Actions, the bundle paths are written to $GITHUB_OUTPUT as 'provenance-bundle'
and 'sbom-bundle'.

.PARAMETER ProvenanceBundle
Bundle written by actions/attest for the build provenance.

.PARAMETER SbomBundle
Bundle written by actions/attest for the SBOM.

.PARAMETER PackageName
Base name of the SBOM zip and bundles. Defaults to 'AdminApp'.

.PARAMETER SourceDirectory
Folder with the tarballs and SBOM zip. Defaults to dist/release.

.PARAMETER OutputDirectory
Folder to fill. Defaults to release-assets under the repository root.
#>

param(
  [Parameter(Mandatory)]
  [string]$ProvenanceBundle,

  [Parameter(Mandatory)]
  [string]$SbomBundle,

  [string]$PackageName = 'AdminApp',

  [string]$SourceDirectory,

  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'ReleaseHelpers.psm1') -Force

$repoRoot = Get-RepoRoot
if (-not $SourceDirectory) { $SourceDirectory = Join-Path $repoRoot $DefaultReleaseDirectory }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot 'release-assets' }

Remove-Item $OutputDirectory -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

# Attach the attested packages so consumers can verify what they download.
Resolve-PackagePath (Join-Path $SourceDirectory '*.tgz') | Copy-Item -Destination $OutputDirectory

$zip = Join-Path $SourceDirectory "$PackageName.SBOM.zip"
if (-not (Test-Path $zip)) { throw "SBOM zip not found: $zip. Run new-sbom.ps1 first." }
Copy-Item $zip $OutputDirectory

$bundles = [ordered]@{
  'provenance-bundle' = @{ Source = $ProvenanceBundle; Name = "$PackageName.provenance.sigstore.json" }
  'sbom-bundle'       = @{ Source = $SbomBundle; Name = "$PackageName.SBOM.sigstore.json" }
}
foreach ($output in $bundles.Keys) {
  $bundle = $bundles[$output]
  if (-not (Test-Path $bundle.Source)) { throw "Attestation bundle not found: $($bundle.Source)" }
  $target = Join-Path $OutputDirectory $bundle.Name
  Copy-Item $bundle.Source $target
  Set-GitHubOutput -Name $output -Value $target
}

Get-ChildItem $OutputDirectory | Format-Table Name, Length -AutoSize | Out-String | Write-Output
