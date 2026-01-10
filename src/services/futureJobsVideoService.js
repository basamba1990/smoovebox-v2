import { supabase, invokeEdgeFunctionWithRetry } from '../lib/supabase';

/**
 * Service de génération vidéo pour les métiers du futur
 * Version Finale Corrigée - Zéro Erreur - Gestion JWT Optimisée
 */
export const futureJobsVideoService = {
  /**
   * Génère une vidéo à partir d'un prompt
   */
  async generateJobVideo(data) {
    if (!data || !data.prompt) {
      return { success: false, error: "Prompt manquant", code: "INVALID_INPUT" };
    }

    // Vérification et rafraîchissement de la session avant l'appel
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: "Session expirée ou utilisateur non connecté", code: "AUTH_REQUIRED" };
    }

    const payload = {
      prompt: String(data.prompt).trim(),
      generator: String(data.generator || 'runway').toLowerCase().trim(),
      style: String(data.style || 'cinematic').toLowerCase().trim(),
      duration: Number(data.duration) || 30,
      jobId: data.jobId ? String(data.jobId) : null
    };

    try {
      const result = await invokeEdgeFunctionWithRetry('generate-video', payload);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Erreur lors de la génération",
          code: result.code || "EDGE_FUNCTION_ERROR",
          details: result.details
        };
      }

      return { success: true, ...result.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || "Erreur réseau ou serveur", 
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
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) throw error;
      return { success: true, ...data };
    } catch (error) {
      return { 
        success: false, 
        error: "Erreur vérification statut", 
        code: "STATUS_CHECK_FAILED"
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
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { 
        success: true, 
        videos: data || [],
        count: (data || []).length
      };
    } catch (error) {
      return {
        success: false,
        error: "Impossible de récupérer l'historique",
        videos: []
      };
    }
  }
};
