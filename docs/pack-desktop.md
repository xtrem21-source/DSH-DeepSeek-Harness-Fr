# Pack du profil — français, micro, thème

Le dépôt contient deux méthodes indépendantes. Celle-ci vit dans [`pack-desktop/`](../pack-desktop/)
et ne modifie **pas** `app.asar` : elle ajoute des paquets au profil de l'application
(`~/.dsh/profiles/<profil>`), avec un bloc de configuration délimité.

## Ce qu'elle ajoute

| Paquet | Rôle |
|---|---|
| `dsh-fr-locale` | interface française : 47 namespaces (2 098 chaînes), 454 corrections hors service de traduction, 28 règles par motif |
| `dsh-voice-input` | bouton micro à droite de la flèche d'envoi ; clic gauche dicte, clic droit ouvre les réglages (Gemini ou ElevenLabs) |
| `dsh-theme-clear-blue` | thème Clear Blue, palette sombre bleutée (porté de `official-clear-blue`) |

## Installation

```text
1. Extraire l'archive DSH-Desktop-Patch-FR-windows-x64-1.0.0.zip
   (ou copier pack-desktop/).
2. Fermer DeepSeek Harness.
3. Double-cliquer patcher.bat.
4. Rouvrir l'application.
```

`patcher.bat` détecte l'application sans chemin codé en dur (argument, dossiers connus, chaque
disque monté, registre de désinstallation), ferme les processus `DSH Desktop.exe` et
`DeepSeek Harness.exe`, sauvegarde le profil, copie les trois paquets, puis vérifie les marqueurs.
Il est idempotent : le relancer ne duplique rien.

## Vérifier et revenir en arrière

```text
logs\dernier.log                  journal de la dernière exécution
restaurer.bat                     remet le profil dans son état d'avant
APPLIQUER-CORRECTIF-MICRO.bat     relance le patch en passant le dossier de l'app en argument
```

Chaque exécution crée `sauvegarde\<horodatage>\` avec un manifeste (chemin, taille, SHA-256).
`restaurer.bat` vérifie chaque fichier restauré contre ce manifeste.

## Version de l'application

**Testé sur DeepSeek Harness 0.2.1-rc.3** (canal `nightly`).

Le pack continue de fonctionner après une mise à jour de l'application tant que la structure des
plugins ne change pas ; **ce n'est pas garanti**. Les points qui peuvent casser :

| Point | Symptôme | Geste |
|---|---|---|
| Emplacement `conversation.input.activity` renommé | le micro n'apparaît plus | vérifier dans l'inspecteur, adapter le slot |
| Service `locale` modifié | l'interface repasse en anglais | vérifier `ctx.locale.addLanguage/register` |
| Thème sans `body[data-ds-dark-theme]` | thème sans effet | vérifier `ui-theme → preference: dark` |
| Mise à jour qui remplace le profil | plus rien | relancer `patcher.bat` |

En cas de doute : `restaurer.bat`, puis relancer `patcher.bat` et contrôler à l'écran.

## Autre langue que le français

Le mécanisme ne connaît que des dictionnaires. Les chaînes sont dans
`pack-desktop/patch/plugins/dsh-fr-locale/fr/*.json` (un fichier par namespace) et les libellés
écrits en dur dans `fr/_correctifs.json` (table exacte + motifs `$1`).

```text
1. Dupliquer fr/ en <code>/ et traduire les valeurs (pas les clés).
2. Dans pack-desktop/outils/assembler-fr.mjs, changer LANGUE :
   { id: "<code>", label: "<nom>", fallback: "en" }.
3. node outils/assembler-fr.mjs
4. Relancer patcher.bat : le paquet est recopié dans le profil.
```

La bascule de langue reste celle de l'application (Réglages → Langue). Le module micro et le thème
sont indépendants de la langue.

## Limites connues

- Le thème ne s'applique qu'en **mode sombre** (`body[data-ds-dark-theme]`).
- La clé API est stockée dans le `localStorage` du profil, en clair (l'application n'a pas de
  coffre chiffré). Elle ne quitte pas la machine.
- Le pack ne touche ni aux sessions, ni aux réglages du moteur, ni à `.credentials.yaml`.
- Une chaîne anglaise d'un paquet non couvert reste en anglais jusqu'à ajout dans
  `fr/_correctifs.json`, puis régénération.
