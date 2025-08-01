// src/lib/videoProcessing.js
import { supabase } from './supabase';

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
    const filePath = `videos/${userId}/${fileName}`;

    // Télécharger le fichier vers le stockage
    const { error: uploadError, data } = await supabase.storage
      .from(\'videos\')
      .upload(filePath, file, {
        cacheControl: \'3600\',
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
      .from(\'videos\')
      .insert([
        {
          user_id: userId,
          title: metadata.title || file.name,
          description: metadata.description || \'\',
          original_file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          status: \'PENDING\',
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
      query = query.eq('status', status);
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
    if (video.processed_file_path) {
      filesToDelete.push(video.processed_file_path);
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
