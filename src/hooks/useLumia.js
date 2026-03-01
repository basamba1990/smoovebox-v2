/**
 * Hook useLumia - VERSION CORRIGÉE
 * Gestion complète du profil LUMIA avec initialisation et fallbacks
 * 
 * Corrections:
 * - Initialisation automatique du profil si absent
 * - Fallbacks pour toutes les données manquantes
 * - Gestion d'erreurs robuste
 * - localStorage pour persistance
 * - Supabase integration ready
 */

import { useState, useEffect, useCallback } from 'react';

// Configuration par défaut
const DEFAULT_LUMIA_PROFILE = {
  user: {
    id: null,
    name: 'Joueur',
    email: null,
  },
  lumia: {
    id: null,
    territoire: 'Casablanca',
    feu_score: 50,
    air_score: 50,
    terre_score: 50,
    eau_score: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

const TERRITORIES = [
  { id: 1, name: 'Casablanca', emoji: '🏙️', color: '#F97316' },
  { id: 2, name: 'Tenerife', emoji: '🏝️', color: '#06B6D4' },
  { id: 3, name: 'Marseille', emoji: '🌊', color: '#F97316' },
  { id: 4, name: 'Dakar', emoji: '🌍', color: '#06B6D4' },
];

const ENERGY_ZONES = {
  feu: { label: 'FEU', emoji: '🔥', color: '#F97316', description: 'Leadership & Action' },
  air: { label: 'AIR', emoji: '🌬', color: '#0EA5E9', description: 'Innovation & Vision' },
  terre: { label: 'TERRE', emoji: '🌍', color: '#22C55E', description: 'Structure & Organisation' },
  eau: { label: 'EAU', emoji: '💧', color: '#06B6D4', description: 'Cohésion & Impact Social' },
};

export function useLumia() {
  const [userLumiaProfile, setUserLumiaProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger le profil LUMIA
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // Essayer de charger depuis localStorage
        const storedProfile = localStorage.getItem('userLumiaProfile');
        
        if (storedProfile) {
          const parsedProfile = JSON.parse(storedProfile);
          setUserLumiaProfile(parsedProfile);
        } else {
          // En production, charger depuis Supabase
          // const { data, error } = await supabase
          //   .from('user_lumia_profiles')
          //   .select('*')
          //   .single();
          
          // Pour l'instant, utiliser le profil par défaut
          setUserLumiaProfile(DEFAULT_LUMIA_PROFILE);
        }
      } catch (err) {
        console.error('Erreur lors du chargement du profil LUMIA:', err);
        setError('Impossible de charger votre profil LUMIA');
        // Fallback au profil par défaut
        setUserLumiaProfile(DEFAULT_LUMIA_PROFILE);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Initialiser le profil LUMIA
  const initializeProfile = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const newProfile = {
        user: {
          id: userData.id || null,
          name: userData.name || 'Joueur',
          email: userData.email || null,
        },
        lumia: {
          id: Math.random().toString(36).substr(2, 9),
          territoire: userData.territoire || 'Casablanca',
          feu_score: userData.feu_score || 50,
          air_score: userData.air_score || 50,
          terre_score: userData.terre_score || 50,
          eau_score: userData.eau_score || 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      // Sauvegarder dans localStorage
      localStorage.setItem('userLumiaProfile', JSON.stringify(newProfile));
      setUserLumiaProfile(newProfile);

      // En production, sauvegarder dans Supabase
      // await supabase.from('user_lumia_profiles').insert([newProfile]);

      return newProfile;
    } catch (err) {
      console.error('Erreur lors de l\'initialisation du profil:', err);
      setError('Impossible de créer votre profil LUMIA');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Mettre à jour les scores énergétiques
  const updateEnergyScores = useCallback(async (scores) => {
    try {
      setLoading(true);
      setError(null);

      if (!userLumiaProfile) {
        throw new Error('Profil LUMIA non trouvé');
      }

      const updatedProfile = {
        ...userLumiaProfile,
        lumia: {
          ...userLumiaProfile.lumia,
          feu_score: Math.max(0, Math.min(100, scores.feu_score ?? userLumiaProfile.lumia.feu_score)),
          air_score: Math.max(0, Math.min(100, scores.air_score ?? userLumiaProfile.lumia.air_score)),
          terre_score: Math.max(0, Math.min(100, scores.terre_score ?? userLumiaProfile.lumia.terre_score)),
          eau_score: Math.max(0, Math.min(100, scores.eau_score ?? userLumiaProfile.lumia.eau_score)),
          updated_at: new Date().toISOString(),
        },
      };

      localStorage.setItem('userLumiaProfile', JSON.stringify(updatedProfile));
      setUserLumiaProfile(updatedProfile);

      // En production, mettre à jour dans Supabase
      // await supabase
      //   .from('user_lumia_profiles')
      //   .update(updatedProfile.lumia)
      //   .eq('id', updatedProfile.lumia.id);

      return updatedProfile;
    } catch (err) {
      console.error('Erreur lors de la mise à jour des scores:', err);
      setError('Impossible de mettre à jour vos scores énergétiques');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userLumiaProfile]);

  // Changer de territoire
  const changeTerritory = useCallback(async (territory) => {
    try {
      setLoading(true);
      setError(null);

      if (!userLumiaProfile) {
        throw new Error('Profil LUMIA non trouvé');
      }

      const updatedProfile = {
        ...userLumiaProfile,
        lumia: {
          ...userLumiaProfile.lumia,
          territoire: territory,
          updated_at: new Date().toISOString(),
        },
      };

      localStorage.setItem('userLumiaProfile', JSON.stringify(updatedProfile));
      setUserLumiaProfile(updatedProfile);

      return updatedProfile;
    } catch (err) {
      console.error('Erreur lors du changement de territoire:', err);
      setError('Impossible de changer votre territoire');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userLumiaProfile]);

  // Calculer l'équilibre énergétique
  const calculateBalance = useCallback(() => {
    if (!userLumiaProfile?.lumia) return 0;
    
    const { feu_score = 50, air_score = 50, terre_score = 50, eau_score = 50 } = userLumiaProfile.lumia;
    const avg = (feu_score + air_score + terre_score + eau_score) / 4;
    const variance = [feu_score, air_score, terre_score, eau_score].reduce(
      (sum, val) => sum + Math.pow(val - avg, 2),
      0
    ) / 4;
    return Math.round(100 - Math.sqrt(variance));
  }, [userLumiaProfile]);

  // Obtenir la zone dominante
  const getDominantZone = useCallback(() => {
    if (!userLumiaProfile?.lumia) return null;
    
    const { feu_score = 50, air_score = 50, terre_score = 50, eau_score = 50 } = userLumiaProfile.lumia;
    const scores = {
      feu: feu_score,
      air: air_score,
      terre: terre_score,
      eau: eau_score,
    };
    
    return Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  }, [userLumiaProfile]);

  // Réinitialiser le profil
  const resetProfile = useCallback(() => {
    localStorage.removeItem('userLumiaProfile');
    setUserLumiaProfile(DEFAULT_LUMIA_PROFILE);
  }, []);

  return {
    userLumiaProfile,
    loading,
    error,
    initializeProfile,
    updateEnergyScores,
    changeTerritory,
    calculateBalance,
    getDominantZone,
    resetProfile,
    territories: TERRITORIES,
    energyZones: ENERGY_ZONES,
  };
}

export default useLumia;
