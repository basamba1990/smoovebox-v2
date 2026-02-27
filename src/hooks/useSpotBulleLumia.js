import { useState, useCallback } from 'react';

/**
 * UNIFIED SPOTBULLE + LUMIA HOOK
 * Consolidates all LUMIA functionality in one hook
 */

export function useSpotBulleLumia() {
  const [userProfile, setUserProfile] = useState({
    territory: null,
    dominantZone: null,
    scores: { feu: 50, air: 50, terre: 50, eau: 50 },
  });

  const [flowState, setFlowState] = useState({
    user: null,
    mission: null,
    constellation: null,
    pitch: null,
    lumiaUpdate: null,
  });

  // ========== PROFILE MANAGEMENT ==========

  const setTerritory = useCallback((territoryId) => {
    setUserProfile(prev => ({ ...prev, territory: territoryId }));
  }, []);

  const setDominantZone = useCallback((zoneId) => {
    setUserProfile(prev => ({ ...prev, dominantZone: zoneId }));
  }, []);

  const updateScores = useCallback((scores) => {
    setUserProfile(prev => ({ ...prev, scores }));
  }, []);

  // ========== FLOW MANAGEMENT ==========

  const setUserProfileFlow = useCallback((user) => {
    setFlowState(prev => ({ ...prev, user }));
  }, []);

  const selectMission = useCallback((mission) => {
    setFlowState(prev => ({ ...prev, mission }));
  }, []);

  const formConstellation = useCallback((members, mentor) => {
    const constellation = {
      id: Math.random().toString(36).substr(2, 9),
      members,
      mentor,
      status: 'active',
      created_at: new Date(),
    };
    setFlowState(prev => ({ ...prev, constellation }));
  }, []);

  const submitPitch = useCallback((videoUrl, feedback) => {
    const pitch = {
      id: Math.random().toString(36).substr(2, 9),
      video_url: videoUrl,
      validation_status: 'pending',
      feedback,
      created_at: new Date(),
    };
    setFlowState(prev => ({ ...prev, pitch }));
  }, []);

  const updateLumia = useCallback((deltas) => {
    const lumiaUpdate = {
      feu_delta: deltas.feu || 0,
      air_delta: deltas.air || 0,
      terre_delta: deltas.terre || 0,
      eau_delta: deltas.eau || 0,
      timestamp: new Date(),
    };
    setFlowState(prev => ({ ...prev, lumiaUpdate }));
  }, []);

  // ========== CALCULATIONS ==========

  const calculateBalance = useCallback(() => {
    const { scores } = userProfile;
    const values = Object.values(scores);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.round(100 - Math.sqrt(variance));
  }, [userProfile]);

  const getCurrentStep = useCallback(() => {
    if (!flowState.user) return 0;
    if (!flowState.mission) return 1;
    if (!flowState.constellation) return 2;
    if (!flowState.pitch) return 3;
    if (!flowState.lumiaUpdate) return 4;
    return 5;
  }, [flowState]);

  // ========== RESET ==========

  const resetFlow = useCallback(() => {
    setFlowState({
      user: null,
      mission: null,
      constellation: null,
      pitch: null,
      lumiaUpdate: null,
    });
  }, []);

  // ========== CONFIGURATION DATA ==========

  const territories = [
    { id: 'casablanca', name: 'LUMIA CASABLANCA', region: 'Maroc', icon: '🏙️', color: '#F97316' },
    { id: 'tenerife', name: 'LUMIA TENERIFE', region: 'Espagne', icon: '🏝️', color: '#06B6D4' },
    { id: 'marseille', name: 'LUMIA MARSEILLE', region: 'France', icon: '🌊', color: '#F97316' },
    { id: 'dakar', name: 'LUMIA DAKAR', region: 'Sénégal', icon: '🌍', color: '#06B6D4' },
  ];

  const zones = [
    { id: 'feu', label: 'FEU', desc: 'Leadership & Action', icon: '🔥', color: '#F97316' },
    { id: 'air', label: 'AIR', desc: 'Innovation & Vision', icon: '🌬', color: '#0EA5E9' },
    { id: 'terre', label: 'TERRE', desc: 'Structure & Organisation', icon: '🌍', color: '#22C55E' },
    { id: 'eau', label: 'EAU', desc: 'Cohésion & Impact Social', icon: '💧', color: '#06B6D4' },
  ];

  // ========== RETURN ==========

  return {
    // Profile state
    userProfile,
    setTerritory,
    setDominantZone,
    updateScores,
    calculateBalance,
    
    // Flow state
    flowState,
    setUserProfileFlow,
    selectMission,
    formConstellation,
    submitPitch,
    updateLumia,
    resetFlow,
    getCurrentStep,
    isFlowComplete: getCurrentStep() === 5,
    
    // Configuration
    territories,
    zones,
  };
}
