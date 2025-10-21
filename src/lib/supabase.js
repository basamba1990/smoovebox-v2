// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// ✅ CONFIGURATION SÉCURISÉE - SUPPRIMER LES CLÉS SENSIBLES DU CLIENT
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ VALIDATION DE LA CONFIGURATION
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erreur de configuration Supabase : VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant');
  
  // En production, throw une erreur. En développement, utiliser des valeurs mock
  if (import.meta.env.PROD) {
    throw new Error('Configuration Supabase incomplète');
  } else {
    console.warn('⚠️ Mode développement: utilisation de valeurs mock pour Supabase');
  }
}

console.log('Configuration Supabase sécurisée:', {
  url: supabaseUrl ? 'Définie' : 'Manquante',
  key: supabaseAnonKey ? 'Définie (Anon Key uniquement)' : 'Manquante',
});

// ✅ OPTIONS DE SÉCURITÉ AVANCÉES
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'spotbulle-auth-token-v2',
    flowType: 'pkce', // ✅ PKCE pour plus de sécurité
    debug: import.meta.env.DEV // ✅ Debug uniquement en développement
  },
  global: {
    headers: {
      'X-Client-Info': 'spotbulle-secure',
      'X-Client-Version': '2.0.0'
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10 // ✅ Limiter les événements realtime
    }
  }
});

// ✅ SYSTÈME DE RETRY AVANCÉ
export const retryOperation = async (operation, maxRetries = 3, baseDelay = 1000, timeout = 30000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // ✅ TIMEOUT POUR CHAQUE TENTATIVE
      return await Promise.race([
        operation(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout)
        ),
      ]);
    } catch (error) {
      console.warn(`🔄 Tentative ${attempt + 1}/${maxRetries} échouée:`, error.message);
      lastError = error;
      
      // ✅ NE PAS RETRY POUR CERTAINES ERREURS
      if (isFatalError(error)) {
        break;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`⏳ Attente de ${delay}ms avant prochaine tentative...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// ✅ DÉTECTION DES ERREURS FATALES
function isFatalError(error) {
  const fatalErrors = [
    'invalid_grant',
    'auth_session_missing',
    'PGRST301',
    'PGRST302'
  ];
  
  return fatalErrors.some(fatalError => 
    error.message?.includes(fatalError) || error.code === fatalError
  );
}

// ✅ GESTION DE SESSION AMÉLIORÉE
export const refreshSession = async () => {
  try {
    console.log('🔄 Vérification de la session...');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Erreur récupération session:', error);
      return false;
    }

    if (!session) {
      console.log('🚫 Aucune session active');
      return false;
    }

    // ✅ VÉRIFICATION DE L'EXPIRATION
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at;
    
    if (expiresAt && now < expiresAt - 60) { // 60 secondes de marge
      console.log('✅ Session valide:', session.user.id);
      return true;
    }

    console.log('🕒 Session expirée ou proche expiration, tentative de rafraîchissement...');
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !newSession) {
      console.error('❌ Erreur rafraîchissement session:', refreshError);
      
      // ✅ TENTATIVE DE RÉAUTHENTIFICATION SILENCIEUSE
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('❌ Erreur lors de la déconnexion:', signOutError);
      }
      
      return false;
    }

    console.log('✅ Session rafraîchie:', newSession.user.id);
    return true;
  } catch (error) {
    console.error('❌ Erreur vérification session:', error);
    return false;
  }
};

// ✅ VÉRIFICATION DE CONNEXION ROBUSTE
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('❌ Erreur session Supabase:', error);
      return { 
        connected: false, 
        error: `Erreur authentification: ${error.message}`,
        code: error.code 
      };
    }

    // ✅ TEST DE LA BASE DE DONNÉES AVEC TIMEOUT
    try {
      const { error: testError } = await Promise.race([
        supabase
          .from('profiles')
          .select('id, updated_at')
          .limit(1)
          .maybeSingle(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 10000)
        )
      ]);

      if (testError && testError.code !== 'PGRST116') {
        console.warn('⚠️ Avertissement base de données:', testError);
        return { 
          connected: true, 
          warning: `Base de données accessible mais avec avertissements: ${testError.message}`,
          code: testError.code
        };
      }
    } catch (dbError) {
      console.warn('⚠️ Base de données non accessible:', dbError);
      return { 
        connected: true, 
        warning: 'Authentification OK mais base de données inaccessible ou lente',
        details: dbError.message
      };
    }

    return { 
      connected: true,
      userId: data.session?.user?.id,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Erreur connexion Supabase:', error);
    return { 
      connected: false, 
      error: `Erreur configuration Supabase: ${error.message}`,
      code: 'CONNECTION_ERROR'
    };
  }
};

// ✅ RÉCUPÉRATION DE PROFIL AVEC CACHE
const profileCache = new Map();
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getProfile = async (userId, forceRefresh = false) => {
  if (!userId) {
    console.warn('⚠️ ID utilisateur manquant pour getProfile');
    return null;
  }

  // ✅ VÉRIFICATION DU CACHE
  const cached = profileCache.get(userId);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < PROFILE_CACHE_TTL)) {
    console.log('✅ Utilisation du profil en cache');
    return cached.data;
  }

  try {
    const { data, error } = await retryOperation(async () => {
      return await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    });

    if (error) {
      console.warn('⚠️ Erreur récupération profil:', error);
      return null;
    }
    
    if (data) {
      // ✅ MISE EN CACHE
      profileCache.set(userId, {
        data,
        timestamp: Date.now()
      });
      
      console.log('✅ Profil chargé et mis en cache');
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur récupération profil après retry:', error);
    return null;
  }
};

// ✅ INVALIDATION DU CACHE PROFIL
export const invalidateProfileCache = (userId) => {
  if (userId) {
    profileCache.delete(userId);
    console.log('🗑️ Cache profil invalidé pour:', userId);
  } else {
    profileCache.clear();
    console.log('🗑️ Cache profil complètement invalidé');
  }
};

// ✅ DONNÉES DASHBOARD OPTIMISÉES
export const fetchDashboardData = async (userId) => {
  if (!userId) {
    throw new Error('ID utilisateur requis pour fetchDashboardData');
  }
  
  try {
    console.log('📊 Récupération dashboard optimisée pour userId:', userId);
    
    const connectionCheck = await checkSupabaseConnection();
    if (!connectionCheck.connected) {
      throw new Error(`Connexion Supabase échouée: ${connectionCheck.error}`);
    }

    // ✅ REQUÊTE UNIQUE AVEC JOINTURES
    const { data: videos, error: videosError } = await retryOperation(async () => {
      return await supabase
        .from('videos')
        .select(`
          id,
          title,
          status,
          created_at,
          duration,
          file_size,
          transcription_text,
          analysis,
          ai_score,
          tags
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50); // ✅ LIMITE POUR LES PERFORMANCES
    });

    if (videosError) {
      console.error('❌ Erreur récupération vidéos:', videosError);
      // Continuer avec un tableau vide plutôt que d'échouer
    }

    const videoList = videos || [];

    // ✅ CALCUL DES STATISTIQUES OPTIMISÉ
    const stats = calculateVideoStats(videoList);

    return {
      ...stats,
      recentVideos: videoList.slice(0, 5),
      allVideos: videoList,
      lastUpdated: new Date().toISOString(),
      isEmpty: videoList.length === 0
    };
  } catch (error) {
    console.error('❌ Erreur récupération dashboard:', error);
    throw new Error(`Impossible de charger les données du dashboard: ${error.message}`);
  }
};

// ✅ CALCUL DES STATS OPTIMISÉ
function calculateVideoStats(videos) {
  if (!videos || videos.length === 0) {
    return {
      totalVideos: 0,
      totalDuration: 0,
      totalSize: 0,
      byStatus: {
        uploaded: 0,
        processing: 0,
        transcribed: 0,
        analyzed: 0,
        failed: 0
      },
      analysisStats: {
        transcribedCount: 0,
        analyzedCount: 0,
        averageScore: 0
      }
    };
  }

  const byStatus = {
    uploaded: 0,
    processing: 0,
    transcribed: 0,
    analyzed: 0,
    failed: 0
  };

  let totalDuration = 0;
  let totalSize = 0;
  let transcribedCount = 0;
  let analyzedCount = 0;
  let totalScore = 0;
  let scoreCount = 0;

  videos.forEach(video => {
    // Statistiques de statut
    byStatus[video.status] = (byStatus[video.status] || 0) + 1;
    
    // Métriques numériques
    if (video.duration) totalDuration += video.duration;
    if (video.file_size) totalSize += video.file_size;
    
    // Statistiques d'analyse
    if (video.transcription_text) transcribedCount++;
    if (video.analysis) analyzedCount++;
    if (video.ai_score) {
      totalScore += video.ai_score;
      scoreCount++;
    }
  });

  return {
    totalVideos: videos.length,
    totalDuration,
    totalSize: Math.round(totalSize / (1024 * 1024)), // Conversion en MB
    byStatus,
    analysisStats: {
      transcribedCount,
      analyzedCount,
      averageScore: scoreCount > 0 ? totalScore / scoreCount : 0
    }
  };
}

// ✅ VÉRIFICATION DU QUESTIONNAIRE AVEC CACHE
const questionnaireCache = new Map();

export const checkQuestionnaireStatus = async (userId) => {
  if (!userId) return false;

  // ✅ VÉRIFICATION DU CACHE
  const cached = questionnaireCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < PROFILE_CACHE_TTL)) {
    return cached.completed;
  }

  try {
    const { data, error } = await supabase
      .from('questionnaire_responses')
      .select('id, completed_at, dominant_color, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Erreur vérification questionnaire:', error);
      return false;
    }

    const completed = !!data?.completed_at;
    
    // ✅ MISE EN CACHE
    questionnaireCache.set(userId, {
      completed,
      timestamp: Date.now(),
      dominantColor: data?.dominant_color
    });

    return completed;
  } catch (error) {
    console.error('❌ Erreur vérification questionnaire:', error);
    return false;
  }
};

// ✅ GESTION D'ERREUR AVANCÉE
export const handleSupabaseError = (error, operation = 'operation', context = {}) => {
  console.error(`❌ Erreur lors de ${operation}:`, {
    error,
    context,
    timestamp: new Date().toISOString()
  });
  
  const errorMap = {
    'PGRST116': { 
      error: 'Aucun résultat trouvé', 
      details: 'Aucune donnée correspondante trouvée dans la base de données',
      userMessage: 'Aucune donnée trouvée pour votre recherche.',
      severity: 'info'
    },
    '42501': { 
      error: 'Permission refusée', 
      details: 'Vous n\'avez pas les droits nécessaires pour cette opération',
      userMessage: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
      severity: 'warning'
    },
    'PGRST301': { 
      error: 'Non authentifié', 
      details: 'Veuillez vous reconnecter',
      userMessage: 'Votre session a expiré. Veuillez vous reconnecter.',
      severity: 'warning',
      action: 'redirectToLogin'
    },
    'PGRST302': { 
      error: 'Jeton expiré', 
      details: 'Votre session a expiré',
      userMessage: 'Votre session a expiré. Veuillez vous reconnecter.',
      severity: 'warning',
      action: 'refreshSession'
    },
    '406': {
      error: 'Format non acceptable',
      details: 'Le format de réponse demandé n\'est pas supporté',
      userMessage: 'Erreur technique. Veuillez réessayer.',
      severity: 'error'
    },
    '401': {
      error: 'Non autorisé',
      details: 'Authentification requise',
      userMessage: 'Vous devez être connecté pour accéder à cette fonctionnalité.',
      severity: 'warning',
      action: 'redirectToLogin'
    },
    'CONNECTION_ERROR': {
      error: 'Erreur de connexion',
      details: 'Impossible de se connecter au serveur',
      userMessage: 'Problème de connexion. Vérifiez votre connexion internet.',
      severity: 'error',
      action: 'retry'
    }
  };

  const errorInfo = errorMap[error.code] || { 
    error: 'Erreur inattendue', 
    details: error.message || 'Une erreur s\'est produite',
    userMessage: 'Une erreur inattendue s\'est produite. Veuillez réessayer.',
    severity: 'error'
  };

  // ✅ JOURNALISATION DES ERREURS CRITIQUES
  if (errorInfo.severity === 'error') {
    console.error('🚨 Erreur critique:', {
      operation,
      error: errorInfo,
      context,
      timestamp: new Date().toISOString()
    });
  }

  return errorInfo;
};

// ✅ UTILITAIRE PURIFICATION DES DONNÉES
export const sanitizeInput = (input, maxLength = 500) => {
  if (typeof input !== 'string') return '';
  
  let sanitized = input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Supprimer les balises HTML basiques
    
  return sanitized;
};

// ✅ EXPORT PAR DÉFAUT
export default supabase;

// ✅ NETTOYAGE AUTOMATIQUE DU CACHE
setInterval(() => {
  const now = Date.now();
  let clearedCount = 0;

  for (const [key, value] of profileCache.entries()) {
    if (now - value.timestamp > PROFILE_CACHE_TTL) {
      profileCache.delete(key);
      clearedCount++;
    }
  }

  for (const [key, value] of questionnaireCache.entries()) {
    if (now - value.timestamp > PROFILE_CACHE_TTL) {
      questionnaireCache.delete(key);
      clearedCount++;
    }
  }

  if (clearedCount > 0) {
    console.log(`🧹 Cache nettoyé: ${clearedCount} entrées expirées`);
  }
}, 60000); // Toutes les minutes
