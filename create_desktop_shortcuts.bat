@echo off
title Create NYSW Desktop Shortcuts
echo Creating NY Sun Works 1-click runners on your Windows Desktop...
node "%~dp0scratch\create_desktop_shortcuts.js"
echo.
echo ===============================================================================
echo  [DONE] 3 shortcuts have been placed directly on your Windows Desktop:
echo    1. "Open NYSW Data Folder.bat"
echo    2. "Run NYSW Data Ingestion.bat"
echo    3. "Launch NYSW Dashboard.bat"
echo ===============================================================================
echo.
pause
