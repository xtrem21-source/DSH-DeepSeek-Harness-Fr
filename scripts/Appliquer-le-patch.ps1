#requires -Version 5.1
<#
    Applique le patch de locale à DeepSeek Harness.

    Le dossier du dépôt peut être déplacé : le script n'utilise que des chemins
    relatifs à son propre emplacement. L'archive n'est remplacée qu'après une
    vérification réussie.

    Exemples :
        .\Appliquer-le-patch.ps1
        .\Appliquer-le-patch.ps1 -Locale es -LangueParDefaut es
        .\Appliquer-le-patch.ps1 -CheminApplication "D:\Apps\DeepSeek Harness"
#>
[CmdletBinding()]
param(
    [string]$CheminApplication = "",
    [string]$Locale = "fr",
    [string]$LangueParDefaut = ""
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptDir
$patcher = Join-Path $repoRoot 'src\patch.mjs'
$localeDir = Join-Path $repoRoot 'locales'
$backupDir = Join-Path $repoRoot 'sauvegarde'

if ([string]::IsNullOrWhiteSpace($LangueParDefaut)) { $LangueParDefaut = $Locale }

function Find-DeepSeekApplication {
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:LOCALAPPDATA) { $candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness')) }
    if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles 'DeepSeek Harness')) }
    if (${env:ProgramFiles(x86)}) { $candidates.Add((Join-Path ${env:ProgramFiles(x86)} 'DeepSeek Harness')) }

    foreach ($root in @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )) {
        try {
            Get-ItemProperty $root -ErrorAction SilentlyContinue |
                Where-Object { $_.DisplayName -like '*DeepSeek Harness*' -and $_.InstallLocation } |
                ForEach-Object { $candidates.Add($_.InstallLocation) }
        } catch { }
    }

    if ($env:LOCALAPPDATA) {
        $programs = Join-Path $env:LOCALAPPDATA 'Programs'
        if (Test-Path $programs) {
            Get-ChildItem $programs -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -like '*DeepSeek*' } |
                ForEach-Object { $candidates.Add($_.FullName) }
        }
    }

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        $exe = Join-Path $candidate 'DeepSeek Harness.exe'
        $asar = Join-Path $candidate 'resources\app.asar'
        if ((Test-Path -LiteralPath $exe) -and (Test-Path -LiteralPath $asar)) { return $candidate }
    }
    return $null
}

$app = $CheminApplication
if ([string]::IsNullOrWhiteSpace($app)) { $app = Find-DeepSeekApplication }
if ([string]::IsNullOrWhiteSpace($app)) {
    throw "DeepSeek Harness n'a pas été trouvé automatiquement. Indiquez son dossier avec -CheminApplication `"C:\chemin\DeepSeek Harness`"."
}
if ($app.EndsWith('DeepSeek Harness.exe', [StringComparison]::OrdinalIgnoreCase)) {
    $app = Split-Path -Parent $app
}
$archive = Join-Path $app 'resources\app.asar'
if (-not (Test-Path -LiteralPath $archive)) { throw "Archive introuvable : $archive" }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
    throw "Node.js 20.19 ou plus récent est requis pour appliquer ce patch."
}

Write-Host ''
Write-Host '=== DeepSeek Harness — patch de locale (ajout seul) ===' -ForegroundColor Cyan
Write-Host "Application    : $app"
Write-Host "Locale ajoutée : $Locale (par défaut : $LangueParDefaut)"
Write-Host ''

# Le garde-fou ne vise que l'installation ciblée : un autre dossier peut être patché
# pendant que l'application tourne, et Windows refuse de toute façon un fichier verrouillé.
$running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue |
    Where-Object { -not $_.Path -or $_.Path.StartsWith($app, [StringComparison]::OrdinalIgnoreCase) }
if ($running) {
    throw "Fermez complètement DeepSeek Harness avant d'appliquer le patch (y compris l'icône de la zone de notification)."
}

$statusText = & $node $patcher --status $archive --locale-dir $localeDir --locales $Locale 2>&1 | Out-String
$status = 'unknown'
try { $status = ($statusText | ConvertFrom-Json).status } catch { }

if ($status -eq 'delta') {
    Write-Host 'Le patch est déjà appliqué. Aucune modification nécessaire.' -ForegroundColor Green
    exit 0
}
if ($status -eq 'delta-other') {
    throw "Cette archive est déjà patchée avec un autre jeu de locales. Restaurez l'archive d'origine, puis relancez."
}
if ($status -eq 'legacy-fr') {
    throw "Cette archive porte l'ancien patch français (marqueur __DSH_FR). Restaurez d'abord l'archive d'origine."
}
if ($status -eq 'unknown') {
    Write-Host "Structure non reconnue comme la version d'origine : tentative avec vérification des ancres. L'archive ne sera remplacée qu'en cas de succès." -ForegroundColor Yellow
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupDir "app.asar.avant-patch-$timestamp"
Copy-Item -LiteralPath $archive -Destination $backup -Force
if ($status -eq 'original') {
    $stable = Join-Path $backupDir 'app.asar.original'
    if (-not (Test-Path -LiteralPath $stable)) {
        Copy-Item -LiteralPath $archive -Destination $stable -Force
    }
}
Write-Host "Sauvegarde : $backup"

$tempOut = Join-Path $env:TEMP ("dsh-locale-" + [guid]::NewGuid().ToString('N') + ".asar")
try {
    & $node $patcher --app $archive --out $tempOut --locale-dir $localeDir --locales $Locale --default $LangueParDefaut
    if ($LASTEXITCODE -ne 0) {
        throw "Le patch a échoué. L'archive d'origine n'a pas été modifiée."
    }
    Copy-Item -LiteralPath $tempOut -Destination $archive -Force
    & $node $patcher --verify $archive --locale-dir $localeDir --locales $Locale --default $LangueParDefaut | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Copy-Item -LiteralPath $backup -Destination $archive -Force
        throw "La vérification après patch a échoué. L'archive d'origine a été restaurée."
    }
} catch {
    if (Test-Path -LiteralPath $backup) {
        Copy-Item -LiteralPath $backup -Destination $archive -Force
    }
    throw
} finally {
    if (Test-Path -LiteralPath $tempOut) { Remove-Item -LiteralPath $tempOut -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host "Patch appliqué. La locale « $Locale » est proposée, et l'anglais et le chinois restent disponibles." -ForegroundColor Green
Write-Host "Archive : $archive"
Write-Host ''
