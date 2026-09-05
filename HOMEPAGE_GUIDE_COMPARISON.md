# Comparaison Homepage Spotbulle — état après corrections

## Références de travail

Le fichier Figma reste la référence visuelle principale, mais il n’est pas actuellement accessible en lecture depuis l’environnement de développement. Le **guide Word** est donc le contrat fonctionnel actif, et l’archive ZIP fournit les assets visuels réellement disponibles. Cette combinaison permet une implémentation honnête et testable, mais elle ne permet pas de déclarer une fidélité pixel-perfect au Figma sans export ou accès public.

## Éléments du guide maintenant couverts

| Exigence | État après correction |
|---|---|
| Fond responsive | Asset fourni utilisé avec adaptation responsive. À confirmer visuellement sur appareils réels. |
| Logo vers la landing page | Clic branché vers `/` dans une nouvelle fenêtre. |
| Déconnexion | Clic branché sur `onSignOut`. |
| Menu inférieur | Les cinq catégories naviguent vers les routes existantes et l’état actif suit désormais la route courante. |
| Rotation de la roue | Les flèches, les touches directionnelles et le glisser horizontal permettent de parcourir les catégories ; un geste de rotation ne déclenche pas une navigation accidentelle. |
| Catégorie sélectionnée | La catégorie courante est affichée et son libellé est identifiable. |
| Hover/focus de la roue | Un panneau contextuel Lumi apparaît au survol de la zone et le bouton reste utilisable au clavier. |
| Notifications | L’icône ouvre un panneau et affiche un compteur non lu lorsque la table `notifications` retourne des données. |
| Profil connecté | Nom, prénom, photo et édition utilisent les données utilisateur disponibles. |
| Badge profil | Le badge est recherché dans `user_spotbulle_badges` et `spotbulle_badges`; aucune image statique n’est présentée comme badge utilisateur si aucune donnée n’existe. |
| Niveau, titre et XP | Les champs directs du profil sont utilisés ; à défaut, les définitions de niveau `spotbulle_badges` de type `level` peuvent déterminer le niveau et l’XP à partir des missions pures. |
| Hover XP | Un titre contextuel indique la progression vers le niveau suivant lorsque la donnée existe, sinon signale explicitement son indisponibilité. |
| Coffre stellaire / niveau | Le clic est branché vers `/lumi/profile`, route existante de profil. |
| Prochaine mission | La sélection parcourt les territoires dans leur ordre, exige d’abord le quota de missions pures du territoire courant, puis autorise une hybride seulement après ce quota. |
| Nombre de sessions | Le composant lit `sessions_count`, `session_count`, `number_of_sessions` ou un tableau `sessions`; il affiche une indisponibilité explicite si aucun champ n’est présent. |
| Pitch réellement enregistré | Un pitch n’est sélectionné que s’il possède une URL jouable. Pour un `file_path` ou `storage_path` sans URL, une URL signée du bucket existant `videos` est demandée. |
| Progressions individuelles | Trois lignes fixes `Energie1`, `Energie2`, `Energie3` sont présentées ; une énergie sans données affiche `Indisponible`, pas une valeur zéro inventée. |
| Progression globale pondérée | La valeur globale n’est affichée que si chaque énergie disponible possède un poids positif (`impact_weight`, `energy_weight`, `weight` ou poids profil). Sinon le composant indique que la pondération est indisponible. |
| Micro-interactions | Rotation, transition de barres, focus/hover et respect de `prefers-reduced-motion` sont présents. |

## Éléments qui manquent encore réellement

| Exigence du guide Word | Pourquoi elle reste incomplète | Action nécessaire |
|---|---|---|
| Notifications entièrement persistantes | L’interface lit `notifications`, mais le dépôt audité ne fournit pas de contrat confirmé ni de producteur de notifications. Si la table n’existe pas, l’interface affiche un état d’indisponibilité. | Confirmer la table, ses colonnes, les politiques RLS et les événements qui créent une notification. |
| Vue détaillée du radar | Le bouton est encore relié à `/update-disc`, qui sert à mettre à jour le questionnaire ; le guide demande une vue détaillée avec résultats et description. | Confirmer ou créer la route de détail du radar et son contrat de données. |
| Banque de badges complète | Le dernier badge attribué est lu, mais la sélection et l’affichage d’une banque de badges ne sont pas proposés sur la Homepage. | Confirmer la route ou le composant Coffre stellaire et le modèle de sélection utilisateur. |
| Banque de pitchs depuis la Homepage | Le bouton ouvre `/video-vault`, mais la Homepage ne propose pas la sélection entre plusieurs pitchs. | Valider que `video-vault` est la page dédiée officielle ou ajouter un sélecteur. |
| Lien « Voir mon impact » dédié | La section affiche l’impact, mais le guide prévoit une action vers la vue correspondante si elle existe ; aucune route impact dédiée n’a été confirmée. | Confirmer la route cible ou maintenir explicitement la section comme vue unique MVP. |
| Progression globale pondérée garantie | Le code refuse d’inventer une pondération, mais le poids métier officiel n’est pas confirmé dans le modèle audité. | Fournir les poids officiels par énergie ou les persister dans le profil/configuration. |
| Titre de niveau garanti | Le code peut le dériver des définitions `spotbulle_badges`, mais il dépend de données de type `level` réellement présentes. | Vérifier les définitions de niveau en base et leurs seuils. |
| Exactitude visuelle Figma | Le Figma n’est pas accessible en lecture ; les dimensions, typographies et états visuels ne peuvent pas être validés pixel-perfect. | Donner un lien public de lecture ou un export PDF/PNG des écrans et états. |
| Transitions de navigation | Le guide laisse ce point à définir dans l’implémentation finale ; aucune transition de route spécifique n’est spécifiée dans les sources disponibles. | Choisir un comportement après validation UX, sans le simuler comme déjà validé. |

## Conclusion truly-operational

Après correction, les interactions principales et les branchements de données sont plus proches d’un MVP opérationnel : la roue est manipulable, Lumi réagit au survol, les notifications ont un panneau, les badges et niveaux ne sont plus représentés par des données statiques par défaut, la mission est strictement filtrée, les sessions sont lues lorsqu’elles existent, les vidéos stockées peuvent être résolues par URL signée, et l’impact global ne prétend plus être pondéré lorsque les poids manquent.

La version ne doit toutefois pas être présentée comme totalement finalisée tant que les contrats `notifications`, niveaux, poids d’impact et vue détaillée du radar ne sont pas confirmés dans Supabase, et tant que le rendu n’est pas comparé à un Figma accessible. Les états « indisponible » sont intentionnels : ils protègent contre les fausses données et rendent visibles les dépendances restantes.

## Vérification anti-placeholder de la roue et de l’impact

Les constantes `WHEEL_ITEMS`, `ENERGY_ORDER` et `ENERGY_COLORS` sont des constantes de configuration/design : elles ne représentent pas des données utilisateur et sont cohérentes avec la structure explicitement demandée par le guide. La rotation de 72 degrés est une constante géométrique de parcours de cinq catégories, pas une progression métier.

La roue ne fabrique pas de catégorie depuis une donnée absente : elle parcourt la liste de base définie dans le prototype, affiche le libellé et le message Lumi associés, puis navigue vers la route configurée. Les valeurs utilisateur ne sont pas utilisées pour inventer la sélection.

Le calcul d’impact ne remplit plus une énergie absente avec zéro et ne calcule plus une moyenne partielle. Il ne produit une progression globale que lorsque les trois énergies ont une progression réelle et un poids strictement positif provenant du profil ou d’une compétence chargée depuis la base. Une mission sans type explicite est ignorée pour le calcul et ne peut plus être classée implicitement comme mission pure.

Les textes tels que `Indisponible`, `Nom non renseigné`, `Objectif non renseigné` et `Pondération globale indisponible` sont des états d’absence de donnée explicites ; ils ne prétendent pas être des valeurs métier. Les seuls points à surveiller restent la confirmation des contrats Supabase et le fait que la liste actuelle de catégories est une configuration statique du prototype, appelée à évoluer avec la validation UX.
