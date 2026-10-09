@echo off
title NY Sun Works - Data Ingestion Pipeline
color 0A
cls
echo ===============================================================================
echo          NEW YORK SUN WORKS - PARTNER SCHOOL SUCCESS DASHBOARD
echo                     AUTOMATED DATA INGESTION RUNNER
echo ===============================================================================
echo.
echo This tool ingests the 7 NYSW operational spreadsheets, executes the 100-point
echo scoring engine across 3 buckets, evaluates early-warning flags, maps assigned
echo GSTs from Column A, and updates the dashboard dataset in data\cohort.json.
echo.
echo -------------------------------------------------------------------------------
echo [1/3] Checking Python environment...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in your system PATH.
    echo Please install Python 3.10+ and make sure 'Add Python to PATH' is checked.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do set PY_VER=%%v
echo [OK] Detected %PY_VER%
echo.
echo [2/3] Checking required Python packages (pandas, openpyxl, xlrd)...
python -c "import pandas, openpyxl, xlrd; print('[OK] All required Excel processing libraries are installed.')" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Installing missing Excel data processing libraries...
    pip install pandas openpyxl xlrd
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install libraries. Please run 'pip install pandas openpyxl xlrd' manually.
        pause
        exit /b 1
    )
)
echo.
echo [3/3] Executing Master Data Ingestion Pipeline...
echo -------------------------------------------------------------------------------
python scripts\ingest_real_data.py
if %ERRORLEVEL% equ 0 (
    echo.
    echo ===============================================================================
    echo  [SUCCESS] DATA INGESTION COMPLETED SUCCESSFULLY!
    echo ===============================================================================
    echo  - Master cohort updated at: data\cohort.json
    echo  - All 3-bucket rubric scores, completeness statuses, and flags recalculated.
    echo  - Assigned GST team members mapped from Column A of Copy of GST Schedule.
    echo.
    echo  If the dashboard server is already running, simply refresh your web browser.
    echo  Otherwise, double-click 'launch_dashboard.bat' to start the dashboard!
    echo ===============================================================================
) else (
    echo.
    echo ===============================================================================
    echo  [ERROR] DATA INGESTION PIPELINE ENCOUNTERED AN ISSUE.
    echo  Please check the error output above or ensure the 7 required spreadsheets
    echo  exist in the established 'data\incoming\' folder (or '1st slice of data SY 25-26\').
    echo  Tip: Double-click 'open_data_folder.bat' to open the intake folder directly.
    echo ===============================================================================
)
echo.
echo Press any key to close this window...
pause >nul
