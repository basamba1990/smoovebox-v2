import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook pour gérer le flux de projet LUMIA (mission, constellation, pitch, mise à jour)
 */
export function useLumiaFlow() {
  const [currentStep, setCurrentStep] = useState(1); // 1-5
  const [missionData, setMissionData] = useState(null);
  const [constellationData, setConstellationData] = useState(null);
  const [pitchData, setPitchData] = useState(null);
  const [lumiaUpdate, setLumiaUpdate] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Étape 2 : Sélectionner une mission
  const selectMission = useCallback(async (missionId) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('id', missionId)
        .single();
      if (error) throw error;
      setMissionData(data);
      setErrors(prev => ({ ...prev, mission: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, mission: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Étape 3 : Former une constellation
  const formConstellation = useCallback(async (members, mentorId = null) => {
    try {
      if (!members || members.length !== 4) {
        throw new Error('Une constellation doit avoir exactement 4 membres');
      }
      setLoading(true);
      // Ici on pourrait créer la constellation en base
      setConstellationData({ members, mentor_id: mentorId, status: 'active' });
      setErrors(prev => ({ ...prev, constellation: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, constellation: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Étape 4 : Soumettre un pitch
  const submitPitch = useCallback(async (videoUrl, constellationId) => {
    try {
      if (!videoUrl) throw new Error('URL vidéo requise');
      setLoading(true);
      const { data, error } = await supabase
        .from('pitch')
        .insert({
          constellation_id: constellationId,
          video_url: videoUrl,
          validation_status: 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      setPitchData(data);
      setErrors(prev => ({ ...prev, pitch: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, pitch: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Étape 5 : Mettre à jour LUMIA (créer un log de mise à jour)
  const updateLumia = useCallback(async (lumiaId, scores) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lumia_update_logs')
        .insert({
          lumia_id: lumiaId,
          feu_delta: scores.feu || 0,
          air_delta: scores.air || 0,
          terre_delta: scores.terre || 0,
          eau_delta: scores.eau || 0,
          pitch_id: pitchData?.id,
        })
        .select()
        .single();
      if (error) throw error;
      setLumiaUpdate(data);
      setErrors(prev => ({ ...prev, lumia: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, lumia: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  }, [pitchData]);

  // Navigation
  const goToNextStep = useCallback(() => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      return true;
    }
    return false;
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      return true;
    }
    return false;
  }, [currentStep]);

  const goToStep = useCallback((step) => {
    if (step >= 1 && step <= 5) {
      setCurrentStep(step);
      return true;
    }
    return false;
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(1);
    setMissionData(null);
    setConstellationData(null);
    setPitchData(null);
    setLumiaUpdate(null);
    setErrors({});
  }, []);

  // Validation d'étape
  const isStepValid = useCallback(
    (step) => {
      switch (step) {
        case 1:
          return true; // Profil déjà chargé via useLumia
        case 2:
          return !!missionData;
        case 3:
          return !!constellationData;
        case 4:
          return !!pitchData;
        case 5:
          return !!lumiaUpdate;
        default:
          return false;
      }
    },
    [missionData, constellationData, pitchData, lumiaUpdate]
  );

  return {
    currentStep,
    missionData,
    constellationData,
    pitchData,
    lumiaUpdate,
    errors,
    loading,
    selectMission,
    formConstellation,
    submitPitch,
    updateLumia,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    reset,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === 5,
    canGoNext: currentStep < 5,
    canGoPrev: currentStep > 1,
    isStepValid,
  };
}
