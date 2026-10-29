# Journal des versions

## 1.1.0 — 2026-10-29

**Seconde méthode : pack du profil (`pack-desktop/`).**

- Interface française complète : 47 namespaces (2 098 chaînes), 454 corrections hors service de
  traduction, 28 règles par motif. L'anglais du shell (menu du compte, modes d'accès, sections
  Compte et Modèles, préréglages d'agent) et les descriptions des extensions intégrées sont
  couverts.
- Micro : bouton à droite de la flèche d'envoi, monté dans l'emplacement React
  `conversation.input.activity` — il survit donc aux envois de message. Panneau de réglages au
  clic droit, Gemini ou ElevenLabs.
- Thème Clear Blue (palette sombre bleutée, porté de `official-clear-blue`).
- `patcher.bat` sans argument : détection par argument, dossiers connus, chaque disque monté et
  registre de désinstallation ; fermeture des deux noms de processus ; sauvegarde et manifeste
  SHA-256 ; idempotence ; vérification des marqueurs.
- Archive prête à extraire : `DSH-Desktop-Patch-FR-windows-x64-1.0.0.zip`.
- Testé sur **DeepSeek Harness 0.2.1-rc.3**. Le pack est prévu pour continuer à fonctionner après
  une mise à jour de l'application, **sans garantie**.

## 1.0.0 — 2026-10-17

**Première version publiable.**

- Moteur `src/patch.mjs` **multi-langue** : `--locales`, `--locale-dir`, `--default`.
  Aucun code de langue n'est câblé dans la logique ; `fr` n'est qu'un pack.
- Packs : `locales/fr/` (2 155 chaînes web, 165 clés shell, 5 libellés d'effort) et
  `locales/template/` (gabarit vide documenté).
- Validation `src/packs.mjs` : code, libellé, direction, parité des `{placeholders}`.
- Patch de 3 fichiers internes, sans remplacer l'archive ; `unpacked` et intégrité conservés.
- Vérification générique : catalogue complet, packs injectés, anglais et chinois conservés,
  shell, locale par défaut.
- Scripts Windows généralisés : `Appliquer-le-patch`, `Restaurer-l-original`, `Verifier-l-etat`.
- Tests de bout en bout : 19 contrôles, dont rupture d'ancre, deux locales dans une archive et
  détection de l'ancien patch `__DSH_FR`.
- Documentation : mécanisme, multi-langue, ajout d'une langue, sécurité et légal, dépannage.

### Repris de la version précédente (non publiée)

- Patch delta français initial : mêmes trois fichiers, dictionnaire `__DSH_FR`.
- Ancienne version « archive complète » : **non reprise**, elle masquait les autres langues.
