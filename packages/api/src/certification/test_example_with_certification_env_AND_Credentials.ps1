$body = @{
  # Clone https://github.com/Ed-Fi-Alliance-OSS/certification-testing 
  # Edit with your script path and params as needed
  scriptPath = '..Repos\certification-testing\bruno\SIS\v4\Student\Students\01 - Check first Student is valid.bru'
  params = @{
    # Edit with your credentials 
    clientId     = 'dbHD7dnJt2yc'
    clientSecret = '2rA6X3CxQ88PywCZ518Z3Hla' 
    oauthUrl         = 'https://certification.ed-fi.org/v6.2/api/oauth/token'
    studentUniqueId  = '604824'
    resourceBaseUrl  = 'https://certification.ed-fi.org/v6.2/api/data/v3'
  }
  auth = @{ 
    type = 'bearer'; 
    # token omitted intentionally so runner will fetch it
    # token = '' 
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