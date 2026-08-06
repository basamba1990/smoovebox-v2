# Spécifications Techniques — Moteur Spotbulle (smoovebox-v2)

## Contexte

Ce document formalise l'architecture technique du moteur d'acquisition des compétences Spotbulle, basé sur le document "Algorithme" de Valentina et le cahier de charges "Tableaudesmissions". Il est intégré au projet `smoovebox-v2` de Samba BA.

## 1. Pédagogie Spotbulle (Le "FD")

L'univers Lumia structure l'apprentissage autour de quatre territoires associés aux quatre éléments, chacun lié à des énergies spécifiques et aux compétences du XXIe siècle.

| Territoire | Élément | Énergie dominante | Couleurs DISC associées |
|---|---|---|---|
| Calyxis | Feu | Création | Rouge, Jaune |
| Cattleya | Air | Coopération | Bleu, Vert |
| Sylvara | Terre | Action | Vert, Rouge |
| Neptunus | Eau | Résilience | Bleu, Jaune |

Le parcours compte **15 sous-niveaux** répartis en **6 niveaux principaux** allant d'Explorateur à Capitaine Lumia. Chaque compétence est associée à un territoire, une énergie et des énergies associées.

## 2. Matrice de Compatibilité

Chaque paire ordonnée de compétences (A, B) est évaluée selon 4 critères pondérés pour produire un score de compatibilité global.

| Critère | Poids | Description |
|---|---|---|
| P (Prérequis cognitif) | 0.35 | La compétence A prépare-t-elle cognitivement à B ? |
| C (Complémentarité) | 0.35 | Les deux compétences se renforcent-elles mutuellement ? |
| T (Transfert) | 0.20 | Le savoir-faire de A se transfère-t-il à B ? |
| D (Difficulté) | 0.10 | Le passage de A à B est-il trop difficile ? |

**Formule :** `Score = 0.35 * P + 0.35 * C + 0.20 * T + 0.10 * D`

Les valeurs de P, C, T, D sont des scores bruts de 0 à 10 fournis par Valentina.

## 3. Formalisation Mathématique

**Permutations ordonnées (AB ≠ BA) :**
Le nombre de paires ordonnées pour n compétences est `P(n,2) = n! / (n-2)!`. Par exemple, pour 5 compétences : P(5,2) = 20 paires.

**Progression cumulative :**
`A_t = A_(t-1) ∪ C_t`
L'ensemble des compétences acquises au temps t est l'union des compétences précédentes et des nouvelles compétences validées du territoire actuel.

**Contraintes du solveur (V1) :**

| Paramètre | Valeur V1 | Description |
|---|---|---|
| N | 5 | Nombre total de combinaisons sélectionnées |
| P | 2 | Nombre minimum de compétences pures (isolées) |
| H | 3 | Nombre minimum de combinaisons hybrides |
| S_min | 6.0 | Score minimum de compatibilité pour être retenue |
| R_max | 3 | Nombre maximum de répétitions d'une même compétence |

## 4. Algorithme d'Optimisation

**Fonction objectif :**
`max Z = Σ Σ S_ij * x_ij`
où S_ij est le score de compatibilité de la paire (i,j) et x_ij est une variable binaire (1 si retenue, 0 sinon).

**Contraintes :**
1. La compétence B ne peut être activée que si ses prérequis sont dans A_t.
2. Le nombre total de combinaisons sélectionnées doit être ≤ N.
3. Le nombre de compétences pures doit être ≥ P.
4. Le nombre de combinaisons hybrides doit être ≥ H.
5. Chaque compétence ne peut apparaître plus de R_max fois.
6. Les énergies du territoire doivent être couvertes.

## 5. Architecture Technique (smoovebox-v2)

### Base de données (Supabase)
Les tables nécessaires seront créées via une nouvelle migration SQL.

### Backend (Supabase Edge Function)
Une nouvelle Edge Function `spotbulle-generate-missions` implémentera le solveur en TypeScript.

### Frontend (React)
Le composant sera intégré dans les étapes 6 et 7 de l'Odyssée (`/journal-mission` et `/portail-lumi`).

### Réutilisation existante
- `RadarChartFourElements.jsx` : déjà implémenté pour les 4 éléments.
- `FourColorsTest.jsx` : questionnaire DISC existant (rouge/jaune/vert/bleu).
- `lumi-compute-profile` : Edge Function existante pour le profil DISC.
- `ProgressTracking.jsx` : pattern de suivi de progression réutilisable.
