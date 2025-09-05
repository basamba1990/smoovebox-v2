import { supabase } from '../lib/supabase';
import { VIDEO_STATUS, toDatabaseStatus } from '../constants/videoStatus';

/**
 * Valide et nettoie un chemin de stockage
 * @param {string} path - Chemin à valider
 * @returns {string} - Chemin validé et nettoyé
 */
function validateStoragePath(path) {
  if (!path) {
    throw new Error('Le chemin de stockage ne peut pas être vide');
  }
  
  // Nettoyer le chemin
  let cleanPath = path
    .replace(/[^a-zA-Z0-9_\-./]/g, '_') // Remplacer les caractères spéciaux
    .replace(/_{2,}/g, '_') // Remplacer les multiples underscores
    .replace(/^_+|_+$/g, ''); // Supprimer les underscores en début/fin
  
  // Vérifier la structure du chemin
  const pathParts = cleanPath.split('/');
  if (pathParts.length < 2) {
    throw new Error('Le chemin de stockage doit contenir au moins un répertoire et un nom de fichier');
  }
  
  // Vérifier que l'ID utilisateur est valide
  const userId = pathParts[0];
  if (!userId || userId === 'null' || userId === 'undefined') {
    throw new Error('ID utilisateur invalide dans le chemin de stockage');
  }
  
  // Vérifier que le nom de fichier est valide
  const filename = pathParts[pathParts.length - 1];
  if (!filename || filename === 'null' || filename === 'undefined') {
    throw new Error('Nom de fichier invalide dans le chemin de stockage');
  }
  
  return cleanPath;
}

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
    if (!id) throw new Error('ID de vidéo requis');
    
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          transcriptions (*),
          analyses (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération de la vidéo:', error);
      throw error;
    }
  },

  /**
   * Récupère les vidéos publiques
   * @param {number} limit - Nombre de vidéos à récupérer
   * @param {number} page - Numéro de page
   * @returns {Promise<Array>} - Liste des vidéos
   */
  async getPublicVideos(limit = 10, page = 0) {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          profiles (username, avatar_url)
        `)
        .eq('is_public', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des vidéos publiques:', error);
      throw error;
    }
  },

  /**
   * Récupère les vidéos de l'utilisateur connecté
   * @returns {Promise<Array>} - Liste des vidéos
   */
  async getUserVideos() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');
      
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          transcriptions (*),
          analyses (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des vidéos utilisateur:', error);
      throw error;
    }
  },

  /**
   * Télécharge une vidéo avec suivi de progression réelle via XMLHttpRequest
   * @param {File} file - Fichier vidéo
   * @param {Object} metadata - Métadonnées de la vidéo
   * @param {Function} onProgress - Callback pour la progression (percent)
   * @returns {Promise<Object>} - Données de la vidéo créée
   */
  async uploadVideo(file, metadata, onProgress) {
    if (!file) throw new Error('Fichier vidéo requis');
    if (!metadata || !metadata.title) throw new Error('Titre de la vidéo requis');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      // Générer un nom de fichier unique avec validation
      const fileNameParts = file.name?.split('.') || [];
      const fileExt = fileNameParts.length > 1 ? fileNameParts.pop() : 'webm';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      // Valider et générer le chemin de stockage
      const filePath = validateStoragePath(`${user.id}/${fileName}`);

      // Upload du fichier via l'API Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type, // Important: spécifier le type MIME correct
          onUploadProgress: (progress) => {
            if (onProgress) {
              const percent = Math.round((progress.loadedBytes / progress.totalBytes) * 100);
              onProgress({
                loaded: progress.loadedBytes,
                total: progress.totalBytes,
                percent: percent
              });
            }
          }
        });

      if (uploadError) {
        throw new Error(`Échec de l'upload: ${uploadError.message}`);
      }

      // Générer l'URL signée après l'upload réussi
      const { data: publicUrl, error: urlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(filePath, 365 * 24 * 60 * 60); // URL valide pendant 1 an
      
      if (urlError) {
        console.warn('Impossible de générer l\'URL signée:', urlError);
      }

      // Créer l'entrée vidéo dans la base de données
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          title: metadata.title.trim(),
          description: metadata.description?.trim() || null,
          status: toDatabaseStatus(VIDEO_STATUS.UPLOADED), // Statut initial après upload
          user_id: user.id,
          original_file_name: file.name,
          file_size: file.size,
          format: file.type.split('/')[1] || 'mp4',
          duration: metadata.duration || null, // Utilise 'duration' au lieu de 'duration_seconds'
          is_public: metadata.isPublic || false,
          storage_path: filePath,
          file_path: filePath, // Compatibilité avec l'ancien champ
          public_url: publicUrl?.signedUrl || null, // Utiliser l'URL signée
        })
        .select()
        .single();

      if (videoError) {
        console.error('Erreur détaillée de Supabase:', videoError);
        throw new Error(`Erreur base de données: ${videoError.message}`);
      }

      // Assurez-vous que la progression est à 100% à la fin
      if (onProgress) {
        onProgress({
          loaded: file.size,
          total: file.size,
          percent: 100
        });
      }

      return videoData; // Retourner les données de la vidéo créée
    } catch (error) {
      console.error('Erreur détaillée lors du téléchargement:', error);
      throw new Error(`Échec de l'upload: ${error.message}`);
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
      // Mettre à jour le statut de la vidéo
      await this.updateVideoStatus(videoId, VIDEO_STATUS.TRANSCRIBING);
      
      // Appeler la fonction Edge pour la transcription
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}` // Utiliser le JWT utilisateur, pas une clé API
          },
          body: JSON.stringify({ videoId: videoId })
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `Erreur HTTP ${response.status}: ${errorText}` };
        }
        
        // Mettre à jour le statut en cas d'erreur
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: errorData.error || `Erreur HTTP ${response.status}`
          })
          .eq('id', videoId);
          
        throw new Error(errorData.error || 'Erreur lors de la transcription');
      }
      
      const result = await response.json();
      
      // Vérifier si la transcription a été lancée avec succès
      if (result.success || result.message) {
        return result;
      } else {
        // Mettre à jour le statut en cas d'erreur
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: result.error || 'Échec de la transcription'
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
            error_message: error.message || 'Erreur inconnue lors de la transcription'
          })
          .eq('id', videoId);
      } catch (updateError) {
        console.error('Erreur lors de la mise à jour du statut:', updateError);
      }
      
      throw error;
    }
  },

  /**
   * Récupère la transcription d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Données de transcription
   */
  async getTranscription(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('video_id', videoId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la transcription:', error);
      throw error;
    }
  },

  /**
   * Déclenche l'analyse IA d'une vidéo - SANS RPC
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Résultat de l'analyse
   */
  async analyzeVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      // Mettre à jour le statut de la vidéo directement
      const { data, error } = await supabase
        .from('videos')
        .update({ 
          status: toDatabaseStatus(VIDEO_STATUS.ANALYZING),
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        success: true, 
        message: 'Analyse démarrée avec succès',
        video: data
      };
      
    } catch (error) {
      console.error('Erreur lors de la demande d\'analyse:', error);
      
      // Mettre à jour le statut en cas d'erreur
      try {
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            error_message: error.message || 'Erreur inconnue lors de l\'analyse'
          })
          .eq('id', videoId);
      } catch (updateError) {
        console.error('Erreur lors de la mise à jour du statut:', updateError);
      }
      
      throw error;
    }
  },

  /**
   * Récupère l'analyse d'une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Données d'analyse
   */
  async getAnalysis(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('video_id', videoId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'analyse:', error);
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
    if (!videoId) throw new Error('ID de vidéo requis');
    if (!status) throw new Error('Statut requis');
    
    const dbStatus = toDatabaseStatus(status);
    
    try {
      const { data, error } = await supabase
        .from('videos')
        .update({ status: dbStatus })
        .eq('id', videoId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      throw error;
    }
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
    
    try {
      const { data, error } = await supabase
        .from('videos')
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
    } catch (error) {
      console.error('Erreur lors de la mise à jour des métadonnées:', error);
      throw error;
    }
  },

  /**
   * Publie une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Données de la vidéo publiée
   */
  async publishVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      const { data, error } = await supabase
        .from('videos')
        .update({ 
          status: toDatabaseStatus(VIDEO_STATUS.PUBLISHED),
          published_at: new Date().toISOString()
        })
        .eq('id', videoId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur lors de la publication de la vidéo:', error);
      throw error;
    }
  },

  /**
   * Supprime une vidéo
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Résultat de la suppression
   */
  async deleteVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');
      
      // Récupérer les informations de la vidéo
      const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .eq('user_id', user.id)
        .single();
      
      if (fetchError) throw fetchError;
      if (!video) throw new Error('Vidéo non trouvée ou accès non autorisé');
      
      // Supprimer le fichier du stockage si storage_path existe
      if (video.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([video.storage_path]);
        
        if (storageError) {
          console.warn('Erreur lors de la suppression du fichier:', storageError);
        }
      }
      
      // Supprimer l'enregistrement de la base de données
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId)
        .eq('user_id', user.id);
      
      if (deleteError) throw deleteError;
      
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la suppression de la vidéo:', error);
      throw error;
    }
  },

  /**
   * Incrémente le nombre de vues d'une vidéo - SANS RPC
   * @param {string} videoId - ID de la vidéo
   * @returns {Promise<Object>} - Données de la vidéo mise à jour
   */
  async incrementViews(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      // Récupérer le nombre de vues actuel
      const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('views_count')
        .eq('id', videoId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Incrémenter le nombre de vues
      const newViewsCount = (video.views_count || 0) + 1;
      
      const { data, error } = await supabase
        .from('videos')
        .update({ 
          views_count: newViewsCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur lors de l\'incrémentation des vues:', error);
      throw error;
    }
  }
};
