# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Verify the provenance and SBOM attestations of Admin App release packages.

.DESCRIPTION
Runs 'gh attestation verify' twice for each package: once for the SLSA provenance
predicate (the default) and once for the SPDX 2.2 SBOM predicate. Fails if any check
does not pass.

Every check pins the signer: the attestation must be signed by the pre-release
workflow in -Repository (not any workflow there that can mint an OIDC token), with a
GitHub Actions OIDC token, and, when -SourceRef is set, built from that ref. In GitHub
Actions -SourceRef defaults to the ref that triggered the run, so the packages must
come from this release's tag.

By default the checks use the GitHub attestations API, retried because it can take a
little while to index a new attestation. Pass both -ProvenanceBundle and -SbomBundle
to verify against the *.sigstore.json bundles attached to a release instead; those
checks are not retried, since a bundle either matches or it does not.

Requires the GitHub CLI ('gh'), authenticated or with GH_TOKEN set.

.PARAMETER PackagePath
Tarballs to verify. Wildcards are allowed.

.PARAMETER Repository
Repository the attestations must come from (owner/name). Defaults to $env:GITHUB_REPOSITORY.

.PARAMETER SignerWorkflow
Workflow that must have signed the attestations (owner/repo/path). Defaults to
<Repository>/.github/workflows/on-prerelease.yml.

.PARAMETER SourceRef
Git ref the packages must have been built from, for example refs/tags/v4.1.0.
Defaults to $env:GITHUB_REF; not checked when empty.

.PARAMETER ProvenanceBundle
Provenance bundle from the release (AdminApp.provenance.sigstore.json). Requires -SbomBundle.

.PARAMETER SbomBundle
SBOM bundle from the release (AdminApp.SBOM.sigstore.json). Requires -ProvenanceBundle.

.PARAMETER Retries
Attempts per check against the attestations API. Defaults to 6.

.PARAMETER DelaySeconds
Wait between attempts. Defaults to 10.

.EXAMPLE
# Verify packages downloaded from a release, using the attestations API
./eng/release/verify-attestations.ps1 -PackagePath ./AdminApp.*.tgz -Repository Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# Verify against the bundles attached to the release
./eng/release/verify-attestations.ps1 -PackagePath ./AdminApp.*.tgz -Repository Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp `
  -ProvenanceBundle ./AdminApp.provenance.sigstore.json -SbomBundle ./AdminApp.SBOM.sigstore.json
#>

param(
  [Parameter(Mandatory)]
  [string[]]$PackagePath,

  [string]$Repository = $env:GITHUB_REPOSITORY,

  [string]$SignerWorkflow,

  [string]$SourceRef = $env:GITHUB_REF,

  [string]$ProvenanceBundle,

  [string]$SbomBundle,

  [int]$Retries = 6,

  [int]$DelaySeconds = 10
)

$ErrorActionPreference = 'Stop'
# A failed attempt is retried, so a non-zero gh exit code must not stop the script.
$PSNativeCommandUseErrorActionPreference = $false
Import-Module (Join-Path $PSScriptRoot 'ReleaseHelpers.psm1') -Force

# The SBOM predicate type follows the SPDX version sbom-tool emits (SPDX 2.2, see
# new-sbom.ps1). A sbom-tool upgrade that changes the SPDX version must change this too.
$sbomPredicateType = 'https://spdx.dev/Document/v2.2'
$oidcIssuer = 'https://token.actions.githubusercontent.com'

if (-not $Repository) { throw "Pass -Repository or set GITHUB_REPOSITORY." }
if ([bool]$ProvenanceBundle -ne [bool]$SbomBundle) {
  throw "Pass both -ProvenanceBundle and -SbomBundle, or neither."
}
if (-not $SignerWorkflow) { $SignerWorkflow = "$Repository/.github/workflows/on-prerelease.yml" }

$useBundles = [bool]$ProvenanceBundle
$attempts = if ($useBundles) { 1 } else { $Retries }

$packages = Resolve-PackagePath $PackagePath

# Applied to every check, so an attestation from another workflow or ref does not pass.
$signer = @('-R', $Repository, '--signer-workflow', $SignerWorkflow, '--cert-oidc-issuer', $oidcIssuer)
if ($SourceRef) { $signer += @('--source-ref', $SourceRef) }

function Invoke-Verify {
  param([string]$Description, [string[]]$Arguments)
  $lastError = ''
  for ($attempt = 1; $attempt -le $attempts; $attempt++) {
    $output = gh attestation verify @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
      Write-Output "Verified $Description"
      return
    }
    $lastError = $output.Trim()
    if ($attempt -lt $attempts) {
      Write-Warning "$Description, attempt $attempt of $attempts failed, retrying in $DelaySeconds s: $lastError"
      Start-Sleep -Seconds $DelaySeconds
    }
  }
  throw "$Description failed after $attempts attempt(s): $lastError`nCommand: gh attestation verify $($Arguments -join ' ')"
}

foreach ($package in $packages) {
  $name = Split-Path $package -Leaf
  $source = if ($useBundles) { 'bundle' } else { 'attestations API' }

  $provenance = @($package) + $signer
  if ($useBundles) { $provenance += @('--bundle', $ProvenanceBundle) }
  Invoke-Verify "provenance of $name ($source)" $provenance

  $sbom = @($package) + $signer + @('--predicate-type', $sbomPredicateType)
  if ($useBundles) { $sbom += @('--bundle', $SbomBundle) }
  Invoke-Verify "SBOM ($sbomPredicateType) of $name ($source)" $sbom
}
