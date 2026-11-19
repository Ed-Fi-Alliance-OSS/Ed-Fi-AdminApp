# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

# The SBOM checks in new-sbom.ps1, run against a stub sbom-tool.

BeforeAll {
  $script:sut = Join-Path $PSScriptRoot '../new-sbom.ps1'

  # Stub for sbom-tool: writes a manifest according to $env:SBOM_STUB_MODE.
  $script:stub = Join-Path $TestDrive 'sbom-tool-stub.ps1'
  Set-Content $stub @'
$outputDir = $args[[array]::IndexOf($args, '-m') + 1]
$manifestDir = Join-Path $outputDir '_manifest/spdx_2.2'
$mode = $env:SBOM_STUB_MODE
if ($mode -eq 'exit-code') { exit 3 }
if ($mode -eq 'no-manifest') { exit 0 }
New-Item -ItemType Directory -Path $manifestDir -Force | Out-Null
$manifest = Join-Path $manifestDir 'manifest.spdx.json'
if ($mode -eq 'invalid-json') { Set-Content $manifest '{ not json'; exit 0 }
$count = if ($mode -eq 'few') { 2 } else { 20 }
$packages = @(1..$count | ForEach-Object { @{ SPDXID = "SPDXRef-Package-$_"; name = "dep$_" } })
if ($mode -ne 'no-root') { $packages += @{ SPDXID = 'SPDXRef-RootPackage'; name = 'EdFi.AdminApp' } }
@{ packages = $packages } | ConvertTo-Json -Depth 5 | Set-Content $manifest
exit 0
'@

  function Invoke-Sbom {
    param([string]$Mode)
    $env:SBOM_STUB_MODE = $Mode
    & $sut -Version 1.2.3 -OutputDirectory $outDir -SbomToolPath $stub
  }
}

Describe 'new-sbom.ps1' {
  BeforeEach {
    $script:outDir = Join-Path $TestDrive ([guid]::NewGuid())
    New-Item -ItemType Directory -Path $outDir | Out-Null
    Set-Content (Join-Path $outDir 'AdminApp.Api-1.2.3.tgz') 'api'
    $script:githubOutput = Join-Path $outDir 'github-output.txt'
    $env:GITHUB_OUTPUT = $githubOutput
  }

  AfterAll {
    Remove-Item Env:SBOM_STUB_MODE, Env:GITHUB_OUTPUT -ErrorAction SilentlyContinue
  }

  It 'writes the zip and step outputs for a good SBOM' {
    Invoke-Sbom 'ok' | Should -Contain 'SBOM: 21 packages, 20 dependencies (root: EdFi.AdminApp)'
    Join-Path $outDir 'AdminApp.SBOM.zip' | Should -Exist
    Get-Content $githubOutput | Should -Contain "zip-path=$(Join-Path (Resolve-Path $outDir) 'AdminApp.SBOM.zip')"
  }

  It 'fails when sbom-tool exits non-zero' {
    { Invoke-Sbom 'exit-code' } | Should -Throw '*sbom-tool failed with exit code 3*'
  }

  It 'fails when sbom-tool writes no manifest' {
    { Invoke-Sbom 'no-manifest' } | Should -Throw '*did not write*manifest.spdx.json*'
  }

  It 'fails when the manifest is not valid JSON' {
    { Invoke-Sbom 'invalid-json' } | Should -Throw '*SBOM is not valid JSON*'
  }

  It 'fails when the manifest has no root package' {
    { Invoke-Sbom 'no-root' } | Should -Throw '*0 root packages*'
  }

  It 'fails when the manifest lists too few dependencies' {
    { Invoke-Sbom 'few' } | Should -Throw '*lists 2 dependencies, minimum 10*'
    Join-Path $outDir 'AdminApp.SBOM.zip' | Should -Not -Exist
  }

  It 'fails when there are no packages' {
    Remove-Item (Join-Path $outDir '*.tgz')
    { Invoke-Sbom 'ok' } | Should -Throw '*No packages found*'
  }
}
