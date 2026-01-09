import { supabase, invokeEdgeFunctionWithRetry } from '../lib/supabase';

/**
 * Service de génération vidéo pour les métiers du futur
 * Gère la communication avec l'Edge Function Supabase
 */
export const futureJobsVideoService = {
  /**
   * Génère une vidéo à partir d'un prompt
   */
  async generateJobVideo(data) {
    console.log('🚀 Service: Début génération vidéo', data);

    if (!data || typeof data !== 'object') {
      return { success: false, error: "Données invalides", code: "INVALID_INPUT" };
    }

    const normalizedPrompt = String(data.prompt || '').trim();
    const normalizedGenerator = String(data.generator || '').toLowerCase().trim();
    const normalizedStyle = String(data.style || '').toLowerCase().trim();
    const duration = Number(data.duration);

    const validGenerators = ['sora', 'runway', 'pika'];
    if (!validGenerators.includes(normalizedGenerator)) {
      return {
        success: false,
        error: `Générateur invalide: ${data.generator}`,
        code: "INVALID_GENERATOR"
      };
    }

    const payload = {
      prompt: normalizedPrompt,
      generator: normalizedGenerator,
      style: normalizedStyle,
      duration: duration,
      userId: data.userId || null,
      jobId: data.jobId ? String(data.jobId) : null
    };

    try {
      const { data: result, error } = await invokeEdgeFunctionWithRetry('generate-video', payload, {
        timeout: 60000,
        useHttpsFallback: true
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Erreur Edge Function",
          code: "EDGE_FUNCTION_ERROR"
        };
      }

      return { success: true, ...result };
    } catch (networkError) {
      return { success: false, error: "Erreur réseau", code: "NETWORK_ERROR" };
    }
  },

  /**
   * Vérifie le statut d'une vidéo
   */
  async checkVideoStatus(videoId) {
    if (!videoId) return { success: false, error: "ID vidéo requis" };

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, status, video_url, public_url, url, metadata, created_at')
        .eq('id', videoId)
        .single();

      if (error) throw error;
      return { success: true, ...data };
    } catch (error) {
      return { success: false, error: "Erreur statut", code: "STATUS_CHECK_FAILED" };
    }
  },

  /**
   * Récupère les vidéos d'un utilisateur
   * CORRECTION : Suppression des jointures job_prompts/future_jobs qui causaient l'erreur 400
   */
  async getUserVideos(userId, limit = 10) {
    if (!userId) return { success: false, error: "ID utilisateur requis" };

    try {
      // On sélectionne uniquement les colonnes de la table 'videos'
      const { data, error } = await supabase
        .from('videos')
        .select('id, status, video_url, public_url, url, metadata, created_at, title')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Erreur SQL getUserVideos:', error);
        throw error;
      }

      return { success: true, videos: data || [] };
    } catch (error) {
      return {
        success: false,
        error: "Impossible de récupérer l'historique",
        videos: [],
        code: "FETCH_VIDEOS_FAILED"
      };
    }
  },

  /**
   * Annule une génération
   */
  async cancelVideoGeneration(videoId) {
    if (!videoId) return { success: false, error: "ID vidéo requis" };

    try {
      const { error } = await supabase
        .from('videos')
        .update({ status: 'cancelled' })
        .eq('id', videoId);

      if (error) throw error;
      return { success: true, message: 'Génération annulée' };
    } catch (error) {
      return { success: false, error: "Erreur annulation", code: "CANCEL_FAILED" };
    }
  }
};
