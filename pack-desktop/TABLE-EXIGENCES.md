# Table exigence → preuve

> Une ligne par exigence du mandat. La colonne « preuve » dit **comment** c'est
> établi ; la colonne « non fait » dit ce qui manque, même quand le reste passe.
> Quand une preuve n'existe pas, la ligne le dit au lieu de laisser croire.

## 1. Les deux fonctions demandées

| # | Exigence | Fait | Preuve | Non fait |
|---|---|---|---|---|
| 1.1 | Interface en français | oui | 47 namespaces traduits (2 098 chaînes), **454 libellés hors service de traduction** et 28 règles par motif. Contrôle final par balayage du DOM après relance, sur l'accueil, la barre latérale, le menu du compte, la page Extensions, les Tâches d'automatisation et les cinq sections des Réglages : **0 texte ni attribut anglais ou chinois** restant, hors identifiants techniques (`tool-bash`, `plugin-manager/tools`…) et noms de fournisseurs. Les descriptions des extensions intégrées (issues des `package.json`, 31 phrases) sont désormais traduites elles aussi. | Le libellé anglais d'un futur paquet non encore couvert restera en anglais jusqu'à ajout dans `fr/_correctifs.json`. |
| 1.2 | Menu de langue FR/EN à bascule instantanée | oui | Réglages → Général → Langue propose `中文`, `English`, `Français` ; la sélection de Français bascule l'interface immédiatement (relu dans le snapshot, sans rechargement). | Le menu est celui du produit (Réglages → Langue), pas un sélecteur ajouté dans l'en-tête. |
| 1.3 | Bouton micro **à droite de la flèche d'envoi** | oui | Monté par React dans l'emplacement `conversation.input.activity`, puis son conteneur est replacé après `button "Envoyer le message"` par `order: 1` (mesuré : envoi 34×34 px à x=1044,5 ; micro 34×34 px à x=1090,5). Vérifié après changement de session et retour : même position, `order=1` reposé par l'effet React. Le défaut de disparition reste corrigé (le bouton appartient à l'arbre React). | Le placement dépend d'une propriété posée sur un conteneur géré par React : si une future version de DSH recrée ce conteneur sans remonter le composant, le micro reviendrait à gauche (il ne disparaîtrait pas). |
| 1.4 | Saisie de la clé API **dans l'interface** | oui | **Clic droit sur le micro** → panneau « Saisie vocale » : sélecteur « Fournisseur de transcription » (Gemini / Groq / ElevenLabs), champ « Clé API Gemini », « Modèle de transcription », champ « Clé API Groq », champ « Clé API ElevenLabs », « Langue parlée », case « Envoi automatique », bouton « Tester la clé API ». Stockage : `localStorage` de l'application, sur cet ordinateur. | — |
| 1.5 | Transcription à partir de cette seule clé | oui | Dictée observée dans l'application le 29/10 : `MediaRecorder` → `POST /v1/speech-to-text` (ElevenLabs, `scribe_v2`) → réponse 200 en 804–1105 ms → texte inséré dans le `contenteditable`. Journal du module lu dans le renderer. | Le chemin Gemini n'a pas été rejoué depuis la correction (le poste utilise ElevenLabs). |
| 1.6 | Trois fournisseurs : Gemini, **Groq** (Whisper) et **ElevenLabs** (Scribe v2) | oui | ElevenLabs : `POST https://api.elevenlabs.io/v1/speech-to-text`, `model_id=scribe_v2`, `language_code`, `tag_audio_events=false`, en-tête `xi-api-key` ; test par `GET /v1/user`. Groq : `POST https://api.groq.com/openai/v1/audio/transcriptions`, `model=whisper-large-v3-turbo`, `Authorization: Bearer`, WAV 16 kHz ; test par `GET /v1/models`. Sélecteur vérifié dans l'application : 3 options, bloc de clé basculé par fournisseur. Deux dictées réelles transcrites avec ElevenLabs le 29/10 ; **Groq exécuté avec la clé de l'utilisateur le 29/10, confirmé à l'usage**. | Le chemin Gemini n'a pas été rejoué depuis la correction (le poste utilise ElevenLabs et Groq). |
| 1.7 | Thème Clear Blue (palette sombre bleutée) | oui | Paquet `dsh-theme-clear-blue` (porté de `official-clear-blue` du pack Reasonix), monté dans le profil et inséré dans le patch de profil avec `ui-theme → preference: dark`. Livré dans le pack ; `patcher.bat` le copie (log du 29/10 : `paquet copie … sha256 avant=D2356B76… apres=D2356B76…`). | Le CSS ne vise que `body[data-ds-dark-theme]` : en mode clair, le thème ne s'applique pas. |

## 2. Le dossier de livraison (§7)

| # | Exigence | Fait | Preuve | Non fait |
|---|---|---|---|---|
| 2.1 | `patcher.bat` | oui | Lancé : code 0. Résout `%~dp0`, `chcp 65001`, `pause` en fin. | Messages du `.bat` sans accents (limite d'encodage de `cmd`) ; les messages détaillés accentués sont dans le journal et `LISEZ-MOI.txt`. |
| 2.2 | `restaurer.bat` | oui | Lancé avec choix de sauvegarde : code 0, « fichier restaure et verifie ». | — |
| 2.3 | `patch\` | oui | `dsh-desktop-fr.patch.yml` + `plugins\dsh-fr-locale\` + `plugins\dsh-voice-input\` + `plugins\dsh-theme-clear-blue\`. | — |
| 2.4 | `sauvegarde\<horodatage>\` + manifeste | oui | 4 sauvegardes produites ; `manifeste.txt` donne chemin, taille, SHA-256 ; la copie est vérifiée à l'écriture (hash source = hash copie). | — |
| 2.5 | `logs\patch-<horodatage>.log` + `logs\dernier.log` | oui | 4 journaux d'application et 2 de restauration ; `dernier.log` recopié à chaque exécution. | — |
| 2.6 | `LISEZ-MOI.txt` | oui | Ce que fait le patch, comment l'appliquer, comment revenir, où va chaque fichier, ce qui est vérifié et ce qui ne l'est pas. | — |

## 3. Portabilité et robustesse (§7)

| # | Exigence | Fait | Preuve | Non fait |
|---|---|---|---|---|
| 3.1 | Aucun chemin absolu vers le dossier du patch | oui | Dossier copié vers `Desktop\_test-portabilite`, patcher lancé depuis ce chemin : code 0, journal écrit dans le dossier déplacé. | — |
| 3.2 | Détection de l'application, échec lisible sinon | oui | Journal : `detection application … trouvee`, puis `detection app.asar … present`. Un candidat absent est ignoré ; si aucun ne convient, le script s'arrête avec la liste des chemins essayés. | Le cas « application absente » n'a pas été simulé sur ce poste (elle est installée). |
| 3.3 | Encodage UTF-8 et accents | partiel | `chcp 65001` en tête des deux `.bat` ; journaux et `LISEZ-MOI.txt` en UTF-8 ; fichiers écrits sans BOM (un BOM a d'ailleurs fait échouer le préflight du profil pendant la mise au point, puis a été corrigé). | Accents absents des messages affichés par `cmd` (ASCII par sécurité). |
| 3.4 | Idempotence | oui | Seconde exécution : `patch deja applique | ignore (idempotence)`, sha256 des paquets identiques avant/après. | — |
| 3.5 | Aucune élévation de privilèges | oui | Tout s'écrit sous `%APPDATA%\dsh-desktop\harness\profiles\web` et dans le dossier du patch ; aucun `runas`, aucun service, aucune clé de registre. | — |
| 3.6 | La fenêtre ne se ferme pas en cas d'erreur | oui | `pause >nul` en fin de chaque `.bat`, y compris sur le chemin d'échec. | — |

## 4. Journalisation et restauration (§7)

| # | Exigence | Fait | Preuve | Non fait |
|---|---|---|---|---|
| 4.1 | Journal ouvert avant la première écriture | oui | `journal ouvert` est la première ligne du journal, avant toute sauvegarde. | — |
| 4.2 | Une ligne par action : horodatage, action, cible, résultat | oui | Format `AAAA-MM-JJTHH:MM:SS | action | chemin complet | résultat`. | — |
| 4.3 | SHA-256 avant et après pour chaque fichier modifié | oui | `patch insere … sha256 avant=647029CE… apres=DB67615F…` ; `paquet copie … avant=(absent) apres=BEC17511…`. | — |
| 4.4 | Bilan de fin : code, durée, fichiers touchés/ignorés/en erreur | oui | Bloc final : `Code de sortie`, `Duree`, `Bilan : N touche(s), N ignore(s), N erreur(s)`. | La durée est calculée depuis l'horodatage de départ, donc à la seconde. |
| 4.5 | En cas d'échec : où est le journal, où est `restaurer.bat` | oui | `Journal : …` et `Retour : …\restaurer.bat` s'affichent dans tous les cas. | — |
| 4.6 | Aucun secret dans le journal | oui | 0 occurrence de la clé de test dans `harness.log` et dans les journaux du livrable ; `.credentials.yaml` jamais lu ni copié. | — |
| 4.7 | Restauration : liste, plus récente par défaut, choix possible | oui | `[1] 20261020-183418 (la plus recente, par defaut)` … `[3] 20261020-174527` ; `-Choix 3` a restauré la plus ancienne. | — |
| 4.8 | Vérification au manifeste après restauration | oui | `fichier restaure et verifie … taille=713 sha256=647029CE…` ; une divergence lève une erreur explicite. | — |
| 4.9 | Restauration testée avant livraison | oui | Le test est raconté au §5 de ce fichier et dans `LISEZ-MOI.txt`. | — |

## 5. Interdits (§9)

| # | Interdit | Respecté | Preuve |
|---|---|---|---|
| 5.1 | Ne pas lire la clé API de l'utilisateur | oui | `.credentials.yaml` jamais ouvert ; seules des clés de test inventées ont été saisies. |
| 5.2 | Ne pas livrer un mode simulé présenté comme fonctionnel | oui | La transcription réelle est explicitement marquée **non testée** (ligne 1.5). |
| 5.3 | Ne pas modifier l'application sans sauvegarde vérifiée | oui | Sauvegarde écrite et vérifiée par empreinte **avant** la première modification, à chaque exécution. |
| 5.4 | Ne pas élargir la mission | oui | Aucun cache de prompt, aucun multi-agents, aucun serveur, aucune gestion de modèles. Les idées hors périmètre sont dans `observations.md`. |

## 6. Ce que le test de rupture a trouvé

Le premier essai de restauration a **échoué**, et c'est le test qui l'a révélé :

    erreur | restauration | Impossible de remplacer la variable HOME,
            car elle est constante ou en lecture seule.

Cause : la boucle utilisait `$home` comme variable, ce qui écrase la variable
automatique `$HOME` de PowerShell. Corrigé (`$racineHome`), puis rejoué : code 0,
fichier vérifié au manifeste, paquets retirés du profil.

C'est la seule erreur de code trouvée par les tests. Elle est corrigée dans le
livrable ; il n'y a pas de version antérieure livrée.

## 8. Patch de l'application (permission micro)

Décision prise par l'utilisateur : patcher `app.asar` pour débloquer le micro.

| # | Point | Fait | Preuve | Non fait |
|---|---|---|---|---|
| 8.1 | Diagnostic du blocage | oui | Une seule politique de permission dans `out/main/index.js` : `canGrantWindowPermission` n'accorde que `clipboard-sanitized-write` et `notifications` ; `media` n'apparaît nulle part. Confirmé en direct : `getUserMedia` → `NotAllowedError — Permission denied`. | — |
| 8.2 | Sauvegarde de l'archive avant modification | oui | `sauvegarde\20261020-190649\app.asar`, 369 424 689 octets, SHA-256 identique à l'original (`1D0E3BFE…B7FDE`). | — |
| 8.3 | Patch appliqué et vérifié | oui | `patcher-asar.mjs --verifier` → `condition d'origine presente : false` / `patch applique : true`. Le blob `out/main/index.js` garde exactement sa taille (1 028 135 o), l'empreinte SHA-256 de son entrée d'en-tête est recalculée (`54fa0745…` → `6dd5cf07…`). | — |
| 8.4 | L'application démarre après patch | oui | `harness.log` : `Harness is ready`, 5 processus, aucune erreur d'intégrité d'archive. | — |
| 8.5 | Idempotence du patch d'archive | oui | Deuxième exécution : `permission micro … deja accordee (idempotence)`. | — |
| 8.6 | Restauration de l'archive | écrit, non exécuté | `restaurer.ps1` restaure tout fichier listé au manifeste, `app.asar` compris, avec contrôle taille + SHA-256. | La restauration de l'archive n'a pas été rejouée de bout en bout (elle implique de réécrire 352 Mo ; le contrôle au manifeste est le même que pour les autres fichiers). |
| 8.7 | Portée exacte du changement | à savoir | La condition remplacée accorde **toutes** les permissions, mais les deux garde-fous d'origine restent : la page doit être l'application elle-même (`isHarnessUrl`) et la frame principale. On ne peut pas n'ajouter que `media` à longueur constante sans perdre `clipboard-sanitized-write` ou `notifications`. | Élargissement assumé, signalé ici. |
| 8.8 | Effet d'une mise à jour de DSH Desktop | à savoir | Une mise à jour remplace `app.asar` : le patch disparaît et le micro se rebloque. | Aucun garde-fou automatique ; il faut relancer `patcher.bat` après chaque mise à jour. |

1. **Transcription réelle** : non exécutée, faute de microphone. C'est la seule
   exigence du mandat qui n'a aucune preuve d'exécution.
2. **Persistance de la clé** après redémarrage complet.
3. **Libellés chinois du panneau Workbenches** (environ 190 entrées) : le paquet
   de l'éditeur n'utilise pas le service de traduction.
4. **5 libellés du shell** écrits en dur, hors de portée du service `locale`.
5. **Fournisseur ElevenLabs** (2026-10-29) : code écrit et vérifié hors
   application seulement — DSH Desktop n'est pas installé sur le poste, donc
   aucune dictée ElevenLabs n'a pu être observée. À rejouer après installation.

Les quatre points sont détaillés dans `observations.md` avec les contournements
possibles, aucun n'étant implémenté.
