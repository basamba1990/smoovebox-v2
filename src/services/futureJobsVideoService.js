// src/services/futureJobsVideoService.js
import { supabase } from '../lib/supabase';

/**
 * Service de génération vidéo pour les métiers du futur
 * Gère la communication avec l'Edge Function Supabase
 */
export const futureJobsVideoService = {
  /**
   * Génère une vidéo à partir d'un prompt
   * @param {Object} data - Données de génération
   * @param {string} data.prompt - Texte du prompt (REQUIS)
   * @param {string} data.generator - Générateur: SORA, RUNWAY, PIKA (REQUIS)
   * @param {string} data.style - Style: futuristic, semi-realistic, etc. (REQUIS)
   * @param {number} data.duration - Durée en secondes (REQUIS)
   * @param {string} data.userId - ID utilisateur (optionnel)
   * @param {string|number} data.jobId - ID du métier (optionnel)
   * @returns {Promise<Object>} Résultat de la génération
   */
  async generateJobVideo(data) {
    console.log('🚀 Service: Début génération vidéo', data);
    
    // VALIDATION DES DONNÉES D'ENTRÉE
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: "Données de génération invalides",
        code: "INVALID_INPUT"
      };
    }

    // Validation des champs requis
    const requiredFields = ['prompt', 'generator', 'style', 'duration'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Champs requis manquants: ${missingFields.join(', ')}`,
        code: "MISSING_FIELDS"
      };
    }

    // PRÉPARATION DU PAYLOAD STRICT POUR L'EDGE FUNCTION
    const payload = {
      prompt: data.prompt, // ✅ FIX: Assurer que c'est bien 'prompt'
      generator: data.generator.toUpperCase(),
      style: data.style,
      duration: Number(data.duration),
      userId: data.userId || null,
      jobId: data.jobId ? String(data.jobId) : null
    };

    console.log('📤 Payload envoyé à Edge Function:', payload);

    try {
      // APPEL EDGE FUNCTION
      const { data: result, error } = await supabase.functions.invoke('generate-video', {
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Source': 'smoovebox-v2-frontend'
        }
      });

      if (error) {
        console.error('❌ Erreur Supabase Functions:', error);
        return {
          success: false,
          error: error.message || "Erreur lors de l'appel à la fonction de génération",
          code: "EDGE_FUNCTION_ERROR"
        };
      }

      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      };

    } catch (networkError) {
      console.error('❌ Erreur réseau:', networkError);
      return {
        success: false,
        error: "Problème de connexion au serveur de génération",
        details: networkError.message,
        code: "NETWORK_ERROR"
      };
    }
  },

  /**
   * Vérifie le statut d'une vidéo
   */
  async checkVideoStatus(videoId) {
    if (!videoId) return { success: false, error: "ID vidéo requis" };
    
    try {
      const { data, error } = await supabase
        .from('generated_videos')
        .select('id, status, video_url, error_message, metadata, created_at')
        .eq('id', videoId)
        .single();

      if (error) throw error;
      
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ Erreur vérification statut:', error);
      return { success: false, error: "Impossible de récupérer le statut", details: error.message };
    }
  },

  /**
   * Récupère les vidéos d'un utilisateur
   */
  async getUserVideos(userId, limit = 10) {
    if (!userId) return { success: false, error: "ID utilisateur requis" };
    
    try {
      // ✅ CORRECTION : Utiliser metadata->>user_id pour convertir en texte
      const { data, error } = await supabase
        .from('generated_videos')
        .select(`
          id,
          status,
          video_url,
          error_message,
          metadata,
          created_at,
          prompt_id,
          job_prompts (
            id,
            generator,
            style,
            duration,
            prompt_text
          )
        `)
        .eq('metadata->>user_id', userId) // ✅ CORRIGÉ ICI
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return { success: true, videos: data || [] };
    } catch (error) {
      console.error('❌ Erreur récupération vidéos:', error);
      return { success: false, error: "Impossible de récupérer l'historique", videos: [] };
    }
  },

  /**
   * Annule une génération en cours
   */
  async cancelVideoGeneration(videoId) {
    if (!videoId) return { success: false, error: "ID vidéo requis" };
    
    try {
      const { error } = await supabase
        .from('generated_videos')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      if (error) throw error;
      
      return { success: true, message: 'Génération annulée' };
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      return { success: false, error: "Impossible d'annuler la génération", details: error.message };
    }
  }
};
