# Gabarit de langue

Ce dossier n'est **jamais** chargé par le moteur : c'est un point de départ.

1. Copie ce dossier sous `locales/<code>/` (exemple : `locales/es/`).
2. Renseigne `meta.json` :

   | Champ | Rôle | Exemple |
   |---|---|---|
   | `code` | code primaire BCP-47, en minuscules | `es`, `pt-BR`, `zh-Hant` |
   | `label` | nom affiché dans le sélecteur | `Español` |
   | `fallback` | langue de repli si une clé manque | `en` |
   | `direction` | `ltr` ou `rtl` | `ltr` |
   | `effort` | libellés des niveaux de raisonnement | `{ "High": "Alto" }` |

3. Remplis `web.json` et `shell.json` (voir `docs/ajouter-une-langue.md`).
4. Vérifie : `npm run verify:packs`.
5. Applique : `npm run patch -- --app <app.asar> --out <copie> --default <code>`.

Les codes `en` et `zh` sont refusés : ils appartiennent à l'application.

`web.json` est un dictionnaire **texte anglais → traduction**. Les `{placeholders}`
doivent être conservés à l'identique, sinon la vérification échoue.

`shell.json` associe une **clé technique** à sa traduction ; les placeholders
viennent de l'application et ne peuvent pas être déduits du seul fichier.
