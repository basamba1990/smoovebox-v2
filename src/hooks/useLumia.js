import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error('Utilisateur non authentifié');
        }

        // ✅ CORRECTION : utiliser maybeSingle() au lieu de single()
        const { data, error: fetchError } = await supabase
          .from('user_lumia_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (data) {
          setUserLumiaProfile({
            user: {
              id: user.id,
              name: user.user_metadata?.name || 'Joueur',
              email: user.email,
            },
            lumia: {
              id: data.id,
              territoire: data.territoire,
              feu_score: data.feu_score,
              air_score: data.air_score,
              terre_score: data.terre_score,
              eau_score: data.eau_score,
              created_at: data.created_at,
              updated_at: data.updated_at,
            },
          });
        } else {
          setUserLumiaProfile(DEFAULT_LUMIA_PROFILE);
        }
      } catch (err) {
        console.error('Erreur lors du chargement du profil LUMIA:', err);
        setError('Impossible de charger votre profil LUMIA');
        setUserLumiaProfile(DEFAULT_LUMIA_PROFILE);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const initializeProfile = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Utilisateur non authentifié');
      }

      const { data, error: insertError } = await supabase
        .from('user_lumia_profiles')
        .insert([{
          user_id: user.id,
          territoire: userData.territoire || 'Casablanca',
          feu_score: userData.feu_score || 50,
          air_score: userData.air_score || 50,
          terre_score: userData.terre_score || 50,
          eau_score: userData.eau_score || 50,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      const newProfile = {
        user: {
          id: user.id,
          name: user.user_metadata?.name || 'Joueur',
          email: user.email,
        },
        lumia: {
          id: data.id,
          territoire: data.territoire,
          feu_score: data.feu_score,
          air_score: data.air_score,
          terre_score: data.terre_score,
          eau_score: data.eau_score,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
      };

      setUserLumiaProfile(newProfile);
      return newProfile;
    } catch (err) {
      console.error('Erreur lors de l\'initialisation du profil:', err);
      setError('Impossible de créer votre profil LUMIA');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEnergyScores = useCallback(async (scores) => {
    try {
      setLoading(true);
      setError(null);

      if (!userLumiaProfile?.lumia?.id) {
        throw new Error('Profil LUMIA non trouvé');
      }

      const { data, error: updateError } = await supabase
        .from('user_lumia_profiles')
        .update({
          feu_score: Math.max(0, Math.min(100, scores.feu_score ?? userLumiaProfile.lumia.feu_score)),
          air_score: Math.max(0, Math.min(100, scores.air_score ?? userLumiaProfile.lumia.air_score)),
          terre_score: Math.max(0, Math.min(100, scores.terre_score ?? userLumiaProfile.lumia.terre_score)),
          eau_score: Math.max(0, Math.min(100, scores.eau_score ?? userLumiaProfile.lumia.eau_score)),
        })
        .eq('id', userLumiaProfile.lumia.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedProfile = {
        ...userLumiaProfile,
        lumia: {
          ...userLumiaProfile.lumia,
          feu_score: data.feu_score,
          air_score: data.air_score,
          terre_score: data.terre_score,
          eau_score: data.eau_score,
          updated_at: data.updated_at,
        },
      };

      setUserLumiaProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      console.error('Erreur lors de la mise à jour des scores:', err);
      setError('Impossible de mettre à jour vos scores énergétiques');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userLumiaProfile]);

  const changeTerritory = useCallback(async (territory) => {
    try {
      setLoading(true);
      setError(null);

      if (!userLumiaProfile?.lumia?.id) {
        throw new Error('Profil LUMIA non trouvé');
      }

      const { data, error: updateError } = await supabase
        .from('user_lumia_profiles')
        .update({ territoire: territory })
        .eq('id', userLumiaProfile.lumia.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedProfile = {
        ...userLumiaProfile,
        lumia: {
          ...userLumiaProfile.lumia,
          territoire: data.territoire,
          updated_at: data.updated_at,
        },
      };

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

  const resetProfile = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Utilisateur non authentifié');
      }

      const { error: deleteError } = await supabase
        .from('user_lumia_profiles')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setUserLumiaProfile(DEFAULT_LUMIA_PROFILE);
    } catch (err) {
      console.error('Erreur lors de la réinitialisation du profil:', err);
      setError('Impossible de réinitialiser votre profil');
    }
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
