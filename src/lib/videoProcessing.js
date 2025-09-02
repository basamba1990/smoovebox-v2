// src/lib/videoProcessing.js
import { supabase } from './supabase';
import { VIDEO_STATUS, toDatabaseStatus } from '../constants/videoStatus';

/**
 * Télécharge une vidéo vers le stockage Supabase
 * @param {File} file - Le fichier vidéo à télécharger
 * @param {string} userId - L'ID de l'utilisateur
 * @param {Object} metadata - Métadonnées de la vidéo (titre, description)
 * @param {Function} onProgress - Callback pour la progression du téléchargement
 * @returns {Promise<Object>} - Résultat du téléchargement
 */
export const uploadVideo = async (file, userId, metadata, onProgress) => {
  try {
    if (!file || !userId) {
      throw new Error('Fichier ou ID utilisateur manquant');
    }

    // Générer un nom de fichier unique
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `videos/${fileName}`;

    // Télécharger le fichier vers le stockage
    const { error: uploadError, data } = await supabase.storage
      .from('videos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        onUploadProgress: (progress) => {
          if (onProgress) {
            const percent = (progress.loaded / progress.total) * 100;
            onProgress(percent);
          }
        },
      });

    if (uploadError) {
      throw new Error(`Erreur lors du téléchargement: ${uploadError.message}`);
    }

    // Créer un enregistrement dans la table videos
    const { error: dbError, data: video } = await supabase
      .from('videos')
      .insert([
        {
          user_id: userId,
          title: metadata.title || file.name,
          description: metadata.description || '',
          original_file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          status: toDatabaseStatus(VIDEO_STATUS.PROCESSING), // Utiliser la fonction de conversion
          storage_path: filePath, // Utiliser filePath comme storage_path
          file_path: filePath // Utiliser filePath comme file_path pour compatibilité
        },
      ])
      .select()
      .single();

    if (dbError) {
      throw new Error(`Erreur lors de l'enregistrement en base de données: ${dbError.message}`);
    }

    return { success: true, video };
  } catch (error) {
    console.error('Erreur lors du téléchargement de la vidéo:', error);
    return { success: false, error };
  }
};

/**
 * Récupère les vidéos d'un utilisateur
 * @param {string} userId - L'ID de l'utilisateur
 * @param {Object} options - Options de pagination et filtrage
 * @returns {Promise<Object>} - Liste des vidéos et nombre total
 */
export const getUserVideos = async (userId, options = {}) => {
  try {
    if (!userId) {
      throw new Error('ID utilisateur manquant');
    }

    const {
      page = 1,
      pageSize = 10,
      status = null,
      orderBy = 'created_at',
      orderDirection = 'desc',
    } = options;

    // Calculer l'offset pour la pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Construire la requête
    let query = supabase
      .from('videos')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(from, to);

    // Ajouter le filtre de statut si spécifié
    if (status) {
      query = query.eq('status', toDatabaseStatus(status));
    }

    // Exécuter la requête
    const { data: videos, error, count } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des vidéos: ${error.message}`);
    }

    return { videos, count, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des vidéos:', error);
    return { videos: [], count: 0, error };
  }
};

/**
 * Récupère l'URL de visualisation d'une vidéo
 * @param {string} filePath - Chemin du fichier dans le stockage
 * @returns {Promise<Object>} - URL de la vidéo
 */
export const getVideoUrl = async (filePath) => {
  try {
    if (!filePath) {
      throw new Error('Chemin de fichier manquant');
    }

    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrl(filePath, 3600); // URL valide pendant 1 heure

    if (error) {
      throw new Error(`Erreur lors de la création de l'URL: ${error.message}`);
    }

    return { url: data.signedUrl, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'URL de la vidéo:', error);
    return { url: null, error };
  }
};

/**
 * Supprime une vidéo
 * @param {string} videoId - ID de la vidéo à supprimer
 * @param {string} userId - ID de l'utilisateur (pour vérification)
 * @returns {Promise<Object>} - Résultat de la suppression
 */
export const deleteVideo = async (videoId, userId) => {
  try {
    if (!videoId || !userId) {
      throw new Error('ID vidéo ou ID utilisateur manquant');
    }

    // Récupérer les informations de la vidéo
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Erreur lors de la récupération de la vidéo: ${fetchError.message}`);
    }

    if (!video) {
      throw new Error('Vidéo non trouvée ou vous n\'avez pas les droits pour la supprimer');
    }

    // Supprimer les fichiers du stockage
    const filesToDelete = [];
    if (video.original_file_path) {
      filesToDelete.push(video.original_file_path);
    }
    if (video.processed_file_path && video.processed_file_path !== video.original_file_path) {
      filesToDelete.push(video.processed_file_path);
    }
    if (video.storage_path && 
        video.storage_path !== video.original_file_path && 
        video.storage_path !== video.processed_file_path) {
      filesToDelete.push(video.storage_path);
    }

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('videos')
        .remove(filesToDelete);

      if (storageError) {
        console.error('Erreur lors de la suppression des fichiers:', storageError);
        // Continuer malgré l'erreur pour supprimer l'enregistrement en base
      }
    }

    // Supprimer l'enregistrement en base de données
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Erreur lors de la suppression de la vidéo: ${deleteError.message}`);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Erreur lors de la suppression de la vidéo:', error);
    return { success: false, error };
  }
};

/**
 * Récupère les détails d'une vidéo
 * @param {string} videoId - ID de la vidéo
 * @param {string} userId - ID de l'utilisateur (pour vérification)
 * @returns {Promise<Object>} - Détails de la vidéo
 */
export const getVideoDetails = async (videoId, userId) => {
  try {
    if (!videoId || !userId) {
      throw new Error('ID vidéo ou ID utilisateur manquant');
    }

    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new Error(`Erreur lors de la récupération des détails de la vidéo: ${error.message}`);
    }

    return { video, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des détails de la vidéo:', error);
    return { video: null, error };
  }
};

/**
 * Met à jour les statistiques d'une vidéo
 * @param {string} videoId - ID de la vidéo
 * @param {Object} stats - Nouvelles statistiques
 * @returns {Promise<Object>} - Résultat de la mise à jour
 */
export const updateVideoStats = async (videoId, stats) => {
  try {
    if (!videoId) {
      throw new Error('ID vidéo manquant');
    }

    const updateData = {};
    
    // Utiliser les nouveaux noms de colonnes harmonisés
    if (stats.views !== undefined) {
      updateData.views = stats.views; // Utilise 'views' au lieu de 'views_count'
    }
    
    if (stats.likes !== undefined) {
      updateData.likes_count = stats.likes;
    }
    
    if (stats.comments !== undefined) {
      updateData.comments_count = stats.comments;
    }
    
    if (stats.performance_score !== undefined) {
      updateData.performance_score = stats.performance_score; // Utilise 'performance_score' au lieu de 'ai_score'
    }
    
    if (stats.duration !== undefined) {
      updateData.duration = stats.duration; // Utilise 'duration' au lieu de 'duration_seconds'
    }

    const { data, error } = await supabase
      .from('videos')
      .update(updateData)
      .eq('id', videoId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la mise à jour des statistiques: ${error.message}`);
    }

    return { success: true, video: data, error: null };
  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques de la vidéo:', error);
    return { success: false, video: null, error };
  }
};

/**
 * Incrémente le nombre de vues d'une vidéo
 * @param {string} videoId - ID de la vidéo
 * @returns {Promise<Object>} - Résultat de l'incrémentation
 */
export const incrementVideoViews = async (videoId) => {
  try {
    if (!videoId) {
      throw new Error('ID vidéo manquant');
    }

    // Utiliser une fonction RPC pour incrémenter atomiquement
    const { data, error } = await supabase.rpc('increment_video_views', {
      video_id: videoId
    });

    if (error) {
      // Si la fonction RPC n'existe pas, faire une mise à jour manuelle
      if (error.code === '42883') {
        console.warn('Fonction increment_video_views non trouvée, utilisation de la mise à jour manuelle');
        
        // Récupérer la vidéo actuelle
        const { data: video, error: fetchError } = await supabase
          .from('videos')
          .select('views')
          .eq('id', videoId)
          .single();
          
        if (fetchError) throw fetchError;
        
        // Incrémenter les vues
        const newViews = (video.views || 0) + 1;
        
        const { data: updatedVideo, error: updateError } = await supabase
          .from('videos')
          .update({ views: newViews })
          .eq('id', videoId)
          .select()
          .single();
          
        if (updateError) throw updateError;
        
        return { success: true, video: updatedVideo, error: null };
      }
      
      throw error;
    }

    return { success: true, data, error: null };
  } catch (error) {
    console.error('Erreur lors de l\'incrémentation des vues:', error);
    return { success: false, data: null, error };
  }
};

