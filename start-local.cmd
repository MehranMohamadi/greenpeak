@echo off
setlocal
cd /d "%~dp0"
if not exist "backend2\instance" mkdir "backend2\instance"
powershell.exe -NoProfile -Command "function Test-LocalPort($port) { $client=[Net.Sockets.TcpClient]::new(); try { $pending=$client.ConnectAsync('127.0.0.1',$port); return ($pending.Wait(500) -and $client.Connected) } catch { return $false } finally { $client.Dispose() } }; $taskRoot=(Get-Location).Path; if (-not (Test-LocalPort 8000)) { Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c backend2\start-local.cmd' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput 'backend2\instance\local-backend.stdout.log' -RedirectStandardError 'backend2\instance\local-backend.stderr.log' } else { Write-Output 'Port 8000 is already in use; existing process preserved.' }; if (-not (Test-LocalPort 3000)) { Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c front2\start-local.cmd' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput 'backend2\instance\local-frontend.stdout.log' -RedirectStandardError 'backend2\instance\local-frontend.stderr.log' } else { Write-Output 'Port 3000 is already in use; existing process preserved.' }"
echo Dashboard: http://127.0.0.1:3000/dashboard
echo Backend health: http://127.0.0.1:8000/health
echo Startup may take a few seconds. Logs: backend2\instance\local-*.log
echo To run interactively, use backend2\start-local.cmd and front2\start-local.cmd in separate terminals.
