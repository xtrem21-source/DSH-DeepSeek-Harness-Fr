# restaurer.ps1 - remet le profil DSH dans son etat anterieur au patch.
#
# Par defaut : la sauvegarde la plus recente. Un index peut etre fourni pour en
# choisir une autre. Chaque fichier restaure est verifie contre le manifeste
# (taille + SHA-256) et le resultat est ecrit au journal.
param(
    [string]$Dossier = (Split-Path -Parent $PSScriptRoot),
    [int]$Choix = 0
)

$ErrorActionPreference = 'Stop'
$script:code = 1
$script:journal = $null
$script:horodatage = Get-Date -Format 'yyyyMMdd-HHmmss'

function Ecrire-Journal {
    param([string]$Action, [string]$Cible, [string]$Resultat)
    $ligne = "{0} | {1} | {2} | {3}" -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $Action, $Cible, $Resultat
    if ($script:journal) { Add-Content -LiteralPath $script:journal -Value $ligne -Encoding UTF8 }
    Write-Host ("  " + $ligne)
}

Write-Host ""
Write-Host "=== DSH Desktop patch FR - restauration ===" -ForegroundColor Cyan
Write-Host ""

$dossierLogs = Join-Path $Dossier 'logs'
if (-not (Test-Path -LiteralPath $dossierLogs)) { New-Item -ItemType Directory -Path $dossierLogs | Out-Null }
$script:journal = Join-Path $dossierLogs ("restauration-{0}.log" -f $script:horodatage)

try {
    Set-Content -LiteralPath $script:journal -Value @("Journal de restauration", "Horodatage : $($script:horodatage)", "") -Encoding UTF8
    Ecrire-Journal 'journal ouvert' $script:journal 'ok'

    # -------------------------------------------------- sauvegardes disponibles
    $racineSauvegardes = Join-Path $Dossier 'sauvegarde'
    if (-not (Test-Path -LiteralPath $racineSauvegardes)) { throw "Aucune sauvegarde : $racineSauvegardes est absent." }
    $sauvegardes = @(Get-ChildItem -LiteralPath $racineSauvegardes -Directory | Sort-Object Name -Descending)
    if ($sauvegardes.Count -eq 0) { throw "Aucune sauvegarde dans $racineSauvegardes." }

    Write-Host "Sauvegardes disponibles :"
    for ($i = 0; $i -lt $sauvegardes.Count; $i++) {
        $marque = if ($i -eq 0) { '  (la plus recente, par defaut)' } else { '' }
        Write-Host ("  [{0}] {1}{2}" -f ($i + 1), $sauvegardes[$i].Name, $marque)
    }
    Write-Host ""

    $index = if ($Choix -ge 1 -and $Choix -le $sauvegardes.Count) { $Choix - 1 } else { 0 }
    $choisie = $sauvegardes[$index]
    Ecrire-Journal 'sauvegarde choisie' $choisie.FullName ("index {0} sur {1}" -f ($index + 1), $sauvegardes.Count)

    $fichierManifeste = Join-Path $choisie.FullName 'manifeste.txt'
    if (-not (Test-Path -LiteralPath $fichierManifeste)) { throw "Manifeste absent de la sauvegarde : $fichierManifeste" }

    # ---------------------------------------------------------- profil cible
    $candidatsHome = @()
    if ($env:APPDATA) { $candidatsHome += (Join-Path $env:APPDATA 'dsh-desktop\harness') }
    if ($env:USERPROFILE) { $candidatsHome += (Join-Path $env:USERPROFILE '.dsh') }
    $dshHome = $null
    foreach ($candidat in $candidatsHome) {
        if (Test-Path -LiteralPath (Join-Path $candidat 'profiles')) { $dshHome = $candidat; break }
    }
    if (-not $dshHome) { throw "Profil DSH introuvable (profiles/ absent)." }

    # ------------------------------------------------------- restauration + controle
    $restaures = 0
    $verifies = 0
    foreach ($ligne in (Get-Content -LiteralPath $fichierManifeste)) {
        if (-not $ligne -or $ligne.StartsWith('#')) { continue }
        $champs = $ligne -split "`t"
        if ($champs.Count -lt 3) { continue }
        $cible = $champs[0]
        $tailleAttendue = [int64]$champs[1]
        $hashAttendu = $champs[2]

        $nom = Split-Path -Leaf $cible
        $copie = Join-Path $choisie.FullName $nom
        if (-not (Test-Path -LiteralPath $copie)) {
            Ecrire-Journal 'copie manquante' $copie 'ignore'
            continue
        }

        $dossierCible = Split-Path -Parent $cible
        if (-not (Test-Path -LiteralPath $dossierCible)) {
            Ecrire-Journal 'dossier cible absent' $dossierCible 'ignore'
            continue
        }

        Copy-Item -LiteralPath $copie -Destination $cible -Force
        $restaures++

        $tailleObtenue = (Get-Item -LiteralPath $cible).Length
        $hashObtenu = (Get-FileHash -LiteralPath $cible -Algorithm SHA256).Hash
        if ($tailleObtenue -ne $tailleAttendue -or $hashObtenu -ne $hashAttendu) {
            throw "Restauration non conforme pour $cible (taille $tailleObtenue attendue $tailleAttendue, sha256 $hashObtenu attendu $hashAttendu)"
        }
        $verifies++
        Ecrire-Journal 'fichier restaure et verifie' $cible ("taille=$tailleObtenue sha256=$hashObtenu")
    }

    if ($restaures -eq 0) { throw "Aucun fichier restaure depuis $($choisie.FullName)." }

    # ------------------------------------------- retrait des paquets installes
    foreach ($nom in @('dsh-fr-locale', 'dsh-voice-input', 'dsh-theme-clear-blue', 'dsh-gemini-stt')) {
        foreach ($racineHome in $candidatsHome) {
            if (-not (Test-Path -LiteralPath $racineHome)) { continue }
            foreach ($profil in @('web', 'desktop')) {
                $cible = Join-Path $racineHome "profiles\$profil\node_modules\$nom"
                if (Test-Path -LiteralPath $cible) {
                    $element = Get-Item -LiteralPath $cible -Force
                    if ($element.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { $element.Delete() }
                    else { Remove-Item -LiteralPath $cible -Recurse -Force }
                    Ecrire-Journal 'paquet retire' $cible 'ok'
                }
            }
        }
    }

    Write-Host ""
    Write-Host "Restauration terminee : $restaures fichier(s), $verifies verifie(s) au manifeste." -ForegroundColor Green
    Ecrire-Journal 'bilan' $choisie.Name ("restaures=$restaures verifies=$verifies")
    $script:code = 0
}
catch {
    if ($script:journal) { Ecrire-Journal 'erreur' 'restauration' $_.Exception.Message }
    Write-Host ""
    Write-Host "ECHEC : $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    if ($script:journal) {
        Add-Content -LiteralPath $script:journal -Value @("", "Code de sortie : $($script:code)") -Encoding UTF8
        Copy-Item -LiteralPath $script:journal -Destination (Join-Path $dossierLogs 'dernier.log') -Force
    }
    Write-Host ""
    Write-Host "Journal : $($script:journal)"
    Write-Host "Code    : $($script:code)"
}

exit $script:code
