#requires -Version 5.1
<#
    Restaure l'archive d'avant le patch (ou l'archive d'origine).
    Le script fonctionne depuis n'importe quel dossier.
#>
[CmdletBinding()]
param(
    [string]$CheminApplication = ""
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptDir
$backupDir = Join-Path $repoRoot 'sauvegarde'

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
        if ((Test-Path -LiteralPath (Join-Path $candidate 'DeepSeek Harness.exe')) -and
            (Test-Path -LiteralPath (Join-Path $candidate 'resources\app.asar'))) { return $candidate }
    }
    return $null
}

$app = $CheminApplication
if ([string]::IsNullOrWhiteSpace($app)) { $app = Find-DeepSeekApplication }
if ([string]::IsNullOrWhiteSpace($app)) {
    throw "DeepSeek Harness n'a pas été trouvé automatiquement. Indiquez son dossier avec -CheminApplication."
}
if ($app.EndsWith('DeepSeek Harness.exe', [StringComparison]::OrdinalIgnoreCase)) { $app = Split-Path -Parent $app }
$archive = Join-Path $app 'resources\app.asar'
if (-not (Test-Path -LiteralPath $archive)) { throw "Archive introuvable : $archive" }

$running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue |
    Where-Object { -not $_.Path -or $_.Path.StartsWith($app, [StringComparison]::OrdinalIgnoreCase) }
if ($running) {
    throw "Fermez complètement DeepSeek Harness avant de restaurer l'archive."
}

$source = $null
$stable = Join-Path $backupDir 'app.asar.original'
if (Test-Path -LiteralPath $stable) {
    $source = $stable
} else {
    $latest = Get-ChildItem -LiteralPath $backupDir -Filter 'app.asar.avant-patch-*' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) { $source = $latest.FullName }
}
if (-not $source) {
    throw "Aucune sauvegarde trouvée dans $backupDir. Utilisez une sauvegarde manuelle ou réinstallez l'application."
}

Copy-Item -LiteralPath $source -Destination $archive -Force
Write-Host ''
Write-Host 'Archive restaurée.' -ForegroundColor Green
Write-Host "Source  : $source"
Write-Host "Archive : $archive"
Write-Host ''
