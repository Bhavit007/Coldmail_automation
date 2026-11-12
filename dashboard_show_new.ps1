# Dashboard shows newly found leads (before enrichment) and which source found each one.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\dashboard_show_new.ps1
# A copy of your workflows from before the change is saved in backup\all_before_dashboard_new.json.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force work, backup | Out-Null

$cmd = 'n8n export:workflow --all --output=/backup/all_before_dashboard_new.json' +
       ' && node /plugins/dashboard_show_new.js /backup/all_before_dashboard_new.json' +
       ' && n8n import:workflow --input=/work/main.json && n8n publish:workflow --id=$(cat /work/main_id.txt)'

Write-Host 'Stopping n8n for a moment...' -ForegroundColor Cyan
docker compose stop n8n
docker compose run --rm --no-deps -v "${PWD}\work:/work" -v "${PWD}\plugins:/plugins:ro" -v "${PWD}\backup:/backup" `
    --entrypoint sh n8n -c $cmd
$failed = $LASTEXITCODE
Write-Host 'Starting n8n again...' -ForegroundColor Cyan
docker compose up -d n8n
if ($failed -eq 2) { Write-Host "`nAlready done earlier - nothing changed." -ForegroundColor Green; return }
if ($failed) { throw 'The change did not complete (see the message above). Your workflows copy is in backup\all_before_dashboard_new.json.' }

Write-Host "`nDone. Open http://localhost:5688/webhook/dashboard - today's new leads show as 'pending'." -ForegroundColor Green
