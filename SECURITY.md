# Sécurité

## Signaler une vulnérabilité

N'ouvrez **pas** d'*issue* publique. Utilisez l'onglet **Security → Report a vulnerability**
(avis de sécurité privé) du dépôt GitHub. Décrivez :

- la version de DeepSeek Harness et de Windows ;
- la commande ou le script exécuté ;
- ce qui se produit, et ce que vous attendiez ;
- si possible, la sortie de `node src/patch.mjs --status <archive>`.

## Surface réelle

| Élément | Risque |
|---|---|
| Lecture et réécriture de `app.asar` | une archive malformée peut corrompre l'installation ; une sauvegarde est prise avant chaque écriture |
| Reconstruction de l'en-tête asar | le code s'appuie sur les modules internes d'`@electron/asar` ; une montée de version majeure peut casser le patch |
| Exécution de `node` | le patch exécute du JavaScript local ; aucun code de l'application n'est exécuté |
| Réseau | **aucun** appel réseau, aucune télémétrie |
| Traductions | du texte injecté dans l'interface ; les valeurs proviennent des packs du dépôt, pas d'un serveur |

## Ce que le dépôt ne fait pas

- Il ne distribue ni l'application, ni son archive, ni ses fichiers extraits.
- Il ne contourne aucune protection, ne modifie aucune licence, ne touche pas aux mises à jour.
- Il n'écrit pas hors de `resources\app.asar` et de `sauvegarde/`.

## Versions prises en charge

La branche `main` uniquement. Les versions antérieures à 1.0.0 ne sont pas maintenues.

## Bonnes pratiques

1. Fermez l'application avant tout patch ou restauration.
2. Gardez `sauvegarde/app.asar.original`.
3. Vérifiez après application : `scripts\Verifier-l-etat.cmd`.
4. Après une mise à jour de l'application, vérifiez l'état avant de réappliquer.
