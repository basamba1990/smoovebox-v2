import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook pour gérer les données LUMIA (territoires, profils utilisateur, scores)
 */
export function useLumia() {
  const [userProfile, setUserProfile] = useState(null);
  const [lumiaData, setLumiaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger le profil LUMIA de l'utilisateur connecté
  useEffect(() => {
    const loadUserLumia = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUserProfile(null);
          setLumiaData(null);
          return;
        }

        // Récupérer l'entrée dans users_lumia
        const { data: userLumia, error: userError } = await supabase
          .from('users_lumia')
          .select('*, lumia(*)')
          .eq('auth_id', user.id)
          .single();

        if (userError && userError.code !== 'PGRST116') { // PGRST116 = not found
          throw userError;
        }

        if (userLumia) {
          setUserProfile(userLumia);
          setLumiaData(userLumia.lumia);
        } else {
          // Créer un profil par défaut si nécessaire
          setUserProfile(null);
          setLumiaData(null);
        }
      } catch (err) {
        console.error('Erreur chargement LUMIA:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadUserLumia();
  }, []);

  // Calculer l'équilibre énergétique (moyenne des 4 scores)
  const calculateBalance = useCallback(() => {
    if (!userProfile?.radar_scores) return 0;
    const { feu, air, terre, eau } = userProfile.radar_scores;
    return Math.round((feu + air + terre + eau) / 4);
  }, [userProfile]);

  // Liste des territoires (LUMIA) disponibles
  const [territories, setTerritories] = useState([]);
  useEffect(() => {
    const loadTerritories = async () => {
      const { data } = await supabase.from('lumia').select('*');
      if (data) setTerritories(data);
    };
    loadTerritories();
  }, []);

  // Zones énergétiques (constantes)
  const zones = [
    { id: 'feu', label: 'FEU', icon: '🔥', color: '#F97316' },
    { id: 'air', label: 'AIR', icon: '🌬', color: '#0EA5E9' },
    { id: 'terre', label: 'TERRE', icon: '🌍', color: '#22C55E' },
    { id: 'eau', label: 'EAU', icon: '💧', color: '#06B6D4' },
  ];

  // Obtenir les infos d'un territoire par son ID
  const getTerritoryInfo = useCallback((territoryId) => {
    return territories.find(t => t.id === territoryId) || null;
  }, [territories]);

  return {
    userProfile,
    lumiaData,
    loading,
    error,
    calculateBalance,
    territories,
    zones,
    getTerritoryInfo,
  };
}
