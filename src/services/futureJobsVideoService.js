import { supabase, invokeEdgeFunctionWithRetry } from '../lib/supabase';

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
   * @param {string} data.style - Style: futuristic, cinematic, etc. (REQUIS)
   * @param {number} data.duration - Durée en secondes (REQUIS)
   * @param {string} data.userId - ID utilisateur (REQUIS)
   * @param {string|number} data.jobId - ID du métier (optionnel)
   * @returns {Promise} Résultat de la génération
   */
  async generateJobVideo(data) {
    console.log('🚀 Service: Début génération vidéo', data);

    // VALIDATION STRICTE DES DONNÉES D'ENTRÉE
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: "Données de génération invalides",
        code: "INVALID_INPUT"
      };
    }

    // NORMALISATION STRICTE AVANT VALIDATION (Correction Casse pour Edge Function)
    const normalizedPrompt = String(data.prompt || '').trim();
    const normalizedGenerator = String(data.generator || '').toLowerCase().trim();
    const normalizedStyle = String(data.style || '').toLowerCase().trim();
    const duration = Number(data.duration);

    // VALIDATION INDIVIDUELLE RENFORCÉE
    const validGenerators = ['sora', 'runway', 'pika'];
    if (!validGenerators.includes(normalizedGenerator)) {
      return {
        success: false,
        error: `Générateur invalide: ${data.generator}. Choisissez entre: ${validGenerators.join(', ')}`,
        code: "INVALID_GENERATOR"
      };
    }

    // PRÉPARATION DU PAYLOAD STRICT POUR L'EDGE FUNCTION
    const payload = {
      prompt: normalizedPrompt,
      generator: normalizedGenerator.toLowerCase(),
      style: normalizedStyle.toLowerCase(),
      duration: duration,
      userId: data.userId || null,
      jobId: data.jobId ? String(data.jobId) : null
    };

    console.log('📤 Payload validé envoyé à Edge Function:', payload);

    try {
      // APPEL EDGE FUNCTION AVEC SYSTÈME DE RETRY ET HTTPS FALLBACK
      const { data: result, error } = await invokeEdgeFunctionWithRetry('generate-video', payload, {
        timeout: 60000,
        useHttpsFallback: true
      });

      if (error) {
        console.error('❌ Erreur Supabase Functions:', error);
        return {
          success: false,
          error: error.message || "Erreur lors de l'appel à la fonction de génération",
          code: "EDGE_FUNCTION_ERROR",
          details: error
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
   * CORRECTION : Utilise la table 'videos' au lieu de 'generated_videos'
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
      console.error('❌ Erreur vérification statut:', error);
      return {
        success: false,
        error: "Impossible de récupérer le statut",
        details: error.message,
        code: "STATUS_CHECK_FAILED"
      };
    }
  },

  /**
   * Récupère les vidéos d'un utilisateur
   * CORRECTION : Utilise la table 'videos' et la colonne 'user_id' directe
   */
  async getUserVideos(userId, limit = 10) {
    if (!userId) return { success: false, error: "ID utilisateur requis" };

    try {
      const { data, error } = await supabase
        .from('videos')
        .select(`
          id,
          status,
          video_url,
          public_url,
          url,
          metadata,
          created_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, videos: data || [] };
    } catch (error) {
      console.error('❌ Erreur récupération vidéos:', error);
      return {
        success: false,
        error: "Impossible de récupérer l'historique",
        videos: [],
        code: "FETCH_VIDEOS_FAILED"
      };
    }
  },

  /**
   * Annule une génération en cours
   * CORRECTION : Utilise la table 'videos'
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
      console.error('❌ Erreur annulation:', error);
      return {
        success: false,
        error: "Impossible d'annuler la génération",
        details: error.message,
        code: "CANCEL_FAILED"
      };
    }
  }
};
