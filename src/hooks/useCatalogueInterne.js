import { useState, useCallback, useEffect } from 'react';
import {
  CATALOGUE_ETAPES,
  getNextEtape,
  getPreviousEtape,
} from '../config/catalogue-interne.config';

const STORAGE_KEY = 'catalogue_progress';

/**
 * Hook personnalisé pour gérer la progression dans le Catalogue Interne.
 * @returns {object} État et fonctions de gestion du catalogue.
 */
export function useCatalogueInterne() {
  const [currentEtapeId, setCurrentEtapeId] = useState(1);
  const [completedEtapes, setCompletedEtapes] = useState([]);
  const [etapeData, setEtapeData] = useState({});
  const [loading, setLoading] = useState(true);

  // Chargement depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCurrentEtapeId(parsed.etape || 1);
        setCompletedEtapes(parsed.completed || []);
        setEtapeData(parsed.data || {});
      }
    } catch (error) {
      console.error('Erreur lors du chargement du catalogue depuis localStorage:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sauvegarde dans localStorage
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            etape: currentEtapeId,
            completed: completedEtapes,
            data: etapeData,
          })
        );
      } catch (error) {
        console.error('Erreur lors de la sauvegarde du catalogue:', error);
      }
    }
  }, [currentEtapeId, completedEtapes, etapeData, loading]);

  // Récupération de l'objet étape actuelle
  const getCurrentEtape = useCallback(() => {
    return CATALOGUE_ETAPES.find(e => e.id === currentEtapeId) || CATALOGUE_ETAPES[0];
  }, [currentEtapeId]);

  // Navigation
  const goToNextEtape = useCallback(() => {
    const next = getNextEtape(currentEtapeId);
    if (next) {
      setCurrentEtapeId(next.id);
      // Marquer l'étape précédente comme complétée si ce n'est pas déjà fait
      setCompletedEtapes(prev => {
        if (!prev.includes(currentEtapeId)) {
          return [...prev, currentEtapeId];
        }
        return prev;
      });
      return true;
    }
    return false;
  }, [currentEtapeId]);

  const goToPreviousEtape = useCallback(() => {
    const prev = getPreviousEtape(currentEtapeId);
    if (prev) {
      setCurrentEtapeId(prev.id);
      return true;
    }
    return false;
  }, [currentEtapeId]);

  const goToEtape = useCallback((etapeId) => {
    if (etapeId >= 1 && etapeId <= 10) {
      setCurrentEtapeId(etapeId);
      return true;
    }
    return false;
  }, []);

  // Gestion des données
  const completeEtape = useCallback((etapeId = currentEtapeId) => {
    setCompletedEtapes(prev => {
      if (prev.includes(etapeId)) return prev;
      return [...prev, etapeId];
    });
  }, [currentEtapeId]);

  const saveEtapeData = useCallback((etapeId, data) => {
    setEtapeData(prev => ({
      ...prev,
      [etapeId]: {
        ...(prev[etapeId] || {}),
        ...data,
        lastUpdated: new Date().toISOString(),
      },
    }));
  }, []);

  const getEtapeData = useCallback((etapeId = currentEtapeId) => {
    return etapeData[etapeId] || {};
  }, [etapeData, currentEtapeId]);

  const getProgress = useCallback(() => {
    const total = 10;
    const completed = completedEtapes.length;
    return {
      current: currentEtapeId,
      total,
      percentage: Math.round((currentEtapeId / total) * 100),
      completed,
      remaining: total - completed,
    };
  }, [currentEtapeId, completedEtapes]);

  const reset = useCallback(() => {
    setCurrentEtapeId(1);
    setCompletedEtapes([]);
    setEtapeData({});
  }, []);

  const isEtapeCompleted = useCallback(
    (etapeId) => completedEtapes.includes(etapeId),
    [completedEtapes]
  );

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
    isFirstEtape: currentEtapeId === 1,
    isLastEtape: currentEtapeId === 10,
    isEtapeCompleted,
    canGoNext: currentEtapeId < 10,
    canGoPrev: currentEtapeId > 1,
  };
}
