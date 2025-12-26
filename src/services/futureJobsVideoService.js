// src/services/futureJobsVideoService.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export class FutureJobsVideoService {
  constructor() {
    this.EDGE_FUNCTION_URL = `${process.env.VITE_SUPABASE_URL}/functions/v1/generate-future-video`;
  }

  /**
   * Génère une vidéo pour un métier du futur
   */
  async generateJobVideo({
    jobId,
    promptText,
    generator = 'Sora',
    style = 'futuristic',
    duration = 30,
    userId,
    jobTitle,
    jobYear
  }) {
    try {
      console.log('🚀 Démarrage génération vidéo:', {
        jobId, generator, style, duration
      });

      // 1. Préparer les données pour l'Edge Function
      const payload = {
        prompt: promptText,
        generator,
        style,
        duration,
        userId,
        jobId
      };

      // 2. Appeler l'Edge Function
      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('✅ Réponse Edge Function:', data);

      // 3. Mettre à jour l'interface utilisateur avec les données
      return {
        success: true,
        videoUrl: data.videoUrl,
        videoId: data.videoId,
        promptId: data.promptId,
        status: data.status,
        metadata: data.metadata,
        message: 'Vidéo générée avec succès !'
      };

    } catch (error) {
      console.error('❌ Erreur génération vidéo:', error);
      
      return {
        success: false,
        error: error.message,
        message: `Échec de la génération: ${error.message}`
      };
    }
  }

  /**
   * Récupère l'historique des vidéos générées par l'utilisateur
   */
  async getUserVideos(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('generated_videos')
        .select(`
          id,
          video_url,
          status,
          created_at,
          metadata,
          job_prompts (
            id,
            prompt_text,
            generator,
            style,
            duration,
            future_jobs (
              title,
              year
            )
          )
        `)
        .eq('job_prompts.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        videos: data || []
      };
    } catch (error) {
      console.error('Erreur récupération vidéos:', error);
      return {
        success: false,
        error: error.message,
        videos: []
      };
    }
  }

  /**
   * Vérifie le statut d'une vidéo en cours de génération
   */
  async checkVideoStatus(videoId) {
    try {
      const { data, error } = await supabase
        .from('generated_videos')
        .select('status, video_url, error_message, metadata')
        .eq('id', videoId)
        .single();

      if (error) throw error;

      return {
        success: true,
        status: data.status,
        videoUrl: data.video_url,
        errorMessage: data.error_message,
        metadata: data.metadata
      };
    } catch (error) {
      console.error('Erreur vérification statut:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Annule une génération en cours (si supporté)
   */
  async cancelVideoGeneration(videoId) {
    try {
      const { error } = await supabase
        .from('generated_videos')
        .update({
          status: 'cancelled',
          metadata: {
            cancelled_at: new Date().toISOString()
          }
        })
        .eq('id', videoId)
        .eq('status', 'generating'); // Uniquement si toujours en cours

      if (error) throw error;

      return {
        success: true,
        message: 'Génération annulée'
      };
    } catch (error) {
      console.error('Erreur annulation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sauvegarde un prompt dans la base de données
   */
  async savePromptToHistory({
    userId,
    jobId,
    generator,
    style,
    duration,
    promptText,
    jobTitle,
    jobYear
  }) {
    try {
      const { data, error } = await supabase
        .from('job_prompts')
        .insert({
          user_id: userId,
          job_id: jobId,
          generator,
          style,
          duration,
          prompt_text: promptText,
          metadata: {
            job_title: jobTitle,
            job_year: jobYear,
            style,
            duration,
            saved_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        promptId: data.id,
        message: 'Prompt sauvegardé'
      };
    } catch (error) {
      console.error('Erreur sauvegarde prompt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
export const futureJobsVideoService = new FutureJobsVideoService();
