$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:SERVER_PORT = '2590'
$env:FRAGMENT_DATA_DIR = Join-Path (Get-Location) 'releases/local-preview-data'
$env:FRAGMENT_LOCAL_PREVIEW = 'true'
$env:FRAGMENT_REQUIRE_DATABASE = 'false'
$env:VITE_SERVER_URL = 'ws://127.0.0.1:2590'
$env:VITE_LOCAL_PREVIEW = 'true'
$env:VITE_DEMO_MODE = 'false'
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:RENDER -ErrorAction SilentlyContinue
$env:PATH = (Join-Path (Get-Location) 'node_modules/.bin') + ';' + $env:PATH
& node_modules/.bin/concurrently.cmd -k 'tsx watch server/index.ts' 'vite --config client/vite.config.ts --port 5190 --host 127.0.0.1'
