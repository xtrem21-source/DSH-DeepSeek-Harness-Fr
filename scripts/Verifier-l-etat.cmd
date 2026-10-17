@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Verifier-l-etat.ps1" %*
exit /b %ERRORLEVEL%
