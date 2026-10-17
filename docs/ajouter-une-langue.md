# Ajouter une langue

Exemple complet avec l'espagnol (`es`). Comptez quelques heures pour 2 155 chaînes, selon la
qualité visée.

## 1. Créer le dossier

```powershell
Copy-Item locales\template locales\es -Recurse
```

## 2. Renseigner `meta.json`

```json
{
  "code": "es",
  "label": "Español",
  "fallback": "en",
  "direction": "ltr",
  "effort": {
    "High": "Alto",
    "Medium": "Medio",
    "Low": "Bajo"
  }
}
```

`code` doit être un code primaire en minuscules. `en` et `zh` sont refusés : ils appartiennent à
l'application.

## 3. Générer le squelette des clés

```powershell
node scripts\exporter-les-cles.mjs es
```

```text
2155 clés → locales\es\web.json
165 clés → locales\es\shell.json
```

Les valeurs sont vides. **Ne traduisez pas `web.json` comme un fichier de clés** : la clé *est*
le texte anglais d'origine. Vous traduisez la valeur.

## 4. Traduire

| Fichier | Ce que vous lisez | Ce que vous écrivez |
|---|---|---|
| `web.json` | `"… {count} more lines"` | `"… {count} líneas más"` |
| `shell.json` | `"cliCommandMenu"` | `"Gestionar el comando dsh…"` |

Règles :

- **Conservez chaque `{placeholder}`** — `{count}`, `{path}`, `{tokens}`…
- Ne traduisez pas les identifiants techniques, noms de modèles, commandes, chemins.
- Ne videz pas une chaîne web ; une chaîne shell vide est légitime (suffixe autour d'un nom).
- Restez court : certaines zones n'ont pas de retour à la ligne.

## 5. Valider

```powershell
npm run verify:packs
```

Sortie attendue :

```text
es — Español : 2155 chaînes web, 165 clés shell, 3 libellés d'effort
Packs valides.
```

Une erreur ressemble à :

```text
ERREUR : web : placeholders manquants dans « … {count} more lines » → {count}
```

Corrigez la valeur concernée, relancez. Les valeurs encore vides sont des avertissements, pas
des erreurs : un pack partiel est utilisable, l'anglais prend le relais.

## 6. Tester sur une copie

```powershell
node src\patch.mjs --app "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app.asar" `
                   --out "$env:TEMP\es.asar" --locales es --default es
node src\patch.mjs --verify "$env:TEMP\es.asar" --locales es --default es
```

`--verify` doit afficher `"ok": true`.

## 7. Appliquer

Application fermée :

```powershell
.\scripts\Appliquer-le-patch.ps1 -Locale es -LangueParDefaut es
.\scripts\Verifier-l-etat.ps1 -Locale es -LangueParDefaut es
```

Rouvrez l'application : le sélecteur propose **Español**, l'espagnol est la langue par défaut,
**English** et **中文** restent disponibles.

## 8. Proposer le pack

Ouvrez une *pull request* avec **une seule langue**. Indiquez :

- le nombre de chaînes traduites sur 2 155 et de clés sur 165 ;
- ce que vous avez vérifié dans l'application (sélecteur, menus, réglages) ;
- ce qui reste vide, et pourquoi.

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| `ancre … introuvable` | la version de l'application a changé ; restaurez et signalez |
| l'interface reste en anglais | locale active ≠ pack ; vérifiez le sélecteur et `--default` |
| `{count}` affiché littéralement | placeholder perdu dans la traduction |
| texte tronqué | traduction trop longue pour la zone |
| `delta-other` | l'archive porte déjà un autre jeu de locales ; restaurez l'original |
