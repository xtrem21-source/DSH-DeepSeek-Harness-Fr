# Observations — idées hors périmètre, notées et **non implémentées**

> Le mandat est explicite : une idée hors périmètre se note ici, elle ne
> s'implémente pas. Ce fichier est la liste de ce que j'ai vu sans y toucher.

## 1. Libellés chinois résiduels dans le panneau Workbenches — **résolu**

Le paquet `dsh-desktop-workbenches` (shell de l'éditeur) embarque sa **propre**
table de traduction, indexée par libellé chinois, et ne l'applique que si la
langue active commence par « en » :

    const isEnglish = () => localeActive().toLowerCase().startsWith('en')
    const tr = (value) => isEnglish() ? enCopy[value] || value : value

En français, `isEnglish()` est faux : les libellés restaient en chinois. Faute
de point d'extension, ces textes sont corrigés côté navigateur par un
observateur du DOM embarqué dans le pack de langue :

- **365 correspondances exactes** (libellés fixes, catégories, et les 17
  workbenches du marché avec leur nom et leur description traduits) ;
- **17 règles par motif** pour les textes à partie variable : compteurs
  (`Mes favoris (3)`), noms imbriqués (`Voir les détails de <nom>`),
  `Auteur : <nom>`, `Capture d'écran de <nom>`, etc. ;
- après application d'un motif, les noms propres chinois restés dans la phrase
  sont eux-mêmes remplacés (le plus long d'abord, pour éviter les coupures).

Vérifié : **0 idéogramme** dans les textes et les attributs sur le tableau de
bord, la page Workbenches (17 fiches), la vue Sessions et les Réglages.

## 2. Noms de workbenches futurs

La table couvre les 17 workbenches présents au catalogue au moment de la
livraison. Un workbench publié plus tard s'affichera en chinois jusqu'à ce que
son nom et sa description soient ajoutés à `patch\plugins\dsh-fr-locale\fr\_correctifs.json`
puis régénérés avec `node outils\assembler-fr.mjs` et recopiés.

Piste d'automatisation possible (non implémentée) : un script qui lit
`workbench-catalog-cache.json`, relève les entrées sans traduction et les
signale — la traduction elle-même restant à écrire.

## 2. Libellés du shell non couverts par le service de traduction — **résolu**

Cinq libellés de l'ossature (`Plugins`, `Automation tasks`, `Standard mode`,
`Access mode`, `Workspace Write`) ne sont pas déclarés dans un dictionnaire du
service `locale` : ils sont écrits en dur dans le shell. Ils sont corrigés par
l'observateur du DOM de `fr/_correctifs.json`, sans modifier l'application.

Le 29/10, le même mécanisme a couvert tout l'anglais restant : menu du compte
(`Settings`, `Feedback`, `Sign out`), pied de barre (`Signed in to …`), modes
d'accès (`Full access`, `Read only`), section Compte, section Modèles (clés API,
`Edit`/`Delete`, `Add model provider`), préréglages d'agent (titres, infobulles,
descriptions des modes) et les 31 descriptions des extensions intégrées.
Même consigne pour la suite : une chaîne anglaise se corrige dans
`fr/_correctifs.json` (entrée exacte, ou motif avec `$1` pour les libellés
variables), puis `node outils\assembler-fr.mjs`.

## 3. Persistance de la clé Gemini — **résolu autrement**

La première tentative écrivait la clé via `ctx.remote.settings.update`, que le
service `settings` du moteur réécrit à sa façon : la valeur ne survivait pas.

Le micro livré n'utilise plus ce chemin : la clé est stockée en `localStorage`
de l'application, comme dans la méthodologie open-cowork-micro. Elle est propre
à cette application et à cette origine, reste sur la machine, et n'est écrite
ni dans un journal ni dans un fichier du dossier de livraison.

## 4. Deux approches de micro, une seule retenue

| | Micro natif de l'éditeur | Méthodologie open-cowork-micro |
|---|---|---|
| Activation | bundle `dsh-experimental-voice-input-bundle` | paquet `dsh-voice-input` |
| Réglages | page Extensions, sélecteur de service | **clic droit sur le micro** |
| Clé API | champ dans Réglages → Général, écriture via l'hôte | champ dans le panneau, `localStorage` |
| Fournisseur | `ctx.speechToText` + provider à écrire | appel direct à l'API Gemini |
| Modèle | celui du service | `gemini-3.5-flash-lite`, modifiable |
| Envoi auto | non | oui, case à cocher |

La seconde est celle qui a été retenue, sur ta décision. Le micro natif est
désactivé (`- id: ui-voice-input / disabled: true`) pour éviter un second
bouton, et le fournisseur Gemini écrit pour la première approche n'est plus
livré.

## 5. Points de vigilance du micro retenu

- **Mise à jour de DSH** : `app.asar` est remplacé, donc la permission micro
  saute et le micro se rebloque. Relancer `patcher.bat`.
- **Modèle par défaut** : `gemini-3.5-flash-lite`. Si Google le retire, le
  script migre automatiquement vers une liste connue ; le champ du panneau
  reste modifiable.
- **Ancrage** : le bouton se place après le bouton d'envoi, reconnu par son
  `aria-label`. Si une version change ce libellé, l'ancre échoue et le bouton
  reste masqué — c'est le point à vérifier en premier.
- **Deux micros** : ne pas réactiver l'extension « Saisie vocale » native,
  sinon un second bouton apparaît.

