# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

BeforeAll {
  $script:sut = Join-Path $PSScriptRoot '../collect-release-assets.ps1'
}

Describe 'collect-release-assets.ps1' {
  BeforeEach {
    $script:source = Join-Path $TestDrive 'source'
    $script:assets = Join-Path $TestDrive 'assets'
    Remove-Item $source, $assets -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $source | Out-Null
    'api', 'fe' | ForEach-Object { Set-Content (Join-Path $source "AdminApp.$_-1.2.3.tgz") $_ }
    Set-Content (Join-Path $source 'AdminApp.SBOM.zip') 'zip'
    Set-Content (Join-Path $TestDrive 'provenance.json') 'provenance'
    Set-Content (Join-Path $TestDrive 'sbom.json') 'sbom'

    $script:params = @{
      ProvenanceBundle = Join-Path $TestDrive 'provenance.json'
      SbomBundle       = Join-Path $TestDrive 'sbom.json'
      SourceDirectory  = $source
      OutputDirectory  = $assets
    }
  }

  It 'copies the packages and SBOM and names the bundles after the package' {
    & $sut @params | Out-Null
    (Get-ChildItem $assets).Name | Sort-Object | Should -Be @(
      'AdminApp.api-1.2.3.tgz'
      'AdminApp.fe-1.2.3.tgz'
      'AdminApp.provenance.sigstore.json'
      'AdminApp.SBOM.sigstore.json'
      'AdminApp.SBOM.zip'
    )
    Get-Content (Join-Path $assets 'AdminApp.SBOM.sigstore.json') | Should -Be 'sbom'
  }

  It 'removes files left from an earlier run' {
    New-Item -ItemType Directory -Path $assets | Out-Null
    Set-Content (Join-Path $assets 'stale.tgz') 'old'
    & $sut @params | Out-Null
    Join-Path $assets 'stale.tgz' | Should -Not -Exist
  }

  It 'fails when the SBOM zip is missing' {
    Remove-Item (Join-Path $source 'AdminApp.SBOM.zip')
    { & $sut @params } | Should -Throw '*SBOM zip not found*'
  }

  It 'fails when a bundle is missing' {
    $params.SbomBundle = Join-Path $TestDrive 'missing.json'
    { & $sut @params } | Should -Throw '*Attestation bundle not found*'
  }
}
