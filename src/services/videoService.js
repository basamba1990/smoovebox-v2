// src/services/videoService.js
import { supabase } from '../lib/supabase';
import { VIDEO_STATUS, toDatabaseStatus } from '../constants/videoStatus';

/**
 * Service pour gérer les opérations liées aux vidéos
 */
export const videoService = {
  /**
   * Récupère une vidéo par son ID
   * @param {string} id - ID de la vidéo
   * @returns {Promise<Object>} - Données de la vidéo
   */
  async getVideoById(id) {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        profiles:profile_id(username, avatar_url, full_name)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Récupère les vidéos publiques
   * @param {number} limit - Nombre de vidéos à récupérer
   * @param {number} page - Numéro de page
   * @returns {Promise<Array>} - Liste des vidéos
   */
  async getPublicVideos(limit = 10, page = 0) {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        profiles:profile_id(username, avatar_url, full_name)
      `)
      .eq('is_public', true)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
    
    if (error) throw error;
    return data;
  },

  /**
   * Récupère les vidéos de l'utilisateur connecté
   * @returns {Promise<Array>} - Liste des vidéos
   */
  async getUserVideos() {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  /**
   * Télécharge une vidéo
   * @param {File} file - Fichier vidéo
   * @param {Object} metadata - Métadonnées de la vidéo (titre, description)
   * @returns {Promise<Object>} - Données de la vidéo créée
   */
  async uploadVideo(file, metadata) {
    const { user } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilisateur non connecté');

    // 1. Créer l'entrée vidéo dans la base de données
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .insert({
        title: metadata.title.trim(),
        description: metadata.description?.trim() || null,
        status: toDatabaseStatus(VIDEO_STATUS.UPLOADING),
        user_id: user.id,
        original_file_name: file.name,
        file_size: file.size,
        format: file.type.split('/')[1] || 'mp4'
      })
      .select()
      .single();

    if (videoError) throw new Error(`Erreur lors de la création de l'entrée vidéo: ${videoError.message}`);

    // 2. Générer un nom de fichier unique pour le stockage
    const fileExt = file.name.split('.').pop();
    const filePath = `videos/${videoData.id}/${Date.now()}.${fileExt}`;
    const storagePath = `uploads/${filePath}`;

    // 3. Télécharger le fichier
    const { error: uploadError } = await supabase.storage
      .from('uploads')
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
          transcription_error: `Erreur d'upload: ${uploadError.message}`
        })
        .eq('id', videoData.id);
        
      throw new Error(`Erreur lors du téléchargement: ${uploadError.message}`);
    }

    // 4. Mettre à jour l'entrée vidéo avec le chemin de stockage
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        storage_path: storagePath,
        file_path: storagePath, // Pour compatibilité avec le code existant
        status: toDatabaseStatus(VIDEO_STATUS.UPLOADED)
      })
      .eq('id', videoData.id);

    if (updateError) throw new Error(`Erreur lors de la mise à jour des informations: ${updateError.message}`);

    return videoData;
  },

  /**
   * Déclenche la transcription d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Résultat de la transcription
   */
  async transcribeVideo(videoId) {
    try {
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la transcription');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la demande de transcription:', error);
      throw error;
    }
  },

  /**
   * Met à jour le statut d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @param {string} status - Nouveau statut
   * @returns {Promise<Object>} - Données de la vidéo mise à jour
   */
  async updateVideoStatus(videoId, status) {
    const { data, error } = await supabase
      .from('videos')
      .update({ status: toDatabaseStatus(status) })
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
    // 1. Récupérer les informations de la vidéo
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('storage_path, file_path')
      .eq('id', videoId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // 2. Supprimer le fichier du stockage si un chemin existe
    const storagePath = video.storage_path || video.file_path;
    if (storagePath) {
      const bucketName = storagePath.split('/')[0];
      const filePath = storagePath.split('/').slice(1).join('/');
      
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);
      
      if (storageError) {
        console.error('Erreur lors de la suppression du fichier:', storageError);
        // Continuer même si la suppression du fichier échoue
      }
    }
    
    // 3. Supprimer l'entrée de la base de données
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);
    
    if (deleteError) throw deleteError;
  }
};
