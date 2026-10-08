@echo off
cd /d "%~dp0"
title Fragment
where npm >nul 2>nul
if errorlevel 1 (
  echo Install Node.js to launch Fragment.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Fragment: http://localhost:5174/
echo Keep this window open while playing.
call npm run dev
pause
