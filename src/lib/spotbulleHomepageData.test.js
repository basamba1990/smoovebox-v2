import { describe, expect, it } from 'vitest';
import {
  asPercentage,
  calculateImpact,
  firstValue,
  levelPresentation,
  missionSessionCount,
  normalizeRadarValues,
  selectNextMission,
} from './spotbulleHomepageData.js';

describe('spotbulleHomepageData', () => {
  it('bloque les hybrides tant que les missions pures du territoire ne sont pas terminées', () => {
    const mission = selectNextMission([
      { id: 'hybrid', type: 'hybrid', territory: 'Cattleya', status: 'pending' },
      { id: 'pure', type: 'pure', territory: 'Cattleya', status: 'pending' },
    ], [{ territory: 'Cattleya', order_index: 1, required_missions: 1 }]);
    expect(mission.id).toBe('pure');
  });

  it('autorise une hybride après le quota de missions pures', () => {
    const mission = selectNextMission([
      { id: 'done-pure', type: 'pure', territory: 'Cattleya', status: 'completed' },
      { id: 'hybrid', type: 'hybrid', territory: 'Cattleya', status: 'pending' },
    ], [{ territory: 'Cattleya', order_index: 1, required_missions: 1 }]);
    expect(mission.id).toBe('hybrid');
  });

  it('extrait le nombre de sessions seulement quand il existe réellement', () => {
    expect(missionSessionCount({ sessions_count: 3 })).toBe(3);
    expect(missionSessionCount({})).toBeNull();
  });

  it('normalise une fraction ou un pourcentage dans [0, 100]', () => {
    expect(asPercentage(0.42)).toBe(42);
    expect(asPercentage(84)).toBe(84);
    expect(asPercentage(140)).toBe(100);
    expect(asPercentage(null)).toBeNull();
  });

  it('calcule les progressions par énergie et retourne une globale seulement si les poids sont disponibles', () => {
    const result = calculateImpact([
      { type: 'pure', status: 'completed', skillA: { energy: 'Energie1' } },
      { type: 'pure', status: 'pending', skillA: { energy: 'Energie1' } },
      { type: 'hybrid', status: 'completed', skillA: { energy: 'Energie2' }, skillB: { energy: 'Energie3' } },
    ]);
    expect(result.rows).toEqual([
      { label: 'Energie1', value: 50, weight: null },
      { label: 'Energie2', value: 100, weight: null },
      { label: 'Energie3', value: 100, weight: null },
    ]);
    expect(result.global).toBeNull();
    expect(calculateImpact([
      { type: 'pure', status: 'completed', skillA: { energy: 'Energie1', impact_weight: 2 } },
      { type: 'pure', status: 'pending', skillA: { energy: 'Energie1', impact_weight: 2 } },
      { type: 'hybrid', status: 'completed', skillA: { energy: 'Energie2', impact_weight: 1 }, skillB: { energy: 'Energie3', impact_weight: 1 } },
    ]).global).toBe(75);
  });

  it('calcule un niveau et l’XP uniquement avec des définitions de niveau persistées', () => {
    expect(levelPresentation(null, [
      { type: 'pure', status: 'completed' },
      { type: 'pure', status: 'completed' },
    ], [
      { badge_type: 'level', badge_key: 'explorateur', display_name: 'Explorateur', required_missions: 0 },
      { badge_type: 'level', badge_key: 'eclaireur', display_name: 'Éclaireur', required_missions: 5 },
    ])).toEqual({ level: 'explorateur', title: 'Explorateur', xp: 40, nextLevel: 'Éclaireur' });
    expect(levelPresentation(null, [], [])).toEqual({ level: null, title: null, xp: null, nextLevel: null });
  });

  it('utilise les premières colonnes disponibles du radar sans inventer de valeur', () => {
    expect(firstValue({ air_score: 0.5 }, ['air', 'air_score'])).toBe(0.5);
    expect(normalizeRadarValues({ air_score: 0.5, water: 20 })).toEqual([50, 20, null, null, null]);
    expect(normalizeRadarValues(null)).toEqual([null, null, null, null, null]);
  });
});
