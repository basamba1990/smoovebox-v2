import { supabase } from '../lib/supabase';

/**
 * VERSION CORRIGÉE : Service pour gérer les vidéos GENUP
 * Correction : Extraction explicite de l'analyse pour compatibilité avec le journal.
 */

/**
 * Enregistre une vidéo avec ses métadonnées GENUP
 */
export async function saveGenupVideo(videoData) {
  try {
    const { data: session, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.session?.user?.id) {
      throw new Error('Utilisateur non authentifié');
    }

    const userId = session.session.user.id;

    // Préparation des données avec compatibilité descendante
    const insertData = {
      user_id: userId,
      title: videoData.title || `${videoData.videoType} - ${new Date().toLocaleDateString()}`,
      description: videoData.description,
      video_type: videoData.videoType,
      session_id: videoData.sessionId,
      storage_path: videoData.storagePath,
      public_url: videoData.publicUrl,
      video_url: videoData.publicUrl,
      status: 'ready', // Changé de 'pending' à 'ready' car l'analyse est déjà faite
      metadata: videoData.metadata || {},
      language: 'fr',
      // AJOUT : Extraction explicite pour les colonnes dédiées si elles existent
      analysis: videoData.metadata?.analysis || null,
      transcription_text: videoData.metadata?.transcription || null
    };

    const { data, error } = await supabase
      .from('videos')
      .insert(insertData)
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
