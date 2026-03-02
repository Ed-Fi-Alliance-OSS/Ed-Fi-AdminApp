$body = @{
  # Clone https://github.com/Ed-Fi-Alliance-OSS/certification-testing 
  # Edit with your script path and params as needed
  scriptPath = 'C:\Users\JohanJosephCamposCas\Repos\certification-testing\bruno\SIS\v4\Student\Students\01 - Check first Student is valid.bru'
  params = @{
    # credentials omitted intentionally, token will be used instead for auth in this test
    # clientId     = '4NRm8Cpw1G2p'
    # clientSecret = 'tfgFV5RUvZtsE0rAzf2ZuIX8'
    oauthUrl         = 'https://localhost/v7-multi-api/tenant1/oauth/token'
    studentUniqueId  = '12345'
    resourceBaseUrl  = 'https://localhost/v7-multi-api/tenant1/data/v3'
  }
  auth = @{ 
    type = 'bearer';
    token = '32b1b90c00a54b16acafdf79c9591bb1' # Edit with your token
   }   
} | ConvertTo-Json -Depth 6

try {
  $resp = Invoke-RestMethod -Uri 'http://localhost:3333/api/certification/run-scenario' -Method Post -Headers @{ 'Content-Type' = 'application/json' } -Body $body -Verbose
  $resp | ConvertTo-Json -Depth 10 | Out-File runner-response.json
  Write-Host 'Saved runner-response.json'
} catch {
  $_ | Out-File parse-run-error.txt
  Write-Host 'Request failed — see runner-error.txt'
}