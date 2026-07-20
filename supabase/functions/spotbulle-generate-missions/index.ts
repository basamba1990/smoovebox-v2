// supabase/functions/spotbulle-generate-missions/index.ts
// Moteur d'optimisation Spotbulle — Génère les missions pédagogiques
//
// Entrée : { user_id, territory }
// Sortie : { missions, total_combinations, acquired_skills }

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Pondérations définies par Valentina
const WEIGHTS = {
  P: 0.35,
  C: 0.35,
  T: 0.20,
  D: 0.10,
};

// Paramètres par défaut pour la V1
const DEFAULT_PARAMS = {
  N: 5,   // Nombre total de combinaisons
  P: 2,   // Minimum compétences pures
  H: 3,   // Minimum combinaisons hybrides
  S_MIN: 6.0, // Score minimum
  R_MAX: 3,   // Répétitions max d'une compétence
};

interface SkillCompatibility {
  skill_a: string;
  skill_b: string;
  score_p: number;
  score_c: number;
  score_t: number;
  score_d: number;
  total_score: number;
  is_forbidden: boolean;
  territory: string;
}

interface Prerequisite {
  skill_id: string;
  prerequisite_id: string;
}

interface AcquiredSkill {
  skill_id: string;
  acquired_at: string;
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
  params?: Partial<typeof DEFAULT_PARAMS>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { user_id, territory, params } = await req.json() as GenerateRequest;

    if (!user_id) {
      throw new Error('user_id est requis');
    }

    const config = { ...DEFAULT_PARAMS, ...(params || {}) };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Étape 1 : Récupérer les acquis de l'utilisateur (A_t)
    const { data: acquiredSkills, error: acqError } = await supabase
      .from('user_skill_progress')
      .select('skill_id, acquired_at, territory')
      .eq('user_id', user_id);

    if (acqError) throw acqError;

    const acquiredIds = new Set((acquiredSkills || []).map((s: AcquiredSkill) => s.skill_id));

    // Étape 2 : Récupérer les compétences du territoire cible
    const { data: skills, error: skillsError } = await supabase
      .from('skills')
      .select('id, name, territory, element, energy')
      .eq('territory', territory || 'Calyxis');

    if (skillsError) throw skillsError;

    const skillIds = new Set(skills.map((s: any) => s.id));

    // Étape 3 : Récupérer les prérequis
    const { data: prerequisites, error: prereqError } = await supabase
      .from('skill_prerequisites')
      .select('skill_id, prerequisite_id');

    if (prereqError) throw prereqError;

    const prereqMap = new Map<string, string[]>();
    (prerequisites || []).forEach((p: Prerequisite) => {
      if (!prereqMap.has(p.skill_id)) prereqMap.set(p.skill_id, []);
      prereqMap.get(p.skill_id)!.push(p.prerequisite_id);
    });

    // Étape 4 : Récupérer la matrice de compatibilité
    const { data: compatMatrix, error: compatError } = await supabase
      .from('skill_compatibility')
      .select('*')
      .eq('territory', territory || 'Calyxis')
      .eq('is_forbidden', false)
      .order('total_score', { ascending: false });

    if (compatError) throw compatError;

    // Étape 5 : Filtrer les combinaisons valides
    const validCombinations: SkillCompatibility[] = [];

    for (const row of (compatMatrix || [])) {
      // Vérifier que les deux compétences appartiennent au territoire
      if (!skillIds.has(row.skill_a) || !skillIds.has(row.skill_b)) continue;

      // Vérifier le score minimum
      if (row.total_score < config.S_MIN) continue;

      // Vérifier les prérequis : skill_b ne peut être activée que si ses prérequis sont dans A_t
      const prereqsB = prereqMap.get(row.skill_b) || [];
      const allPrereqsMet = prereqsB.every((pre: string) => acquiredIds.has(pre));
      if (!allPrereqsMet) continue;

      validCombinations.push(row);
    }

    // Étape 6 : Optimisation — sélectionner les meilleures combinaisons
    // Trié par total_score décroissant (déjà fait en SQL)
    // Appliquer la contrainte R_max (nombre max de répétitions)
    const skillUsageCount = new Map<string, number>();
    const selected: GeneratedMission[] = [];
    let pureCount = 0;
    let hybridCount = 0;

    // D'abord, sélectionner les compétences pures (non déjà acquises)
    const availableSkills = skills
      .filter((s: any) => !acquiredIds.has(s.id))
      .sort((a: any, b: any) => (b.pure_score || 0) - (a.pure_score || 0));

    for (const skill of availableSkills) {
      if (pureCount >= config.P) break;
      if ((skillUsageCount.get(skill.id) || 0) >= config.R_MAX) continue;

      selected.push({
        type: 'pure',
        skill_a: skill.id,
        skill_b: null,
        score: skill.pure_score || 0,
        territory: skill.territory,
      });
      pureCount++;
      skillUsageCount.set(skill.id, (skillUsageCount.get(skill.id) || 0) + 1);
    }

    // Ensuite, sélectionner les combinaisons hybrides
    for (const combo of validCombinations) {
      if (selected.length >= config.N) break;
      if (hybridCount >= config.H && selected.length >= config.P + config.H) break;

      const usageA = skillUsageCount.get(combo.skill_a) || 0;
      const usageB = skillUsageCount.get(combo.skill_b) || 0;

      if (usageA >= config.R_MAX || usageB >= config.R_MAX) continue;

      selected.push({
        type: 'hybrid',
        skill_a: combo.skill_a,
        skill_b: combo.skill_b,
        score: combo.total_score,
        territory: combo.territory,
      });
      hybridCount++;
      skillUsageCount.set(combo.skill_a, usageA + 1);
      skillUsageCount.set(combo.skill_b, usageB + 1);
    }

    // Étape 7 : Calculer le score total de la fonction objectif
    const totalObjective = selected.reduce((sum, m) => sum + m.score, 0);

    // Étape 8 : Récupérer les noms des compétences pour les résultats
    const skillNameMap = new Map<string, string>();
    skills.forEach((s: any) => skillNameMap.set(s.id, s.name));

    const missionsWithNames = selected.map((m) => ({
      ...m,
      skill_a_name: m.skill_a ? skillNameMap.get(m.skill_a) || 'Inconnue' : null,
      skill_b_name: m.skill_b ? skillNameMap.get(m.skill_b) || 'Inconnue' : null,
    }));

    // Étape 9 : Sauvegarder en base de données
    const missionRecords = selected.map((m) => ({
      user_id,
      skill_a: m.skill_a,
      skill_b: m.skill_b,
      mission_type: m.type,
      total_score: m.score,
      territory: m.territory,
    }));

    if (missionRecords.length > 0) {
      await supabase.from('user_missions').insert(missionRecords);
    }

    return new Response(
      JSON.stringify({
        success: true,
        territory,
        acquired_count: acquiredIds.size,
        total_combinations_evaluated: validCombinations.length,
        missions_generated: missionsWithNames.length,
        pure_count: pureCount,
        hybrid_count: hybridCount,
        objective_score: totalObjective,
        missions: missionsWithNames,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
