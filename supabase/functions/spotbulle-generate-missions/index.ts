// supabase/functions/spotbulle-generate-missions/index.ts
// Moteur d'optimisation Spotbulle — Génère les missions pédagogiques

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_PARAMS = {
  N: 5,   // Nombre total de combinaisons
  P: 2,   // Minimum compétences pures
  H: 3,   // Minimum combinaisons hybrides
  S_MIN: 6.0, // Score minimum
  R_MAX: 3,   // Répétitions max d'une compétence
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
  params?: Partial<typeof DEFAULT_PARAMS>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { user_id, territory, params } = await req.json() as GenerateRequest;
    if (!user_id) throw new Error('user_id est requis');

    const config = { ...DEFAULT_PARAMS, ...(params || {}) };
    const targetTerritory = territory || 'Calyxis';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 1. Acquis utilisateur
    const { data: acquiredSkills, error: acqError } = await supabase
      .from('user_skill_progress')
      .select('skill_id')
      .eq('user_id', user_id);
    if (acqError) throw acqError;
    const acquiredIds = new Set((acquiredSkills || []).map((s: any) => s.skill_id));

    // 2. Compétences du territoire
    const { data: skills, error: skillsError } = await supabase
      .from('skills')
      .select('id, name, territory, pure_score')
      .eq('territory', targetTerritory);
    if (skillsError) throw skillsError;
    const skillIds = new Set(skills.map((s: any) => s.id));
    const skillNameMap = new Map<string, string>();
    skills.forEach((s: any) => skillNameMap.set(s.id, s.name));

    // 3. Prérequis
    const { data: prerequisites, error: prereqError } = await supabase
      .from('skill_prerequisites')
      .select('skill_id, prerequisite_id');
    if (prereqError) throw prereqError;
    const prereqMap = new Map<string, string[]>();
    (prerequisites || []).forEach((p: any) => {
      if (!prereqMap.has(p.skill_id)) prereqMap.set(p.skill_id, []);
      prereqMap.get(p.skill_id)!.push(p.prerequisite_id);
    });

    // 4. Matrice de compatibilité
    const { data: compatMatrix, error: compatError } = await supabase
      .from('skill_compatibility')
      .select('*')
      .eq('is_forbidden', false)
      .order('total_score', { ascending: false });
    if (compatError) throw compatError;

    // 5. Filtrage
    const validCombinations: SkillCompatibility[] = (compatMatrix || []).filter(row => {
      if (!skillIds.has(row.skill_a_id) || !skillIds.has(row.skill_b_id)) return false;
      if (row.total_score < config.S_MIN) return false;
      const prereqsB = prereqMap.get(row.skill_b_id) || [];
      return prereqsB.every(pre => acquiredIds.has(pre));
    });

    // 6. Sélection
    const skillUsageCount = new Map<string, number>();
    const selected: GeneratedMission[] = [];
    let pureCount = 0;
    let hybridCount = 0;

    // Pures
    const availableSkills = skills
      .filter((s: any) => !acquiredIds.has(s.id))
      .sort((a: any, b: any) => (b.pure_score || 0) - (a.pure_score || 0));

    for (const skill of availableSkills) {
      if (pureCount >= config.P) break;
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

    // Hybrides (Triées par score décroissant pour l'optimisation)
    const sortedHybrids = [...validCombinations].sort((a, b) => b.total_score - a.total_score);
    
    for (const combo of sortedHybrids) {
      if (selected.length >= config.N) break;
      if (hybridCount >= config.H && selected.length >= config.N) break;
      
      const usageA = skillUsageCount.get(combo.skill_a_id) || 0;
      const usageB = skillUsageCount.get(combo.skill_b_id) || 0;
      
      // Éviter la surexploitation d'une compétence
      if (usageA >= config.R_MAX || usageB >= config.R_MAX) continue;

      selected.push({
        type: 'hybrid',
        skill_a: combo.skill_a_id,
        skill_b: combo.skill_b_id,
        score: combo.total_score,
        territory: targetTerritory,
      });
      hybridCount++;
      skillUsageCount.set(combo.skill_a_id, usageA + 1);
      skillUsageCount.set(combo.skill_b_id, usageB + 1);
    }

    // 7. Résultat
    const totalObjective = selected.reduce((sum, m) => sum + m.score, 0);
    const missionsWithNames = selected.map((m) => ({
      ...m,
      skill_a_name: m.skill_a ? skillNameMap.get(m.skill_a) : null,
      skill_b_name: m.skill_b ? skillNameMap.get(m.skill_b) : null,
    }));

    // 8. FIX: Nettoyer les anciennes missions pending du même territoire pour éviter les doublons
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

    return new Response(JSON.stringify({
      success: true,
      territory: targetTerritory,
      missions: missionsWithNames,
      objective_score: totalObjective,
      // FIX: Retourner les stats pour le frontend
      acquired_count: 0,
      total_combinations: selected.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
