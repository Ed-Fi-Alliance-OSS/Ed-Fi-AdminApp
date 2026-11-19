# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Verify the provenance and SBOM attestations of Admin App release packages.

.DESCRIPTION
Runs 'gh attestation verify' twice for each package: once for the SLSA provenance
predicate (the default) and once for the SPDX 2.2 SBOM predicate. Each check is
retried, because the attestations API can take a few seconds to index a new
attestation. Fails if any check does not pass.

Every check pins the signer: the attestation must be signed by the pre-release
workflow in -Repository (not any workflow there that can mint an OIDC token), and,
when -SourceRef is set, built from that ref. In GitHub Actions -SourceRef defaults to
the ref that triggered the run, so the packages must come from this release's tag.

Pass -ProvenanceBundle and -SbomBundle to verify against the offline
*.sigstore.json bundles attached to a release instead of the attestations API.

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
Optional offline provenance bundle (AdminApp.provenance.sigstore.json).

.PARAMETER SbomBundle
Optional offline SBOM bundle (AdminApp.sbom.sigstore.json).

.PARAMETER Retries
Attempts per check. Defaults to 3.

.PARAMETER DelaySeconds
Wait between attempts. Defaults to 10.

.EXAMPLE
# Verify packages downloaded from a release, using the attestations API
./eng/release/test-attestations.ps1 -PackagePath ./AdminApp.*.tgz -Repository Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# Verify against the offline bundles attached to the release
./eng/release/test-attestations.ps1 -PackagePath ./AdminApp.*.tgz -Repository Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp `
  -ProvenanceBundle ./AdminApp.provenance.sigstore.json -SbomBundle ./AdminApp.sbom.sigstore.json
#>

param(
  [Parameter(Mandatory)]
  [string[]]$PackagePath,

  [string]$Repository = $env:GITHUB_REPOSITORY,

  [string]$SignerWorkflow,

  [string]$SourceRef = $env:GITHUB_REF,

  [string]$ProvenanceBundle,

  [string]$SbomBundle,

  [int]$Retries = 3,

  [int]$DelaySeconds = 10
)

$ErrorActionPreference = 'Stop'
# A failed attempt is retried, so a non-zero gh exit code must not stop the script.
$PSNativeCommandUseErrorActionPreference = $false

# The SBOM predicate type follows the SPDX version sbom-tool emits (SPDX 2.2).
$sbomPredicateType = 'https://spdx.dev/Document/v2.2'

if (-not $Repository) { throw "Pass -Repository or set GITHUB_REPOSITORY." }
if (-not $SignerWorkflow) { $SignerWorkflow = "$Repository/.github/workflows/on-prerelease.yml" }

# Applied to every check, so an attestation from another workflow or ref does not pass.
$signer = @('-R', $Repository, '--signer-workflow', $SignerWorkflow)
if ($SourceRef) { $signer += @('--source-ref', $SourceRef) }

$packages = @(Resolve-Path $PackagePath | ForEach-Object Path)
if ($packages.Count -eq 0) { throw "No packages found for: $($PackagePath -join ', ')" }

function Invoke-Verify {
  param([string[]]$Arguments)
  for ($attempt = 1; $attempt -le $Retries; $attempt++) {
    gh attestation verify @Arguments
    if ($LASTEXITCODE -eq 0) {
      Write-Output "Verified: $($Arguments -join ' ')"
      return
    }
    if ($attempt -lt $Retries) { Start-Sleep -Seconds $DelaySeconds }
  }
  throw "Attestation verification failed after $Retries attempts: $($Arguments -join ' ')"
}

foreach ($package in $packages) {
  $provenance = @($package) + $signer
  if ($ProvenanceBundle) { $provenance += @('--bundle', $ProvenanceBundle) }
  Invoke-Verify $provenance

  $sbom = @($package) + $signer + @('--predicate-type', $sbomPredicateType)
  if ($SbomBundle) { $sbom += @('--bundle', $SbomBundle) }
  Invoke-Verify $sbom
}
