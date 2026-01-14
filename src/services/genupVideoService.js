import { supabase } from '../lib/supabase';

/**
 * Service pour gérer les vidéos GENUP
 * Inclut l'enregistrement avec type et session
 */

/**
 * Enregistre une vidéo avec ses métadonnées GENUP
 * @param {Object} videoData - Données de la vidéo
 * @param {string} videoData.title - Titre de la vidéo
 * @param {string} videoData.description - Description
 * @param {string} videoData.videoType - Type de vidéo (pitch, reflexive, action_trace)
 * @param {string} videoData.sessionId - ID de la session
 * @param {string} videoData.storagePath - Chemin de stockage dans Supabase Storage
 * @param {string} videoData.publicUrl - URL publique de la vidéo
 * @param {Object} videoData.metadata - Métadonnées supplémentaires
 * @returns {Promise<Object>} Données de la vidéo enregistrée
 */
export async function saveGenupVideo(videoData) {
  try {
    const { data: session, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.session?.user?.id) {
      throw new Error('Utilisateur non authentifié');
    }

    const userId = session.session.user.id;

    const { data, error } = await supabase
      .from('videos')
      .insert({
        user_id: userId,
        title: videoData.title || `${videoData.videoType} - ${new Date().toLocaleDateString()}`,
        description: videoData.description,
        video_type: videoData.videoType,
        session_id: videoData.sessionId,
        storage_path: videoData.storagePath,
        public_url: videoData.publicUrl,
        status: 'pending',
        metadata: videoData.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement de la vidéo:', err);
    throw err;
  }
}

/**
 * Met à jour le statut d'une vidéo
 * @param {string} videoId - ID de la vidéo
 * @param {string} status - Nouveau statut
 * @returns {Promise<Object>} Données mises à jour
 */
export async function updateVideoStatus(videoId, status) {
  try {
    const { data, error } = await supabase
      .from('videos')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', videoId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Erreur lors de la mise à jour du statut:', err);
    throw err;
  }
}

/**
 * Récupère toutes les sessions de transformation d'un utilisateur
 * @returns {Promise<Array>} Liste des sessions uniques
 */
export async function getUserSessions() {
  try {
    const { data: session, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.session?.user?.id) {
      throw new Error('Utilisateur non authentifié');
    }

    const userId = session.session.user.id;

    const { data, error } = await supabase
      .from('videos')
      .select('session_id, created_at')
      .eq('user_id', userId)
      .not('session_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Dédupliquer les sessions
    const uniqueSessions = [];
    const seenSessionIds = new Set();

    data.forEach((video) => {
      if (!seenSessionIds.has(video.session_id)) {
        seenSessionIds.add(video.session_id);
        uniqueSessions.push({
          sessionId: video.session_id,
          createdAt: video.created_at,
        });
      }
    });

    return uniqueSessions;
  } catch (err) {
    console.error('Erreur lors de la récupération des sessions:', err);
    throw err;
  }
}

/**
 * Récupère les statistiques de transformation pour une session
 * @param {string} sessionId - ID de la session
 * @returns {Promise<Object>} Statistiques de la session
 */
export async function getSessionStats(sessionId) {
  try {
    const { data: session, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.session?.user?.id) {
      throw new Error('Utilisateur non authentifié');
    }

    const userId = session.session.user.id;

    const { data, error } = await supabase
      .from('videos')
      .select('video_type, status')
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const stats = {
      totalVideos: data.length,
      byType: {
        pitch: 0,
        reflexive: 0,
        action_trace: 0,
        ai_synthesis: 0,
        human_validation: 0,
      },
      byStatus: {
        pending: 0,
        processing: 0,
        ready: 0,
        validated: 0,
        failed: 0,
      },
    };

    data.forEach((video) => {
      if (stats.byType[video.video_type] !== undefined) {
        stats.byType[video.video_type]++;
      }
      if (stats.byStatus[video.status] !== undefined) {
        stats.byStatus[video.status]++;
      }
    });

    return stats;
  } catch (err) {
    console.error('Erreur lors de la récupération des statistiques:', err);
    throw err;
  }
}
