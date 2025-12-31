// src/services/futureJobsVideoService.js
import { supabase } from '../lib/supabaseClient';

/**
 * Service de génération vidéo pour les métiers du futur
 * Version corrigée avec payload strictement aligné sur Edge Function
 */
export const futureJobsVideoService = {
  
  /**
   * Génère une vidéo à partir d'un prompt - VERSION CORRIGÉE
   * @param {Object} payload - Données de génération STRICTEMENT alignées
   */
  async generateJobVideo(payload) {
    const {
      prompt,
      generator,
      style,
      duration,
      userId,
      jobId
    } = payload;

    // Validation stricte
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt invalide ou vide');
    }

    // Normalisation stricte
    const normalizedPayload = {
      prompt: String(prompt).trim(),
      generator: String(generator).toUpperCase(), // ✅ GARANTI MAJUSCULES
      style: String(style),
      duration: Number(duration),
      userId: userId || null,
      jobId: jobId || null
    };

    console.log('📤 Payload normalisé envoyé:', normalizedPayload);

    try {
      // Appel Edge Function
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: normalizedPayload,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Source': 'smoovebox-v2-frontend'
        }
      });

      if (error) {
        console.error('❌ Erreur Edge Function:', error);
        throw new Error(error.message || 'Erreur lors de la génération vidéo');
      }

      return {
        success: true,
        ...data,
        timestamp: new Date().toISOString()
      };

    } catch (networkError) {
      console.error('❌ Erreur réseau:', networkError);
      throw new Error(`Problème de connexion: ${networkError.message}`);
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

      return {
        success: true,
        ...data
      };
    } catch (error) {
      console.error('❌ Erreur vérification statut:', error);
      return {
        success: false,
        error: "Impossible de récupérer le statut",
        details: error.message
      };
    }
  },

  /**
   * Récupère les vidéos d'un utilisateur
   */
  async getUserVideos(userId, limit = 5) {
    if (!userId) return { success: false, error: "ID utilisateur requis" };

    try {
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
            generator,
            style,
            future_jobs ( title )
          )
        `)
        .eq('metadata->>user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        videos: data || []
      };
    } catch (error) {
      console.error('❌ Erreur récupération vidéos:', error);
      return {
        success: false,
        error: "Impossible de récupérer l'historique",
        videos: []
      };
    }
  },

  /**
   * Annule une génération en cours
   */
  async cancelVideoGeneration(videoId) {
    try {
      const { error } = await supabase
        .from('generated_videos')
        .update({ 
          status: 'cancelled',
          error_message: 'Annulé par l\'utilisateur'
        })
        .eq('id', videoId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      return { success: false, error: error.message };
    }
  }
};
