// src/services/videoService.js
import { supabase } from '../lib/supabase';
import { VIDEO_STATUS, toDatabaseStatus } from '../constants/videoStatus';

/**
 * Service pour gérer les opérations liées aux vidéos
 */
export const videoService = {
  /**
   * CORRECTION: Récupère une vidéo par son ID depuis la vue video_details
   * @param {string} id - ID de la vidéo
   * @returns {Promise<Object>} - Données de la vidéo
   */
  async getVideoById(id) {
    if (!id) throw new Error('ID de vidéo requis');
    
    // CORRECTION: Utiliser la vue video_details pour récupérer toutes les informations consolidées
    const { data, error } = await supabase
      .from('video_details') // Changement ici: utilisation de la vue
      .select('*') // Toutes les colonnes de la vue sont déjà jointes
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * CORRECTION: Récupère les vidéos publiques depuis la vue video_details
   * @param {number} limit - Nombre de vidéos à récupérer
   * @param {number} page - Numéro de page
   * @returns {Promise<Array>} - Liste des vidéos
   */
  async getPublicVideos(limit = 10, page = 0) {
    // CORRECTION: Utiliser la vue video_details
    const { data, error } = await supabase
      .from('video_details') // Changement ici: utilisation de la vue
      .select('*') // Toutes les colonnes de la vue sont déjà jointes
      .eq('is_public', true)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
    
    if (error) throw error;
    return data || [];
  },

  /**
   * CORRECTION: Récupère les vidéos de l'utilisateur connecté depuis la vue video_details
   * @returns {Promise<Array>} - Liste des vidéos
   */
  async getUserVideos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilisateur non connecté');
    
    // CORRECTION: Utiliser la vue video_details
    const { data, error } = await supabase
      .from('video_details') // Changement ici: utilisation de la vue
      .select('*') // Toutes les colonnes de la vue sont déjà jointes
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Télécharge une vidéo
   * @param {File} file - Fichier vidéo
   * @param {Object} metadata - Métadonnées de la vidéo (titre, description)
   * @returns {Promise<Object>} - Données de la vidéo créée
   */
  async uploadVideo(file, metadata) {
    if (!file) throw new Error('Fichier vidéo requis');
    if (!metadata || !metadata.title) throw new Error('Titre de la vidéo requis');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilisateur non connecté');

    try {
      // 1. Récupérer le profil de l'utilisateur
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error(`Erreur lors de la récupération du profil: ${profileError.message}`);
      }
      
      const profileId = profileData?.id || null;

      // 2. Créer l'entrée vidéo dans la base de données (table videos, pas la vue)
      const { data: videoData, error: videoError } = await supabase
        .from('videos') // Utiliser la table videos pour l'insertion
        .insert({
          title: metadata.title.trim(),
          description: metadata.description?.trim() || null,
          status: toDatabaseStatus(VIDEO_STATUS.UPLOADING),
          user_id: user.id,
          profile_id: profileId,
          original_file_name: file.name,
          file_size: file.size,
          format: file.type.split('/')[1] || 'mp4',
          duration: metadata.duration || null,
          is_public: metadata.isPublic || false
        })
        .select()
        .single();

      if (videoError) throw new Error(`Erreur lors de la création de l'entrée vidéo: ${videoError.message}`);

      // 3. Générer un nom de fichier unique pour le stockage
      const fileExt = file.name.split('.').pop();
      const fileName = `${videoData.id}_${Date.now()}.${fileExt}`;
      const filePath = `${videoData.id}/${fileName}`;

      // 4. Télécharger le fichier
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        // En cas d'erreur d'upload, mettre à jour le statut de la vidéo
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: `Erreur d'upload: ${uploadError.message}` // CORRECTION: Utiliser error_message
          })
          .eq('id', videoData.id);
          
        throw new Error(`Erreur lors du téléchargement: ${uploadError.message}`);
      }

      // 5. Générer l'URL publique
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      // 6. Mettre à jour l'entrée vidéo avec le chemin de stockage et l'URL publique
      const { data: updatedVideo, error: updateError } = await supabase
        .from('videos')
        .update({ 
          storage_path: filePath,
          file_path: filePath,
          public_url: publicUrlData?.publicUrl || null,
          status: toDatabaseStatus(VIDEO_STATUS.UPLOADED)
        })
        .eq('id', videoData.id)
        .select()
        .single();

      if (updateError) throw new Error(`Erreur lors de la mise à jour des informations: ${updateError.message}`);

      return updatedVideo;
    } catch (error) {
      console.error('Erreur lors du téléchargement de la vidéo:', error);
      throw error;
    }
  },

  /**
   * Déclenche la transcription d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Résultat de la transcription
   */
  async transcribeVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      // 1. Mettre à jour le statut de la vidéo (table videos)
      await this.updateVideoStatus(videoId, VIDEO_STATUS.TRANSCRIBING);
      
      // 2. Appeler la fonction Edge pour la transcription
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ video_id: videoId })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
        
        // Mettre à jour le statut en cas d'erreur
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: errorData.error || `Erreur HTTP ${response.status}` // CORRECTION: Utiliser error_message
          })
          .eq('id', videoId);
          
        throw new Error(errorData.error || 'Erreur lors de la transcription');
      }
      
      const result = await response.json();
      
      // 3. Vérifier si la transcription a été lancée avec succès
      if (result.success) {
        return result;
      } else {
        // Mettre à jour le statut en cas d'erreur
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: result.error || 'Échec de la transcription' // CORRECTION: Utiliser error_message
          })
          .eq('id', videoId);
          
        throw new Error(result.error || 'Échec de la transcription');
      }
    } catch (error) {
      console.error('Erreur lors de la demande de transcription:', error);
      
      // Mettre à jour le statut en cas d'erreur non gérée
      try {
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: error.message || 'Erreur inconnue lors de la transcription' // CORRECTION: Utiliser error_message
          })
          .eq('id', videoId);
      } catch (updateError) {
        console.error('Erreur lors de la mise à jour du statut:', updateError);
      }
      
      throw error;
    }
  },

  /**
   * CORRECTION: Récupère la transcription d'une vidéo depuis la vue video_details
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Données de transcription
   */
  async getTranscription(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    // CORRECTION: Utiliser la vue video_details pour récupérer la transcription
    const { data, error } = await supabase
      .from('video_details')
      .select('transcription_text, transcription_data, transcription_id, transcription_status')
      .eq('id', videoId)
      .single();
    
    if (error) throw error;
    return data || null;
  },

  /**
   * Déclenche l'analyse IA d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Résultat de l'analyse
   */
  async analyzeVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      // 1. Mettre à jour le statut de la vidéo
      await this.updateVideoStatus(videoId, VIDEO_STATUS.ANALYZING);
      
      // 2. Appeler la fonction Edge pour l'analyse
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-transcription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ video_id: videoId })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
        
        // Mettre à jour le statut en cas d'erreur
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: errorData.error || `Erreur HTTP ${response.status}` // CORRECTION: Utiliser error_message
          })
          .eq('id', videoId);
          
        throw new Error(errorData.error || 'Erreur lors de l\'analyse');
      }
      
      const result = await response.json();
      
      // 3. Vérifier si l'analyse a été lancée avec succès
      if (result.success) {
        return result;
      } else {
        // Mettre à jour le statut en cas d'erreur
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: result.error || 'Échec de l\'analyse' // CORRECTION: Utiliser error_message
          })
          .eq('id', videoId);
          
        throw new Error(result.error || 'Échec de l\'analyse');
      }
    } catch (error) {
      console.error('Erreur lors de la demande d\'analyse:', error);
      
      // Mettre à jour le statut en cas d'erreur non gérée
      try {
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: error.message || 'Erreur inconnue lors de l\'analyse' // CORRECTION: Utiliser error_message
          })
          .eq('id', videoId);
      } catch (updateError) {
        console.error('Erreur lors de la mise à jour du statut:', updateError);
      }
      
      throw error;
    }
  },

  /**
   * CORRECTION: Récupère l'analyse d'une vidéo depuis la vue video_details
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Données d'analyse
   */
  async getAnalysis(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    // CORRECTION: Utiliser la vue video_details pour récupérer l'analyse
    const { data, error } = await supabase
      .from('video_details')
      .select('analysis_id, analysis_summary, analysis_keywords, analysis_sentiment, analysis_created_at')
      .eq('id', videoId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  /**
   * Met à jour le statut d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @param {string} status - Nouveau statut
   * @returns {Promise<Object>} - Données de la vidéo mise à jour
   */
  async updateVideoStatus(videoId, status) {
    if (!videoId) throw new Error('ID de vidéo requis');
    if (!status) throw new Error('Statut requis');
    
    const dbStatus = toDatabaseStatus(status);
    
    // CORRECTION: Mettre à jour la table videos (pas la vue)
    const { data, error } = await supabase
      .from('videos') // Utiliser la table videos pour la mise à jour
      .update({ status: dbStatus })
      .eq('id', videoId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Met à jour les métadonnées d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @param {Object} metadata - Nouvelles métadonnées
   * @returns {Promise<Object>} - Données de la vidéo mise à jour
   */
  async updateVideoMetadata(videoId, metadata) {
    if (!videoId) throw new Error('ID de vidéo requis');
    if (!metadata) throw new Error('Métadonnées requises');
    
    // CORRECTION: Mettre à jour la table videos (pas la vue)
    const { data, error } = await supabase
      .from('videos') // Utiliser la table videos pour la mise à jour
      .update({
        title: metadata.title?.trim() || undefined,
        description: metadata.description?.trim() || undefined,
        is_public: metadata.isPublic !== undefined ? metadata.isPublic : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Publie une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Données de la vidéo publiée
   */
  async publishVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    // CORRECTION: Mettre à jour la table videos (pas la vue)
    const { data, error } = await supabase
      .from('videos') // Utiliser la table videos pour la mise à jour
      .update({ 
        status: toDatabaseStatus(VIDEO_STATUS.PUBLISHED),
        published_at: new Date().toISOString()
      })
      .eq('id', videoId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Supprime une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<void>}
   */
  async deleteVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      // 1. Récupérer les informations de la vidéo depuis la table videos
      const { data: video, error: fetchError } = await supabase
        .from('videos') // Utiliser la table videos pour récupérer les infos
        .select('storage_path, file_path')
        .eq('id', videoId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // 2. Supprimer le fichier du stockage si un chemin existe
      const storagePath = video.storage_path || video.file_path;
      if (storagePath) {
        try {
          const { error: storageError } = await supabase.storage
            .from('videos')
            .remove([storagePath]);
          
          if (storageError) {
            console.error('Erreur lors de la suppression du fichier:', storageError);
            // Continuer même si la suppression du fichier échoue
          }
        } catch (storageError) {
          console.error('Exception lors de la suppression du fichier:', storageError);
          // Continuer même si la suppression du fichier échoue
        }
      }
      
      // 3. Supprimer les transcriptions associées
      try {
        await supabase
          .from('transcriptions')
          .delete()
          .eq('video_id', videoId);
      } catch (transcriptionError) {
        console.error('Erreur lors de la suppression des transcriptions:', transcriptionError);
        // Continuer même si la suppression des transcriptions échoue
      }
      
      // 4. Supprimer les analyses associées
      try {
        await supabase
          .from('video_analyses')
          .delete()
          .eq('video_id', videoId);
      } catch (analysisError) {
        console.error('Erreur lors de la suppression des analyses:', analysisError);
        // Continuer même si la suppression des analyses échoue
      }
      
      // 5. Supprimer l'entrée de la base de données (table videos)
      const { error: deleteError } = await supabase
        .from('videos') // Utiliser la table videos pour la suppression
        .delete()
        .eq('id', videoId);
      
      if (deleteError) throw deleteError;
    } catch (error) {
      console.error('Erreur lors de la suppression de la vidéo:', error);
      throw error;
    }
  },

  /**
   * CORRECTION: Vérifie le statut d'une vidéo depuis la vue video_details
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Statut actuel de la vidéo avec informations détaillées
   */
  async checkVideoStatus(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    // CORRECTION: Utiliser la vue video_details pour récupérer toutes les informations de statut
    const { data, error } = await supabase
      .from('video_details')
      .select('status, error_message, transcription_status, transcription_error, analysis_id')
      .eq('id', videoId)
      .single();
    
    if (error) throw error;
    return {
      status: data.status,
      errorMessage: data.error_message,
      transcriptionStatus: data.transcription_status,
      transcriptionError: data.transcription_error,
      hasAnalysis: !!data.analysis_id
    };
  }
};

export default videoService;
