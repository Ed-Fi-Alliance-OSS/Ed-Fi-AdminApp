# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Run the Pester tests for the eng/release scripts.

.DESCRIPTION
Installs the pinned Pester version for the current user if it is missing, then runs
the tests in this folder. The tests stub sbom-tool and gh, so they need no network
access or GitHub token.

.PARAMETER ResultPath
Optional NUnit XML results file, for CI.

.EXAMPLE
./eng/release/tests/run-tests.ps1
#>

param(
  [string]$ResultPath
)

$ErrorActionPreference = 'Stop'

$pesterVersion = '6.2.0'
if (-not (Get-Module Pester -ListAvailable | Where-Object Version -eq $pesterVersion)) {
  Install-Module Pester -RequiredVersion $pesterVersion -Scope CurrentUser -Force -SkipPublisherCheck
}
Import-Module Pester -RequiredVersion $pesterVersion

$config = New-PesterConfiguration
$config.Run.Path = $PSScriptRoot
$config.Run.Exit = $true
$config.Output.Verbosity = 'Detailed'
if ($ResultPath) {
  $config.TestResult.Enabled = $true
  $config.TestResult.OutputPath = $ResultPath
}
Invoke-Pester -Configuration $config
