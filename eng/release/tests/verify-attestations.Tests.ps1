# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

# verify-attestations.ps1 with 'gh' mocked: the arguments it passes and its retry logic.

BeforeAll {
  $script:sut = Join-Path $PSScriptRoot '../verify-attestations.ps1'
  $script:workflow = 'owner/repo/.github/workflows/on-prerelease.yml'

  function Invoke-Verify {
    param([hashtable]$Extra = @{})
    $params = @{
      PackagePath  = Join-Path $TestDrive '*.tgz'
      Repository   = 'owner/repo'
      SourceRef    = 'refs/tags/v1.2.3'
      Retries      = 3
      DelaySeconds = 0
    }
    foreach ($key in $Extra.Keys) { $params[$key] = $Extra[$key] }
    & $sut @params 3>$null
  }
}

Describe 'verify-attestations.ps1' {
  BeforeAll {
    Set-Content (Join-Path $TestDrive 'AdminApp.Api-1.2.3.tgz') 'api'
    Set-Content (Join-Path $TestDrive 'AdminApp.FrontEnd-1.2.3.tgz') 'fe'
  }

  Context 'when gh succeeds' {
    BeforeAll {
      Mock gh { $global:LASTEXITCODE = 0 }
    }

    It 'checks provenance and SBOM for each package' {
      Invoke-Verify | Should -HaveCount 4
      Should -Invoke gh -Times 4 -Exactly
      Should -Invoke gh -Times 2 -Exactly -ParameterFilter { $args -contains '--predicate-type' }
    }

    It 'pins the signer workflow, OIDC issuer and source ref on every check' {
      Invoke-Verify | Out-Null
      Should -Invoke gh -Times 4 -Exactly -ParameterFilter {
        $a = $args -join ' '
        $a -like "*-R owner/repo --signer-workflow $workflow*" -and
        $a -like '*--cert-oidc-issuer https://token.actions.githubusercontent.com*' -and
        $a -like '*--source-ref refs/tags/v1.2.3*'
      }
    }

    It 'passes the bundles when given' {
      $bundles = @{ ProvenanceBundle = 'p.sigstore.json'; SbomBundle = 's.sigstore.json' }
      Invoke-Verify $bundles | Out-Null
      Should -Invoke gh -Times 2 -Exactly -ParameterFilter { ($args -join ' ') -like '*--bundle p.sigstore.json*' }
      Should -Invoke gh -Times 2 -Exactly -ParameterFilter { ($args -join ' ') -like '*--bundle s.sigstore.json*' }
    }
  }

  Context 'when gh fails' {
    BeforeAll {
      Mock gh { 'no attestations found'; $global:LASTEXITCODE = 1 }
    }

    It 'retries, then throws with the check and the last error' {
      { Invoke-Verify } |
        Should -Throw '*provenance of AdminApp.Api-1.2.3.tgz (attestations API) failed after 3 attempt(s): no attestations found*'
      Should -Invoke gh -Times 3 -Exactly
    }

    It 'does not retry a bundle check' {
      $bundles = @{ ProvenanceBundle = 'p.sigstore.json'; SbomBundle = 's.sigstore.json' }
      { Invoke-Verify $bundles } | Should -Throw '*(bundle) failed after 1 attempt(s)*'
      Should -Invoke gh -Times 1 -Exactly
    }
  }

  Context 'when the attestation is indexed late' {
    It 'passes on a later attempt' {
      $script:calls = 0
      Mock gh { $script:calls++; $global:LASTEXITCODE = if ($script:calls -eq 1) { 1 } else { 0 } }
      Invoke-Verify | Should -HaveCount 4
      Should -Invoke gh -Times 5 -Exactly
    }
  }

  Context 'argument checks' {
    BeforeAll {
      Mock gh { $global:LASTEXITCODE = 0 }
    }

    It 'requires both bundles or neither' {
      { Invoke-Verify @{ ProvenanceBundle = 'p.sigstore.json' } } | Should -Throw '*both -ProvenanceBundle and -SbomBundle*'
      Should -Invoke gh -Times 0 -Exactly
    }

    It 'fails when there are no packages' {
      { Invoke-Verify @{ PackagePath = Join-Path $TestDrive 'missing*.tgz' } } | Should -Throw '*No packages found*'
    }
  }
}
