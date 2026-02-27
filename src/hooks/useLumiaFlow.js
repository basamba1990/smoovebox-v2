import { useState, useCallback, useEffect } from 'react';

/**
 * Hook gérant le flux complet : Profil -> Mission -> Constellation -> Pitch -> Mise à jour LUMIA.
 */
export function useLumiaFlow() {
  const [currentStep, setCurrentStep] = useState(1); // 1-5
  const [userData, setUserData] = useState(null);
  const [missionData, setMissionData] = useState(null);
  const [constellationData, setConstellationData] = useState(null);
  const [pitchData, setPitchData] = useState(null);
  const [lumiaUpdate, setLumiaUpdate] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Étape 1 : Profil utilisateur
  const setUserProfile = useCallback((data) => {
    try {
      if (!data.dominantZone) throw new Error('Zone dominante requise');
      setUserData(data);
      setErrors(prev => ({ ...prev, user: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, user: error.message }));
      return false;
    }
  }, []);

  // Étape 2 : Sélection mission
  const selectMission = useCallback((missionId) => {
    try {
      if (!missionId) throw new Error('Mission requise');
      setMissionData({ id: missionId });
      setErrors(prev => ({ ...prev, mission: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, mission: error.message }));
      return false;
    }
  }, []);

  // Étape 3 : Formation constellation
  const formConstellation = useCallback((members) => {
    try {
      if (!members || members.length !== 4) throw new Error('Constellation doit avoir 4 membres');
      setConstellationData({ members });
      setErrors(prev => ({ ...prev, constellation: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, constellation: error.message }));
      return false;
    }
  }, []);

  // Étape 4 : Soumission pitch
  const submitPitch = useCallback((videoUrl) => {
    try {
      if (!videoUrl) throw new Error('Vidéo requise');
      setPitchData({ videoUrl });
      setErrors(prev => ({ ...prev, pitch: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, pitch: error.message }));
      return false;
    }
  }, []);

  // Étape 5 : Mise à jour LUMIA
  const updateLumia = useCallback(async () => {
    try {
      setLoading(true);
      // Appel API pour mettre à jour LUMIA
      const response = await fetch('/api/lumia/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userData,
          missionData,
          constellationData,
          pitchData,
        }),
      });

      if (!response.ok) throw new Error('Erreur mise à jour LUMIA');

      const result = await response.json();
      setLumiaUpdate(result);
      setErrors(prev => ({ ...prev, lumia: null }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, lumia: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  }, [userData, missionData, constellationData, pitchData]);

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

  // Réinitialiser
  const reset = useCallback(() => {
    setCurrentStep(1);
    setUserData(null);
    setMissionData(null);
    setConstellationData(null);
    setPitchData(null);
    setLumiaUpdate(null);
    setErrors({});
  }, []);

  // Persistance localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lumia_flow');
      if (saved) {
        const { step, user, mission, constellation, pitch, lumia } = JSON.parse(saved);
        setCurrentStep(step || 1);
        if (user) setUserData(user);
        if (mission) setMissionData(mission);
        if (constellation) setConstellationData(constellation);
        if (pitch) setPitchData(pitch);
        if (lumia) setLumiaUpdate(lumia);
      }
    } catch (error) {
      console.error('Erreur chargement flux:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'lumia_flow',
        JSON.stringify({
          step: currentStep,
          user: userData,
          mission: missionData,
          constellation: constellationData,
          pitch: pitchData,
          lumia: lumiaUpdate,
        })
      );
    } catch (error) {
      console.error('Erreur sauvegarde flux:', error);
    }
  }, [currentStep, userData, missionData, constellationData, pitchData, lumiaUpdate]);

  // Vérification de validité d'une étape
  const isStepValid = useCallback(
    (step) => {
      switch (step) {
        case 1:
          return !!userData;
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
    [userData, missionData, constellationData, pitchData, lumiaUpdate]
  );

  return {
    // État
    currentStep,
    userData,
    missionData,
    constellationData,
    pitchData,
    lumiaUpdate,
    errors,
    loading,

    // Étapes
    setUserProfile,
    selectMission,
    formConstellation,
    submitPitch,
    updateLumia,

    // Navigation
    goToNextStep,
    goToPreviousStep,
    goToStep,

    // Utilitaires
    reset,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === 5,
    canGoNext: currentStep < 5,
    canGoPrev: currentStep > 1,
    isStepValid,
  };
}
