# Notes de comparaison maquette / preview

## Maquette fournie par Valentina

La maquette présente une Homepage desktop/mobile centrée sur une identité visuelle sombre bleu-vert, avec un header Spotbulle, une carte profil Luma, un radar de personnalité, une roue latérale de navigation autour de Lumi, une carte « Prochaine mission », une carte « Mon pitch vidéo », une carte « Mon impact » et une navigation inférieure.

Les libellés visibles incluent notamment « Mon profil », « Prochaine mission », « Mon impact », « Mon pitch vidéo », « Voir mes missions », « Voir mon impact » et une progression d’impact globale illustrée autour de 76 %. La maquette utilise un profil illustré, des badges, un niveau, une barre XP, des éléments décoratifs lumineux et une hiérarchie de cartes fortement intégrée au fond graphique.

## Preview testé le 8 septembre 2026

Le lien Shareable Vercel fourni redirige vers `/login`, y compris lorsque `/spotbulle-home` est demandé directement avec le paramètre `_vercel_share`. La page affiche « Hors ligne », « Connexion », le formulaire e-mail/mot de passe et « Se connecter ». Aucun rendu de la Homepage n’a donc été observable dans le preview sans session applicative.

## Limite de comparaison

La comparaison visuelle directe maquette-versus-rendu déployé reste impossible dans cette session, car le Shareable Link contourne la protection Vercel mais pas l’authentification Spotbulle. La comparaison source-versus-maquette peut néanmoins relever les écarts connus : la Homepage code une roue centrale dans une carte, un profil, un radar, une mission, un pitch et un impact, mais l’onglet Impact pointe encore vers `/journal-mission`, le bouton « Voir mon impact » de la maquette n’est pas reproduit comme destination dédiée, le radar ouvre `/update-disc`, et le compte test observé est vide/incomplet.

## Écarts visuels et fonctionnels identifiables depuis la maquette

| Zone | Maquette | Code actuel | Verdict |
|---|---|---|---|
| Navigation inférieure | Accueil, Défis, bouton central fusée/Spotbulle, Messages, Profil | Accueil, Missions, Pitch, Impact, Profil | Écart majeur de structure et de vocabulaire ; les cinq destinations ne correspondent pas. |
| Roue Lumi | Menu circulaire latéral autour de Lumi, avec plusieurs secteurs et un centre blanc | Carte « Votre parcours » avec une roue centrale de 154 px, flèches gauche/droite et libellé superposé | Fonction interactive présente, mais composition et emplacement ne sont pas fidèles à la maquette. |
| Header | Logo Spotbulle, cloche, avatar/initiale et sortie | Logo, cloche et sortie ; pas d’avatar/initiale dans le header | Élément visuel manquant. |
| Bloc profil | Avatar, badge, niveau, XP et radar réunis dans une même carte supérieure | Profil et niveau dans une carte ; radar dans une carte séparée | Les données sont partiellement présentes, mais la hiérarchie de la maquette n’est pas reproduite. |
| Prochaine mission | Statut, titre complet, « 3 séances », consignes d’action, difficulté, récompense et bouton « Voir les missions » | Type, titre selon les champs disponibles, nombre de sessions si présent, objectif, deux liens ; pas de rendu explicite de difficulté/récompense dans le composant | Fonction partielle ; les éléments absents ne doivent pas être inventés sans colonnes confirmées. |
| Pitch vidéo | Carte vidéo avec durée, texte d’introduction et bouton « Voir mon pitch » | Lecteur vidéo réel si URL disponible, titre et lien `/video-vault`, état vide sinon | Logique opérationnelle mais copie et composition différentes. |
| Impact | Texte contextuel, anneau global 76 %, compétences entraînées et bouton « Voir mon impact » | Trois énergies génériques, barres si données, anneau seulement si poids réels, pas de route Impact dédiée | Écart majeur ; le code est plus strict sur les données mais ne reproduit pas la fonctionnalité complète de la maquette. |
| Radar | Radar intégré au bloc profil et valeurs visibles | Radar séparé, ou état indisponible si cinq valeurs normalisées non trouvées | Écart de placement et de contrat de données. |
| Identité visuelle | Fond sombre texturé, halos et cartes vitrées très proches du prototype | Fond/assets dédiés et cartes vitrées, mais proportions et composition propres au code | Direction visuelle cohérente, fidélité pixel-perfect non démontrée. |

## Verdict

La version actuelle est cohérente au niveau de l’intention produit : elle contient les blocs profil, parcours, mission, radar, pitch et impact, et elle refuse de fabriquer les valeurs absentes. Elle n’est toutefois pas cohérente avec la maquette au niveau du layout, de la navigation et de plusieurs contenus métier. Le point le plus visible est la navigation inférieure et le menu Lumi, suivis par l’impact et le regroupement profil/radar.

Le preview Shareable testé reste bloqué sur `/login` avec l’état « Hors ligne », de sorte qu’aucune conclusion de rendu déployé ne doit être présentée comme une observation d’exécution. Les constats ci-dessus sont une comparaison de la maquette image avec le code source et le comportement de redirection observé.
