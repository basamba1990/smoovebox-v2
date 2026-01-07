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
   * @param {string} data.style - Style: futuristic, semi-realistic, etc. (REQUIS)
   * @param {number} data.duration - Durée en secondes (REQUIS)
   * @param {string} data.userId - ID utilisateur (optionnel)
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

    // Validation des champs requis
    const requiredFields = ['prompt', 'generator', 'style', 'duration'];
    const missingFields = requiredFields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Champs requis manquants: ${missingFields.join(', ')}`,
        code: "MISSING_FIELDS"
      };
    }

    // NORMALISATION STRICTE AVANT VALIDATION
    const normalizedPrompt = String(data.prompt).trim();
    const normalizedGenerator = String(data.generator).toLowerCase().trim();
    const normalizedStyle = String(data.style).toLowerCase().trim();
    const duration = Number(data.duration);

    // VALIDATION INDIVIDUELLE RENFORCÉE
    if (!normalizedPrompt || normalizedPrompt.length === 0) {
      return {
        success: false,
        error: "Le prompt est requis et doit être une chaîne non vide",
        code: "INVALID_PROMPT"
      };
    }

 const validGenerators = [\'sora\', \'runway\', \'pika\'];  if (!validGenerators.includes(normalizedGenerator)) {
      return {
        success: false,
        error: `Générateur invalide: ${data.generator}. Choisissez entre: ${validGenerators.join(', ')}`,
        code: "INVALID_GENERATOR"
      };
    }

    const validStyles = ["semi-realistic", "futuristic", "cinematic", "documentary", "abstract", "lumi-universe"];
    if (!validStyles.includes(normalizedStyle)) {
      return {
        success: false,
        error: `Style invalide: ${data.style}. Styles autorisés: ${validStyles.join(', ')}`,
        code: "INVALID_STYLE"
      };
    }

    if (isNaN(duration) || duration < 1 || duration > 120) {
      return {
        success: false,
        error: "Durée invalide. Doit être un nombre entre 1 et 120 secondes",
        code: "INVALID_DURATION"
      };
    }

    // PRÉPARATION DU PAYLOAD STRICT POUR L'EDGE FUNCTION
    const payload = {
      prompt: normalizedPrompt,
      generator: normalizedGenerator,
      style: normalizedStyle,
      duration: duration,
      userId: data.userId || null,
      jobId: data.jobId ? String(data.jobId) : null
    };

    console.log('📤 Payload validé envoyé à Edge Function:', payload);

    try {
      // APPEL EDGE FUNCTION AVEC SYSTÈME DE RETRY ET HTTPS FALLBACK
      const { data: result, error } = await invokeEdgeFunctionWithRetry('generate-video', payload, {
        timeout: 60000, // Augmentation du timeout pour la génération vidéo
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

      // Validation de la réponse de l'Edge Function
      if (!result) {
        return {
          success: false,
          error: "Réponse vide de l'Edge Function",
          code: "EMPTY_RESPONSE"
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
            prompt_text,
            future_jobs (
              title
            )
          )
        `)
        .eq('metadata->>user_id', userId)
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
      return {
        success: false,
        error: "Impossible d'annuler la génération",
        details: error.message,
        code: "CANCEL_FAILED"
      };
    }
  }
};
