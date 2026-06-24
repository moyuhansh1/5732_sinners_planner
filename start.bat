@echo off
title Siner Planner - Ctrl+C to stop

REM Kill orphan process from previous run
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING"') do (
    echo [Cleanup] Killing orphan on port 8000 (PID %%a)
    taskkill /F /PID %%a 2>nul
)

echo ========================================
echo   Siner Planner
echo   Open: http://localhost:8000
echo   Press Ctrl+C to stop
echo ========================================
echo.

cd /d D:\Pycharm\siner_planner
D:\Anaconda\envs\pytorch_2.51\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

REM Cleanup on exit
echo.
echo [Cleanup] Releasing port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)
echo Done.

pause
