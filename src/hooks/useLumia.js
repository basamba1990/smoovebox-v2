/**
 * Hook useLumia - VERSION MISE À JOUR
 * Compatible avec le nouveau schéma SQL:
 * - lumia_territories (métadonnées des territoires)
 * - lumia_zones (métadonnées des zones)
 * - user_lumia_profile (profil LUMIA spécifique à l'utilisateur)
 * 
 * Ce hook récupère les données réelles de Supabase et les expose de manière cohérente.
 */

import { useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useQuery } from '@tanstack/react-query';

export function useLumia() {
  const supabase = useSupabaseClient();
  const currentUser = useUser();

  // ============================================================================
  // 1. Récupérer les territoires depuis lumia_territories
  // ============================================================================
  const {
    data: territories = [],
    isLoading: loadingTerritories,
    error: territoriesError,
  } = useQuery({
    queryKey: ['lumia-territories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lumia_territories')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('[useLumia] Erreur récupération territoires:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 5, // Cache 5 minutes
  });

  // ============================================================================
  // 2. Récupérer les zones depuis lumia_zones
  // ============================================================================
  const {
    data: zones = [],
    isLoading: loadingZones,
    error: zonesError,
  } = useQuery({
    queryKey: ['lumia-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lumia_zones')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('[useLumia] Erreur récupération zones:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 5, // Cache 5 minutes
  });

  // ============================================================================
  // 3. Récupérer le profil LUMIA de l'utilisateur connecté
  // ============================================================================
  const {
    data: userLumiaProfile,
    isLoading: loadingProfile,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['user-lumia-profile', currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      if (!currentUser) return null;

      const { data, error } = await supabase
        .from('user_lumia_profile')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = "not found", ce qui est acceptable si l'utilisateur n'a pas encore de profil
        console.error('[useLumia] Erreur récupération profil utilisateur:', error);
        throw error;
      }

      return data || null;
    },
  });

  // ============================================================================
  // 4. Fonctions utilitaires
  // ============================================================================

  const getTerritoryInfo = useCallback((territoryId) => {
    return territories.find(t => t.id === territoryId);
  }, [territories]);

  const getZoneInfo = useCallback((zoneId) => {
    return zones.find(z => z.id === zoneId);
  }, [zones]);

  const calculateBalance = useCallback(() => {
    if (!userLumiaProfile) return 50;

    const { feu_score, air_score, terre_score, eau_score } = userLumiaProfile;
    const scores = [feu_score, air_score, terre_score, eau_score];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / scores.length;
    
    // Formule: 100 - sqrt(variance) pour mesurer l'équilibre
    // Plus les scores sont équilibrés, plus la valeur est proche de 100
    return Math.round(100 - Math.sqrt(variance));
  }, [userLumiaProfile]);

  const getScoresObject = useCallback(() => {
    if (!userLumiaProfile) {
      return { feu: 50, air: 50, terre: 50, eau: 50 };
    }

    return {
      feu: userLumiaProfile.feu_score,
      air: userLumiaProfile.air_score,
      terre: userLumiaProfile.terre_score,
      eau: userLumiaProfile.eau_score,
    };
  }, [userLumiaProfile]);

  const getDominantZoneInfo = useCallback(() => {
    if (!userLumiaProfile?.dominant_zone_id) return null;
    return getZoneInfo(userLumiaProfile.dominant_zone_id);
  }, [userLumiaProfile, getZoneInfo]);

  const getTerritoryProfile = useCallback(() => {
    if (!userLumiaProfile?.territory_id) return null;
    return getTerritoryInfo(userLumiaProfile.territory_id);
  }, [userLumiaProfile, getTerritoryInfo]);

  // ============================================================================
  // 5. Retourner l'interface publique du hook
  // ============================================================================
  return {
    // État
    userLumiaProfile,
    territories,
    zones,

    // Chargement
    isLoading: loadingProfile || loadingTerritories || loadingZones,
    loadingProfile,
    loadingTerritories,
    loadingZones,

    // Erreurs
    error: profileError || territoriesError || zonesError,
    profileError,
    territoriesError,
    zonesError,

    // Fonctions utilitaires
    getTerritoryInfo,
    getZoneInfo,
    getDominantZoneInfo,
    getTerritoryProfile,
    calculateBalance,
    getScoresObject,
    refetchProfile,

    // Compatibilité avec l'ancien hook (pour les composants existants)
    userProfile: {
      territory: userLumiaProfile?.territory_id || 'casablanca',
      dominantZone: userLumiaProfile?.dominant_zone_id || 'feu',
      scores: {
        feu: userLumiaProfile?.feu_score || 50,
        air: userLumiaProfile?.air_score || 50,
        terre: userLumiaProfile?.terre_score || 50,
        eau: userLumiaProfile?.eau_score || 50,
      },
    },
    modules: [
      { id: 1, name: 'LE SAS D\'ACCUEIL', desc: 'Inscription & Radar de naissance', icon: '🚀' },
      { id: 2, name: 'LE SCAN DES 4 ÉLÉMENTS', desc: 'Test comportemental & Étoile', icon: '🔍' },
      { id: 3, name: 'LE MODULE MIMÉTIQUE', desc: 'Dashboard & Jauges d\'énergie', icon: '📊' },
      { id: 4, name: 'LE LABO DE TRANSFORMATION', desc: 'SPOTCOACH IA & Métiers 2035', icon: '🧬' },
      { id: 5, name: 'LA CARTE GALACTIQUE', desc: 'Matching gagnant & Groupes', icon: '🌌' },
      { id: 6, name: 'LE JOURNAL DE MISSION', desc: 'Portfolio & Projets territoriaux', icon: '📖' },
      { id: 7, name: 'PORTAIL VERS LA PLANÈTE LUMI', desc: 'Certifications & Passport', icon: '🌟' },
    ],
  };
}
