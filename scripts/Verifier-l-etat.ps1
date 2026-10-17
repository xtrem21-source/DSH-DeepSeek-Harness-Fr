#requires -Version 5.1
<#
    Vérifie l'état du patch sur l'installation actuelle.
    Sortie 0 si l'archive est patchée et vérifiée, 1 sinon.
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
        if ((Test-Path -LiteralPath (Join-Path $candidate 'DeepSeek Harness.exe')) -and
            (Test-Path -LiteralPath (Join-Path $candidate 'resources\app.asar'))) { return $candidate }
    }
    return $null
}

$app = $CheminApplication
if ([string]::IsNullOrWhiteSpace($app)) { $app = Find-DeepSeekApplication }
if ([string]::IsNullOrWhiteSpace($app)) { throw "DeepSeek Harness n'a pas été trouvé automatiquement." }
if ($app.EndsWith('DeepSeek Harness.exe', [StringComparison]::OrdinalIgnoreCase)) { $app = Split-Path -Parent $app }
$archive = Join-Path $app 'resources\app.asar'

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Node.js est requis pour vérifier le patch." }

Write-Host "Application : $app"
$statusText = & $node $patcher --status $archive --locale-dir $localeDir --locales $Locale 2>&1 | Out-String
$status = 'unknown'
try { $status = ($statusText | ConvertFrom-Json).status } catch { }
Write-Host "État : $status"

if ($status -ne 'delta') {
    if ($status -eq 'original') { Write-Host "L'archive est d'origine : le patch n'est pas appliqué." -ForegroundColor Yellow }
    elseif ($status -eq 'legacy-fr') { Write-Host "L'archive porte l'ancien patch français." -ForegroundColor Yellow }
    elseif ($status -eq 'delta-other') { Write-Host "L'archive est patchée avec un autre jeu de locales." -ForegroundColor Yellow }
    else { Write-Host "Structure non reconnue." -ForegroundColor Yellow }
    exit 1
}

& $node $patcher --verify $archive --locale-dir $localeDir --locales $Locale --default $LangueParDefaut
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "Patch vérifié : locale « $Locale » ajoutée, anglais et chinois conservés." -ForegroundColor Green
exit 0
