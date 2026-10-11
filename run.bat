@echo off
setlocal
title S!aP Mazzant PoC (port 5176)
cd /d "%~dp0app"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node 20+ from https://nodejs.org and re-run.
  pause
  exit /b 1
)

REM --- Backend (integration hub, simulated) on 4333: REST + websocket /ws ---
if not exist "%~dp0server\node_modules\ws" (
  echo Installing backend dependencies - first run only, needs internet...
  call npm install --prefix "%~dp0server"
)
netstat -ano | findstr /R /C:":4333 .*LISTENING" >nul
if errorlevel 1 (
  if exist "%~dp0server\node_modules\ws" (
    echo Starting backend on http://127.0.0.1:4333 - minimized window
    start "Mazzant API 4333" /min /d "%~dp0server" cmd /c node index.js
  ) else (
    echo [WARN] Backend dependencies missing - app will run with local simulation only.
  )
) else (
  echo Backend already running on 4333.
)

REM Port 5176 is pinned (strictPort). Stop if something else already holds it.
netstat -ano | findstr /R /C:":5176 .*LISTENING" >nul
if not errorlevel 1 (
  echo [WARN] Port 5176 is already in use - the app may already be running.
  echo        Opening http://127.0.0.1:5176 anyway.
  start "" http://127.0.0.1:5176
  pause
  exit /b 0
)

if not exist "node_modules\vite" (
  echo Installing dependencies - first run only, needs internet...
  call npm install --prefix "%CD%"
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo  S!aP Mazzant PoC - simulated data only
echo  Starting at http://127.0.0.1:5176  (Ctrl+C to stop)
echo.

REM Open the browser a few seconds after the server starts.
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start "" http://127.0.0.1:5176"

call npm run dev

REM Stop the minimized backend window started above.
taskkill /f /t /fi "WINDOWTITLE eq Mazzant API 4333*" >nul 2>nul

echo.
echo Server stopped.
pause
