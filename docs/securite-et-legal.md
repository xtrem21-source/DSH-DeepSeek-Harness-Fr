# Sécurité et cadre légal

## Ce que le patch écrit

| Chemin | Quand | Contenu |
|---|---|---|
| `<installation>\resources\app.asar` | après vérification | archive patchée (3 fichiers internes) |
| `sauvegarde\app.asar.avant-patch-<date>` | avant toute écriture | copie de l'archive d'origine |
| `sauvegarde\app.asar.original` | au premier patch d'une archive d'origine | référence stable de restauration |
| `%TEMP%\dsh-locale-<guid>.asar` | pendant l'opération | fichier de travail, supprimé ensuite |

Rien d'autre. Aucun registre, aucune variable d'environnement, aucun fichier de configuration.

## Ce que le patch ne fait pas

- Aucun appel réseau : ni mise à jour, ni télémétrie, ni vérification de licence.
- Aucun contournement de protection, de signature ou de licence.
- Aucune modification de l'exécutable, des ressources `unpacked` ou des fichiers voisins.
- Aucune élévation de privilèges : si l'installation est dans `Program Files`, l'écriture échoue
  proprement et l'archive reste intacte.

## Sauvegarde et retour

Avant de remplacer l'archive, le script en copie les octets. Le chemin de retour est **nommé** :

```text
scripts\Restaurer-l-original.cmd
  → sauvegarde\app.asar.original s'il existe
  → sinon la sauvegarde datée la plus récente
```

Une restauration manuelle reste possible : recopiez le fichier de `sauvegarde\` sur
`resources\app.asar`, application fermée.

## Cadre légal

| Question | Réponse |
|---|---|
| Le dépôt distribue-t-il l'application ? | **Non.** Ni archive, ni exécutable, ni fichiers extraits. |
| Que distribue-t-il ? | Le code du patch et des traductions. |
| Est-ce de l'interopérabilité ? | Le patch adapte l'affichage d'une application installée, localement, pour son utilisateur. |
| Est-ce un contournement ? | Non : aucune protection technique n'est visée. |
| Les traductions ? | Elles dérivent de l'interface ; leurs droits restent à leurs auteurs. Voir `NOTICE.md`. |
| Les marques ? | « DeepSeek », « DeepSeek Harness » appartiennent à leurs titulaires ; le projet est indépendant. |

En cas de demande d'un ayant droit, le contenu concerné sera retiré ou remplacé.

## Risques réels

| Risque | Mesure |
|---|---|
| Une mise à jour de l'application déplace les ancres | le patch s'arrête avant d'écrire |
| Une archive malformée | écriture dans un temporaire, vérification, remplacement seulement après succès |
| Une coupure pendant l'écriture | la sauvegarde est recopiée par le bloc `catch` |
| Une dépendance compromise | une seule dépendance d'exécution, `@electron/asar`, version figée |
| Un pack mal traduit | validation des schémas et des placeholders en CI |

## Vos responsabilités

- N'utilisez le patch que sur une installation que vous êtes autorisé à modifier.
- Fermez l'application avant toute opération.
- Conservez `sauvegarde/` : c'est votre seul retour immédiat.
- Signalez les problèmes de sécurité en privé (voir `SECURITY.md`), pas en issue publique.
