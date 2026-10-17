@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Restaurer-l-original.ps1" %*
exit /b %ERRORLEVEL%
