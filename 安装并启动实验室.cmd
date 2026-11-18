@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-lab.ps1" %*
if errorlevel 1 (
  echo.
  echo Setup did not finish. Check the message above.
  pause
  exit /b 1
)
