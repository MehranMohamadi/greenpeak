@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Backend virtual environment is missing: backend2\.venv
  exit /b 1
)
set "DEBUG=false"
set "ENVIRONMENT=development"
set "MONGODB_URL=mongodb://127.0.0.1:27017"
set "GREENPEAK_DAILY_ANALYSIS_ENABLED=false"
set "GREENPEAK_NEWS_ENABLED=false"
set "GREENPEAK_OFFICIAL_SENTIMENT_ENABLED=false"
echo GreenPeak backend: http://127.0.0.1:8000
".venv\Scripts\python.exe" -m uvicorn src.main:app --host 127.0.0.1 --port 8000
