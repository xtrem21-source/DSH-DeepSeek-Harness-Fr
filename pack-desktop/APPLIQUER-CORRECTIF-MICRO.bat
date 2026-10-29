@echo off
rem =====================================================================
rem APPLIQUER-CORRECTIF-MICRO.bat
rem Lance patcher.ps1 sur l'installation reelle : J:\DeepSeek Harness.
rem ATTENTION : ce script FERME l'application "DeepSeek Harness" pour
rem pouvoir reecrire son app.asar. Fermez vos travaux en cours d'abord.
rem Lancez-le d'un double-clic (sur Bureau) puis relancez l'application.
rem =====================================================================
chcp 65001 >nul
setlocal EnableExtensions

set "PATCHDIR=%~dp0"
if "%PATCHDIR:~-1%"=="\" set "PATCHDIR=%PATCHDIR:~0,-1%"

if not exist "%PATCHDIR%\outils\patcher.ps1" (
  echo ERREUR : outils\patcher.ps1 introuvable dans %PATCHDIR%
  pause 2>nul
  exit /b 1
)

echo ============================================================
echo  Correctif du micro - DSH / DeepSeek Harness
echo  Dossier du patch : %PATCHDIR%
echo.
echo  L'application qui vous sert de session va etre FERMEE, puis
echo  le patch sera applique, puis vous relancerez l'application.
echo ============================================================
echo.

rem -------- Fermeture de l'application (plusieurs noms possibles) ----
echo Attente de la fermeture de l'application...
for %%N in ("DeepSeek Harness.exe" "DSH NEXT.exe") do (
  taskkill /f /im %%~N >nul 2>nul
)
rem attendre la disparition effective (max 20 x 1s)
set /a essais=0
:attente
tasklist /fi "imagename eq DeepSeek Harness.exe" 2>nul | find /i "DeepSeek Harness.exe" >nul
if errorlevel 1 goto fermee
set /a essais+=1
if %essais% geq 20 goto fermeture_possible
timeout /t 1 /nobreak >nul
goto attente
:fermee
echo   Application fermee.
goto lance_ps1

:fermeture_possible
echo   (Le processus ne s'est pas eteint tout seul ; on continue,
echo    l'archive sera peut-etre deja liberee.)

:lance_ps1
rem -------- node pour la permission micro --------
if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" (
  set "PATH=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;%PATH%"
)

echo.
echo Lancement du patcher...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PATCHDIR%\outils\patcher.ps1" -Dossier "%PATCHDIR%" "J:\DeepSeek Harness"
set "CODE=%ERRORLEVEL%"

echo.
if "%CODE%"=="0" (
  echo ============================================================
  echo  PATCH APPLIQUE.
  echo  1. Relancez l'application (DeepSeek Harness).
  echo  2. Clic DROIT sur le bouton micro -^> collez votre cle Gemini,
  echo     puis Enregistrer.
  echo  3. Clic GAUCHE sur le micro pour dicter.
  echo ============================================================
) else (
  echo Le patch n'a pas abouti (code %CODE%).
  echo Journal : "%PATCHDIR%\logs\dernier.log"
  echo Pour revenir en arriere : "%PATCHDIR%\restaurer.bat"
)
echo.
pause 2>nul
endlocal