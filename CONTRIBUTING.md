# Contribuer

Merci de vouloir améliorer la localisation de DeepSeek Harness.

## Ce qui est bienvenu

| Contribution | Comment |
|---|---|
| Une nouvelle langue | un dossier `locales/<code>/` complet |
| Des corrections de traduction | une modification de `locales/<code>/*.json` |
| Un correctif du moteur | une *issue* d'abord si le comportement change |
| Une amélioration des scripts | testée sur Windows PowerShell 5.1 **et** 7 |

## Ajouter une langue

1. Copiez `locales/template/` en `locales/<code>/` (`es`, `de`, `pt-BR`…).
2. Générez le squelette des clés :

   ```powershell
   node scripts/exporter-les-cles.mjs es
   ```

   Cela crée `locales/es/web.json` (clés anglaises → vides) et `locales/es/shell.json`
   (clés techniques → vides). **Remplissez `meta.json` à la main.**
3. Traduisez. Les valeurs vides sont signalées ; elles n'empêchent pas le patch.
4. Vérifiez :

   ```powershell
   npm run verify:packs
   npm test
   ```

5. Ouvrez une *pull request* **par langue**, avec le nombre de chaînes traduites.

## Règles de traduction

| Règle | Raison |
|---|---|
| Conserver chaque `{placeholder}` **à l'identique** | un `{count}` perdu s'affiche tel quel |
| Ne pas traduire les noms de modèles, paquets, commandes, chemins | ce sont des identifiants |
| Ne pas vider une chaîne web | l'interface deviendrait muette |
| Une chaîne shell vide est légitime | certains libellés entourent un nom (« Bienvenue dans » + nom) |
| Éviter les traductions automatiques non relues | une machine ne voit ni le contexte ni la longueur |
| Respecter la longueur | l'interface n'a pas de mise en page adaptative partout |

Les pluriels ne sont pas gérés par ICU : l'application substitue `{count}`. Formulez de façon
à rester correcte quel que soit le nombre (« {count} élément(s) » plutôt qu'un accord fautif).

## Code

- Node.js **ESM**, sans étape de build. Pas de dépendance nouvelle sans raison écrite.
- `src/patch.mjs` ne doit contenir **aucun code de langue en dur** : tout passe par les packs.
- Toute nouvelle ancre doit avoir un test de rupture (ancre cassée → échec propre).
- Style : 2 espaces, guillemets simples, point-virgule.

## Avant d'ouvrir une PR

```powershell
npm ci
npm run verify:packs
npm test
```

Les 19 contrôles doivent passer. Décrivez ce que vous avez vérifié **à la main** en plus
(lancement de l'application, sélecteur de langue, menus).

## Commits

`type(portée): description` — exemples : `feat(es): ajoute le pack espagnol`,
`fix(patch): conserve les fichiers unpacked`, `docs: explique le repli`.
