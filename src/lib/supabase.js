-- Code frontend amélioré pour src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';
import { VIDEO_STATUS } from '../constants/videoStatus.js';

// Configuration avec gestion d'erreurs améliorée et fallbacks robustes
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Constante pour la gestion des sessions - à utiliser de manière cohérente dans toute l'application
export const AUTH_STORAGE_KEY = 'smoovebox-auth-token';

console.log('Configuration Supabase:', {
  url: supabaseUrl ? 'Définie' : 'Manquante',
  key: supabaseAnonKey ? 'Définie' : 'Manquante'
});

// Initialisation du client Supabase avec configuration robuste et gestion d'erreurs
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: AUTH_STORAGE_KEY,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'smoovebox-v2'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  }
});

// Fonction utilitaire pour les tentatives avec retry et backoff exponentiel
export const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Tentative ${attempt}/${maxRetries} échouée:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Backoff exponentiel avec jitter
      const backoffDelay = delay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
};

/**
 * Vérifie la connexion à Supabase avec gestion d'erreurs robuste
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
export const checkSupabaseConnection = async () => {
  try {
    // Test de connexion basique
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Erreur de session Supabase:", error);
      return {
        connected: false,
        error: `Erreur de connexion à l'authentification: ${error.message}`
      };
    }

    // Test de connexion à la base de données
    try {
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (testError && testError.code !== 'PGRST116') {
        console.warn("Avertissement base de données:", testError);
        return {
          connected: true,
          error: `Base de données accessible mais avec avertissements: ${testError.message}`
        };
      }
    } catch (dbError) {
      console.warn("Base de données non accessible:", dbError);
      return {
        connected: true,
        error: "Authentification OK mais base de données inaccessible"
      };
    }
    
    return { connected: true };
    
  } catch (error) {
    console.error("Erreur de connexion Supabase:", error);
    return {
      connected: false,
      error: `Erreur de configuration Supabase: ${error.message}`
    };
  }
};

/**
 * Récupère l'ID du profil associé à un user_id (auth) avec gestion d'erreurs robuste
 * @param {string} userId 
 * @returns {Promise<string>} profile_id
 */
export const getProfileId = async (userId) => {
  try {
    const { data, error } = await retryOperation(async () => {
      return await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();
    });

    if (error) {
      if (error.code === 'PGRST116') {
        // Table profiles non trouvée, retourner user_id directement
        console.warn("Table profiles non trouvée, utilisation de user_id directement");
        return userId;
      }
      
      // Si le profil n'existe pas, essayer de le créer
      if (error.code === 'PGRST301') {
        console.warn("Profil non trouvé, tentative de création...");
        
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          throw new Error("Utilisateur non authentifié");
        }
        
        const { data: newProfile, error: createError } = await retryOperation(async () => {
          return await supabase
            .from('profiles')
            .insert({
              user_id: userId,
              email: userData.user.email,
              username: userData.user.email?.split('@')[0] || 'user',
              full_name: userData.user.user_metadata?.full_name || 
                        `${userData.user.user_metadata?.first_name || ''} ${userData.user.user_metadata?.last_name || ''}`.trim() || null
            })
            .select()
            .single();
        });
          
        if (createError) {
          console.error('Erreur lors de la création du profil:', createError);
          // En cas d'échec, retourner user_id directement
          return userId;
        }
        return newProfile.id;
      }
      
      throw error;
    }
    
    if (!data) {
      console.warn("Profil non trouvé pour l'utilisateur, utilisation de user_id directement");
      return userId;
    }
    
    return data.id;
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error.message);
    // En cas d'erreur, retourner user_id comme fallback
    return userId;
  }
};

/**
 * Fonction utilitaire pour récupérer les données du dashboard avec jointures optimisées
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
export const fetchDashboardData = async (userId) => {
  try {
    console.log('Récupération des données dashboard pour userId:', userId);
    
    // Récupérer les vidéos avec leurs transcriptions associées en une seule requête
    const { data: videosWithTranscriptions, error: queryError } = await retryOperation(async () => {
      return await supabase
        .from('videos')
        .select(`
          id, 
          title, 
          description, 
          created_at, 
          status, 
          thumbnail_url, 
          file_path,
          transcriptions:transcriptions(id, confidence_score, created_at)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    });
      
    if (queryError) {
      // Si l'erreur est due à une relation inexistante, essayer les requêtes séparées
      if (queryError.message?.includes('does not exist') || queryError.code === 'PGRST116') {
        return await fetchDashboardDataFallback(userId);
      }
      console.error('Erreur requête dashboard:', queryError);
      throw queryError;
    }
    
    // Traiter les données pour le dashboard
    const videosCount = videosWithTranscriptions ? videosWithTranscriptions.length : 0;
    
    // Extraire toutes les transcriptions
    const allTranscriptions = [];
    videosWithTranscriptions?.forEach(video => {
      if (video.transcriptions && Array.isArray(video.transcriptions)) {
        allTranscriptions.push(...video.transcriptions);
      }
    });
    
    const transcriptionsCount = allTranscriptions.length;
    
    // Calculer le score moyen de confiance
    let averageScore = null;
    if (allTranscriptions.length > 0) {
      const validScores = allTranscriptions
        .filter(t => t.confidence_score !== null)
        .map(t => t.confidence_score);
      
      if (validScores.length > 0) {
        averageScore = Math.round(
          validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        );
      }
    }
    
    // Préparer les données du dashboard
    return {
      stats: {
        videosCount,
        transcriptionsCount,
        averageScore
      },
      recentVideos: videosWithTranscriptions ? videosWithTranscriptions.slice(0, 5) : []
    };
    
  } catch (error) {
    console.error('Erreur lors de la récupération des données dashboard:', error);
    // En cas d'erreur, essayer la méthode de fallback
    return await fetchDashboardDataFallback(userId);
  }
};

/**
 * Version de fallback pour fetchDashboardData utilisant des requêtes séparées
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
const fetchDashboardDataFallback = async (userId) => {
  try {
    console.log('Utilisation du fallback pour les données dashboard');
    
    // Récupérer les statistiques des vidéos avec retry
    const { data: videosData, error: videosError } = await retryOperation(async () => {
      return await supabase
        .from('videos')
        .select('id, title, description, created_at, status, thumbnail_url, file_path')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    });
      
    if (videosError && videosError.code !== 'PGRST116') {
      console.error('Erreur vidéos:', videosError);
    }
    
    // Récupérer les transcriptions avec retry
    const { data: transcriptionsData, error: transcriptionsError } = await retryOperation(async () => {
      return await supabase
        .from('transcriptions')
        .select('id, confidence_score, created_at')
        .eq('user_id', userId);
    });
    
    if (transcriptionsError && transcriptionsError.code !== 'PGRST116') {
      console.error('Erreur transcriptions:', transcriptionsError);
    }
    
    // Calculer les statistiques
    const videosCount = videosData ? videosData.length : 0;
    const transcriptionsCount = transcriptionsData ? transcriptionsData.length : 0;
    
    // Calculer le score moyen de confiance
    let averageScore = null;
    if (transcriptionsData && transcriptionsData.length > 0) {
      const validScores = transcriptionsData
        .filter(t => t.confidence_score !== null)
        .map(t => t.confidence_score);
      
      if (validScores.length > 0) {
        averageScore = Math.round(
          validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        );
      }
    }
    
    // Préparer les données du dashboard
    return {
      stats: {
        videosCount,
        transcriptionsCount,
        averageScore
      },
      recentVideos: videosData ? videosData.slice(0, 5) : []
    };
  } catch (error) {
    console.error('Erreur dans le fallback dashboard:', error);
    throw new Error(`Erreur dashboard: ${error.message}`);
  }
};

/**
 * Déclenche la transcription d'une vidéo via l'Edge Function
 * @param {string} videoId - ID de la vidéo à transcrire
 * @returns {Promise<Object>} - Résultat de la transcription
 */
export const transcribeVideo = async (videoId) => {
  try {
    if (!videoId) {
      throw new Error('ID de vidéo requis');
    }
    
    // Récupérer le token d'authentification actuel
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Utilisateur non authentifié');
    }
    
    // Appeler l'Edge Function avec le token d'authentification
    const response = await fetch(
      `${supabaseUrl}/functions/v1/transcribe-video`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ video_id: videoId })
      }
    );
    
    // Vérifier la réponse
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Erreur lors de la transcription (${response.status}): ${errorData.error || response.statusText}`
      );
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Erreur lors de la transcription:', error);
    throw error;
  }
};

/**
 * Surveille le statut d'une vidéo en temps réel
 * @param {string} videoId - ID de la vidéo à surveiller
 * @param {Function} onStatusChange - Callback appelé lors d'un changement de statut
 * @returns {Function} - Fonction pour arrêter la surveillance
 */
export const watchVideoStatus = (videoId, onStatusChange) => {
  if (!videoId || typeof onStatusChange !== 'function') {
    console.error('ID de vidéo et callback requis pour watchVideoStatus');
    return () => {};
  }
  
  // S'abonner aux changements de statut via Realtime
  const subscription = supabase
    .channel(`video-status-${videoId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'videos',
        filter: `id=eq.${videoId}`
      },
      (payload) => {
        // Appeler le callback avec les nouvelles données
        onStatusChange(payload.new);
      }
    )
    .subscribe();
  
  // Retourner une fonction pour se désabonner
  return () => {
    subscription.unsubscribe();
  };
};

export default supabase;
