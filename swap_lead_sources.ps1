# Adds the lead-sources plug-in: Amazon nearby grid + Google Maps scraper + Claude web search.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\swap_lead_sources.ps1
# A copy of all your workflows from before the change is saved in backup\all_before_lead_sources.json.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force work, backup | Out-Null

Write-Host 'Starting the Google Maps scraper (the first time downloads about 1 GB)...' -ForegroundColor Cyan
docker compose up -d postgres gmaps
if ($LASTEXITCODE) { throw 'Could not start the Google Maps scraper. Is Docker running?' }

Write-Host 'Adding the new searches to the database...' -ForegroundColor Cyan
Get-Content db\step4.sql -Raw | docker compose exec -T postgres psql -U coldmail -d coldmail -v ON_ERROR_STOP=1
if ($LASTEXITCODE) { throw 'Could not update the database (see the message above).' }

$cmd = 'n8n export:workflow --all --output=/backup/all_before_lead_sources.json' +
       ' && node /plugins/swap_lead_sources.js /backup/all_before_lead_sources.json' +
       ' && n8n import:workflow --input=/work/plugin.json && n8n import:workflow --input=/work/main.json' +
       ' && n8n publish:workflow --id=leadsource000001 && sh /work/publish_main.sh'

Write-Host 'Stopping n8n for a moment...' -ForegroundColor Cyan
docker compose stop n8n
docker compose run --rm --no-deps -v "${PWD}\work:/work" -v "${PWD}\plugins:/plugins:ro" -v "${PWD}\backup:/backup" `
    --entrypoint sh n8n -c $cmd
$failed = $LASTEXITCODE
Write-Host 'Starting n8n again...' -ForegroundColor Cyan
docker compose up -d n8n
if ($failed -eq 2) { Write-Host "`nWorkflow was already swapped earlier - only the database and scraper were updated." -ForegroundColor Green; return }
if ($failed) { throw 'The swap did not complete (see the message above). Your workflows copy is in backup\all_before_lead_sources.json.' }

Write-Host "`nDone. In n8n open 'Find leads' and click 'Execute workflow' (run it 3 times to try all three sources)." -ForegroundColor Green
Write-Host 'Google Maps scraper dashboard: http://localhost:8090' -ForegroundColor Green
