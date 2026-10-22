@echo off
setlocal
cd /d "%~dp0"
set "DEBUG=false"
set "ENVIRONMENT=development"
set "MONGODB_URL=mongodb://127.0.0.1:27017"
".venv\Scripts\python.exe" -m src.services.local_market_analysis %*
