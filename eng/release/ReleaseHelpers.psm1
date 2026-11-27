# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

# Helpers shared by the eng/release scripts.

# Default folder for the release build output (tarballs and SBOM), relative to the repo root.
$DefaultReleaseDirectory = 'dist/release'

function Get-RepoRoot {
  (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
}

# Run a native command and throw on a non-zero exit code. pwsh does not stop on a
# native command failure, even with $ErrorActionPreference = 'Stop'.
function Invoke-Native {
  param(
    [Parameter(Mandatory)][string]$Command,
    [string[]]$Arguments = @()
  )
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE" }
}

# Write a step output when running in GitHub Actions; no-op locally.
function Set-GitHubOutput {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Value
  )
  if ($env:GITHUB_OUTPUT) { "$Name=$Value" >> $env:GITHUB_OUTPUT }
}

# Run a script block inside a collapsible log group in GitHub Actions.
function Invoke-LogGroup {
  param(
    [Parameter(Mandatory)][string]$Title,
    [Parameter(Mandatory)][scriptblock]$ScriptBlock
  )
  if ($env:GITHUB_ACTIONS) { Write-Host "::group::$Title" } else { Write-Host "== $Title" }
  try { & $ScriptBlock }
  finally { if ($env:GITHUB_ACTIONS) { Write-Host '::endgroup::' } }
}

# Resolve paths and wildcards to files, failing when nothing matches.
function Resolve-PackagePath {
  param([Parameter(Mandatory)][string[]]$Path)
  $files = @(Resolve-Path $Path -ErrorAction SilentlyContinue | ForEach-Object Path)
  if ($files.Count -eq 0) { throw "No packages found for: $($Path -join ', ')" }
  $files
}

Export-ModuleMember -Function Get-RepoRoot, Invoke-Native, Set-GitHubOutput, Invoke-LogGroup, Resolve-PackagePath `
  -Variable DefaultReleaseDirectory
