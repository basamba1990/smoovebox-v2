// src/services/futureJobsVideoService.js
import { supabase } from '../lib/supabase';

/**
 * Service de génération vidéo pour les métiers du futur
 * Gère la communication avec l'Edge Function Supabase
 */
export const futureJobsVideoService = {
  
  /**
   * Génère une vidéo à partir d'un prompt
   * @param {Object} payload - Données de génération
   * @param {string} payload.prompt - Texte du prompt (REQUIS)
   * @param {string} payload.generator - Générateur: SORA, RUNWAY, PIKA (REQUIS)
   * @param {string} payload.style - Style: futuristic, semi-realistic, etc. (REQUIS)
   * @param {number} payload.duration - Durée en secondes (REQUIS)
   * @param {string} payload.userId - ID utilisateur (optionnel)
   * @param {string|number} payload.jobId - ID du métier (optionnel)
   * @returns {Promise<Object>} Résultat de la génération
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

    console.log('🚀 Service: Début génération vidéo', { generator, style, duration, jobId });
    
    // VALIDATION STRICTE CÔTÉ CLIENT
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Le prompt est requis et doit être une chaîne de caractères non vide');
    }

    if (!generator) {
      throw new Error('Le générateur est requis (SORA, RUNWAY, PIKA)');
    }

    // PRÉPARATION DU PAYLOAD NORMALISÉ POUR L'EDGE FUNCTION
    const normalizedPayload = {
      prompt: String(prompt).trim(),
      generator: String(generator).toUpperCase(), // 🔥 CRITIQUE: Toujours en majuscules
      style: style || 'futuristic',
      duration: Number(duration) || 30,
      userId: userId || null,
      jobId: jobId ? String(jobId) : null
    };

    console.log('📤 Payload normalisé envoyé à Edge Function:', normalizedPayload);

    try {
      // APPEL EDGE FUNCTION VIA LE CLIENT SUPABASE
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: normalizedPayload,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Source': 'smoovebox-v2-frontend'
        }
      });

      if (error) {
        console.error('❌ Erreur Edge Function:', error);
        throw new Error(error.message || "Erreur lors de l'appel à la fonction de génération");
      }

      return {
        success: true,
        ...data,
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      console.error('❌ Erreur service génération:', err);
      throw err;
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
  async getUserVideos(userId, limit = 10) {
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
            id,
            generator,
            style,
            duration,
            prompt_text
          )
        `)
        .eq('metadata->>user_id', userId) // ✅ Utilisation de l'opérateur ->> pour le JSONB
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
  }
};
