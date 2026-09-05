export const ENERGY_ORDER = ['Energie1', 'Energie2', 'Energie3'];

export function firstValue(source, keys) {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

export function asPercentage(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

export function formatName(profile, user) {
  return profile?.full_name || profile?.name || user?.user_metadata?.full_name || user?.email || null;
}

function missionType(mission) {
  return mission?.mission_type || mission?.type || null;
}

function completedPureCount(missions, territory) {
  return missions.filter((mission) => mission.territory === territory && mission.status === 'completed' && missionType(mission) === 'pure').length;
}

export function selectNextMission(missions, territories) {
  const orderedTerritories = [...(territories || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  if (orderedTerritories.length === 0) return null;

  for (const territory of orderedTerritories) {
    const required = Number(territory.required_missions);
    if (!Number.isFinite(required)) return null;
    const completedPure = completedPureCount(missions, territory.territory);
    const territoryMissions = missions.filter((mission) => mission.territory === territory.territory && mission.status !== 'completed');
    const pureMission = territoryMissions.find((mission) => missionType(mission) === 'pure');
    if (completedPure < required) return pureMission ? { ...pureMission, type: 'pure', requiredPure: required, completedPure, territoryDisplayName: territory.display_name || territory.territory } : null;

    const hybridMission = territoryMissions.find((mission) => missionType(mission) === 'hybrid');
    if (hybridMission) return { ...hybridMission, type: 'hybrid', requiredPure: required, completedPure, territoryDisplayName: territory.display_name || territory.territory };
  }
  return null;
}

export function missionSessionCount(mission) {
  const direct = firstValue(mission, ['sessions_count', 'session_count', 'number_of_sessions', 'sessions']);
  if (Array.isArray(direct)) return direct.length;
  if (typeof direct === 'number') return direct;
  if (typeof direct === 'string' && direct.trim() !== '' && !Number.isNaN(Number(direct))) return Number(direct);
  return null;
}

export function calculateImpact(missions, energyWeights = {}) {
  const values = new Map(ENERGY_ORDER.map((energy) => {
    const configuredWeight = Number(energyWeights[energy]);
    return [energy, { total: 0, completed: 0, weight: Number.isFinite(configuredWeight) && configuredWeight > 0 ? configuredWeight : null }];
  }));
  (missions || []).forEach((mission) => {
    const type = missionType(mission);
    if (type !== 'pure' && type !== 'hybrid') return;
    const entries = [mission.skillA, type === 'hybrid' ? mission.skillB : null].filter(Boolean);
    entries.forEach((skill) => {
      const energy = skill.energy;
      if (!values.has(energy)) return;
      const current = values.get(energy);
      current.total += 1;
      if (mission.status === 'completed') current.completed += 1;
      if (current.weight === null) {
        const skillWeight = Number(skill.impact_weight ?? skill.energy_weight ?? skill.weight);
        current.weight = Number.isFinite(skillWeight) && skillWeight > 0 ? skillWeight : null;
      }
    });
  });
  const rows = ENERGY_ORDER.map((label) => {
    const value = values.get(label);
    return { label, value: value.total ? Math.round((value.completed / value.total) * 100) : null, weight: value.weight };
  });
  const weightedRows = rows.filter((row) => row.value !== null && typeof row.weight === 'number' && row.weight > 0);
  const weightTotal = weightedRows.reduce((sum, row) => sum + row.weight, 0);
  const allEnergiesAvailable = rows.every((row) => row.value !== null && typeof row.weight === 'number' && row.weight > 0);
  const global = allEnergiesAvailable && weightTotal > 0
    ? Math.round(weightedRows.reduce((sum, row) => sum + row.value * row.weight, 0) / weightTotal)
    : null;
  return { rows, global };
}

export function normalizeRadarValues(row) {
  if (!row) return [null, null, null, null, null];
  return [
    asPercentage(firstValue(row, ['air', 'air_score', 'air_percentage', 'air_value'])),
    asPercentage(firstValue(row, ['eau', 'water', 'water_score', 'eau_percentage'])),
    asPercentage(firstValue(row, ['feu', 'fire', 'fire_score', 'feu_percentage'])),
    asPercentage(firstValue(row, ['terre', 'earth', 'earth_score', 'terre_percentage'])),
    asPercentage(firstValue(row, ['equilibre', 'balance', 'balance_score'])),
  ];
}

export function levelPresentation(profile, missions = [], levelDefinitions = []) {
  const directLevel = firstValue(profile, ['level', 'current_level', 'niveau']);
  const directTitle = firstValue(profile, ['level_title', 'niveau_nom', 'level_name', 'title']);
  const directXp = asPercentage(firstValue(profile, ['experience', 'experience_percentage', 'xp', 'xp_percentage']));
  const directNextLevel = firstValue(profile, ['next_level', 'next_level_title', 'prochain_niveau']);
  if (directLevel || directTitle || directXp !== null) return { level: directLevel, title: directTitle, xp: directXp, nextLevel: directNextLevel };

  const definitions = (levelDefinitions || [])
    .filter((definition) => definition.badge_type === 'level' && Number.isFinite(Number(definition.required_missions)))
    .sort((a, b) => Number(a.required_missions) - Number(b.required_missions));
  if (!definitions.length) return { level: null, title: null, xp: null, nextLevel: null };

  const completed = (missions || []).filter((mission) => mission.status === 'completed' && missionType(mission) === 'pure').length;
  const current = definitions.filter((definition) => completed >= Number(definition.required_missions)).at(-1) || null;
  const next = definitions.find((definition) => completed < Number(definition.required_missions)) || null;
  const currentThreshold = Number(current?.required_missions || 0);
  const nextThreshold = Number(next?.required_missions || 0);
  const xp = next ? asPercentage((completed - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) : 100;
  return {
    level: current?.level || current?.badge_key || null,
    title: current?.display_name || current?.name || current?.badge_key || null,
    xp,
    nextLevel: next?.display_name || next?.name || next?.level || next?.badge_key || null,
  };
}
