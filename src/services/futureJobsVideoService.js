import { supabase, invokeEdgeFunctionWithRetry } from '../lib/supabase';

/**
 * Service de génération vidéo pour les métiers du futur
 * Gère la communication avec l'Edge Function Supabase
 */
export const futureJobsVideoService = {
  /**
   * Génère une vidéo à partir d'un prompt
   * CORRECTION : Normalisation stricte de la casse et validation étendue
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

    // Validation des générateurs
    const validGenerators = ['sora', 'runway', 'pika'];
    if (!validGenerators.includes(normalizedGenerator)) {
      return {
        success: false,
        error: `Générateur invalide: ${data.generator}. Valides: ${validGenerators.join(', ')}`,
        code: "INVALID_GENERATOR"
      };
    }

    // Validation des durées
    if (!duration || isNaN(duration) || duration < 1 || duration > 120) {
      return {
        success: false,
        error: "Durée invalide. Doit être entre 1 et 120 secondes",
        code: "INVALID_DURATION"
      };
    }

    // CORRECTION : Ne pas envoyer userId dans le body - la fonction utilise le JWT
    const payload = {
      prompt: normalizedPrompt,
      generator: normalizedGenerator,
      style: normalizedStyle,
      duration: duration,
      // Note: userId est optionnel et ignoré si JWT présent
      // Ne pas inclure userId ici pour forcer l'utilisation du JWT
      jobId: data.jobId ? String(data.jobId) : null
    };

    try {
      console.log('📤 Envoi vers Edge Function:', payload);
      
      // CORRECTION : Le JWT est automatiquement inclus via l'en-tête Authorization
      const { data: result, error } = await invokeEdgeFunctionWithRetry(
        'generate-video', 
        payload, 
        {
          timeout: 60000,
          useHttpsFallback: true
        }
      );

      if (error) {
        console.error('❌ Erreur Edge Function:', error);
        
        // Gestion spécifique des erreurs d'authentification
        if (error.code === 'AUTH_REQUIRED' || error.status === 401) {
          return {
            success: false,
            error: "Session expirée. Veuillez vous reconnecter.",
            code: "AUTH_REQUIRED",
            requiresReauth: true
          };
        }
        
        return {
          success: false,
          error: error.message || "Erreur Edge Function",
          code: error.code || "EDGE_FUNCTION_ERROR",
          details: error.details
        };
      }

      return { success: true, ...result };
    } catch (networkError) {
      console.error('❌ Erreur réseau:', networkError);
      return { 
        success: false, 
        error: "Erreur réseau ou timeout", 
        code: "NETWORK_ERROR",
        details: networkError.message 
      };
    }
  },

  /**
   * Vérifie le statut d'une vidéo
   * CORRECTION : Sélection cohérente avec la politique RLS
   */
  async checkVideoStatus(videoId) {
    if (!videoId) return { success: false, error: "ID vidéo requis" };

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, status, video_url, public_url, url, metadata, created_at, storage_path')
        .eq('id', videoId)
        .single();

      if (error) {
        console.error('❌ Erreur checkVideoStatus:', error);
        throw error;
      }
      return { success: true, ...data };
    } catch (error) {
      return { 
        success: false, 
        error: "Erreur vérification statut", 
        code: "STATUS_CHECK_FAILED",
        details: error.message 
      };
    }
  },

  /**
   * Récupère les vidéos d'un utilisateur
   * CORRECTION : Requête compatible RLS avec colonnes autorisées
   */
  async getUserVideos(userId, limit = 10) {
    if (!userId) return { success: false, error: "ID utilisateur requis", code: "MISSING_USER_ID" };

    try {
      // CORRECTION : Sélection des colonnes autorisées par la politique RLS
      const { data, error, status } = await supabase
        .from('videos')
        .select('id, status, video_url, public_url, url, metadata, created_at, title, storage_path, user_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Erreur getUserVideos:', { error, status, userId });
        
        // Correction pour les erreurs RLS
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          return {
            success: false,
            error: "Permissions insuffisantes. Veuillez vérifier les politiques RLS.",
            code: "RLS_ERROR",
            videos: []
          };
        }
        
        throw error;
      }

      // Filtrage supplémentaire côté client pour éviter tout problème
      const userVideos = (data || []).filter(video => video.user_id === userId);

      return { 
        success: true, 
        videos: userVideos,
        count: userVideos.length
      };
    } catch (error) {
      console.error('❌ Exception getUserVideos:', error);
      return {
        success: false,
        error: "Impossible de récupérer l'historique des vidéos",
        videos: [],
        code: "FETCH_VIDEOS_FAILED",
        details: error.message
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
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      if (error) throw error;
      return { success: true, message: 'Génération annulée' };
    } catch (error) {
      return { 
        success: false, 
        error: "Erreur lors de l'annulation", 
        code: "CANCEL_FAILED",
        details: error.message 
      };
    }
  },

  /**
   * Télécharge une vidéo avec le bon content-type
   */
  async downloadVideo(videoData) {
    try {
      const url = videoData.url || videoData.public_url || videoData.video_url;
      if (!url) {
        throw new Error('URL de vidéo non disponible');
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Erreur téléchargement: ${response.status}`);

      const blob = await response.blob();
      const contentType = blob.type || 'video/mp4';
      const extension = contentType.includes('image') ? '.jpg' : '.mp4';
      const fileName = `video-${videoData.id || Date.now()}${extension}`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      return { success: true, fileName };
    } catch (error) {
      return { 
        success: false, 
        error: "Erreur téléchargement", 
        code: "DOWNLOAD_FAILED",
        details: error.message 
      };
    }
  }
};
