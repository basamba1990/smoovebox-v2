# Guide d'intégration — Moteur Spotbulle dans smoovebox-v2

**Auteur :** Samba BA (DevOps)
**Date :** 20 juillet 2026
**Méthode :** Senecal (fondamentaux d'abord, outils ensuite)

---

## Récapitulatif des 5 prérequis

| Étape | Fondamental | Statut |
|---|---|---|
| 1. Pédagogie | Territoires, Énergies, Compétences | Validé avec les documents d'Estelle/Valentina |
| 2. Matrice | Poids P=0.35, C=0.35, T=0.20, D=0.10 | Validé dans le document Algorithme |
| 3. Maths | Permutations P(n,2), cumul A_t, contraintes N/P/H | Formalisé dans SPOTBULLE_SPECS.md |
| 4. Solveur | Maximisation sous contraintes, filtrage | Architecturé dans l'Edge Function |
| 5. Code | SQL + TypeScript + React | Généré ci-dessous |

---

## Fichiers créés

### 1. Migration SQL : `supabase/migrations/20260720_add_spotbulle_missions.sql`

Cette migration crée 5 tables avec RLS (Row Level Security) :

| Table | Rôle | Colonnes clés |
|---|---|---|
| `skills` | Compétences du XXIe siècle | name, territory, element, energy |
| `skill_prerequisites` | Graphe orienté des prérequis | skill_id, prerequisite_id |
| `skill_compatibility` | Matrice de pondération | score_p, score_c, score_t, score_d, total_score (calculé) |
| `user_skill_progress` | Acumul des acquis (A_t) | user_id, skill_id, territory, level |
| `user_missions` | Résultat du solveur | skill_a, skill_b, mission_type, total_score, status |

**Pour déployer :**
```bash
cd /home/ubuntu/smoovebox-v2
npx supabase db push
```

### 2. Edge Function : `supabase/functions/spotbulle-generate-missions/index.ts`

C'est le cœur du moteur. Elle reçoit l'ID utilisateur et le territoire, puis :
1. Récupère les acquis A_t
2. Génère les permutations du territoire
3. Filtre selon les prérequis
4. Applique les contraintes (N, P, H, S_MIN, R_MAX)
5. Sauvegarde les missions en base
6. Retourne le résultat JSON

**Pour déployer :**
```bash
cd /home/ubuntu/smoovebox-v2
npx supabase functions deploy spotbulle-generate-missions
```

### 3. Service frontend : `src/services/spotbulleEngine.js`

Module réutilisable qui expose :
- `calculateCompatibilityScore(p, c, t, d)` — Calcul du score pondéré
- `generatePermutations(competences)` — Permutations ordonnées AB ≠ BA
- `getAcquiredSkills(userId)` — Récupération des acquis
- `checkPrerequisites(skillId, acquired, prereqs)` — Vérification des prérequis
- `mergeAcquiredSkills(previous, newSkills)` — Cumul A_t = A_(t-1) ∪ C_t
- `generateMissionsForUser(userId, territory)` — Appel principal à l'Edge Function

### 4. Composant React : `src/components/SpotbulleMissions.jsx`

Interface utilisateur avec :
- Sélecteur de territoire (Calyxis/Feu, Cattleya/Air, Sylvara/Terre, Neptunus/Eau)
- Bouton de génération des missions
- Affichage des missions pures et hybrides avec badges
- Barres de progression vers les objectifs P et H
- Statistiques (compétences acquises, combinaisons évaluées, score objectif)

---

## Instructions d'intégration dans l'application

### Étape A : Créer les tables dans Supabase

```bash
cd smoovebox-v2
npx supabase db push
```

### Étape B : Insérer les compétences de Valentina

Valentina devra fournir les données de compétences et de compatibilité. En attendant, voici un exemple de seed SQL :

```sql
-- Insérer des compétences pour le territoire Calyxis (Feu)
INSERT INTO public.skills (name, territory, element, energy, pure_score) VALUES
  ('Créativité', 'Calyxis', 'Feu', 'Création', 8.5),
  ('Innovation', 'Calyxis', 'Feu', 'Création', 7.0),
  ('Prise de décision', 'Calyxis', 'Feu', 'Action', 6.5),
  ('Leadership', 'Calyxis', 'Feu', 'Action', 7.5),
  ('Résolution de problèmes', 'Calyxis', 'Feu', 'Création', 8.0);

-- Insérer des prérequis (ex: Créativité est prérequis d'Innovation)
INSERT INTO public.skill_prerequisites (skill_id, prerequisite_id)
SELECT s2.id, s1.id
FROM public.skills s1, public.skills s2
WHERE s1.name = 'Créativité' AND s2.name = 'Innovation';

-- Insérer des compatibilités (exemple pour Créativité → Innovation)
INSERT INTO public.skill_compatibility (skill_a, skill_b, score_p, score_c, score_t, score_d, territory)
SELECT s1.id, s2.id, 8, 9, 7, 6, 'Calyxis'
FROM public.skills s1, public.skills s2
WHERE s1.name = 'Créativité' AND s2.name = 'Innovation';
```

### Étape C : Déployer l'Edge Function

```bash
npx supabase functions deploy spotbulle-generate-missions
```

### Étape D : Intégrer le composant dans l'Odyssée

Modifier `src/App.jsx` ou `src/components/OdysseyLayout.jsx` pour ajouter :

```jsx
import SpotbulleMissions from './components/SpotbulleMissions.jsx';

// Dans la route /carte-galactique ou /journal-mission
<SpotbulleMissions
  userId={user?.id}
  userProfile={profile}
/>
```

Ou ajouter une nouvelle route dans le fichier de routing pour l'étape 6 de l'Odyssée (journal de mission).

### Étape E : Tester le moteur

```javascript
// Dans la console du navigateur ou un test
import { generateMissionsForUser } from './services/spotbulleEngine.js';

const result = await generateMissionsForUser(
  'user-uuid-here',
  'Calyxis',
  { N: 5, P: 2, H: 3, S_MIN: 6.0, R_MAX: 3 }
);
console.log(result);
// → { success: true, missions: [...], objective_score: 32.4, ... }
```

---

## Validation avant production

Avant de pousser en production, Samba doit :

1. **Valider avec Valentina** que les compétences et prérequis dans la base correspondent à son document.
2. **Tester l'Edge Function** avec `supabase functions serve` en local.
3. **Vérifier les performances** : avec 5 compétences par territoire, le solveur évalue max 20 combinaisons. Avec 10 compétences, ce sera 90 combinaisons. Au-delà, il faudra optimiser le filtre SQL.
4. **Confirmer avec Estelle** les valeurs N, P, H pour le MVP avant le déploiement au Maroc.

---

## Prochaines étapes

1. Recevoir les données de compétences de Valentina (liste, scores, prérequis).
2. Les importer dans Supabase via le script de seed.
3. Tester l'Edge Function avec un utilisateur de test.
4. Faire valider le résultat à Estelle et Valentina.
5. Intégrer dans le parcours utilisateur (étape 6 de l'Odyssée).
6. Préparer le point financier avec Estelle.
