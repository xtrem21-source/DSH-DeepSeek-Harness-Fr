# DeepSeek Harness — interface française

**Un patch delta multi-langue pour l'interface de DeepSeek Harness.** Il ajoute le français
**sans retirer** le chinois ni l'anglais, et le moteur accepte **n'importe quelle langue** :
le français n'est qu'un pack livré avec le dépôt.

[English summary](README.en.md) · [Comment ça marche](docs/comment-ca-marche.md) ·
[Ajouter une langue](docs/ajouter-une-langue.md) · [Multi-langue](docs/multilingue.md)

---

## Ce que fait le patch

| Point | Delta |
|---|---|
| Archive remplacée | **Non** : 3 fichiers internes modifiés, 121 Mo intacts |
| Langues | 中文, English et la langue du pack restent disponibles |
| Langue par défaut | configurable (`fr` par défaut) |
| Traductions appliquées | uniquement quand la locale active possède un pack |
| Mise à jour de l'application | réapplicable si les ancres existent |
| Échec de compatibilité | l'archive n'est **pas** remplacée ; le script s'arrête |
| Sauvegarde | créée avant toute écriture |
| Retour | `scripts\Restaurer-l-original.cmd` |

Le pack français couvre **2 155 chaînes** de l'interface web et **165 clés** du shell Electron
(menus, bienvenue, connexion, mises à jour), plus les libellés des niveaux de raisonnement.

## Prérequis

- **Windows** (les scripts fournis sont en PowerShell ; le moteur Node fonctionne ailleurs).
- **Node.js 20.19 ou plus récent.**
- **DeepSeek Harness fermé**, y compris l'icône de la zone de notification.

## Installer

```powershell
git clone https://github.com/xtrem21-source/deepseek-harness-fr.git
cd deepseek-harness-fr
npm ci
npm test          # 19 contrôles : packs, patch, rupture, multi-locale, ancien patch
```

Puis, application fermée :

```text
scripts\Appliquer-le-patch.cmd
```

Rouvrez DeepSeek Harness : le sélecteur de langue propose **Français**, la locale par défaut
est le français, et **English** / **中文** restent disponibles.

### En ligne de commande

```powershell
node src/patch.mjs --app "<dossier>\resources\app.asar" --out "$env:TEMP\patch.asar" --default fr
node src/patch.mjs --verify "<dossier>\resources\app.asar" --default fr
node src/patch.mjs --status "<dossier>\resources\app.asar"
node src/patch.mjs --list
```

| Option | Rôle |
|---|---|
| `--locales fr,es` | packs à injecter (défaut : tous ceux de `locales/`) |
| `--locale-dir <dir>` | dossier des packs (défaut : `locales/` du dépôt) |
| `--default fr` | locale proposée au premier lancement (défaut : comportement d'origine) |
| `--status` | `original`, `delta`, `delta-other`, `legacy-fr`, `unknown` |
| `--list` | inventaire des packs et validation |

## Vérifier et restaurer

```text
scripts\Verifier-l-etat.cmd      → « État : delta » + vérification des ancres
scripts\Restaurer-l-original.cmd  → remet l'archive d'avant le patch
```

## Ajouter une langue

Le moteur ne connaît que des **codes** ; il ne contient aucun mot français.

```text
locales/
  fr/        pack livré : meta.json, web.json, shell.json
  template/  gabarit vide, jamais chargé
```

1. Copiez `locales/template/` en `locales/<code>/`.
2. Renseignez `meta.json` (`code`, `label`, `fallback`, `direction`, `effort`).
3. Traduisez `web.json` (texte anglais → traduction) et `shell.json` (clé → traduction).
4. `npm run verify:packs` — la parité des `{placeholders}` est contrôlée.
5. `node src/patch.mjs --app <asar> --out <copie> --default <code>`.

Guide détaillé : [docs/ajouter-une-langue.md](docs/ajouter-une-langue.md).
Conception multi-langue (repli, RTL, pluriels) : [docs/multilingue.md](docs/multilingue.md).

## Structure

```text
src/patch.mjs        moteur : ancres, reconstruction asar, vérification
src/packs.mjs        chargement et validation des packs
locales/<code>/      meta.json + web.json + shell.json
scripts/             apply / restore / verify (PowerShell + .cmd)
tests/               fixture d'archive reconstruite, tests de bout en bout
docs/                mécanisme, multi-langue, ajout de langue, sécurité, dépannage
```

## Ce qui n'est pas traduit

- Les réponses du modèle et le contenu saisi.
- Les noms de modèles, paquets, identifiants, commandes, chemins.
- Les textes fournis dynamiquement par le serveur.
- Quelques libellés d'accessibilité codés en dur, qui restent en anglais.

## Limites connues

- Le patch est lié au **mécanisme de localisation** de l'application, pas à une empreinte :
  il vérifie des ancres et s'arrête proprement si elles ont bougé.
- Une mise à jour automatique peut écraser le patch : réappliquez-le, ou restaurez d'abord.
- Une seule liste de locales par archive : pour changer de jeu de packs, restaurez l'original.
- L'interface n'est pas retournée automatiquement pour les langues RTL (`ar`, `fa`, `he`) :
  les chaînes sont traduites, la mise en page reste LTR. Voir [docs/multilingue.md](docs/multilingue.md).
- Testé contre **DeepSeek Harness 0.2.0-rc.2**. Une autre version peut déplacer les ancres.

## Légal

Projet **indépendant**, sans affiliation avec DeepSeek. Aucun binaire de l'application n'est
distribué. Le code du patch est sous MIT ; les chaînes traduites dérivent de l'interface et
restent la propriété de leurs auteurs. Voir [NOTICE.md](NOTICE.md).

## Licence

[MIT](LICENSE) pour le code. Voir [NOTICE.md](NOTICE.md) pour les traductions et les marques.
