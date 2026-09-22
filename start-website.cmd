@echo off
setlocal
cd /d "%~dp0"
set "sgbcRuntime=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies"
if exist "%sgbcRuntime%\node\bin\node.exe" (
  set "PATH=%sgbcRuntime%\node\bin;%sgbcRuntime%\bin\fallback;%PATH%"
)
where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  echo pnpm could not be found. Install Node.js and pnpm, then try again.
  pause
  exit /b 1
)
echo Website: http://127.0.0.1:3000
echo Keep this window open. Press Ctrl+C to stop.
call pnpm.cmd dev --port 3000 --webpack
