# Audit initial — Homepage Spotbulle

Date de l’audit : 2026-09-05
Branche inspectée : `origin/feature/spotbulle-motor`
Commit inspecté : `2ea84be1` — `Fix: automate skill acquisition, badge awarding, and enforce pure missions priority`

## Sources disponibles

- Dépôt Smoovebox v2 cloné localement.
- Archive graphique extraite dans `/home/ubuntu/spotbulle-assets/Valentina_Figma/`.
- Guide fonctionnel : `Guide Homepage - Tableau des interactions et comportements dynamiques.docx`.
- Le guide indique que le Figma est la référence visuelle et que les éléments dynamiques doivent être alimentés par les données de l’utilisateur.

## Ressources graphiques inventoriées

L’archive contient le fond principal, les éléments d’en-tête, les icônes du menu inférieur, les assets du menu déroulant/roue, des éléments de profil, des assets de mission, de pitch, d’impact et des micro-animations. Les noms sont encodés avec des caractères accentués ; ils devront être normalisés ou importés sans supposer un chemin ASCII.

## Architecture existante repérée

- Le routage redirige un utilisateur authentifié vers `/embark`, rendu par `SpotCoach`.
- `SimplifiedHome` est l’ancienne Homepage riche en fonctionnalités, accessible via `/old`, et ne correspond pas encore à la composition Figma demandée.
- `SpotbulleMissions` est déjà branché sur les tables `spotbulle_territories`, `user_missions` et `skills`, avec un contrôle de déverrouillage des territoires et une progression par énergie.
- `spotbulleEngine.js` expose déjà la lecture des compétences acquises, la fusion cumulative et la sélection des missions pures avant les hybrides.
- `LumiUnifiedProfile` et `video-vault` sont les références existantes pour lire les données persistantes de profil, radar, vidéos et pitchs.
- `RadarChartFourElements` ne doit pas être considéré comme suffisant pour le radar Homepage : il utilise actuellement des intensités dérivées de couleurs plutôt que des pourcentages utilisateur réels.

## Critères fonctionnels à respecter

1. Aucun texte, score, nom, badge, mission, pitch ou progression ne doit être inventé ou codé en dur lorsqu’il est censé dépendre de l’utilisateur.
2. Les données absentes doivent produire un état explicite et actionnable, pas un faux contenu de démonstration.
3. Les assets du ZIP doivent être utilisés comme ressources graphiques, sans les confondre avec les données métier.
4. La roue doit être une interaction réelle : rotation, sélection, état actif et navigation vers la catégorie correspondante.
5. La Homepage doit afficher des données réelles pour le profil, le niveau, l’XP, les missions, le radar, le pitch et l’impact, ou indiquer clairement qu’une donnée n’est pas encore disponible.
6. Les liens et boutons doivent être branchés sur des routes ou actions existantes ; tout nouveau parcours doit être documenté et testé.
7. Le travail doit être livré par petites étapes testables, avec vérification de build, tests unitaires et contrôle visuel avant toute poussée Git.

## Blocage actuel

Le dépôt contient le guide fonctionnel et les assets, mais aucune modification n’a encore été faite. Le fichier Figma accessible précédemment était une capture de la page de connexion et non le contenu du design. L’implémentation peut donc commencer à partir du guide et des assets, mais les dimensions et détails visuels qui ne sont pas explicitement présents dans les assets restent à confirmer par un export Figma lisible ou un lien public en lecture seule.

## Vérification de l’URL déployée

L’URL Vercel fournie redirige vers la connexion Vercel elle-même (`vercel.com/login`) dans le navigateur d’audit. Le rendu authentifié de l’application n’est donc pas vérifiable depuis cette session et aucune conclusion ne doit être tirée sur la Homepage à partir de cette redirection.

## État de référence qualité

L’installation reproductible avec `npm ci --ignore-scripts` réussit. Le build Vite de la branche réussit également. Le lint échoue déjà avant les changements Homepage avec plusieurs erreurs `no-unused-vars` et avertissements de dépendances React Hook dans des fichiers existants, dont `SimplifiedHome.jsx`, `login.jsx`, `lumi-onboarding.jsx`, `record-video.jsx`, `video-success.jsx`, `video-vault.jsx` et `AppRoutes.jsx`. Ces erreurs doivent être distinguées des éventuelles erreurs introduites par la Homepage ; elles ne seront pas masquées par une désactivation globale du lint.

## Vérification Vercel après push du commit 0d624f4c

La branche distante `feature/spotbulle-motor` pointe bien vers le commit `0d624f4c`. L’URL de preview fournie redirige cependant vers `vercel.com/login` avec un flux SSO Vercel. Le rendu de `/spotbulle-home` et l’état du déploiement ne sont donc pas vérifiables depuis cette session sans authentification Vercel ou URL de preview publique.

## Diagnostic preview après push 99e71856

Le commit `99e71856` est présent sur `origin/feature/spotbulle-motor`. L’ouverture de `/spotbulle-home` via le domaine Vercel fourni redirige encore vers `https://vercel.com/login?...`. Le domaine est donc protégé par une authentification Vercel avant que la route applicative puisse être affichée depuis la session actuelle.

## Test interactif du preview le 6 septembre 2026

Deux tentatives d’ouverture de `https://smoovebox-v2-git-feature-spotbulle-motor-samba-bas-projects.vercel.app/spotbulle-home` ont redirigé vers `vercel.com/login`. La Homepage n’est pas inspectable dans cette session sans authentification Vercel. Les observations fonctionnelles disponibles proviennent donc de la vidéo fournie, pas d’un test interactif autonome.
