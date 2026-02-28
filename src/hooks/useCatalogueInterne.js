import { useState, useCallback, useEffect } from 'react';
import { CATALOGUE_ETAPES, getNextEtape, getPreviousEtape } from '../config/catalogue-interne.config';

/**
 * Hook pour gérer la progression à travers le catalogue interne
 * Suivi des 10 étapes du parcours élève
 */

export function useCatalogueInterne() {
  const [currentEtape, setCurrentEtape] = useState(1);
  const [completedEtapes, setCompletedEtapes] = useState([]);
  const [etapeData, setEtapeData] = useState({});
  const [loading, setLoading] = useState(false);

  // Récupérer l'étape actuelle
  const getCurrentEtape = useCallback(() => {
    return CATALOGUE_ETAPES.find(e => e.id === currentEtape);
  }, [currentEtape]);

  // Avancer à l'étape suivante
  const goToNextEtape = useCallback(() => {
    const nextEtape = getNextEtape(currentEtape);
    if (nextEtape) {
      setCurrentEtape(nextEtape.id);
      if (!completedEtapes.includes(currentEtape)) {
        setCompletedEtapes([...completedEtapes, currentEtape]);
      }
      return true;
    }
    return false;
  }, [currentEtape, completedEtapes]);

  // Revenir à l'étape précédente
  const goToPreviousEtape = useCallback(() => {
    const prevEtape = getPreviousEtape(currentEtape);
    if (prevEtape) {
      setCurrentEtape(prevEtape.id);
      return true;
    }
    return false;
  }, [currentEtape]);

  // Aller à une étape spécifique
  const goToEtape = useCallback((etapeId) => {
    if (etapeId >= 1 && etapeId <= CATALOGUE_ETAPES.length) {
      setCurrentEtape(etapeId);
      return true;
    }
    return false;
  }, []);

  // Marquer une étape comme complétée
  const completeEtape = useCallback((etapeId = currentEtape) => {
    if (!completedEtapes.includes(etapeId)) {
      setCompletedEtapes([...completedEtapes, etapeId]);
    }
  }, [currentEtape, completedEtapes]);

  // Sauvegarder les données d'une étape
  const saveEtapeData = useCallback((etapeId, data) => {
    setEtapeData(prev => ({
      ...prev,
      [etapeId]: { ...prev[etapeId], ...data },
    }));
  }, []);

  // Récupérer les données d'une étape
  const getEtapeData = useCallback((etapeId = currentEtape) => {
    return etapeData[etapeId] || {};
  }, [currentEtape, etapeData]);

  // Calculer la progression
  const getProgress = useCallback(() => {
    return {
      current: currentEtape,
      total: CATALOGUE_ETAPES.length,
      percentage: Math.round((currentEtape / CATALOGUE_ETAPES.length) * 100),
      completed: completedEtapes.length,
      remaining: CATALOGUE_ETAPES.length - completedEtapes.length,
    };
  }, [currentEtape, completedEtapes]);

  // Réinitialiser le catalogue
  const reset = useCallback(() => {
    setCurrentEtape(1);
    setCompletedEtapes([]);
    setEtapeData({});
  }, []);

  // Charger depuis le localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('catalogue_progress');
      if (saved) {
        const { etape, completed, data } = JSON.parse(saved);
        setCurrentEtape(etape || 1);
        setCompletedEtapes(completed || []);
        setEtapeData(data || {});
      }
    } catch (error) {
      console.error('Erreur chargement progression:', error);
    }
  }, []);

  // Sauvegarder dans le localStorage
  useEffect(() => {
    try {
      localStorage.setItem('catalogue_progress', JSON.stringify({
        etape: currentEtape,
        completed: completedEtapes,
        data: etapeData,
      }));
    } catch (error) {
      console.error('Erreur sauvegarde progression:', error);
    }
  }, [currentEtape, completedEtapes, etapeData]);

  return {
    // État
    currentEtape: getCurrentEtape(),
    completedEtapes,
    etapeData,
    loading,
    
    // Navigation
    goToNextEtape,
    goToPreviousEtape,
    goToEtape,
    
    // Gestion
    completeEtape,
    saveEtapeData,
    getEtapeData,
    getProgress,
    reset,
    
    // Utilitaires
    isFirstEtape: currentEtape === 1,
    isLastEtape: currentEtape === CATALOGUE_ETAPES.length,
    isEtapeCompleted: (etapeId) => completedEtapes.includes(etapeId),
    canGoNext: currentEtape < CATALOGUE_ETAPES.length,
    canGoPrev: currentEtape > 1,
  };
}
