# NOTICE

## Indépendance

Ce dépôt est un projet **indépendant**. Il n'est ni édité, ni parrainé, ni approuvé par
DeepSeek. « DeepSeek » et « DeepSeek Harness » sont les marques de leurs titulaires respectifs.

## Ce qui est distribué ici

| Contenu | Nature | Licence |
|---|---|---|
| `src/`, `scripts/`, `tests/` | code original | MIT |
| `pack-desktop/outils/`, `pack-desktop/*.bat`, `pack-desktop/patch/plugins/dsh-voice-input/` | code original | MIT |
| `pack-desktop/patch/plugins/dsh-fr-locale/*.json` | chaînes traduites à partir de l'interface | MIT pour l'apport des contributeurs, dans la mesure où il peut être concédé |
| `pack-desktop/patch/plugins/dsh-theme-clear-blue/` | portage du thème `official-clear-blue` | MIT pour le portage ; le thème d'origine reste à ses auteurs |
| `locales/fr/web.json`, `locales/fr/shell.json` | chaînes traduites à partir de l'interface | MIT pour l'apport des contributeurs, dans la mesure où il peut être concédé |
| `docs/`, `README*` | documentation | MIT |

**Aucun binaire de l'application n'est distribué.** Ni `app.asar`, ni l'exécutable, ni les
fichiers extraits. Le dépôt ne contient que la logique de patch et les traductions.

## Traductions

Les clés de `web.json` sont les chaînes anglaises d'origine ; les valeurs sont des traductions
produites pour ce projet. Elles dérivent de l'interface de DeepSeek Harness, dont les droits
restent à leurs auteurs. Elles sont publiées ici pour permettre l'interopérabilité linguistique
d'une application installée localement, pas pour redistribuer l'application.

Si un ayant droit demande le retrait d'un contenu, ouvrez une *issue* : le contenu concerné sera
retiré ou remplacé.

## Ce que le patch fait à votre machine

- Il lit `resources\app.asar` de l'installation locale.
- Il écrit une **copie** temporaire, la vérifie, puis remplace l'archive.
- Il conserve une sauvegarde dans `sauvegarde/` (non versionnée).
- Il ne contacte **aucun** réseau et n'envoie aucune donnée.

## Absence de garantie

Le patch modifie un logiciel tiers installé. Une mise à jour de l'application peut le rendre
inopérant ou, dans un cas défavorable, empêcher son démarrage. Une sauvegarde est créée avant
chaque écriture et la restauration est fournie. Vous restez responsable de l'usage.
