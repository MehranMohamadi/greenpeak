@echo off
setlocal
cd /d "%~dp0"
set "GREENPEAK_INTERNAL_API_BASE_URL=http://127.0.0.1:8000/api/v1"
set "ANALYTICS_PROXY_BASE_URL=http://127.0.0.1:8000/api/v1"
set "NEXT_PUBLIC_API_BASE_URL=/api/v1"
if not exist "node_modules\next\package.json" (
  echo Frontend dependencies are missing. Run npm.cmd ci in front2.
  exit /b 1
)
call npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
