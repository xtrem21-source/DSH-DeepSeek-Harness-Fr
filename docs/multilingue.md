# Conception multi-langue

Le dépôt s'appelle `deepseek-harness-fr` parce que le français est le pack livré. **Le moteur,
lui, ignore le français** : il ne connaît que des codes de langue et des dictionnaires.

## Le contrat d'un pack

```text
locales/<code>/
  meta.json    code, label, fallback, direction, effort
  web.json     "<texte anglais>" → "<traduction>"
  shell.json   "<clé technique>" → "<traduction>"
```

| Champ | Type | Rôle |
|---|---|---|
| `code` | `fr`, `es`, `pt-BR` | code primaire BCP-47 ; `en` et `zh` sont refusés (fournis par l'app) |
| `label` | texte | nom affiché dans le sélecteur |
| `fallback` | code | langue de repli si une clé manque |
| `direction` | `ltr` / `rtl` | déclaratif (voir RTL ci-dessous) |
| `effort` | objet | libellés des niveaux de raisonnement (`High`, `Medium`, …) |

## Pourquoi deux dictionnaires

| Fichier | Clé | Raison |
|---|---|---|
| `web.json` | texte anglais | l'interface appelle `translate("ns", "clé")` ; le moteur applique la traduction **après** la résolution, sur le texte rendu |
| `shell.json` | clé technique | le shell Electron utilise des clés (`cliCommandMenu`) dont le texte anglais vit dans `main.js` |

Conséquence pratique : dans `web.json`, la **clé est le texte source**. On peut donc traduire
sans connaître les identifiants internes, et la parité des placeholders est vérifiable.
Dans `shell.json`, la clé est opaque : la parité des placeholders ne peut pas être déduite et
doit être vérifiée à l'œil, dans l'application.

## Repli

L'application résout déjà sa chaîne de repli (`locale → fallback → en`). Le patch intervient
**après** : `__dshLocalize(resolved)`. Une clé absente du pack affiche donc le texte d'origine,
jamais une chaîne vide.

## Plusieurs langues dans une archive

```powershell
node src/patch.mjs --app app.asar --out copie.asar --locales fr,es --default es
```

- chaque code est ajouté à `LOCALE_IDS` et au sélecteur ;
- chaque pack reçoit son dictionnaire web, shell et effort ;
- la locale active choisit son pack, les autres restent dormants ;
- `--default` désigne celle proposée au premier lancement.

Une seule liste de locales par archive : pour la changer, restaurez l'original et repatchez.
C'est volontaire — réécrire par-dessus un patch existant rendrait les états ambigus.

## Placeholders

Les `{placeholders}` sont substitués par l'application. Un placeholder perdu s'affiche
littéralement (`{count}` au lieu de `3`). `npm run verify:packs` compare la liste triée des
placeholders de la clé et de la valeur, et refuse toute différence.

## Pluriels

Pas d'ICU : l'application substitue `{count}` et rien de plus. Une traduction doit rester
correcte pour toutes les valeurs. Préférez une formulation neutre (« {count} élément(s) ») à un
accord qui ne vaut que pour le singulier.

## Variantes régionales

Le moteur ramène `fr-CA` à `fr` pour choisir le pack. En pratique, utilisez le **code primaire**
comme nom de dossier (`fr`, `pt`, `zh` refusé) et gardez les variantes dans les traductions.
Un pack `pt-BR` fonctionnerait, mais ne serait choisi que si la locale active est exactement
`pt-BR`.

## RTL — ce qui marche, ce qui ne marche pas

| Aspect | État |
|---|---|
| Chaînes traduites | **oui**, comme n'importe quelle langue |
| `meta.direction: "rtl"` | **déclaratif** : validé, documenté, non appliqué |
| Sens de la mise en page | **non** : le patch ne pose pas `dir="rtl"` sur le document |
| Miroir des icônes, marges, animations | **non** |

Traduire en arabe ou en hébreu donnera du texte juste dans une mise en page LTR. Un support
complet demanderait de modifier les feuilles de style et la racine du document — un autre
chantier, hors du périmètre « delta de chaînes ».

## Chaînes non traduisibles par ce mécanisme

- Réponses du modèle, contenu saisi.
- Textes fournis par le serveur (certains libellés de fournisseurs).
- Noms de modèles, paquets, commandes, chemins.
- Libellés d'accessibilité codés en dur dans les composants.

## Vérifier un pack

```powershell
npm run verify:packs                              # schéma + placeholders
node src/patch.mjs --list                         # inventaire et erreurs
node src/patch.mjs --app app.asar --out c.asar --locales es --default es
node src/patch.mjs --verify c.asar --locales es --default es
```

Le test de bout en bout (`npm test`) fabrique une archive factice, patche `fr` puis `fr,es`,
et vérifie qu'une ancre cassée échoue sans rien écrire.
