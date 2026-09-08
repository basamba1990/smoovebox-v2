# Audit source — `/spotbulle-home`

## Périmètre

Audit statique de la branche `feature/spotbulle-motor`, du routeur `src/routes/AppRoutes.jsx`, du composant `src/pages/SpotbulleHomepage.jsx`, du module `src/lib/spotbulleHomepageData.js` et du schéma Supabase accessible pour le projet `nyxtckjfaajhacboxojd`. Aucun mot de passe ni PAT n’est utilisé.

## Incohérences critiques

| Gravité | Constat | Preuve | Conséquence |
|---|---|---|---|
| Critique | La Homepage interroge `notifications`, mais aucune table `notifications` n’existe dans le schéma inspecté. La table existante est `admin_notifications`, dont les colonnes ne permettent pas directement de filtrer un utilisateur. | `SpotbulleHomepage.jsx:137`; schéma Supabase | La bannière « Certaines données ne sont pas disponibles : notifications. » apparaît systématiquement. Le panneau affiche ensuite « Aucune notification disponible », ce qui contredit la bannière. |
| Critique | Le profil persistant contient `current_xp` et `next_level_xp`, mais `levelPresentation()` ne lit ni l’un ni l’autre. Il lit `xp`, `experience` ou `xp_percentage`, qui ne figurent pas dans `public.profiles`. | `SpotbulleHomepage.jsx:192,264-268`; `spotbulleHomepageData.js:101-106`; schéma `profiles` | Un profil peut avoir un niveau et une progression réels en base, mais l’interface affiche « Progression indisponible ». |
| Critique | Le code tente de calculer l’impact pondéré avec `profile.energy_weights` ou `profile.impact_weights`, mais ces colonnes ne figurent pas dans `public.profiles`. Les compétences ont `pure_score`, mais pas `impact_weight`, `energy_weight` ou `weight`. | `SpotbulleHomepage.jsx:187`; `spotbulleHomepageData.js:56-86`; schéma `profiles` et `skills` | Le calcul pondéré ne peut pas produire une progression globale métier réelle avec le schéma actuel. L’affichage indisponible est honnête, mais la fonctionnalité n’est pas opérationnelle. |

## Incohérences fonctionnelles importantes

| Gravité | Constat | Conséquence |
|---|---|---|
| Haute | L’onglet de navigation « Impact » pointe vers `/journal-mission`, la même route que « Missions ». | Cliquer sur Impact n’ouvre pas une vue d’impact dédiée. |
| Haute | Le bouton logo ouvre `/` dans un nouvel onglet au lieu de conserver le contexte Homepage ou d’ouvrir une landing explicitement confirmée. | L’utilisateur peut croire que la Homepage Spotbulle a disparu alors qu’il vient d’être envoyé vers l’ancienne route. |
| Haute | Le radar attend cinq champs `air`, `eau`, `feu`, `terre`, `equilibre`. `questionnaire_responses` contient surtout `disc_color`, `challenge_approach`, `preferred_activities`, `current_talent`, etc. `lumi_profiles` contient `disc_scores` en JSON, mais le normaliseur ne lit pas ce JSON. | Le radar reste indisponible même lorsqu’une réponse questionnaire ou un profil Lumi existe. |
| Moyenne | La vidéo est résolue seulement depuis `video_url`, `public_url`, `file_path` ou `storage_path`. La table `videos` possède aussi `url` et `storage_bucket`, qui ne sont pas utilisés. | Une vidéo stockée peut exister sans être lisible dans la Homepage si son chemin est exposé sous une autre colonne. |
| Moyenne | Le badge affiché est le dernier badge attribué, mais aucune vue de banque de badges n’est ouverte depuis le bouton « Coffre stellaire ». | Le guide peut attendre une banque ou une sélection de badges, alors que la Homepage ne fait qu’afficher un badge. |
| Moyenne | Le bouton « Mon radar en détails » navigue vers `/update-disc`, qui correspond à la mise à jour du questionnaire, pas à une vue radar dédiée. | Le libellé et la destination ne décrivent pas la même action. |

## Placeholders et fallbacks observés

Les chaînes `Niveau indisponible`, `Titre indisponible`, `Progression indisponible`, `Nom non renseigné`, `Objectif non renseigné`, `Nombre de sessions non renseigné`, `Donnée non renseignée` et `Pondération globale indisponible` sont des états d’absence de données explicites. Elles ne fabriquent pas de valeurs métier, mais elles restent visibles dans un parcours incomplet.

En revanche, `Notification` et `Contenu non renseigné` sont des fallbacks de contenu dans le panneau de notifications. Ils ne sont pas des données fictives, mais ils peuvent donner l’impression qu’une notification existe alors que ses champs sont absents. Le panneau devrait afficher un état de données incomplet distinct.

Les constantes `WHEEL_ITEMS`, `ENERGY_COLORS` et les messages Lumi sont des configurations de design acceptables pour le MVP. Elles ne sont pas des données utilisateur et ne doivent pas être confondues avec des placeholders.

## État observé du compte de test existant

Le compte `basamba1990@yahoo.fr` existe et est confirmé dans Supabase. Son profil `public.profiles` existe avec `onboarding_completed = false`, `global_progress = 0`, `level_name = Explorateur`, `current_xp = 0` et `next_level_xp = 100`. Il possède des missions Spotbulle, mais son parcours n’est pas complété. Ce compte est donc adapté pour tester les états vides et les blocages de récupération, pas pour représenter un utilisateur ayant déjà acquis toutes ses compétences.

## Conclusion

La route et les composants principaux existent, les routes appelées par la roue sont présentes et les constantes visuelles ne constituent pas des faux résultats. Toutefois, trois problèmes empêchent de considérer la Homepage comme entièrement opérationnelle : le contrat inexistant des notifications, le mapping incomplet de l’XP persistée et l’absence de poids persistés nécessaires à l’impact global. Le radar et l’impact doivent être raccordés à des contrats de données confirmés avant toute présentation comme fonctionnalité terminée.
