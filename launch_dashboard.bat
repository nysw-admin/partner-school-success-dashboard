@echo off
title NY Sun Works - Dashboard Server
color 0B
cls
echo ===============================================================================
echo          NEW YORK SUN WORKS - PARTNER SCHOOL SUCCESS DASHBOARD
echo                         LOCAL SERVER LAUNCHER
echo ===============================================================================
echo.
echo Checking Node.js environment...
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in your system PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Detected Node.js %NODE_VER%
echo.
echo Starting local web server on http://localhost:5173/ ...
echo Your web browser will open automatically in a few seconds.
echo (Keep this window open while using the dashboard. Close to exit.)
echo -------------------------------------------------------------------------------
timeout /t 2 /nobreak >nul
start http://localhost:5173/
npm run dev
