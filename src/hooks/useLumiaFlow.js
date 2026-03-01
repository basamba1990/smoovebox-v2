/**
 * Hook useLumiaFlow - VERSION MISE À JOUR
 * Gestion du flux LUMIA complet avec le nouveau schéma SQL
 * 
 * Gère: User → Mission → Constellation → Pitch → Update Lumia
 * 
 * Compatible avec:
 * - user_lumia_profile (profil utilisateur)
 * - lumia (scores territoriaux)
 * - missions (missions disponibles)
 * - constellations (équipes de 4)
 * - pitches (vidéos et validation)
 * - lumia_update_logs (historique des mises à jour)
 */

import { useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useLumiaFlow() {
  const supabase = useSupabaseClient();
  const currentUser = useUser();
  const queryClient = useQueryClient();

  // ============================================================================
  // 1. Récupérer le profil LUMIA de l'utilisateur
  // ============================================================================
  const {
    data: userLumiaProfile,
    isLoading: loadingProfile,
    error: profileError,
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
        console.error('[useLumiaFlow] Erreur profil utilisateur:', error);
        throw error;
      }

      return data || null;
    },
  });

  // ============================================================================
  // 2. Récupérer les scores territoriaux depuis la table lumia
  // ============================================================================
  const {
    data: territoryScores,
    isLoading: loadingTerritoryScores,
    error: territoryScoresError,
  } = useQuery({
    queryKey: ['territory-scores', userLumiaProfile?.territory_id],
    enabled: !!userLumiaProfile?.territory_id,
    queryFn: async () => {
      if (!userLumiaProfile?.territory_id) return null;

      const { data, error } = await supabase
        .from('lumia')
        .select('*')
        .eq('territoire', userLumiaProfile.territory_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[useLumiaFlow] Erreur scores territoriaux:', error);
        throw error;
      }

      return data || null;
    },
  });

  // ============================================================================
  // 3. Récupérer les missions disponibles pour le territoire
  // ============================================================================
  const {
    data: availableMissions = [],
    isLoading: loadingMissions,
    error: missionsError,
  } = useQuery({
    queryKey: ['available-missions', territoryScores?.id],
    enabled: !!territoryScores?.id,
    queryFn: async () => {
      if (!territoryScores?.id) return [];

      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('lumia_id', territoryScores.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useLumiaFlow] Erreur missions:', error);
        throw error;
      }

      return data || [];
    },
  });

  // ============================================================================
  // 4. Récupérer les constellations de l'utilisateur
  // ============================================================================
  const {
    data: userConstellations = [],
    isLoading: loadingConstellations,
    error: constellationsError,
  } = useQuery({
    queryKey: ['user-constellations', currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from('constellations')
        .select('*, missions(id, titre, zone_dominante, description)')
        .contains('members', [currentUser.id])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useLumiaFlow] Erreur constellations:', error);
        throw error;
      }

      return data || [];
    },
  });

  // ============================================================================
  // 5. Créer une nouvelle constellation
  // ============================================================================
  const createConstellationMutation = useMutation({
    mutationFn: async ({ missionId, memberIds }) => {
      if (!currentUser) throw new Error('Non authentifié');

      if (memberIds.length !== 4) {
        throw new Error('Une constellation doit avoir exactement 4 membres');
      }

      const { data, error } = await supabase
        .from('constellations')
        .insert({
          mission_id: missionId,
          members: memberIds,
          mentor_id: currentUser.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        console.error('[useLumiaFlow] Erreur création constellation:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-constellations'] });
      toast.success('Constellation créée avec succès !');
    },
    onError: (error) => {
      console.error('[useLumiaFlow] Erreur mutation constellation:', error);
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // ============================================================================
  // 6. Enregistrer un pitch vidéo
  // ============================================================================
  const recordPitchMutation = useMutation({
    mutationFn: async ({ constellationId, videoUrl }) => {
      if (!currentUser) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('pitches')
        .insert({
          constellation_id: constellationId,
          video_url: videoUrl,
          validation_status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('[useLumiaFlow] Erreur enregistrement pitch:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Pitch enregistré avec succès !');
    },
    onError: (error) => {
      console.error('[useLumiaFlow] Erreur mutation pitch:', error);
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // ============================================================================
  // 7. Valider un pitch et mettre à jour les scores LUMIA
  // ============================================================================
  const validatePitchMutation = useMutation({
    mutationFn: async ({ pitchId, validationStatus, feedback, scoreDeltas }) => {
      if (!currentUser) throw new Error('Non authentifié');

      // Étape 1: Mettre à jour le statut du pitch
      const { data: pitch, error: pitchError } = await supabase
        .from('pitches')
        .update({
          validation_status: validationStatus,
          feedback: feedback,
        })
        .eq('id', pitchId)
        .select()
        .single();

      if (pitchError) {
        console.error('[useLumiaFlow] Erreur mise à jour pitch:', pitchError);
        throw pitchError;
      }

      // Étape 2: Si le pitch est approuvé, mettre à jour les scores LUMIA
      if (validationStatus === 'approved' && scoreDeltas && territoryScores?.id) {
        // Enregistrer le log de mise à jour
        const { error: logError } = await supabase
          .from('lumia_update_logs')
          .insert({
            lumia_id: territoryScores.id,
            pitch_id: pitchId,
            feu_delta: scoreDeltas.feu || 0,
            air_delta: scoreDeltas.air || 0,
            terre_delta: scoreDeltas.terre || 0,
            eau_delta: scoreDeltas.eau || 0,
          });

        if (logError) {
          console.error('[useLumiaFlow] Erreur enregistrement log:', logError);
          throw logError;
        }

        // Les triggers SQL vont automatiquement mettre à jour les scores LUMIA
      }

      return pitch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territory-scores'] });
      queryClient.invalidateQueries({ queryKey: ['user-lumia-profile'] });
      toast.success('Pitch validé et scores LUMIA mis à jour !');
    },
    onError: (error) => {
      console.error('[useLumiaFlow] Erreur mutation validation:', error);
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // ============================================================================
  // 8. Retourner l'interface publique du hook
  // ============================================================================
  return {
    // État
    userLumiaProfile,
    territoryScores,
    availableMissions,
    userConstellations,

    // Chargement
    isLoading: loadingProfile || loadingMissions || loadingConstellations || loadingTerritoryScores,
    loadingProfile,
    loadingMissions,
    loadingConstellations,
    loadingTerritoryScores,

    // Erreurs
    profileError,
    missionsError,
    constellationsError,
    territoryScoresError,

    // Mutations
    createConstellation: createConstellationMutation.mutate,
    recordPitch: recordPitchMutation.mutate,
    validatePitch: validatePitchMutation.mutate,

    // États de mutation
    creatingConstellation: createConstellationMutation.isPending,
    recordingPitch: recordPitchMutation.isPending,
    validatingPitch: validatePitchMutation.isPending,
  };
}
