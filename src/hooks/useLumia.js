/**
 * Hook useLumia - FIXED VERSION
 * Gère l'état LUMIA et les calculs d'équilibre énergétique
 */

import { useState, useCallback } from 'react';
import { LUMIA_CONFIG } from '../config/lumia.config.js';

export function useLumia() {
  const [userProfile, setUserProfile] = useState({
    territory: 'casablanca',
    dominantZone: 'feu',
    scores: { feu: 75, air: 75, terre: 75, eau: 75 },
  });

  const setTerritory = useCallback((territoryId) => {
    setUserProfile(prev => ({ ...prev, territory: territoryId }));
  }, []);

  const setDominantZone = useCallback((zoneId) => {
    setUserProfile(prev => ({ ...prev, dominantZone: zoneId }));
  }, []);

  const updateScores = useCallback((scores) => {
    setUserProfile(prev => ({ ...prev, scores }));
  }, []);

  const getTerritoryInfo = useCallback((id) => {
    return LUMIA_CONFIG.territories.find(t => t.id === id);
  }, []);

  const getZoneInfo = useCallback((id) => {
    return LUMIA_CONFIG.zones.find(z => z.id === id);
  }, []);

  const calculateBalance = useCallback(() => {
    const { scores } = userProfile;
    const values = Object.values(scores);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.round(100 - Math.sqrt(variance));
  }, [userProfile]);

  return {
    userProfile,
    setTerritory,
    setDominantZone,
    updateScores,
    getTerritoryInfo,
    getZoneInfo,
    calculateBalance,
    territories: LUMIA_CONFIG.territories,
    zones: LUMIA_CONFIG.zones,
    modules: LUMIA_CONFIG.modules,
  };
}
