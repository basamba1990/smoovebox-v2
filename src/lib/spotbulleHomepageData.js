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

export function pickNextMission(missions) {
  const available = (missions || []).filter((mission) => mission.status !== 'completed');
  return available.find((mission) => mission.type === 'pure') || available[0] || null;
}

export function calculateImpact(missions) {
  const values = new Map();
  (missions || []).forEach((mission) => {
    const entries = [mission.skillA, mission.type === 'hybrid' ? mission.skillB : null].filter(Boolean);
    entries.forEach((skill) => {
      const key = skill.energy || 'Non renseignée';
      const current = values.get(key) || { total: 0, completed: 0 };
      current.total += 1;
      if (mission.status === 'completed') current.completed += 1;
      values.set(key, current);
    });
  });
  const rows = [...values.entries()].map(([label, value]) => ({ label, value: value.total ? Math.round((value.completed / value.total) * 100) : 0 }));
  const global = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.value, 0) / rows.length) : null;
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
