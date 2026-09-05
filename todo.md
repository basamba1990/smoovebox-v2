# Project TODO — Homepage Spotbulle

- [x] Cloner le dépôt et inspecter la branche `feature/spotbulle-motor`
- [x] Extraire les ressources graphiques fournies
- [x] Lire le guide Word des interactions et comportements dynamiques
- [x] Formaliser les critères d’acceptation sans inventer de données
- [ ] Confirmer les routes cibles et les sources persistantes pour les éléments non résolus
- [x] Créer une branche locale de travail à partir de `origin/feature/spotbulle-motor`
- [x] Ajouter les assets graphiques avec des chemins robustes et documentés
- [x] Construire la structure Homepage Spotbulle sans remplacer les anciennes routes
- [x] Brancher le profil sur les données réelles de l’utilisateur connecté
- [x] Brancher le radar sur des pourcentages réellement persistés ou afficher un état indisponible explicite
- [x] Brancher la prochaine mission sur le moteur et les missions réellement accessibles
- [x] Brancher les pitchs sur les vidéos réellement enregistrées
- [x] Brancher Mon impact sur les progressions individuelles et globale disponibles
- [x] Implémenter la navigation inférieure et la roue avec des interactions réelles
- [x] Traiter les états chargement, erreur, absence de donnée et responsive
- [x] Écrire ou mettre à jour les tests unitaires pertinents
- [ ] Exécuter lint, tests et build
- [ ] Vérifier le rendu desktop et mobile
- [ ] Faire valider le périmètre et le rendu avant toute mise à jour distante
- [ ] Préparer puis pousser uniquement les changements validés vers `feature/spotbulle-motor`

## Corrections Homepage — audit guide Word

- [x] Rendre la roue manipulable par flèches, clavier et glisser horizontal
- [x] Ajouter le contexte Lumi au survol de la roue
- [x] Ajouter le panneau de notifications et le compteur non lu si la table existe
- [x] Utiliser les badges utilisateur persistés sans fallback présenté comme réel
- [x] Dériver niveau et XP depuis le profil ou les définitions de niveau persistées
- [x] Filtrer la prochaine mission par territoire et imposer les missions pures avant hybrides
- [x] Afficher le nombre de sessions lorsqu’un champ réel est présent
- [x] Résoudre les vidéos stockées via le bucket `videos` et URL signée
- [x] Afficher trois énergies et refuser une progression globale sans pondération réelle
- [x] Ajouter les tests des règles de filtrage, niveau, sessions, radar et impact pondéré
- [x] Exécuter tests, lint ciblé, build et contrôle du diff
- [ ] Confirmer en environnement Supabase les contrats `notifications`, niveaux, poids d’impact et badges
- [ ] Confirmer la route détaillée du radar, la banque de badges et la vue impact
- [ ] Comparer le rendu final avec un Figma public ou un export lisible
- [ ] Faire valider ces corrections avant toute poussée distante
