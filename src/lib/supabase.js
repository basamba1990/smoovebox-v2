import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const AUTH_STORAGE_KEY = 'spotbulle-auth-token';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erreur de configuration Supabase : VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant');
  throw new Error('Configuration Supabase incomplète');
}

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
  db: {
    schema: 'public',
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
    console.log('Vérification de la session...');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Erreur récupération session:', error);
      return false;
    }

    if (session && session.expires_at && Math.floor(Date.now() / 1000) < session.expires_at) {
      console.log('Session valide:', session.user.id);
      return true;
    }

    console.log('Session expirée ou absente, tentative de rafraîchissement...');
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !newSession) {
      console.error('Erreur rafraîchissement session:', refreshError);
      return false;
    }

    console.log('Session rafraîchie:', newSession.user.id);
    return true;
  } catch (error) {
    console.error('Erreur vérification session:', error);
    return false;
  }
};

export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Erreur session Supabase:', error);
      return { connected: false, error: `Erreur authentification: ${error.message}` };
    }

    try {
      // Test simple de la base de données
      const { error: testError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle(); // Utiliser maybeSingle() au lieu de single() pour éviter les 406

      if (testError && testError.code !== 'PGRST116') {
        console.warn('Avertissement base de données:', testError);
        return { 
          connected: true, 
          error: `Base de données accessible mais avec avertissements: ${testError.message}` 
        };
      }
    } catch (dbError) {
      console.warn('Base de données non accessible:', dbError);
      return { 
        connected: true, 
        error: 'Authentification OK mais base de données inaccessible' 
      };
    }

    return { connected: true };
  } catch (error) {
    console.error('Erreur connexion Supabase:', error);
    return { 
      connected: false, 
      error: `Erreur configuration Supabase: ${error.message}` 
    };
  }
};

export const getProfileId = async (userId) => {
  try {
    const { data, error } = await retryOperation(async () => {
      return await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId) // Correction: utiliser 'id' au lieu de 'user_id'
        .maybeSingle(); // Utiliser maybeSingle() pour éviter les erreurs 406
    });

    if (error) {
      console.warn('Erreur récupération profil:', error);
      return userId; // Fallback
    }
    
    return data?.id || userId;
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    return userId;
  }
};

export const fetchDashboardData = async (userId) => {
  if (!userId) throw new Error('ID utilisateur requis');
  
  try {
    console.log('Récupération dashboard pour userId:', userId);
    
    const connectionCheck = await checkSupabaseConnection();
    if (!connectionCheck.connected) {
      throw new Error(`Connexion Supabase échouée: ${connectionCheck.error}`);
    }

    // Récupérer les vidéos
    const { data: videos, error: videosError } = await retryOperation(async () => {
      return await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    });

    if (videosError) {
      console.error('Erreur récupération vidéos:', videosError);
      // Continuer même s'il n'y a pas de vidéos
    }

    const videoList = videos || [];

    if (videoList.length === 0) {
      return {
        totalVideos: 0,
        totalViews: 0,
        avgEngagement: 0,
        recentVideos: [],
        isEmpty: true
      };
    }

    const totalVideos = videoList.length;
    const totalViews = videoList.reduce((sum, video) => sum + (video.views || 0), 0);
    
    const validEngagementScores = videoList.filter(video => video.performance_score != null);
    const avgEngagement = validEngagementScores.length > 0 
      ? validEngagementScores.reduce((sum, video) => sum + video.performance_score, 0) / validEngagementScores.length 
      : 0;

    const recentVideos = videoList.slice(0, 5).map(video => ({
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
      isEmpty: false
    };
  } catch (error) {
    console.error('Erreur récupération dashboard:', error);
    throw new Error(`Impossible de charger les données du dashboard: ${error.message}`);
  }
};

// Fonction pour vérifier le statut du questionnaire
export const checkQuestionnaireStatus = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('questionnaire_responses')
      .select('id, completed_at')
      .eq('user_id', userId)
      .maybeSingle(); // Important: utiliser maybeSingle() pour éviter les 406

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur vérification questionnaire:', error);
      return false;
    }

    return !!data; // Retourne true si le questionnaire est complété
  } catch (error) {
    console.error('Erreur vérification questionnaire:', error);
    return false;
  }
};

export const handleSupabaseError = (error, operation = 'operation') => {
  console.error(`Erreur lors de ${operation}:`, error);
  
  const errorMap = {
    'PGRST116': { 
      error: 'Aucun résultat trouvé', 
      details: 'Aucune donnée correspondante trouvée dans la base de données'
    },
    '42501': { 
      error: 'Permission refusée', 
      details: 'Vous n\'avez pas les droits nécessaires pour cette opération'
    },
    'PGRST301': { 
      error: 'Non authentifié', 
      details: 'Veuillez vous reconnecter' 
    },
    'PGRST302': { 
      error: 'Jeton expiré', 
      details: 'Votre session a expiré' 
    },
    '406': {
      error: 'Format non acceptable',
      details: 'Le format de réponse demandé n\'est pas supporté'
    },
    '401': {
      error: 'Non autorisé',
      details: 'Authentification requise'
    }
  };

  return errorMap[error.code] || { 
    error: 'Erreur inattendue', 
    details: error.message || 'Une erreur s\'est produite' 
  };
};

export default supabase;
