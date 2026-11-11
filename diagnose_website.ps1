# Shows the website plug-in's settings and what happened in its last 5 runs. Changes nothing.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\diagnose_website.ps1
Set-Location $PSScriptRoot
Get-Content plugins\diagnose_website.js -Raw | docker compose exec -T n8n node -
