// supabase/functions/spotbulle-generate-missions/index.ts
// Moteur d'optimisation Spotbulle — Génère les missions pédagogiques

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

interface OptimizerSkill {
  id: string;
  energy: string | null;
  pure_score: number | null;
}

interface OptimizerCombination {
  skill_a_id: string;
  skill_b_id: string;
  total_score: number;
  is_forbidden: boolean;
}

interface OptimizerMission {
  type: 'pure' | 'hybrid';
  skill_a: string;
  skill_b: string | null;
  score: number;
  territory: string;
}

interface OptimizerParams {
  N: number;
  P: number;
  H: number;
  S_MIN: number;
  R_MAX: number;
}

interface OptimizerResult {
  selected: OptimizerMission[];
  objectiveScore: number;
  coveredEnergies: string[];
}

interface Candidate {
  mission: OptimizerMission;
  skills: string[];
  energies: string[];
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return b.mission.score - a.mission.score || a.mission.type.localeCompare(b.mission.type) || a.mission.skill_a.localeCompare(b.mission.skill_a) || (a.mission.skill_b ?? '').localeCompare(b.mission.skill_b ?? '');
}

function isBetter(candidate: OptimizerResult, incumbent: OptimizerResult | null): boolean {
  if (!incumbent) return true;
  if (candidate.objectiveScore !== incumbent.objectiveScore) return candidate.objectiveScore > incumbent.objectiveScore;
  return candidate.selected.map((mission) => `${mission.type}:${mission.skill_a}:${mission.skill_b ?? ''}`).join('|') < incumbent.selected.map((mission) => `${mission.type}:${mission.skill_a}:${mission.skill_b ?? ''}`).join('|');
}

function optimizeMissions(
  skills: OptimizerSkill[],
  combinations: OptimizerCombination[],
  territory: string,
  params: OptimizerParams,
  acquiredIds: Set<string>,
  requiredEnergies: Set<string>,
): OptimizerResult {
  if (!Number.isInteger(params.N) || params.N < 1) throw new Error('N doit être un entier positif');
  if (!Number.isInteger(params.P) || !Number.isInteger(params.H) || params.P < 0 || params.H < 0 || params.P + params.H > params.N) throw new Error('Les contraintes P et H sont incompatibles avec N');
  if (!Number.isInteger(params.R_MAX) || params.R_MAX < 1) throw new Error('R_MAX doit être un entier positif');

  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const candidates: Candidate[] = [];

  for (const skill of skills) {
    if (acquiredIds.has(skill.id)) continue;
    candidates.push({
      mission: { type: 'pure', skill_a: skill.id, skill_b: null, score: skill.pure_score ?? 0, territory },
      skills: [skill.id],
      energies: skill.energy ? [skill.energy] : [],
    });
  }

  for (const combination of combinations) {
    if (combination.is_forbidden || combination.total_score < params.S_MIN) continue;
    const skillA = skillById.get(combination.skill_a_id);
    const skillB = skillById.get(combination.skill_b_id);
    if (!skillA || !skillB || acquiredIds.has(skillA.id) || acquiredIds.has(skillB.id)) continue;
    candidates.push({
      mission: { type: 'hybrid', skill_a: skillA.id, skill_b: skillB.id, score: combination.total_score, territory },
      skills: [skillA.id, skillB.id],
      energies: [skillA.energy, skillB.energy].filter((energy): energy is string => Boolean(energy)),
    });
  }

  candidates.sort(compareCandidates);
  const suffixScores = new Array(candidates.length + 1).fill(0);
  for (let index = candidates.length - 1; index >= 0; index -= 1) suffixScores[index] = suffixScores[index + 1] + Math.max(0, candidates[index].mission.score);

  let best: OptimizerResult | null = null;
  const usage = new Map<string, number>();
  const selected: Candidate[] = [];
  const covered = new Set<string>();

  const search = (index: number, pureCount: number, hybridCount: number, score: number): void => {
    if (selected.length === params.N) {
      if (pureCount < params.P || hybridCount < params.H) return;
      for (const energy of requiredEnergies) if (!covered.has(energy)) return;
      const result: OptimizerResult = { selected: selected.map((candidate) => candidate.mission), objectiveScore: score, coveredEnergies: [...covered].sort() };
      if (isBetter(result, best)) best = result;
      return;
    }
    if (index >= candidates.length) return;
    const slots = params.N - selected.length;
    if (pureCount + slots < params.P || hybridCount + slots < params.H) return;
    if (best && score + suffixScores[index] < best.objectiveScore) return;

    const candidate = candidates[index];
    const canUse = candidate.skills.every((skillId) => (usage.get(skillId) ?? 0) < params.R_MAX);
    if (canUse) {
      selected.push(candidate);
      candidate.skills.forEach((skillId) => usage.set(skillId, (usage.get(skillId) ?? 0) + 1));
      const addedEnergies = candidate.energies.filter((energy) => !covered.has(energy));
      addedEnergies.forEach((energy) => covered.add(energy));
      search(index + 1, pureCount + (candidate.mission.type === 'pure' ? 1 : 0), hybridCount + (candidate.mission.type === 'hybrid' ? 1 : 0), score + candidate.mission.score);
      addedEnergies.forEach((energy) => covered.delete(energy));
      candidate.skills.forEach((skillId) => {
        const next = (usage.get(skillId) ?? 0) - 1;
        if (next === 0) usage.delete(skillId); else usage.set(skillId, next);
      });
      selected.pop();
    }
    search(index + 1, pureCount, hybridCount, score);
  };

  search(0, 0, 0, 0);
  if (!best) throw new Error('Aucune solution ne satisfait les contraintes pédagogiques configurées');
  return best;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface SkillCompatibility {
  skill_a_id: string;
  skill_b_id: string;
  score_p: number;
  score_c: number;
  score_t: number;
  score_d: number;
  total_score: number;
  is_forbidden: boolean;
}

interface GeneratedMission {
  type: 'pure' | 'hybrid';
  skill_a: string | null;
  skill_b: string | null;
  score: number;
  territory: string;
}

interface GenerateRequest {
  user_id: string;
  territory?: string;
  params?: Partial<OptimizerParams>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { user_id, territory, params } = await req.json() as GenerateRequest;
    if (!user_id) throw new Error('user_id est requis');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: engineConfig, error: engineConfigError } = await supabase
      .from('spotbulle_engine_config')
      .select('max_combinations, min_pure, min_hybrid, min_compatibility_score, max_skill_repetitions')
      .eq('id', true)
      .maybeSingle();
    if (engineConfigError) throw engineConfigError;
    if (!engineConfig) throw new Error('La configuration du moteur Spotbulle est absente');

    // 1. Acquis utilisateur (déplacé plus haut pour la priorité pure)
    const { data: acquiredSkills, error: acqError } = await supabase
      .from('user_skill_progress')
      .select('skill_id')
      .eq('user_id', user_id);
    if (acqError) throw acqError;
    const acquiredIds = new Set((acquiredSkills || []).map((s: any) => s.skill_id));

    const territoryOrder = ['Calyxis', 'Sylvara', 'Cattleya', 'Neptunus']; // Ordre par défaut si non chargé
    const targetTerritory = territory || territoryOrder[0];

    // 0. Calculer les compétences pures non acquises pour ce territoire
    const { data: territorySkills, error: territorySkillsError } = await supabase
      .from('skills')
      .select('id, energy')
      .eq('territory', targetTerritory);
    if (territorySkillsError) throw territorySkillsError;

    const unacquiredPureIds = (territorySkills || [])
      .map((s: any) => s.id)
      .filter(id => !acquiredIds.has(id));

    const config: OptimizerParams = {
      N: engineConfig.max_combinations,
      P: unacquiredPureIds.length > 0 ? Math.min(unacquiredPureIds.length, engineConfig.max_combinations) : engineConfig.min_pure,
      H: unacquiredPureIds.length > 0 ? 0 : engineConfig.min_hybrid,
      S_MIN: engineConfig.min_compatibility_score,
      R_MAX: engineConfig.max_skill_repetitions,
      ...(params || {}),
    };

    const { data: territoryConfigs, error: territoryError } = await supabase
      .from('spotbulle_territories')
      .select('territory, order_index, required_missions')
      .order('order_index', { ascending: true });
    if (territoryError) throw territoryError;
    if (!territoryConfigs?.length) throw new Error('La configuration territoriale est vide');

    const { data: progressionStages, error: progressionStagesError } = await supabase
      .from('spotbulle_progression_stages')
      .select('stage_key, level, level_label, sub_level_start, sub_level_end, territory, element, activated_sub_energy_a, activated_sub_energy_b, unlock_event')
      .order('level', { ascending: true });
    if (progressionStagesError) throw progressionStagesError;

    const territoryOrder = territoryConfigs.map((item: any) => item.territory);
    const targetTerritory = territory || territoryOrder[0];
    if (!territoryOrder.includes(targetTerritory)) {
      throw new Error(`Territoire inconnu: ${targetTerritory}`);
    }

    // 1. Le territoire suivant n'est accessible qu'après validation des cinq missions précédentes.
    const territoryIndex = territoryOrder.indexOf(targetTerritory);
    if (territoryIndex > 0) {
      const previousTerritory = territoryOrder[territoryIndex - 1];
      const requiredMissions = territoryConfigs[territoryIndex - 1]?.required_missions;
      if (!requiredMissions) throw new Error(`Le nombre de missions requis pour ${previousTerritory} est absent`);
      const { data: previousMissions, error: previousError } = await supabase
        .from('user_missions')
        .select('status')
        .eq('user_id', user_id)
        .eq('territory', previousTerritory);
      if (previousError) throw previousError;
      const completedPrevious = (previousMissions || []).filter((mission: any) => mission.status === 'completed').length;
      if (completedPrevious < requiredMissions) {
        throw new Error(`Le territoire ${targetTerritory} est verrouillé. Terminez les cinq missions de ${previousTerritory}.`);
      }
    }

    // 2. Acquis utilisateur (déjà chargés plus haut)

    // 3. Compétences du territoire
    const { data: allSkills, error: skillsError } = await supabase
      .from('skills')
      .select('id, name, territory, energy, sub_energy, pure_score')
      .eq('territory', targetTerritory);
    if (skillsError) throw skillsError;

    const { data: progressionRows, error: progressionError } = await supabase
      .from('spotbulle_progression_matrix')
      .select('skill_id, state, unlock_after_skill_id')
      .eq('territory', targetTerritory);
    if (progressionError) throw progressionError;
    const progressionBySkill = new Map((progressionRows || []).map((row: any) => [row.skill_id, row]));
    const progressionSkills = (allSkills || []).filter((skill: any) => {
      const rule = progressionBySkill.get(skill.id);
      if (!rule) return (progressionRows || []).length === 0;
      if (rule.state === 'blocked') return false;
      return !rule.unlock_after_skill_id || acquiredIds.has(rule.unlock_after_skill_id);
    });
    const skills = progressionSkills;
    const skillIds = new Set(skills.map((s: any) => s.id));
    const skillNameMap = new Map<string, string>();
    skills.forEach((s: any) => skillNameMap.set(s.id, s.name));

    // 4. Prérequis
    const { data: prerequisites, error: prereqError } = await supabase
      .from('skill_prerequisites')
      .select('skill_id, prerequisite_id');
    if (prereqError) throw prereqError;
    const prereqMap = new Map<string, string[]>();
    (prerequisites || []).forEach((p: any) => {
      if (!prereqMap.has(p.skill_id)) prereqMap.set(p.skill_id, []);
      prereqMap.get(p.skill_id)!.push(p.prerequisite_id);
    });

    // 5. Matrice de compatibilité
    const { data: compatMatrix, error: compatError } = await supabase
      .from('skill_compatibility')
      .select('*')
      .order('total_score', { ascending: false });
    if (compatError) throw compatError;

    // 6. Filtrage
    const validCombinations: SkillCompatibility[] = (compatMatrix || []).filter(row => {
      if (!skillIds.has(row.skill_a_id) || !skillIds.has(row.skill_b_id)) return false;
      if (row.total_score < config.S_MIN) return false;
      const prereqsB = prereqMap.get(row.skill_b_id) || [];
      return prereqsB.every(pre => acquiredIds.has(pre));
    });

    // 7. Optimisation exacte : maximise la fonction objectif sous toutes les contraintes.
    const requiredEnergies = new Set(skills.map((skill: any) => skill.energy).filter(Boolean));
    const optimized = optimizeMissions(
      skills,
      validCombinations,
      targetTerritory,
      config,
      acquiredIds,
      requiredEnergies,
    );
    const selected = optimized.selected;

    // 8. Résultat
    const totalObjective = optimized.objectiveScore;
    const coveredEnergies = new Set(optimized.coveredEnergies);
    const missionsWithNames = selected.map((m) => ({
      ...m,
      skill_a_name: m.skill_a ? skillNameMap.get(m.skill_a) : null,
      skill_b_name: m.skill_b ? skillNameMap.get(m.skill_b) : null,
    }));

    // 9. FIX: Nettoyer les anciennes missions pending du même territoire pour éviter les doublons
    //    On supprime uniquement les missions avec status='pending' pour ce territoire
    //    Les missions 'in_progress' ou 'completed' sont conservées
    if (selected.length > 0) {
      // Supprimer les doublons pending existants pour ce territoire
      await supabase
        .from('user_missions')
        .delete()
        .eq('user_id', user_id)
        .eq('territory', targetTerritory)
        .eq('status', 'pending');

      // Insérer les nouvelles missions avec status explicite
      await supabase.from('user_missions').insert(selected.map(m => ({
        user_id,
        skill_a: m.skill_a,
        skill_b: m.skill_b,
        mission_type: m.type,
        total_score: m.score,
        status: 'pending',
        territory: m.territory,
      })));
    }

    const { data: badgeDefinitions, error: badgeError } = await supabase
      .from('spotbulle_badges')
      .select('id, badge_key, badge_type, territory, level, required_missions, required_skill_id');
    if (badgeError) throw badgeError;
    const { data: completedMissions, error: completedMissionsError } = await supabase
      .from('user_missions')
      .select('territory, status')
      .eq('user_id', user_id)
      .eq('status', 'completed');
    if (completedMissionsError) throw completedMissionsError;
    const completedByTerritory = new Map<string, number>();
    (completedMissions || []).forEach((mission: any) => completedByTerritory.set(mission.territory, (completedByTerritory.get(mission.territory) || 0) + 1));
    const awardedBadges = (badgeDefinitions || []).filter((badge: any) => {
      if (badge.badge_type === 'territory') return (completedByTerritory.get(badge.territory) || 0) >= (badge.required_missions || Number.MAX_SAFE_INTEGER);
      if (badge.badge_type === 'competence') return Boolean(badge.required_skill_id && acquiredIds.has(badge.required_skill_id));
      if (badge.badge_type === 'level') return false;
      return territoryOrder.every((item: string) => (completedByTerritory.get(item) || 0) > 0);
    });
    if (awardedBadges.length > 0) {
      await supabase.from('user_spotbulle_badges').upsert(awardedBadges.map((badge: any) => ({ user_id, badge_id: badge.id })), { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
    }

    return new Response(JSON.stringify({
      success: true,
      territory: targetTerritory,
      missions: missionsWithNames,
      objective_score: totalObjective,
      acquired_count: acquiredIds.size,
      total_combinations: selected.length,
      covered_energies: [...coveredEnergies],
      required_energies: [...requiredEnergies],
      energy_coverage_complete: [...requiredEnergies].every((energy) => coveredEnergies.has(energy)),
      progression_rules_applied: (progressionRows || []).length > 0,
      progression_stages: progressionStages || [],
      awarded_badges: awardedBadges.map((badge: any) => badge.badge_key),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
