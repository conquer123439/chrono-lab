$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host 'Starting Chrono Lab at http://127.0.0.1:5173 (no-cache server)' -ForegroundColor Cyan
Write-Host 'Keep this window open while playing. Press Enter to stop the server.'
python serve.py
Read-Host
