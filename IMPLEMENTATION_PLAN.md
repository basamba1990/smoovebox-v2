# Plan de travail contrôlé — Homepage Spotbulle

## Principe de sécurité

Le travail est effectué sur `work/spotbulle-homepage`, créée depuis `origin/feature/spotbulle-motor`. La branche distante ne sera pas modifiée avant validation explicite du rendu, des tests et du périmètre. Les fichiers d’audit et de critères sont conservés dans le dépôt pour rendre les décisions traçables.

## Étape A — Cartographie des données

Avant de construire l’interface, chaque bloc sera associé à une requête ou à un service existant. Si une donnée n’a pas de source persistante confirmée, le bloc sera soit relié à une route existante qui la fournit, soit rendu avec un état indisponible explicite. Aucun fallback de démonstration ne sera ajouté.

## Étape B — Shell visuel réutilisable

La Homepage sera ajoutée comme une composition dédiée, sans casser `SimplifiedHome`, `/old`, `/classic` ni les routes déjà présentes. Les assets du ZIP seront copiés avec des noms sûrs et documentés. Les éléments de navigation seront des composants réutilisables et accessibles, afin que les changements de catégories restent localisés.

## Étape C — Données réelles et états d’interface

Les sections profil, missions, pitch et impact consommeront les données réelles disponibles. Chaque section traitera séparément le chargement, l’erreur, l’absence de donnée et le succès. Les textes dynamiques seront dérivés des données retournées ; aucune valeur illustrative ne sera présentée comme réelle.

## Étape D — Interactions

La roue sera implémentée comme un contrôle interactif avec une sélection d’état, une rotation contrôlée et une navigation associée. Le menu inférieur gérera l’état actif. Les hovers seront complétés par des équivalents clavier ou focus lorsque cela concerne une information essentielle. Les animations resteront secondaires et désactivables via les préférences de mouvement réduit.

## Étape E — Validation technique

Le projet ne contient actuellement aucun script de test automatisé. Avant de livrer, un socle Vitest ciblé sera ajouté pour les fonctions de transformation de données et les règles de sélection. Les commandes `lint`, `test` et `build` seront exécutées. Une vérification visuelle desktop/mobile sera effectuée sur le parcours de Homepage et les routes touchées.

## Étape F — Validation humaine et livraison

Un rapport de validation indiquera les fonctionnalités réellement opérationnelles, les éléments encore bloqués par l’absence de spécification ou de donnée, les commandes exécutées et les captures de vérification. Après accord explicite, les changements seront commités puis poussés vers `feature/spotbulle-motor`. En cas de désaccord, la branche distante restera intacte.

## Points à confirmer avant la phase finale

Les noms et routes définitifs des catégories, la page cible du logo, la source exacte des quatre valeurs du radar, le calcul pondéré de l’impact, la source des notifications et les comportements précis qui ne figurent que dans le prototype Figma doivent être confirmés si le fichier Figma reste inaccessible en lecture publique.
