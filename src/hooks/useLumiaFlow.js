import { useState, useCallback } from 'react';

export function useLumiaFlow() {
  const [flowState, setFlowState] = useState({
    user: null,
    mission: null,
    constellation: null,
    pitch: null,
    lumiaUpdate: null,
  });

  // 1. USER PROFILE
  const setUserProfile = useCallback((user) => {
    setFlowState(prev => ({ ...prev, user }));
  }, []);

  // 2. MISSION SELECTION
  const selectMission = useCallback((mission) => {
    setFlowState(prev => ({ ...prev, mission }));
  }, []);

  // 3. CONSTELLATION FORMATION (4 members)
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

  // 4. PITCH SUBMISSION
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

  // 5. LUMIA UPDATE
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

  // RESET FLOW
  const resetFlow = useCallback(() => {
    setFlowState({
      user: null,
      mission: null,
      constellation: null,
      pitch: null,
      lumiaUpdate: null,
    });
  }, []);

  // GET CURRENT STEP
  const getCurrentStep = useCallback(() => {
    if (!flowState.user) return 0;
    if (!flowState.mission) return 1;
    if (!flowState.constellation) return 2;
    if (!flowState.pitch) return 3;
    if (!flowState.lumiaUpdate) return 4;
    return 5;
  }, [flowState]);

  return {
    flowState,
    setUserProfile,
    selectMission,
    formConstellation,
    submitPitch,
    updateLumia,
    resetFlow,
    getCurrentStep,
    isComplete: getCurrentStep() === 5,
  };
}
