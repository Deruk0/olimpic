@echo off
setlocal
cd /d "%~dp0"
set "olimpik_reset_flag="
if /i "%~1"=="--reset-demo" set "olimpik_reset_flag=-ResetDemo"

if not defined WT_SESSION (
    where wt.exe >nul 2>&1
    if not errorlevel 1 (
        start "" wt.exe -w Olimpik-local new-tab --title "Olimpik localhost" --suppressApplicationTitle --reloadEnvironment powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1" %olimpik_reset_flag%
        exit /b
    )
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1" %olimpik_reset_flag%
exit /b %errorlevel%
