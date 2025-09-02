// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';
import { VIDEO_STATUS } from '../constants/videoStatus.js';

// Configuration avec gestion d'erreurs améliorée et fallbacks robustes
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Constante pour la gestion des sessions - à utiliser de manière cohérente dans toute l'application
export const AUTH_STORAGE_KEY = 'spotbulle-auth-token';

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
      'X-Client-Info': 'spotbulle'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    },
    timeout: 30000 // Timeout de 30 secondes
  },
  db: {
    schema: 'public'
  }
});

/**
 * Fonction utilitaire pour réessayer une opération en cas d'échec
 * @param {Function} operation - La fonction à exécuter
 * @param {number} maxRetries - Nombre maximum de tentatives
 * @param {number} delay - Délai entre les tentatives en ms
 * @returns {Promise} - Le résultat de l'opération
 */
export const retryOperation = async (operation, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.warn(`Tentative ${attempt + 1}/${maxRetries} échouée:`, error);
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
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
        console.warn("Profil non trouvé, retour de l'ID utilisateur comme fallback.");
        return userId;
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
  if (!userId) {
    throw new Error('ID utilisateur requis pour récupérer les données du dashboard');
  }

  try {
    console.log('Récupération des données dashboard pour userId:', userId);
    
    // Vérifier la connexion avant de procéder
    const connectionCheck = await checkSupabaseConnection();
    if (!connectionCheck.connected) {
      throw new Error(`Connexion Supabase échouée: ${connectionCheck.error}`);
    }
    
    // Récupérer les vidéos avec leurs transcriptions associées en une seule requête
    const { data: videos, error: videosError } = await retryOperation(async () => {
      return await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    });
      
    if (videosError) {
      console.error('Erreur lors de la récupération des vidéos:', videosError);
      throw new Error(`Impossible de récupérer les vidéos: ${videosError.message}`);
    }
    
    // Si aucune vidéo n'est trouvée, retourner des valeurs par défaut
    if (!videos || videos.length === 0) {
      return {
        totalVideos: 0,
        totalViews: 0,
        avgEngagement: 0,
        recentVideos: [],
        isEmpty: true
      };
    }
    
    // Calculer les statistiques à partir des vidéos récupérées
    const totalVideos = videos.length;
    
    // Calculer le nombre total de vues (avec une valeur par défaut de 0 si views est null)
    const totalViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);
    
    // Calculer l'engagement moyen (avec une valeur par défaut de 0 si performance_score est null)
    const validEngagementScores = videos.filter(video => video.performance_score !== null && video.performance_score !== undefined);
    const avgEngagement = validEngagementScores.length > 0
      ? validEngagementScores.reduce((sum, video) => sum + video.performance_score, 0) / validEngagementScores.length
      : 0;
    
    // Prendre les 5 vidéos les plus récentes pour l'affichage
    const recentVideos = videos.slice(0, 5).map(video => ({
      id: video.id,
      title: video.title || `Video ${video.id}`,
      created_at: video.created_at,
      views: video.views || 0,
      performance_score: video.performance_score || 0,
      status: video.status || 'unknown'
    }));
    
    return {
      totalVideos,
      totalViews,
      avgEngagement,
      recentVideos,
      isEmpty: false
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des données du dashboard:', error);
    // Ne plus utiliser de fallback avec des données factices
    throw new Error(`Impossible de charger les données du dashboard: ${error.message}`);
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
    if (!session || !session.access_token) {
      throw new Error("Utilisateur non authentifié ou jeton d'accès manquant.");
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
        body: JSON.stringify({ videoId: videoId })
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

