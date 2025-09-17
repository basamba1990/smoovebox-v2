import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const AUTH_STORAGE_KEY = 'spotbulle-auth-token';

console.log('Configuration Supabase:', {
  url: supabaseUrl ? 'Définie' : 'Manquante',
  key: supabaseAnonKey ? 'Définie' : 'Manquante',
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: AUTH_STORAGE_KEY,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'spotbulle',
    },
  },
});

export const retryOperation = async (operation, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        ),
      ]);
    } catch (error) {
      console.warn(`Tentative ${attempt + 1}/${maxRetries} échouée:`, error);
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

export const refreshSession = async () => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Erreur lors de la récupération de la session:', sessionError);
      return false;
    }
    
    if (session) {
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && now < session.expires_at) {
        return true;
      }
      
      console.log('Session expirée, tentative de rafraîchissement...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Erreur lors du rafraîchissement de la session:', refreshError);
        return false;
      }
      
      return !!newSession;
    }
    
    console.log('Aucune session active, vérification du stockage...');
    const { data: { session: storedSession }, error: storedError } = await supabase.auth.getSession();
    
    return !!storedSession && !storedError;
  } catch (error) {
    console.error('Erreur lors de la vérification de la session:', error);
    return false;
  }
};

export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Erreur de session Supabase:', error);
      return {
        connected: false,
        error: `Erreur de connexion à l'authentification: ${error.message}`,
      };
    }

    try {
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (testError && testError.code !== 'PGRST116') {
        console.warn('Avertissement base de données:', testError);
        return {
          connected: true,
          error: `Base de données accessible mais avec avertissements: ${testError.message}`,
        };
      }
    } catch (dbError) {
      console.warn('Base de données non accessible:', dbError);
      return {
        connected: true,
        error: 'Authentification OK mais base de données inaccessible',
      };
    }

    return { connected: true };
  } catch (error) {
    console.error('Erreur de connexion Supabase:', error);
    return {
      connected: false,
      error: `Erreur de configuration Supabase: ${error.message}`,
    };
  }
};

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
        console.warn('Table profiles non trouvée, utilisation de user_id directement');
        return userId;
      }
      if (error.code === 'PGRST301') {
        console.warn('Profil non trouvé, retour de l\'ID utilisateur comme fallback.');
        return userId;
      }
      throw error;
    }

    if (!data) {
      console.warn('Profil non trouvé pour l\'utilisateur, utilisation de user_id directement');
      return userId;
    }

    return data.id;
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error.message);
    return userId;
  }
};

export const fetchDashboardData = async (userId) => {
  if (!userId) {
    throw new Error('ID utilisateur requis pour récupérer les données du dashboard');
  }

  try {
    console.log('Récupération des données dashboard pour userId:', userId);

    const connectionCheck = await checkSupabaseConnection();
    if (!connectionCheck.connected) {
      throw new Error(`Connexion Supabase échouée: ${connectionCheck.error}`);
    }

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

    if (!videos || videos.length === 0) {
      return {
        totalVideos: 0,
        totalViews: 0,
        avgEngagement: 0,
        recentVideos: [],
        isEmpty: true,
      };
    }

    const totalVideos = videos.length;
    const totalViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);
    const validEngagementScores = videos.filter(
      video => video.performance_score !== null && video.performance_score !== undefined
    );
    const avgEngagement =
      validEngagementScores.length > 0
        ? validEngagementScores.reduce((sum, video) => sum + video.performance_score, 0) /
          validEngagementScores.length
        : 0;

    const recentVideos = videos.slice(0, 5).map(video => ({
      id: video.id,
      title: video.title || `Video ${video.id}`,
      created_at: video.created_at,
      views: video.views || 0,
      performance_score: video.performance_score || 0,
      status: video.status || 'unknown',
    }));

    return {
      totalVideos,
      totalViews,
      avgEngagement,
      recentVideos,
      isEmpty: false,
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des données du dashboard:', error);
    throw new Error(`Impossible de charger les données du dashboard: ${error.message}`);
  }
};

export const transcribeVideo = async (videoId) => {
  try {
    if (!videoId) {
      throw new Error('ID de vidéo requis');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.access_token) {
      throw new Error('Utilisateur non authentifié ou jeton d\'accès manquant.');
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/transcribe-video`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ videoId }),
      }
    );

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

export const watchVideoStatus = (videoId, onStatusChange) => {
  if (!videoId || typeof onStatusChange !== 'function') {
    console.error('ID de vidéo et callback requis pour watchVideoStatus');
    return () => {};
  }

  const subscription = supabase
    .channel(`video-status-${videoId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'videos',
        filter: `id=eq.${videoId}`,
      },
      (payload) => {
        onStatusChange(payload.new);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
};

export const handleSupabaseError = (error, operation = 'operation') => {
  console.error(`Erreur lors de ${operation}:`, error);
  
  if (error.code === 'PGRST116') {
    return { error: 'Aucun résultat trouvé', details: error.message };
  } else if (error.code === '42501') {
    return { error: 'Permission refusée', details: 'Vous n\'avez pas les droits nécessaires' };
  } else if (error.code === 'PGRST301') {
    return { error: 'Non authentifié', details: 'Veuillez vous reconnecter' };
  } else if (error.code === 'PGRST302') {
    return { error: 'Jeton expiré', details: 'Votre session a expiré' };
  }
  
  return { 
    error: 'Erreur inattendue', 
    details: error.message || 'Une erreur s\'est produite' 
  };
};

export default supabase;
