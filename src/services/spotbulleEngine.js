/**
 * Service Spotbulle Engine
 * Calcul du score de compatibilité et génération de permutations.
 * Utilisé côté frontend pour les calculs légers,
 * et côté backend via l'Edge Function pour le solveur complet.
 */

import { supabase } from '../lib/supabase.js';

// Pondérations définies dans le document Algorithme
const WEIGHTS = {
  P: 0.35, // Prérequis cognitif
  C: 0.35, // Complémentarité
  T: 0.20, // Transfert
  D: 0.10, // Difficulté
};

/**
 * Calcule le score de compatibilité pédagogique entre deux compétences.
 * Formule : Score = 0.35 * P + 0.35 * C + 0.20 * T + 0.10 * D
 *
 * @param {number} p - Score prérequis cognitif (0 à 10)
 * @param {number} c - Score complémentarité (0 à 10)
 * @param {number} t - Score transfert (0 à 10)
 * @param {number} d - Score difficulté (0 à 10)
 * @returns {number} Score pondéré total (0 à 10)
 */
export function calculateCompatibilityScore(p, c, t, d) {
  return WEIGHTS.P * p + WEIGHTS.C * c + WEIGHTS.T * t + WEIGHTS.D * d;
}

/**
 * Génère toutes les permutations ordonnées de longueur 2.
 * AB ≠ BA (l'ordre a une importance pédagogique).
 *
 * @param {Array} competences - Liste des compétences
 * @returns {Array} Paires ordonnées [{skillA, skillB}, ...]
 */
export function generatePermutations(competences) {
  const permutations = [];
  for (let i = 0; i < competences.length; i++) {
    for (let j = 0; j < competences.length; j++) {
      if (i !== j) {
        permutations.push({
          skillA: competences[i],
          skillB: competences[j],
        });
      }
    }
  }
  return permutations;
}

/**
 * Calcule le nombre de permutations possibles.
 * P(n, k) = n! / (n-k)!  avec k=2
 *
 * @param {number} n - Nombre de compétences
 * @returns {number} Nombre de paires ordonnées
 */
export function countPermutations(n) {
  return n * (n - 1); // P(n,2) = n!/(n-2)! = n*(n-1)
}

/**
 * Récupère les acquis de l'utilisateur (A_t).
 *
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Set>} Ensemble des IDs de compétences acquises
 */
export async function getAcquiredSkills(userId) {
  const { data, error } = await supabase
    .from('user_skill_progress')
    .select('skill_id')
    .eq('user_id', userId);

  if (error) throw error;
  return new Set((data || []).map((row) => row.skill_id));
}

/**
 * Vérifie si les prérequis d'une compétence sont satisfaits.
 *
 * @param {string} skillId - ID de la compétence cible
 * @param {Set} acquiredSkills - Compétences déjà acquises
 * @param {Array} allPrerequisites - Liste de tous les prérequis
 * @returns {boolean} true si tous les prérequis sont dans les acquis
 */
export function checkPrerequisites(skillId, acquiredSkills, allPrerequisites) {
  const prereqs = allPrerequisites
    .filter((p) => p.skill_id === skillId)
    .map((p) => p.prerequisite_id);

  return prereqs.every((pre) => acquiredSkills.has(pre));
}

/**
 * Applique la progression cumulative : A_t = A_(t-1) ∪ C_t
 *
 * @param {Set} previousAcquired - Compétences acquises au temps t-1
 * @param {Array} newCompetences - Compétences validées au temps t
 * @returns {Set} Nouvel ensemble de compétences acquises
 */
export function mergeAcquiredSkills(previousAcquired, newCompetences) {
  const merged = new Set(previousAcquired);
  newCompetences.forEach((skill) => merged.add(skill));
  return merged;
}

/**
 * Applique les contraintes du solveur sur une liste de combinaisons.
 *
 * @param {Array} combinations - Combinaisons triées par score
 * @param {Object} params - Paramètres de contraintes
 * @param {Set} acquiredSkills - Compétences déjà acquises
 * @returns {Object} { pure: [], hybrid: [] }
 */
export function applySolverConstraints(combinations, params, acquiredSkills) {
  const { N = 5, P = 2, H = 3, R_MAX = 3 } = params;
  const result = { pure: [], hybrid: [] };
  const skillUsage = new Map();

  const incrementUsage = (skillId) => {
    skillUsage.set(skillId, (skillUsage.get(skillId) || 0) + 1);
  };

  const getUsage = (skillId) => skillUsage.get(skillId) || 0;

  // Sélectionner les compétences pures d'abord
  let pureCount = 0;
  for (const combo of combinations) {
    if (pureCount >= P) break;
    if (combo.type !== 'pure') continue;
    if (getUsage(combo.skillId) >= R_MAX) continue;
    if (acquiredSkills.has(combo.skillId)) continue;

    result.pure.push(combo);
    pureCount++;
    incrementUsage(combo.skillId);
  }

  // Sélectionner les combinaisons hybrides
  for (const combo of combinations) {
    if (result.pure.length + result.hybrid.length >= N) break;
    if (combo.type !== 'hybrid') continue;
    if (getUsage(combo.skillA) >= R_MAX || getUsage(combo.skillB) >= R_MAX) continue;

    result.hybrid.push(combo);
    incrementUsage(combo.skillA);
    incrementUsage(combo.skillB);
  }

  return result;
}

/**
 * Génère les missions pour un utilisateur via l'Edge Function.
 * C'est la méthode principale qui délègue le calcul au solveur côté serveur.
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} territory - Territoire cible (Calyxis, Cattleya, Sylvara, Neptunus)
 * @param {Object} params - Paramètres optionnels du solveur
 * @returns {Promise<Object>} Résultat du solveur avec les missions générées
 */
export async function generateMissionsForUser(userId, territory, params = {}) {
  const { data, error } = await supabase.functions.invoke(
    'spotbulle-generate-missions',
    {
      body: {
        user_id: userId,
        territory,
        params,
      },
    }
  );

  if (error) throw error;
  if (data.error) throw new Error(data.error);

  return data;
}

// Export par défaut
export default {
  calculateCompatibilityScore,
  generatePermutations,
  countPermutations,
  getAcquiredSkills,
  checkPrerequisites,
  mergeAcquiredSkills,
  applySolverConstraints,
  generateMissionsForUser,
  WEIGHTS,
};
