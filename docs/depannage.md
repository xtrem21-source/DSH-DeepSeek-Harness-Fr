# Dépannage

## Messages du patcheur

| Message | Cause | Solution |
|---|---|---|
| `ancre … introuvable` | la version de DeepSeek Harness a changé | restaurez l'archive d'origine ; ouvrez une issue avec la version de l'application |
| `fichier non transformé : …` | l'ancre existe mais le remplacement n'a rien changé | signalez-le : le patch est inopérant pour cette version |
| `cette archive porte l’ancien patch français` | marqueur `__DSH_FR` détecté | restaurez l'archive d'origine, puis réappliquez |
| `déjà patchée avec un autre jeu de locales` | `LOCALE_IDS` contient d'autres codes | restaurez, puis patchez avec la liste voulue |
| `--out doit désigner un autre fichier` | sortie = entrée | écrivez dans un temporaire |
| `pack … invalide` | schéma, code ou placeholders | `npm run verify:packs` pour le détail |

## Messages des scripts

| Message | Cause | Solution |
|---|---|---|
| `Fermez complètement DeepSeek Harness` | processus encore actif | quittez aussi l'icône de la zone de notification |
| `DeepSeek Harness n'a pas été trouvé` | installation non standard | `-CheminApplication "D:\…\DeepSeek Harness"` |
| `Archive introuvable` | dossier incomplet | vérifiez `resources\app.asar` |
| `Node.js 20.19 ou plus récent est requis` | `node` absent du `PATH` | installez Node.js, rouvrez le terminal |
| `Aucune sauvegarde trouvée` | dossier `sauvegarde/` vide | réinstallez l'application, puis repatchez |
| `La vérification après patch a échoué` | archive inattendue | la sauvegarde a été recopiée automatiquement |

## L'application ne démarre plus

1. Fermez tout processus restant.
2. Restaurez :

   ```text
   scripts\Restaurer-l-original.cmd
   ```

3. Si le script échoue, copiez à la main `sauvegarde\app.asar.original` sur
   `resources\app.asar`.
4. Rouvrez l'application. Si elle démarre, le patch était en cause : signalez la version.

## L'interface reste en anglais

| Vérification | Commande |
|---|---|
| Le patch est-il appliqué ? | `scripts\Verifier-l-etat.cmd` → `État : delta` |
| Le pack est-il complet ? | `npm run verify:packs` |
| La locale par défaut est-elle bonne ? | `node src/patch.mjs --verify <asar> --default fr` |
| Le sélecteur propose-t-il la langue ? | dans l'application, Réglages → Langue |

Une locale choisie explicitement (`en`, `zh`) reste prioritaire : c'est voulu.

## Fichiers `.payload`

Un `.asar.payload` ne subsiste que si le processus a été tué pendant l'écriture. L'archive
d'origine n'a pas été touchée à ce stade : supprimez le fichier et relancez.

## Accents cassés dans les scripts

Les `.ps1` sont en UTF-8 **avec BOM**, parce que Windows PowerShell 5.1 lit l'UTF-8 sans BOM
comme de l'ANSI. Si vous éditez un script, conservez le BOM. Les `.cmd` sont en CRLF.

## Politique d'exécution PowerShell

Les `.cmd` lancent `powershell -ExecutionPolicy Bypass -File …` : aucune modification globale
n'est nécessaire. Si vous appelez le `.ps1` directement :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Appliquer-le-patch.ps1
```

## `npm ci` échoue

Le dépôt versionne `package-lock.json`. Si l'installation échoue, vérifiez la version de Node
(`node --version` ≥ 20.19) et l'accès au registre npm. `npm install` fonctionne aussi, mais
`npm ci` est reproductible.
