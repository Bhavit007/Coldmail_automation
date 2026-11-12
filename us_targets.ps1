# Switches lead finding to US businesses (db\us_targets.sql). Safe to run more than once.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\us_targets.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Get-Content db\us_targets.sql -Raw | docker compose exec -T postgres psql -U coldmail -d coldmail -v ON_ERROR_STOP=1
if ($LASTEXITCODE) { throw 'Could not update the database (see the message above). Is Docker running?' }
Write-Host "`nDone. In n8n, open 'Find leads' and click 'Execute workflow' to find 10 US leads." -ForegroundColor Green
