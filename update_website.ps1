# Updates the website plug-in (Claude's new thinking settings, long pages) and adds build progress to the dashboard.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\update_website.ps1
# Copies from before the change are saved in the backup folder.
param([string]$MainWorkflowId = 'sv251vpUDQywSpsf')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force work, backup | Out-Null

$cmd = "n8n export:workflow --id=$MainWorkflowId --output=/backup/main_before_website_update.json" +
       ' && n8n export:workflow --id=websiteplug00001 --output=/backup/website_plugin_before_update.json' +
       ' && node /plugins/update_website.js /backup/main_before_website_update.json /backup/website_plugin_before_update.json' +
       ' && n8n import:workflow --input=/work/plugin.json && n8n import:workflow --input=/work/main.json' +
       " && n8n publish:workflow --id=websiteplug00001 && n8n publish:workflow --id=$MainWorkflowId"

Write-Host 'Stopping n8n for a moment...' -ForegroundColor Cyan
docker compose stop n8n
docker compose run --rm --no-deps -v "${PWD}\work:/work" -v "${PWD}\plugins:/plugins:ro" -v "${PWD}\backup:/backup" `
    --entrypoint sh n8n -c $cmd
$failed = $LASTEXITCODE
Write-Host 'Starting n8n again...' -ForegroundColor Cyan
docker compose up -d n8n
if ($failed) { throw 'The update did not complete (see the message above). Copies of both workflows are in the backup folder.' }

Write-Host "`nDone. Wait ~30 seconds, then click Build page in the dashboard: the lead shows 'Building page...' and the dashboard refreshes itself." -ForegroundColor Green
