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

    // Validation du prompt
    if (typeof data.prompt !== 'string' || data.prompt.trim().length === 0) {
      return {
        success: false,
        error: "Le prompt doit être une chaîne de caractères non vide",
        code: "INVALID_PROMPT"
      };
    }

    // Validation du générateur
    const validGenerators = ['SORA', 'RUNWAY', 'PIKA'];
    if (!validGenerators.includes(data.generator.toUpperCase())) {
      return {
        success: false,
        error: `Générateur invalide. Valeurs acceptées: ${validGenerators.join(', ')}`,
        code: "INVALID_GENERATOR"
      };
    }

    // Validation du style
    const validStyles = ['semi-realistic', 'futuristic', 'cinematic', 'documentary', 'abstract'];
    if (!validStyles.includes(data.style)) {
      return {
        success: false,
        error: `Style invalide. Valeurs acceptées: ${validStyles.join(', ')}`,
        code: "INVALID_STYLE"
      };
    }

    // Validation de la durée
    if (typeof data.duration !== 'number' || data.duration < 1 || data.duration > 120) {
      return {
        success: false,
        error: "La durée doit être un nombre entre 1 et 120 secondes",
        code: "INVALID_DURATION"
      };
    }

    // PRÉPARATION DU PAYLOAD STRICT
    const payload = {
      prompt: data.prompt, // ⚠️ IMPORTANT: Nom exact attendu par l'Edge Function
      generator: data.generator.toUpperCase(),
      style: data.style,
      duration: Number(data.duration),
      userId: data.userId || null,
      jobId: data.jobId ? String(data.jobId) : null
      // ❌ NE PAS INCLURE: promptText, jobTitle, jobYear, etc.
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

      // GESTION ERREUR SUPABASE
      if (error) {
        console.error('❌ Erreur Supabase Functions:', error);
        
        // Tentative de fallback direct
        try {
          const directResponse = await this._directEdgeCall(payload);
          return directResponse;
        } catch (fallbackError) {
          return {
            success: false,
            error: "Service de génération temporairement indisponible",
            details: error.message,
            code: "EDGE_FUNCTION_ERROR",
            fallback: true
          };
        }
      }

      // RÉPONSE DE SUCCÈS
      console.log('✅ Réponse Edge Function reçue:', result);
      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      };

    } catch (networkError) {
      // GESTION ERREUR RÉSEAU
      console.error('❌ Erreur réseau:', networkError);
      
      return {
        success: false,
        error: "Problème de connexion au serveur de génération",
        details: networkError.message,
        code: "NETWORK_ERROR",
        isNetworkError: true,
        suggestion: "Vérifiez votre connexion internet et réessayez."
      };
    }
  },

  /**
   * Appel direct à l'Edge Function (fallback)
   * @private
   */
  async _directEdgeCall(payload) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('URL Supabase non configurée');
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-video`;
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Fallback direct échoué:', error);
      throw error;
    }
  },

  /**
   * Vérifie le statut d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} Statut de la vidéo
   */
  async checkVideoStatus(videoId) {
    if (!videoId) {
      return {
        success: false,
        error: "ID vidéo requis",
        code: "MISSING_VIDEO_ID"
      };
    }

    try {
      const { data, error } = await supabase
        .from('generated_videos')
        .select('id, status, video_url, error_message, metadata, created_at')
        .eq('id', videoId)
        .single();

      if (error) throw error;

      return {
        success: true,
        ...data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erreur vérification statut:', error);
      return {
        success: false,
        error: "Impossible de récupérer le statut",
        details: error.message,
        code: "STATUS_CHECK_ERROR"
      };
    }
  },

  /**
   * Annule une génération en cours
   * @param {string} videoId - ID de la vidéo
   */
  async cancelVideoGeneration(videoId) {
    if (!videoId) {
      return {
        success: false,
        error: "ID vidéo requis",
        code: "MISSING_VIDEO_ID"
      };
    }

    try {
      const { error } = await supabase
        .from('generated_videos')
        .update({ 
          status: 'cancelled',
          metadata: {
            cancelled_at: new Date().toISOString(),
            cancelled_by: 'user'
          }
        })
        .eq('id', videoId)
        .eq('status', 'generating'); // Seulement si toujours en génération

      if (error) throw error;

      return {
        success: true,
        message: "Génération annulée",
        videoId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      return {
        success: false,
        error: "Impossible d'annuler la génération",
        details: error.message,
        code: "CANCELLATION_ERROR"
      };
    }
  },

  /**
   * Récupère les vidéos d'un utilisateur
   * @param {string} userId - ID utilisateur
   * @param {number} limit - Nombre maximum de résultats
   * @returns {Promise<Object>} Liste des vidéos
   */
  async getUserVideos(userId, limit = 10) {
    if (!userId) {
      return {
        success: false,
        error: "ID utilisateur requis",
        code: "MISSING_USER_ID"
      };
    }

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
              id,
              title,
              year
            )
          )
        `)
        .eq('metadata->user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        videos: data || [],
        count: data?.length || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erreur récupération vidéos:', error);
      return {
        success: false,
        error: "Impossible de récupérer l'historique",
        details: error.message,
        code: "HISTORY_ERROR",
        videos: [] // Retourne tableau vide en cas d'erreur
      };
    }
  },

  /**
   * Message d'erreur adapté à l'utilisateur
   * @param {string} errorCode - Code d'erreur technique
   * @returns {string} Message utilisateur
   */
  getUserErrorMessage(errorCode) {
    const messages = {
      'INVALID_PROMPT': 'Le texte de description est invalide.',
      'INVALID_GENERATOR': 'Le type de générateur sélectionné n\'est pas supporté.',
      'INVALID_STYLE': 'Le style visuel sélectionné n\'est pas disponible.',
      'INVALID_DURATION': 'La durée spécifiée est invalide.',
      'MISSING_FIELDS': 'Certaines informations requises sont manquantes.',
      'EDGE_FUNCTION_ERROR': 'Le service de génération est temporairement indisponible.',
      'NETWORK_ERROR': 'Problème de connexion. Vérifiez votre internet.',
      'DB_ERROR': 'Erreur d\'enregistrement. Vos données sont sauvegardées.',
      'GENERATION_FAILED': 'La génération a échoué. Veuillez réessayer.',
      'SORA_UNAVAILABLE': 'Le générateur Sora sera bientôt disponible.',
      'default': 'Une erreur technique est survenue. Notre équipe a été notifiée.'
    };

    return messages[errorCode] || messages.default;
  }
};
