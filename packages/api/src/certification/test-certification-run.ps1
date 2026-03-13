param(
  [string]$ApiBaseUrl = 'http://localhost:3000/api',
  [string]$ScenarioPath = 'v4/MasterSchedule/BellSchedules',
  [string]$Env = 'certification.ed-fi.org',
  [string]$ParamsJson = '',
  [switch]$UseInlineParams = $false
)

<#
Example usages:
PowerShell Core:
  pwsh .\packages\api\scripts\test-certification-run.ps1
  pwsh .\packages\api\scripts\test-certification-run.ps1 -ApiBaseUrl 'http://localhost:3333/api' -ScenarioPath 'v4/MasterSchedule/BellSchedules' -ParamsJson '{"SCHOOL_ID":255901001}'
  pwsh test-certification-run.ps1 -ApiBaseUrl 'http://localhost:3333/api' -ScenarioPath 'v4/MasterSchedule/BellSchedules' -ParamsJson '{"SCHOOL_ID":255901001}'
  powershell -ExecutionPolicy Bypass -File test-certification-run.ps1 -ApiBaseUrl 'http://localhost:3333/api' -ScenarioPath 'v4/MasterSchedule/BellSchedules' -ParamsJson '{"schoolId":1549697793, "bellScheduleName":"Normal Schedule"}'
  powershell -ExecutionPolicy Bypass -File .\test-certification-run.ps1 -ApiBaseUrl "http://localhost:3333/api" -ScenarioPath "v4/MasterSchedule/BellSchedules" -ParamsJson "{\"schoolId\":1549697793,\"bellScheduleName\":\"Normal Schedule\"}"

  # Use inline params without escaping (recommended for interactive use):
  # powershell -ExecutionPolicy Bypass -File .\test-certification-run.ps1 -ApiBaseUrl 'http://localhost:3333/api' -ScenarioPath 'v4/MasterSchedule/BellSchedules' -UseInlineParams
#>

# Inline parameter object you can use with -UseInlineParams to avoid shell escaping
# $InlineParams = @{
#   schoolId = 1549697793
#   bellScheduleName = 'Early Release B'
# }

$InlineParams = @{
  schoolId = 255901107
  bellScheduleName = 'Normal Schedule'
}

if ($UseInlineParams) {
  $ParamsJson = $InlineParams | ConvertTo-Json -Depth 10
}

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

Write-Info "Using API base: $ApiBaseUrl"
Write-Info "ScenarioPath: $ScenarioPath"

try {
  $paramsObj = $null
  if ($ParamsJson -and $ParamsJson.Trim().Length -gt 0) {
    $paramsObj = $ParamsJson | ConvertFrom-Json -ErrorAction Stop
  }
} catch {
  Write-Err "Failed to parse -ParamsJson: $_"
  exit 2
}

$body = @{
  scenarioPath = $ScenarioPath
  params = $paramsObj
  env = $Env
}

$jsonBody = $body | ConvertTo-Json -Depth 10

$uri = "$ApiBaseUrl/certification/run"
Write-Info "POST $uri"

try {
  $response = Invoke-RestMethod -Method Post -Uri $uri -Body $jsonBody -ContentType 'application/json'
} catch {
  Write-Err "HTTP request failed: $_"
  exit 3
}

Write-Info "Response received. Preparing to save results."

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$safeScenario = ($ScenarioPath -replace '[\\/: ]', '_')
$resultsDir = Join-Path -Path $PSScriptRoot -ChildPath '\certification-results'
New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
$outFile = Join-Path -Path $resultsDir -ChildPath "$($safeScenario)-$timestamp.json"

$response | ConvertTo-Json -Depth 20 | Out-File -FilePath $outFile -Encoding utf8
Write-Info "Saved response to: $outFile"

Write-Host "`n=== Response (summary) ===`n"
if ($response.exitCode -ne $null) {
  Write-Host "exitCode: $($response.exitCode)"
}
if ($response.scenarioPath -ne $null) { Write-Host "scenarioPath: $($response.scenarioPath)" }
if ($response.workDir -ne $null) { Write-Host "workDir: $($response.workDir)" }

Write-Host "`nFull response file: $outFile`n"

exit 0
