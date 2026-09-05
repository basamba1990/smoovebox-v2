# Homepage Spotbulle — exigences vérifiables

## Périmètre confirmé par le guide

Le Figma est la référence visuelle pour les dimensions, couleurs, typographies et positionnements. Le guide fonctionnel décrit les comportements attendus ; il ne constitue pas une autorisation d’inventer des contenus ou de remplacer des données métier par des valeurs d’exemple.

| Bloc | Données attendues | Actions attendues | Critère de vérification |
|---|---|---|---|
| Fond | Asset graphique fourni | Aucune | Le fond reste lisible sur plusieurs tailles d’écran et les bâtiments bas ne sont pas coupés par le cadrage responsive. |
| En-tête | Identité de l’utilisateur pour les éléments personnels | Logo vers la landing page, notifications, sortie/déconnexion et autres icônes prévues | Chaque élément cliquable déclenche une route ou une action existante ; aucune action silencieuse. |
| Menu inférieur | Catégories de la version de référence | Navigation vers les catégories | L’icône de la page courante est visuellement active ; la navigation fonctionne au clavier et au clic. |
| Roue | Liste réelle des catégories disponibles | Rotation horaire/antihoraire, sélection, navigation et survol contextuel | La roue n’est pas une image passive : sa rotation modifie réellement la sélection et le clic mène à la catégorie. |
| Profil | Nom/prénom, photo, badge, niveau, XP et progression réels | Édition du profil, ouverture du coffre/niveaux, hover XP | Les valeurs affichées proviennent de l’utilisateur connecté ; l’état vide est explicite si une donnée manque. |
| Radar | Quatre valeurs réelles terre/eau/air/feu | Ouverture du radar détaillé | Le polygone et les pourcentages changent selon les données persistées ; aucune dérivation arbitraire depuis une couleur. |
| Prochaine mission | Mission réellement accessible, sessions, objectif et badge | Ouverture de la mission et de la liste des missions | La carte correspond à la prochaine mission calculée et ne présente pas une mission fictive. |
| Pitch vidéo | Vidéo réellement enregistrée par l’utilisateur | Lecture et accès à la banque de pitchs | Une miniature temporaire ne doit pas être présentée comme un pitch réel ; l’absence de vidéo est signalée clairement. |
| Mon impact | Progressions individuelles des trois énergies et progression globale | Accès à la vue d’impact | Les trois barres et le cercle global sont calculés séparément à partir des données disponibles. |
| Micro-interactions | États réels de l’interface | Hover, transitions, progression animée, rotation de la roue | Les animations n’empêchent pas l’accès clavier, ne masquent pas les erreurs et restent cohérentes sur mobile. |

## Règles de données

Les données qui dépendent de l’utilisateur doivent être lues depuis les sources persistantes existantes ou depuis une nouvelle source explicitement documentée et testée. La Homepage ne doit jamais contenir de nom utilisateur, score, badge, mission, pitch, XP ou pourcentage écrit en dur pour simuler un état réel.

Lorsque la donnée n’est pas disponible, l’interface doit afficher un état vide honnête avec une action permettant de compléter ou de consulter la source correspondante. Les valeurs nulles ou absentes ne doivent pas être remplacées par des données de démonstration.

## Correspondance avec l’existant observé

| Besoin | Existant repéré | Décision d’audit |
|---|---|---|
| Missions, territoires et progression par énergie | `SpotbulleMissions.jsx`, tables `spotbulle_territories`, `user_missions`, `skills` | Réutiliser les requêtes et la logique avant de créer un nouveau modèle. |
| Compétences acquises et priorité pure/hybride | `spotbulleEngine.js`, `user_skill_progress` et Edge Function de génération | Ne pas dupliquer la règle dans la Homepage ; exposer le résultat métier réel. |
| Profil connecté | `AuthContext`, `profiles` et `profile` transmis aux pages | Utiliser les données du contexte et prévoir un état de chargement/absence. |
| Vidéos/pitchs | `video-vault.jsx`, `useVideos.js`, table `videos` | Réutiliser les URLs et états réels ; ne pas afficher l’image de référence comme contenu final. |
| Radar | Composant SVG existant mais intensités dérivées des couleurs | Vérifier la source persistante des pourcentages avant de brancher le bloc ; ne pas réutiliser tel quel si elle n’est pas réelle. |
| Navigation | `AppRoutes.jsx`, routes `/journal-mission`, `/pitch-recording`, `/lumi/profile`, `/embark` | Lier chaque CTA à une route existante ou documenter explicitement toute route à créer. |

## Inconnues bloquantes à confirmer

Le guide ne précise pas à lui seul les noms définitifs des cinq catégories du menu, la route exacte de la landing page, la source persistante des notifications, la source exacte des quatre pourcentages du radar, le calcul pondéré final de l’impact, ni la page cible de certaines catégories. Ces points doivent être confirmés par le prototype Figma accessible ou par Valentina/Estelle avant d’être codés.

## Definition of Done pour la Homepage

La Homepage est considérée comme prête uniquement lorsque les ressources sont chargées depuis des fichiers réels, que les données utilisateur proviennent de sources persistantes, que chaque interaction documentée dispose d’un flux vérifiable, que les états de chargement/erreur/vide sont traités, que le build et les tests automatisés passent, et qu’une vérification visuelle desktop/mobile a été effectuée. La branche de destination ne doit être mise à jour qu’après cette validation explicite.
