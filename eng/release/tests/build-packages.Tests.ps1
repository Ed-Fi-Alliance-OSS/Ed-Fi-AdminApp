# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

# The full build runs in the pack job, which also checks that package.json is reverted.
# These tests cover the checks that run before the build starts.

BeforeAll {
  $script:sut = Join-Path $PSScriptRoot '../build-packages.ps1'
}

Describe 'build-packages.ps1' {
  It 'rejects a version that is not SemVer, before building' -ForEach @(
    @{ Version = 'not-a-version' }
    @{ Version = '1.2' }
    @{ Version = 'v1.2.3 extra' }
  ) {
    { & $sut -Version $Version -SkipInstall -OutputDirectory $TestDrive } | Should -Throw '*is not a SemVer version*'
  }
}
