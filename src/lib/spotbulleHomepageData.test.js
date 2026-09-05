import { describe, expect, it } from 'vitest';
import {
  asPercentage,
  calculateImpact,
  firstValue,
  normalizeRadarValues,
  pickNextMission,
} from './spotbulleHomepageData.js';

describe('spotbulleHomepageData', () => {
  it('préfère une mission pure parmi les missions non terminées', () => {
    const mission = pickNextMission([
      { id: 'hybrid', type: 'hybrid', status: 'pending' },
      { id: 'done-pure', type: 'pure', status: 'completed' },
      { id: 'pure', type: 'pure', status: 'pending' },
    ]);
    expect(mission.id).toBe('pure');
  });

  it('normalise une fraction ou un pourcentage dans [0, 100]', () => {
    expect(asPercentage(0.42)).toBe(42);
    expect(asPercentage(84)).toBe(84);
    expect(asPercentage(140)).toBe(100);
    expect(asPercentage(null)).toBeNull();
  });

  it('calcule les progressions par énergie et la moyenne globale', () => {
    const result = calculateImpact([
      { type: 'pure', status: 'completed', skillA: { energy: 'Energie1' } },
      { type: 'pure', status: 'pending', skillA: { energy: 'Energie1' } },
      { type: 'hybrid', status: 'completed', skillA: { energy: 'Energie2' }, skillB: { energy: 'Energie3' } },
    ]);
    expect(result.rows).toEqual([
      { label: 'Energie1', value: 50 },
      { label: 'Energie2', value: 100 },
      { label: 'Energie3', value: 100 },
    ]);
    expect(result.global).toBe(83);
  });

  it('utilise les premières colonnes disponibles du radar sans inventer de valeur', () => {
    expect(firstValue({ air_score: 0.5 }, ['air', 'air_score'])).toBe(0.5);
    expect(normalizeRadarValues({ air_score: 0.5, water: 20 })).toEqual([50, 20, null, null, null]);
    expect(normalizeRadarValues(null)).toEqual([null, null, null, null, null]);
  });
});
