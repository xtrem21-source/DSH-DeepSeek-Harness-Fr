# patcher.ps1 - applique le patch DSH Desktop patch FR.
#
# Ce script fait tout le travail ; patcher.bat ne sert qu'a le lancer en
# double-clic avec un message lisible. Il n'ecrit que dans %LOCALAPPDATA% et
# %APPDATA% (jamais ailleurs) et ne demande aucune elevation de privileges.
#
# Principe : journal d'abord, sauvegarde ensuite, modification en dernier.
param(
    [string]$Dossier = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$script:code = 1
$script:journal = $null
$script:horodatage = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:bilan = [ordered]@{ touches = 0; ignores = 0; erreurs = 0 }

function Ecrire-Journal {
    param([string]$Action, [string]$Cible, [string]$Resultat)
    $ligne = "{0} | {1} | {2} | {3}" -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $Action, $Cible, $Resultat
    if ($script:journal) { Add-Content -LiteralPath $script:journal -Value $ligne -Encoding UTF8 }
    Write-Host ("  " + $ligne)
}

function Empreinte {
    param([string]$Chemin)
    if (-not (Test-Path -LiteralPath $Chemin)) { return '(absent)' }
    return (Get-FileHash -LiteralPath $Chemin -Algorithm SHA256).Hash
}

function Ecrire-Utf8SansBom {
    param([string]$Chemin, [string]$Texte)
    $encodage = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Chemin, $Texte, $encodage)
}

Write-Host ""
Write-Host "=== DSH Desktop patch FR - application ===" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------- dossier logs
$dossierLogs = Join-Path $Dossier 'logs'
if (-not (Test-Path -LiteralPath $dossierLogs)) { New-Item -ItemType Directory -Path $dossierLogs | Out-Null }
$script:journal = Join-Path $dossierLogs ("patch-{0}.log" -f $script:horodatage)

try {
    $entete = @(
        "Journal DSH Desktop patch FR",
        "Horodatage      : $($script:horodatage)",
        "Dossier patch   : $Dossier",
        "Poste           : $env:COMPUTERNAME",
        "Utilisateur     : $env:USERNAME",
        "PowerShell      : $($PSVersionTable.PSVersion)",
        ""
    )
    Set-Content -LiteralPath $script:journal -Value $entete -Encoding UTF8
    Ecrire-Journal 'journal ouvert' $script:journal 'ok'

    # ------------------------------------------------------ detection de l'app
    $candidatsApp = @()
    if ($env:LOCALAPPDATA) {
        $candidatsApp += (Join-Path $env:LOCALAPPDATA 'Programs\DSH Desktop')
        $candidatsApp += (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness')
    }
    if ($env:ProgramFiles) {
        $candidatsApp += (Join-Path $env:ProgramFiles 'DSH Desktop')
        $candidatsApp += (Join-Path $env:ProgramFiles 'DeepSeek Harness')
    }
    if (${env:ProgramFiles(x86)}) {
        $candidatsApp += (Join-Path ${env:ProgramFiles(x86)} 'DSH Desktop')
        $candidatsApp += (Join-Path ${env:ProgramFiles(x86)} 'DeepSeek Harness')
    }
    if ($args.Count -gt 0) { $candidatsApp = @($args[0]) + $candidatsApp }

    # 3) Chaque disque monte : l'application est souvent installee hors de C:
    #    (sur ce poste : J:\DeepSeek Harness). Aucun chemin n'est code en dur.
    try {
        foreach ($lecteur in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
            if (-not $lecteur.Root) { continue }
            $candidatsApp += (Join-Path $lecteur.Root 'DeepSeek Harness')
            $candidatsApp += (Join-Path $lecteur.Root 'DSH Desktop')
        }
    } catch { }

    # 4) Entrees de desinstallation : DisplayName qui nomme l'application.
    try {
        $clesDesinstallation = @(
            'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
            'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
            'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
        )
        foreach ($cle in $clesDesinstallation) {
            Get-ItemProperty -Path $cle -ErrorAction SilentlyContinue |
                Where-Object { $_.DisplayName -and $_.InstallLocation -and ($_.DisplayName -match 'DeepSeek Harness|DSH Desktop') } |
                ForEach-Object { $candidatsApp += $_.InstallLocation }
        }
    } catch { }

    # dedoublonnage, ordre conserve
    $candidatsApp = @($candidatsApp | Where-Object { $_ } | Select-Object -Unique)

    $application = $null
    foreach ($candidat in $candidatsApp) {
        # Noms d'exe acceptes : "DSH Desktop.exe" (installation type) et
        # "DeepSeek Harness.exe" (installation renommee recente). Le reste du
        # script travaille sur resources\app.asar, independent du nom exact.
        foreach ($exe in @('DSH Desktop.exe', 'DeepSeek Harness.exe')) {
            if ($candidat -and (Test-Path -LiteralPath (Join-Path $candidat $exe))) { $application = $candidat; break }
        }
        if ($application) { break }
    }
    if (-not $application) {
        throw "Application DSH Desktop introuvable. Chemins essayes : $($candidatsApp -join ' ; '). Passez le chemin en argument : patcher.bat ""D:\chemin\DSH Desktop"""
    }
    Ecrire-Journal 'detection application' $application 'trouvee'
    $asar = Join-Path $application 'resources\app.asar'
    if (-not (Test-Path -LiteralPath $asar)) { throw "app.asar absent dans $application : installation incomplete ou deplacement manuel." }
    Ecrire-Journal 'detection app.asar' $asar 'present'

    # ---------------------------------------------------- detection du profil
    $candidatsHome = @()
    if ($env:APPDATA) { $candidatsHome += (Join-Path $env:APPDATA 'dsh-desktop\harness') }
    if ($env:USERPROFILE) { $candidatsHome += (Join-Path $env:USERPROFILE '.dsh') }

    $dshHome = $null
    foreach ($candidat in $candidatsHome) {
        if (Test-Path -LiteralPath (Join-Path $candidat 'profiles')) { $dshHome = $candidat; break }
    }
    if (-not $dshHome) { throw "Profil DSH introuvable (profiles/ absent). Chemins essayes : $($candidatsHome -join ' ; ')" }
    Ecrire-Journal 'detection profil' $dshHome 'trouve'

    $nomProfil = $null
    foreach ($essai in @('web', 'desktop')) {
        if (Test-Path -LiteralPath (Join-Path $dshHome "profiles\$essai")) { $nomProfil = $essai; break }
    }
    if (-not $nomProfil) { throw "Aucun profil exploitable (web ou desktop) sous $dshHome\profiles" }
    $dossierProfil = Join-Path $dshHome "profiles\$nomProfil"
    Ecrire-Journal 'profil actif' $dossierProfil $nomProfil

    $fichierPatch = Join-Path $dossierProfil 'cordis.patch.yml'
    $fichierManifeste = Join-Path $dossierProfil 'package.json'
    if (-not (Test-Path -LiteralPath $fichierPatch)) { throw "cordis.patch.yml absent du profil : $fichierPatch" }

    # ------------------------------- permission micro (patch de l'application)
    # Les anciennes versions ne listaient que deux permissions et refusaient
    # « media » : il fallait patcher out/main/index.js de l'asar. Les versions
    # recentes ("DeepSeek Harness") installent deja la permission microphone
    # nativement (installMicrophonePermissions). On DETECTE donc la presence de
    # cette permission native et on ne patche l'asar QUE si elle est absente.
    $scriptNode = Get-Command node -ErrorAction SilentlyContinue
    $scriptAsar = Join-Path $Dossier 'outils\patcher-asar.mjs'
    $scriptVerifMic = Join-Path $Dossier 'outils\verif-mic-native.mjs'
    $micNatif = $false
    $asarDejaPatche = $false
    if ($scriptNode -and (Test-Path -LiteralPath $scriptVerifMic)) {
        & $scriptNode.Source $scriptVerifMic $asar *> $null
        $micNatif = ($LASTEXITCODE -eq 0)
    }
    if ($scriptNode -and -not $micNatif) {
        # Permission native absente : on retombe sur l'ancien patch asar.
        & $scriptNode.Source $scriptAsar $asar '--verifier' *> $null
        $asarDejaPatche = ($LASTEXITCODE -eq 0)
    }

    # --------------------------------------------------------- point de retour
    $dossierSauvegarde = Join-Path (Join-Path $Dossier 'sauvegarde') $script:horodatage
    New-Item -ItemType Directory -Path $dossierSauvegarde -Force | Out-Null
    Ecrire-Journal 'sauvegarde creation' $dossierSauvegarde 'ok'

    $aCopier = @($fichierPatch, $fichierManifeste)
    if ($scriptNode -and -not $micNatif -and -not $asarDejaPatche) { $aCopier += $asar }

    $lignesManifeste = @(
        "# Manifeste de sauvegarde - $($script:horodatage)",
        "# Format : chemin<TAB>taille<TAB>sha256",
        "# Copie conservee : $dossierSauvegarde",
        ""
    )
    foreach ($source in $aCopier) {
        if (-not (Test-Path -LiteralPath $source)) { continue }
        $nom = Split-Path -Leaf $source
        $destination = Join-Path $dossierSauvegarde $nom
        Copy-Item -LiteralPath $source -Destination $destination -Force
        $taille = (Get-Item -LiteralPath $destination).Length
        $hash = Empreinte $destination
        $hashSource = Empreinte $source
        $lignesManifeste += ("{0}`t{1}`t{2}" -f $source, $taille, $hash)
        if ($hash -ne $hashSource) { throw "Copie de sauvegarde non conforme pour $source" }
        Ecrire-Journal 'sauvegarde fichier' $source ("copie ok, sha256=$hash")
    }
    Ecrire-Utf8SansBom (Join-Path $dossierSauvegarde 'manifeste.txt') (($lignesManifeste -join "`r`n") + "`r`n")
    Ecrire-Journal 'manifeste ecrit' (Join-Path $dossierSauvegarde 'manifeste.txt') 'ok'

    # -------------------------------------------------- copie des paquets plugin
    $sourcePlugins = Join-Path $Dossier 'patch\plugins'
    if (-not (Test-Path -LiteralPath $sourcePlugins)) { throw "Dossier patch\plugins absent : $sourcePlugins" }
    $cibleNodeModules = Join-Path $dossierProfil 'node_modules'
    if (-not (Test-Path -LiteralPath $cibleNodeModules)) { New-Item -ItemType Directory -Path $cibleNodeModules -Force | Out-Null }

    foreach ($paquet in Get-ChildItem -LiteralPath $sourcePlugins -Directory) {
        $destination = Join-Path $cibleNodeModules $paquet.Name
        $avant = if (Test-Path -LiteralPath (Join-Path $destination 'package.json')) { Empreinte (Join-Path $destination 'package.json') } else { '(absent)' }
        # Supprime TOUTE destination existante (dossier ou lien) avant de recopier
        # le paquet en entier. Necessaire pour que les sous-fichiers modifies
        # (ex. dsh-voice-input/lib/client.js) soient bien ecrases : un simple
        # Copy-Item -Recurse sur un dossier existant peut fusionner et ne pas
        # remplacer le contenu.
        if (Test-Path -LiteralPath $destination) {
            $element = Get-Item -LiteralPath $destination -Force
            if ($element.PSIsContainer) { $element.Delete($true) }
            else { Remove-Item -LiteralPath $destination -Force }
            Ecrire-Journal 'ancien paquet retire' $destination 'ok'
        }
        Copy-Item -LiteralPath $paquet.FullName -Destination $destination -Recurse -Force
        $apres = Empreinte (Join-Path $destination 'package.json')
        if ($apres -eq '(absent)') { throw "Copie du paquet $($paquet.Name) invalide : package.json absent dans $destination" }
        $script:bilan.touches++
        Ecrire-Journal 'paquet copie' $destination ("package.json sha256 avant=$avant apres=$apres")
    }

    # ------------------------------------------------- permission micro (suite)
    if ($micNatif) {
        Write-Host "Permission microphone deja native dans cette version : asar non modifie." -ForegroundColor Green
        Ecrire-Journal 'permission micro' $asar 'native (installMicrophonePermissions) : non patche'
        $script:bilan.ignores++
    }
    elseif (-not $scriptNode) {
        Write-Host ""
        Write-Host "AVERTISSEMENT : node.exe est introuvable." -ForegroundColor Yellow
        Write-Host "Sans lui, la permission micro ne peut pas etre accordee : le bouton"
        Write-Host "micro restera inerte. Le reste du patch (francais, Gemini, cle API)"
        Write-Host "fonctionne sans node. Installez Node.js puis relancez patcher.bat."
        Ecrire-Journal 'permission micro' $asar 'non appliquee : node introuvable'
        $script:bilan.erreurs++
    }
    elseif ($asarDejaPatche) {
        $script:bilan.ignores++
        Ecrire-Journal 'permission micro' $asar 'deja accordee (idempotence)'
    }
    else {
        $hashAvantAsar = Empreinte $asar
        & $scriptNode.Source $scriptAsar $asar
        if ($LASTEXITCODE -ne 0) { throw "Le patch de permission micro a echoue (code $LASTEXITCODE)." }
        & $scriptNode.Source $scriptAsar $asar '--verifier'
        if ($LASTEXITCODE -ne 0) { throw "Le patch de permission micro n'a pas pu etre verifie apres application." }
        $script:bilan.touches++
        Ecrire-Journal 'permission micro accordee' $asar ("sha256 avant=$hashAvantAsar apres=$(Empreinte $asar)")
    }

    # ------------------------------------------------------ insertion du patch
    $blocSource = Join-Path $Dossier 'patch\dsh-desktop-fr.patch.yml'
    if (-not (Test-Path -LiteralPath $blocSource)) { throw "Bloc de patch absent : $blocSource" }
    $bloc = (Get-Content -LiteralPath $blocSource -Raw) -replace "`r`n", "`n"
    $marqueurDebut = '# --- DSH Desktop patch FR : debut ---'
    $marqueurFin = '# --- DSH Desktop patch FR : fin ---'
    if ($bloc -notmatch [regex]::Escape($marqueurDebut) -or $bloc -notmatch [regex]::Escape($marqueurFin)) {
        throw "Le bloc de patch ne contient pas ses deux marqueurs : $blocSource"
    }

    $contenu = (Get-Content -LiteralPath $fichierPatch -Raw) -replace "`r`n", "`n"
    $dejaPresent = $contenu -match [regex]::Escape($marqueurDebut)

    if ($dejaPresent) {
        $script:bilan.ignores++
        Ecrire-Journal 'patch deja applique' $fichierPatch 'ignore (idempotence)'
    }
    else {
        $hashAvant = Empreinte $fichierPatch
        if (-not $contenu.EndsWith("`n")) { $contenu += "`n" }
        $nouveau = $contenu + "`n" + $bloc + "`n"
        Ecrire-Utf8SansBom $fichierPatch $nouveau
        $hashApres = Empreinte $fichierPatch
        if ($hashApres -eq $hashAvant) { throw "Le patch de profil n'a pas change malgre l'insertion : $fichierPatch" }
        $script:bilan.touches++
        Ecrire-Journal 'patch insere' $fichierPatch ("sha256 avant=$hashAvant apres=$hashApres")
    }

    # -------------------------------------------------------------- verification
    $final = Get-Content -LiteralPath $fichierPatch -Raw
    foreach ($attendu in @('dsh-fr-locale', 'dsh-voice-input', 'dsh-theme-clear-blue', 'ui-voice-input', 'preference: fr', 'preference: dark')) {
        if ($final -notmatch [regex]::Escape($attendu)) { throw "Verification echouee : '$attendu' absent du patch apres application." }
    }
    Ecrire-Journal 'verification patch' $fichierPatch 'les marqueurs attendus sont presents'

    foreach ($nom in @('dsh-fr-locale', 'dsh-voice-input', 'dsh-theme-clear-blue')) {
        $package = Join-Path $cibleNodeModules "$nom\package.json"
        if (-not (Test-Path -LiteralPath $package)) { throw "Verification echouee : $package absent apres copie." }
    }
    Ecrire-Journal 'verification paquets' $cibleNodeModules 'les paquets du patch sont en place'

    $script:code = 0
}
catch {
    $script:bilan.erreurs++
    if ($script:journal) { Ecrire-Journal 'erreur' 'execution' $_.Exception.Message }
    Write-Host ""
    Write-Host "ECHEC : $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    $duree = [math]::Round(((Get-Date) - [datetime]::ParseExact($script:horodatage, 'yyyyMMdd-HHmmss', $null)).TotalSeconds, 1)
    $fin = @(
        "",
        "Code de sortie : $($script:code)",
        "Duree          : $duree s",
        "Bilan          : $($script:bilan.touches) fichier(s) touche(s), $($script:bilan.ignores) ignore(s), $($script:bilan.erreurs) erreur(s)"
    )
    if ($script:journal) {
        Add-Content -LiteralPath $script:journal -Value $fin -Encoding UTF8
        $dernier = Join-Path (Join-Path $Dossier 'logs') 'dernier.log'
        Copy-Item -LiteralPath $script:journal -Destination $dernier -Force
    }
    Write-Host ""
    Write-Host "Journal   : $($script:journal)"
    Write-Host "Retour    : $(Join-Path $Dossier 'restaurer.bat')"
    Write-Host "Code      : $($script:code)"
}

exit $script:code
