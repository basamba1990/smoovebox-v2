// src/services/videoService.js
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
  if (pathParts.length < 3 || pathParts[0] !== 'videos') {
    throw new Error('Le chemin de stockage doit commencer par "videos/<user_id>/<filename>"');
  }
  
  // Vérifier que l'ID utilisateur est valide
  const userId = pathParts[1];
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

  async uploadVideo(file, metadata, onProgress) {
    if (!file) throw new Error('Fichier vidéo requis');
    if (!metadata || !metadata.title) throw new Error('Titre de la vidéo requis');
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Utilisateur:', user?.id, 'Auth UID:', session?.user?.id, 'User Error:', userError, 'Session Error:', sessionError);
      if (!user) throw new Error('Utilisateur non connecté');
      if (user.id !== session?.user?.id) throw new Error('Incohérence entre user.id et auth.uid()');

      // Générer un nom de fichier unique avec validation
      const fileNameParts = file.name?.split('.') || [];
      const fileExt = fileNameParts.length > 1 ? fileNameParts.pop() : 'webm';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      // Valider et générer le chemin de stockage
      const filePath = validateStoragePath(`videos/${user.id}/${fileName}`);
      console.log('Chemin de stockage:', filePath, 'Expected UID in path:', user.id);

      // Upload du fichier via l'API Supabase Storage
      console.log('Début de l\'upload dans le bucket videos...');
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
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
        console.error('Erreur d\'upload dans storage:', uploadError);
        throw new Error(`Échec de l'upload: ${uploadError.message}`);
      }
      console.log('Upload réussi dans le bucket videos.');

      // Générer l'URL signée après l'upload réussi
      console.log('Génération de l\'URL signée...');
      const { data: publicUrl, error: urlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(filePath, 365 * 24 * 60 * 60);
      
      if (urlError) {
        console.warn('Impossible de générer l\'URL signée:', urlError);
      }

      // Créer l'entrée vidéo dans la base de données
      console.log('Insertion dans la table videos...');
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          title: metadata.title.trim(),
          description: metadata.description?.trim() || null,
          status: toDatabaseStatus(VIDEO_STATUS.UPLOADED),
          user_id: user.id,
          original_file_name: file.name,
          file_size: file.size,
          format: file.type.split('/')[1] || 'mp4',
          duration: metadata.duration || null,
          is_public: metadata.isPublic || false,
          storage_path: filePath,
          file_path: filePath,
          public_url: publicUrl?.signedUrl || null,
        })
        .select()
        .single();

      if (videoError) {
        console.error('Erreur lors de l\'insertion dans videos:', videoError);
        throw new Error(`Erreur base de données: ${videoError.message}`);
      }
      console.log('Insertion réussie:', videoData);

      // Assurez-vous que la progression est à 100% à la fin
      if (onProgress) {
        onProgress({
          loaded: file.size,
          total: file.size,
          percent: 100
        });
      }

      return videoData;
    } catch (error) {
      console.error('Erreur détaillée lors du téléchargement:', error);
      throw new Error(`Échec de l'upload: ${error.message}`);
    }
  },

  async transcribeVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      await this.updateVideoStatus(videoId, VIDEO_STATUS.TRANSCRIBING);
      
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
      
      if (result.success || result.message) {
        return result;
      } else {
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

  async analyzeVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
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

  async deleteVideo(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');
      
      const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .eq('user_id', user.id)
        .single();
      
      if (fetchError) throw fetchError;
      if (!video) throw new Error('Vidéo non trouvée ou accès non autorisé');
      
      if (video.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([video.storage_path]);
        
        if (storageError) {
          console.warn('Erreur lors de la suppression du fichier:', storageError);
        }
      }
      
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

  async incrementViews(videoId) {
    if (!videoId) throw new Error('ID de vidéo requis');
    
    try {
      const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('views_count')
        .eq('id', videoId)
        .single();
      
      if (fetchError) throw fetchError;
      
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
  },

  // New functions for public_videos table
  async getPublicVideoById(id) {
    if (!id) throw new Error('ID de vidéo publique requis');
    
    try {
      const { data, error } = await supabase
        .from('public_videos')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération de la vidéo publique:', error);
      throw error;
    }
  },

  async getAllPublicVideos() {
    try {
      const { data, error } = await supabase
        .from('public_videos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des vidéos publiques:', error);
      throw error;
    }
  }
};
