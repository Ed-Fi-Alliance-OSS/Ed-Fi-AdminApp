# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Lint the GitHub Actions workflows with actionlint.

.DESCRIPTION
Downloads the pinned actionlint release for this platform (sha256-checked, cached in
the temp folder) and runs it against .github/workflows. actionlint checks workflow
syntax, expressions, job dependencies, permissions and, when shellcheck is installed
(it is on GitHub-hosted runners), the shell scripts in run: steps.

.EXAMPLE
./eng/lint-workflows.ps1
#>

$ErrorActionPreference = 'Stop'

# Digests are from https://github.com/rhysd/actionlint/releases/tag/v1.7.12
$version = '1.7.12'
$sha256 = @{
  'linux_amd64'   = '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8'
  'linux_arm64'   = '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6'
  'darwin_amd64'  = '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644'
  'darwin_arm64'  = 'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'
  'windows_amd64' = '6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9'
}

$os = if ($IsWindows) { 'windows' } elseif ($IsMacOS) { 'darwin' } else { 'linux' }
$arch = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture) {
  'X64' { 'amd64' }
  'Arm64' { 'arm64' }
  default { throw "No actionlint $version binary is published for $_" }
}
$platform = "${os}_$arch"
$archive = "actionlint_${version}_$platform.$(if ($IsWindows) { 'zip' } else { 'tar.gz' })"

$cacheDir = Join-Path ($env:RUNNER_TEMP ?? [System.IO.Path]::GetTempPath()) "actionlint/$version"
$actionlint = Join-Path $cacheDir "actionlint$(if ($IsWindows) { '.exe' })"

if (-not (Test-Path $actionlint)) {
  New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
  $download = Join-Path $cacheDir $archive
  $url = "https://github.com/rhysd/actionlint/releases/download/v$version/$archive"
  Write-Host "Downloading $url"
  Invoke-WebRequest $url -OutFile $download -MaximumRetryCount 3 -RetryIntervalSec 5 -TimeoutSec 300
  $hash = (Get-FileHash $download -Algorithm SHA256).Hash
  if ($hash -ne $sha256[$platform]) {
    Remove-Item $download -Force
    throw "sha256 mismatch for $archive. Expected $($sha256[$platform]), got $hash"
  }
  if ($IsWindows) { Expand-Archive $download -DestinationPath $cacheDir -Force }
  else { tar -xzf $download -C $cacheDir actionlint }
  Remove-Item $download
}

Push-Location (Join-Path $PSScriptRoot '..')
try {
  & $actionlint -color
  if ($LASTEXITCODE -ne 0) { throw "actionlint found problems (exit code $LASTEXITCODE)" }
  Write-Output "actionlint ${version}: no problems found"
}
finally {
  Pop-Location
}
