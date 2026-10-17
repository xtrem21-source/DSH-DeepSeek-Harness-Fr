@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Appliquer-le-patch.ps1" %*
exit /b %ERRORLEVEL%
