@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Chrono Lab - local game server
echo ============================================
echo.

rem Find a working Python launcher instead of assuming the "python" name exists.
set "PYCMD="
where python >nul 2>nul && set "PYCMD=python"
if not defined PYCMD (
  where py >nul 2>nul && set "PYCMD=py"
)

if not defined PYCMD (
  echo [ERROR] Python was not found on this computer.
  echo.
  echo Install Python 3 from https://www.python.org/downloads/
  echo and tick "Add python.exe to PATH" during setup.
  echo.
  echo The window stays open so you can read this message.
  pause
  exit /b 1
)

echo Using launcher: %PYCMD%
echo.
echo Keep this window OPEN while you play.
echo Close it to stop the server.
echo.

%PYCMD% serve.py

echo.
echo --------------------------------------------
echo Server stopped. Press any key to close.
echo --------------------------------------------
pause >nul
