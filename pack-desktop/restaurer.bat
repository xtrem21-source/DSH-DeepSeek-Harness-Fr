@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem restaurer.bat - remet le profil DSH dans son etat initial.
rem Par defaut : la sauvegarde la plus recente. Un numero peut etre passe en
rem argument pour en choisir une autre (voir la liste affichee).

set "PATCHDIR=%~dp0"
if "%PATCHDIR:~-1%"=="\" set "PATCHDIR=%PATCHDIR:~0,-1%"

echo.
echo === DSH Desktop patch FR - restauration ===
echo Dossier du patch : %PATCHDIR%
echo.

if not exist "%PATCHDIR%\outils\restaurer.ps1" (
  echo ERREUR : outils\restaurer.ps1 introuvable.
  echo Le dossier du patch est incomplet.
  goto :fin
)

if not exist "%PATCHDIR%\sauvegarde" (
  echo ERREUR : aucune sauvegarde.
  echo Ce dossier n'a jamais ete patche depuis cet emplacement.
  goto :fin
)

set "PSCMD=powershell"
where pwsh >nul 2>nul && set "PSCMD=pwsh"

"%PSCMD%" -NoProfile -ExecutionPolicy Bypass -File "%PATCHDIR%\outils\restaurer.ps1" -Dossier "%PATCHDIR%" -Choix %1
set "CODE=%ERRORLEVEL%"

echo.
if "%CODE%"=="0" (
  echo Profil restaure et verifie contre le manifeste.
  echo Fermez puis relancez DSH Desktop.
) else (
  echo La restauration n'a pas abouti. Code : %CODE%
  echo Lisez le journal indique ci-dessus.
)

:fin
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul
endlocal
