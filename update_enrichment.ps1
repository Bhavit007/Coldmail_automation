# Upgrades the enrichment plug-in: Crawl4AI reads each lead's website for free, Claude only fills the gaps.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\update_enrichment.ps1
# A copy of your workflows from before the change is saved in backup\all_before_enrichment_v2.json.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force work, backup | Out-Null

Write-Host 'Starting Crawl4AI (the first time downloads about 2 GB)...' -ForegroundColor Cyan
docker compose up -d crawl4ai
if ($LASTEXITCODE) { throw 'Could not start Crawl4AI. Is Docker running?' }

$cmd = 'n8n export:workflow --all --output=/backup/all_before_enrichment_v2.json' +
       ' && node /plugins/update_enrichment.js /backup/all_before_enrichment_v2.json' +
       ' && n8n import:workflow --input=/work/plugin.json && n8n publish:workflow --id=enrichclaude0001'

Write-Host 'Stopping n8n for a moment...' -ForegroundColor Cyan
docker compose stop n8n
docker compose run --rm --no-deps -v "${PWD}\work:/work" -v "${PWD}\plugins:/plugins:ro" -v "${PWD}\backup:/backup" `
    --entrypoint sh n8n -c $cmd
$failed = $LASTEXITCODE
Write-Host 'Starting n8n again...' -ForegroundColor Cyan
docker compose up -d n8n
if ($failed -eq 2) { Write-Host "`nAlready done earlier - nothing changed." -ForegroundColor Green; return }
if ($failed) { throw 'The update did not complete (see the message above). Your workflows copy is in backup\all_before_enrichment_v2.json.' }

Write-Host "`nDone. Run 'Process leads' as usual - the enrichment plug-in now reads websites with Crawl4AI first." -ForegroundColor Green
