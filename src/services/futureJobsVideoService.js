import { supabase, invokeEdgeFunctionWithRetry } from '../lib/supabase';
import { qg } from '../utils/logger';

/**
 * Service de génération vidéo pour les métiers du futur
 * Version Corrigée - Gestion robuste du téléchargement et des logs
 */
export const futureJobsVideoService = {
  /**
   * Génère une vidéo à partir d'un prompt
   */
  async generateJobVideo(data) {
    if (!data || !data.prompt) {
      return { success: false, error: "Prompt manquant", code: "INVALID_INPUT" };
    }

    qg.info('Démarrage de la génération vidéo', { generator: data.generator });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: "Session expirée", code: "AUTH_REQUIRED" };
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
        qg.error('Erreur Edge Function:', result.error);
        return {
          success: false,
          error: result.error || "Erreur lors de la génération",
          code: result.code || "EDGE_FUNCTION_ERROR",
          details: result.details
        };
      }

      return { success: true, ...result.data };
    } catch (error) {
      qg.error('Erreur réseau génération:', error);
      return { 
        success: false, 
        error: error.message || "Erreur réseau", 
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
      return { success: false, error: error.message };
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
      return { success: true, videos: data || [] };
    } catch (error) {
      qg.error('Erreur historique:', error);
      return { success: false, error: error.message, videos: [] };
    }
  },

  /**
   * Télécharge une vidéo ou une image (DALL-E)
   */
  async downloadVideo(video) {
    try {
      const url = video.url || video.public_url || video.video_url;
      if (!url) throw new Error("URL manquante");

      qg.info('Téléchargement de la ressource:', url);

      // Création d'un lien temporaire pour forcer le téléchargement
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      
      // Déterminer le nom du fichier
      const isImage = url.includes('.jpg') || url.includes('.png') || (video.metadata && video.metadata.is_placeholder);
      const ext = isImage ? 'jpg' : 'mp4';
      const fileName = video.title 
        ? `${video.title.replace(/\s+/g, '_')}.${ext}` 
        : `spotbulle_${video.id.substring(0, 8)}.${ext}`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return { success: true };
    } catch (error) {
      qg.error("Erreur téléchargement:", error);
      return { success: false, error: error.message };
    }
  }
};
