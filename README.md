# DeepSeek Harness — interface française

**Interface française pour DeepSeek Harness, en deux méthodes.** Le **patch delta de l'archive**
ajoute le français **sans retirer** le chinois ni l'anglais, et son moteur accepte **n'importe
quelle langue** ; le **pack du profil** ajoute en plus le **micro** (Gemini / ElevenLabs) et le
**thème Clear Blue** (mode sombre), sans toucher à l'archive.

[English summary](README.en.md) · [Comment ça marche](docs/comment-ca-marche.md) ·
[Ajouter une langue](docs/ajouter-une-langue.md) · [Multi-langue](docs/multilingue.md)

---

## Deux méthodes dans ce dépôt

| | **Méthode 1 — patch delta de l'archive** | **Méthode 2 — pack du profil** |
|---|---|---|
| Où | `src/`, `scripts/`, `locales/` (ce README) | [`pack-desktop/`](pack-desktop/LISEZ-MOI.txt) |
| Ce qui est modifié | 3 fichiers internes de `app.asar` | le profil DSH (`~\.dsh\profiles\desktop`) |
| Langues | tout pack de `locales/`, sélecteur dans l'app | français livré, bascule FR / EN |
| Micro | — | bouton de dictée (Gemini ou ElevenLabs) |
| Thème | — | Clear Blue (mode sombre) |
| Installation | `npm ci`, puis `scripts\Appliquer-le-patch.cmd` | dézipper, double-clic sur `patcher.bat` |
| Retour arrière | `scripts\Restaurer-l-original.cmd` | `pack-desktop\restaurer.bat` |

Les deux méthodes peuvent coexister : elles ne touchent pas les mêmes fichiers. Le pack du profil
ne modifie pas `app.asar` (la permission micro y est déjà native dans la version visée).

### Méthode 2 — pack du profil (`pack-desktop/`)

Interface française complète, bouton micro et thème Clear Blue, sans réemballer l'archive.

1. Télécharger **`DSH-Desktop-Patch-FR-windows-x64-1.0.0.zip`** (racine du dépôt) et l'extraire,
   ou cloner le dépôt et aller dans `pack-desktop/`.
2. Fermer DeepSeek Harness, puis double-cliquer **`patcher.bat`**.
3. Rouvrir l'application : l'interface est en français, le micro est à droite de la flèche
   d'envoi (clic gauche pour dicter, clic droit pour la clé API).

> **Version.** Testé sur **DeepSeek Harness 0.2.1-rc.3** (canal `nightly`). Le pack continue de
> fonctionner après une mise à jour de l'application tant que la structure des plugins ne change
> pas ; **ce n'est pas garanti**. S'il cesse de fonctionner, relancer `patcher.bat` puis vérifier
> à l'écran ; en cas d'échec, `restaurer.bat` remet le profil dans son état d'avant.

Le pack est livré en français, mais le mécanisme ne connaît que des dictionnaires : les chaînes
vivent dans `patch/plugins/dsh-fr-locale/fr/*.json` (47 fichiers, 2 098 chaînes) plus la table de
corrections `_correctifs.json` (454 entrées, 28 règles). `node outils/assembler-fr.mjs` reconstruit
`lib/client.js`. Pour une autre langue : dupliquer le dossier, changer `LANGUE` (`id`, `label`,
`fallback`) dans le générateur, traduire les valeurs, régénérer. Détails :
[docs/pack-desktop.md](docs/pack-desktop.md).

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
git clone https://github.com/xtrem21-source/DSH-DeepSeek-Harness-Fr.git
cd DSH-DeepSeek-Harness-Fr
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
