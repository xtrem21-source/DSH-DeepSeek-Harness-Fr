@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem patcher.bat - lanceur en double-clic du patch DSH Desktop patch FR.
rem Toute la logique est dans outils\patcher.ps1 ; ce fichier ne sert qu'a
rem resoudre son propre repertoire, appeler PowerShell et garder la fenetre
rem ouverte en cas d'erreur.

rem Le repertoire du patch se deduit du chemin de ce script : le dossier peut
rem etre deplace (autre disque, cle USB) sans rien reconfigurer.
set "PATCHDIR=%~dp0"
if "%PATCHDIR:~-1%"=="\" set "PATCHDIR=%PATCHDIR:~0,-1%"

rem Outils systeme appeles par chemin absolu : un "findstr" ou un "timeout"
rem d'un autre environnement (Git Bash, MSYS) dans le PATH ne peut pas les
rem detourner.
set "SYS=%SystemRoot%\System32"

echo.
echo === DSH Desktop patch FR ===
echo Dossier du patch : %PATCHDIR%
echo.

if not exist "%PATCHDIR%\outils\patcher.ps1" (
  echo ERREUR : outils\patcher.ps1 introuvable.
  echo Le dossier du patch est incomplet. Decompressez-le en entier.
  goto :fin
)

if not exist "%PATCHDIR%\patch\plugins" (
  echo ERREUR : patch\plugins introuvable.
  echo Le dossier du patch est incomplet. Decompressez-le en entier.
  goto :fin
)

set "PSCMD=powershell"
where pwsh >nul 2>nul && set "PSCMD=pwsh"

rem --- Fermeture forcee de l'application -------------------------------
rem app.asar et le profil doivent etre libres : un processus encore en
rem memoire garde l'archive ouverte et le patch echouerait. On tue donc le
rem processus, puis on attend sa disparition effective avant de continuer.
rem Deux noms d'executable sont acceptes : "DSH Desktop.exe" (installation
rem type) et "DeepSeek Harness.exe" (installation renommee recente).
rem (Pas de bloc parenthese ici : les labels y sont invalides en batch.)
set "APP_OUVERTE=0"
tasklist /fi "imagename eq DSH Desktop.exe" 2>nul | "%SYS%\findstr.exe" /i /c:"DSH Desktop.exe" >nul && set "APP_OUVERTE=1"
tasklist /fi "imagename eq DeepSeek Harness.exe" 2>nul | "%SYS%\findstr.exe" /i /c:"DeepSeek Harness.exe" >nul && set "APP_OUVERTE=1"
if "%APP_OUVERTE%"=="0" goto app_fermee

echo Application ouverte : fermeture en cours...
taskkill /f /im "DSH Desktop.exe" >nul 2>nul
taskkill /f /im "DeepSeek Harness.exe" >nul 2>nul
set /a essais=0

:attente_fermeture
set "ENCORE=0"
tasklist /fi "imagename eq DSH Desktop.exe" 2>nul | "%SYS%\findstr.exe" /i /c:"DSH Desktop.exe" >nul && set "ENCORE=1"
tasklist /fi "imagename eq DeepSeek Harness.exe" 2>nul | "%SYS%\findstr.exe" /i /c:"DeepSeek Harness.exe" >nul && set "ENCORE=1"
if "%ENCORE%"=="0" goto app_fermee
set /a essais+=1
if %essais% geq 15 goto fermeture_impossible
"%SYS%\timeout.exe" /t 1 /nobreak >nul
goto attente_fermeture

:fermeture_impossible
echo ERREUR : l'application refuse de se fermer apres 15 secondes.
echo Fermez-la a la main (gestionnaire de taches) puis relancez patcher.bat.
goto :fin

:app_fermee
echo DSH Desktop ferme : archive et profil sont libres.
echo.

"%PSCMD%" -NoProfile -ExecutionPolicy Bypass -File "%PATCHDIR%\outils\patcher.ps1" -Dossier "%PATCHDIR%"
set "CODE=%ERRORLEVEL%"

echo.
if "%CODE%"=="0" (
  echo Patch applique.
  echo.
  echo 1. Relancez DSH Desktop.
  echo 2. L'interface est deja en francais : Reglages -^> Langue -^> Francais.
  echo 3. CLIC DROIT sur le bouton micro (a droite du bouton d'envoi^) :
  echo    choisissez Gemini ou ElevenLabs, collez votre cle API, Enregistrer.
  echo 4. CLIC GAUCHE sur ce meme micro pour dicter.
) else (
  echo Le patch n'a pas abouti. Code : %CODE%
  echo Lisez le journal indique ci-dessus, puis relancez si besoin.
  echo Pour revenir en arriere : "%PATCHDIR%\restaurer.bat"
)

:fin
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul
endlocal
