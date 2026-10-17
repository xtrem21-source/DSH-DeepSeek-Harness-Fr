# Journal des versions

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
