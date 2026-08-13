export interface OptimizerSkill {
  id: string;
  energy: string | null;
  pure_score: number | null;
}

export interface OptimizerCombination {
  skill_a_id: string;
  skill_b_id: string;
  total_score: number;
  is_forbidden: boolean;
}

export interface OptimizerMission {
  type: 'pure' | 'hybrid';
  skill_a: string;
  skill_b: string | null;
  score: number;
  territory: string;
}

export interface OptimizerParams {
  N: number;
  P: number;
  H: number;
  S_MIN: number;
  R_MAX: number;
}

export interface OptimizerResult {
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

export function optimizeMissions(
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
