# Comment ça marche

## L'archive

`app.asar` est une archive Electron : un en-tête (taille + JSON de l'arborescence) suivi des
contenus bout à bout. Chaque entrée porte un `offset`, une `size`, parfois une `integrity`.

Le patch **ne remplace pas** l'archive. Il la relit et n'écrit que trois fichiers internes :

| Fichier | Rôle |
|---|---|
| `dsh\node_modules\@deepseek-ai\dsh-client-locale\lib\client.js` | catalogue des locales, dictionnaires web, résolution des textes |
| `dsh\node_modules\@deepseek-ai\dsh-client-ui-model-selection\lib\client.js` | libellés des niveaux de raisonnement |
| `lib\main.js` | dictionnaires du shell Electron, locale de repli |

Tous les autres fichiers sont recopiés **à l'identique**. Les entrées `unpacked` et les liens
sont laissés tels quels : leurs octets ne vivent pas dans l'archive.

## Les ancres

Le moteur ne reconnaît pas une empreinte d'archive : il cherche des **extraits de code exacts**.
Si l'un manque, il s'arrête **avant** d'écrire quoi que ce soit.

| Ancre | Ce qu'elle permet |
|---|---|
| `const LOCALE_IDS = [...]` | ajouter le code au catalogue |
| `en: { label: "English" }` | ajouter le libellé du sélecteur |
| `this.provisional = resolveInitialLocale(...)` | choisir la locale proposée par défaut |
| `var LocaleRuntime = class {` | injecter le dictionnaire et son helper |
| `resolveText(text) { ... }` | traduire les chaînes simples **et** les objets localisés |
| `const template = this.lookup(...)` | traduire après la résolution de repli |
| `this.snapshot = Object.freeze({...})` | publier la locale active (`globalThis`) |
| `//#region` (sélecteur de modèle) | injecter la table d'effort |
| `resolveDesktopLocale(locale)` | router le shell vers le bon dictionnaire |

C'est ce qui rend le patch **plus durable** qu'un remplacement d'archive : il dépend du
*mécanisme de localisation*, pas d'une version figée. Et c'est ce qui le rend vulnérable à une
refonte de ce mécanisme : dans ce cas, il échoue proprement.

## Le déroulement

```text
--status  → original | delta | delta-other | legacy-fr | unknown
   │
   ├─ original / unknown : on continue (unknown = avertissement)
   ├─ delta              : rien à faire
   └─ delta-other / legacy-fr : refus, restaurer d'abord
   │
copie de sauvegarde → patch d'une copie → vérification → remplacement
```

1. Le script PowerShell sauvegarde l'archive (`sauvegarde/app.asar.avant-patch-<date>`).
2. Le moteur écrit le résultat dans un fichier temporaire, jamais dans l'archive.
3. Il vérifie le temporaire ; en cas d'échec, l'archive d'origine est intacte.
4. Seulement alors, le temporaire remplace l'archive.
5. Une seconde vérification tourne sur l'archive en place ; si elle échoue, la sauvegarde est
   recopiée.

## À l'exécution

```text
locale active ──▶ resolveText / translate ──▶ __dshLocalize ──▶ pack[active] ──▶ texte
                                                │
                                                └─ pas de pack : texte inchangé
```

- `globalThis.__DSH_ACTIVE_LOCALE__` est publié à la construction et à chaque changement.
- `__dshLocalize` ne touche à rien si la locale active n'a pas de pack : **l'anglais et le
  chinois gardent leur comportement d'origine**.
- Le code régional est ramené au code primaire (`fr-CA` → `fr`).
- Le shell reçoit un dictionnaire par pack ; `zh` et `en` restent les dictionnaires intégrés.

## Vérification

`--verify` relit les trois fichiers **dans l'archive** et contrôle :

- tous les codes de packs présents dans `LOCALE_IDS` ;
- les packs injectés et le helper de localisation ;
- `en: { label: "English" }` et `label: "中文"` toujours présents ;
- la table d'effort et son helper ;
- les dictionnaires du shell et les `messages: en` / `messages: zh` ;
- si `--default` est fourni : la locale par défaut dans les deux fichiers concernés.

Le code de sortie est `0` si tout est vrai, `1` sinon. Un test qui ne peut pas échouer ne
prouve rien : chaque ancre a son test de rupture dans `tests/run.mjs`.
