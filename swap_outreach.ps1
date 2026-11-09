# Swaps the email-sending nodes in your main workflow for the outreach plug-in.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\swap_outreach.ps1
# A copy of your workflow from before the change is saved in backup\main_before_outreach_plugin.json.
param([string]$MainWorkflowId = 'sv251vpUDQywSpsf')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force work, backup | Out-Null

$cmd = "n8n export:workflow --id=$MainWorkflowId --output=/backup/main_before_outreach_plugin.json" +
       ' && node /plugins/swap_outreach.js /backup/main_before_outreach_plugin.json' +
       ' && n8n import:workflow --input=/work/plugin.json && n8n import:workflow --input=/work/main.json' +
       " && n8n publish:workflow --id=outreachplug0001 && n8n publish:workflow --id=$MainWorkflowId"

Write-Host 'Stopping n8n for a moment...' -ForegroundColor Cyan
docker compose stop n8n
docker compose run --rm --no-deps -v "${PWD}\work:/work" -v "${PWD}\plugins:/plugins:ro" -v "${PWD}\backup:/backup" `
    --entrypoint sh n8n -c $cmd
$failed = $LASTEXITCODE
Write-Host 'Starting n8n again...' -ForegroundColor Cyan
docker compose up -d n8n
if ($failed -eq 2) { Write-Host "`nAlready done earlier - nothing changed." -ForegroundColor Green; return }
if ($failed) { throw 'The swap did not complete (see the message above). Your workflow copy is in backup\main_before_outreach_plugin.json.' }

Write-Host "`nDone. Open http://localhost:5688 - your workflow now uses 'Outreach (plug-in)', and 'PLUGIN outreach: channels' is published." -ForegroundColor Green
