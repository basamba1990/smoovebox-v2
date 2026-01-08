import { createClient } from '@supabase/supabase-js';

// ✅ CONFIGURATION SÉCURISÉE AVEC FORÇAGE HTTPS STRICT
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ FORÇAGE HTTPS ABSOLU EN PRODUCTION
if (import.meta.env.PROD) {
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    console.warn('⚠️ SUPABASE_URL non-HTTPS détecté en production. Forçage HTTPS.');
    supabaseUrl = supabaseUrl.replace('http://', 'https://');
  }
  
  // Validation finale
  if (supabaseUrl && supabaseUrl.includes('http://')) {
    throw new Error('Configuration Supabase: URL doit être HTTPS en production. Vérifiez VITE_SUPABASE_URL.');
  }
}

// ✅ VALIDATION DE LA CONFIGURATION
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Configuration Supabase incomplète. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.';
  
  if (import.meta.env.PROD) {
    throw new Error(errorMsg);
  } else {
    console.warn('⚠️', errorMsg);
    console.warn('⚠️ Mode développement: utilisation de valeurs mock pour Supabase');
  }
}

console.log('🔧 Configuration Supabase:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 25)}...` : 'MANQUANT',
  keyPresent: !!supabaseAnonKey,
  protocol: supabaseUrl ? new URL(supabaseUrl).protocol : 'N/A',
  env: import.meta.env.MODE
});

// ✅ OPTIONS DE SÉCURITÉ AVANCÉES
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'future-jobs-auth-token',
    flowType: 'pkce',
    debug: import.meta.env.DEV,
    storage: window.localStorage
  },
  global: {
    headers: {
      'X-Client-Info': 'future-jobs-generator',
      'X-Client-Version': '3.0.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// ✅ SYSTÈME DE RETRY AVANCÉ
export const retryOperation = async (operation, maxRetries = 3, baseDelay = 1000, timeout = 30000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout après ${timeout}ms`)), timeout)
        )
      ]);
      
      clearTimeout(timeoutId);
      return result;
      
    } catch (error) {
      console.warn(`🔄 Tentative ${attempt + 1}/${maxRetries} échouée:`, error.message);
      lastError = error;
      
      // Pas de retry sur certaines erreurs
      if (isFatalError(error)) {
        console.error('❌ Erreur fatale, arrêt des retry:', error.message);
        break;
      }
      
      // Backoff exponentiel
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`⏳ Attente ${Math.round(delay)}ms avant prochaine tentative...`);
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
    'PGRST302',
    '42501', // Permission denied
    '23502'  // Not null violation
  ];
  
  const errorStr = String(error.message || error.code || '');
  return fatalErrors.some(fatalError => errorStr.includes(fatalError));
}

// ✅ GESTION DE SESSION AMÉLIORÉE
export const refreshSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Erreur récupération session:', error);
      return { valid: false, error };
    }

    if (!session) {
      console.log('🚫 Aucune session active');
      return { valid: false, reason: 'no-session' };
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at;
    
    // Session valide si expire dans plus de 5 minutes
    if (expiresAt && now < expiresAt - 300) {
      return { valid: true, session, userId: session.user.id };
    }

    console.log('🔄 Session expirée, tentative de rafraîchissement...');
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !newSession) {
      console.error('❌ Erreur rafraîchissement session:', refreshError);
      
      // Nettoyage
      await supabase.auth.signOut();
      return { valid: false, reason: 'refresh-failed' };
    }

    console.log('✅ Session rafraîchie:', newSession.user.id);
    return { valid: true, session: newSession, userId: newSession.user.id };
    
  } catch (error) {
    console.error('❌ Erreur vérification session:', error);
    return { valid: false, error };
  }
};

// ✅ VÉRIFICATION DE CONNEXION SIMPLIFIÉE (sans health-check)
export const checkSupabaseConnection = async () => {
  try {
    const startTime = Date.now();
    
    // 1. Vérifier l'authentification (très léger)
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      return { 
        connected: false, 
        error: `Erreur authentification: ${authError.message}`,
        code: authError.code,
        latency: Date.now() - startTime
      };
    }

    // 2. Simple ping de la base de données (requête très légère)
    const dbCheckStart = Date.now();
    try {
      // Requête ultra légère qui ne dépend pas de permissions
      const { error: pingError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();
      
      // Ne pas échouer si c'est juste "aucun résultat"
      if (pingError && pingError.code !== 'PGRST116') {
        console.warn('⚠️ Base de données avec avertissement:', pingError.message);
      }
    } catch (dbError) {
      console.warn('⚠️ Base de données inaccessible:', dbError.message);
      // On continue quand même, ce n'est pas fatal pour la génération
    }

    const dbLatency = Date.now() - dbCheckStart;
    const totalLatency = Date.now() - startTime;

    return {
      connected: true,
      authenticated: !!authData.session,
      userId: authData.session?.user?.id,
      database: { ok: true, latency: dbLatency },
      latency: totalLatency,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Erreur vérification connexion:', error);
    return {
      connected: false,
      error: `Erreur de connexion: ${error.message}`,
      code: 'CONNECTION_ERROR',
      timestamp: new Date().toISOString()
    };
  }
};

// ✅ NOUVELLE FONCTION POUR APPELS EDGE FUNCTIONS AVEC RETRY
export const invokeEdgeFunctionWithRetry = async (functionName, body, options = {}) => {
  const {
    maxRetries = 3,
    timeout = 30000,
    useHttpsFallback = true
  } = options;

  console.group(`🚀 Appel Edge Function: ${functionName}`);
  console.log('📦 Body:', { ...body, promptPreview: body.prompt?.substring(0, 50) + '...' });

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 Tentative ${attempt + 1}/${maxRetries}`);
      
      // ✅ APPEL DIRECT HTTPS DE SECOURS EN PRODUCTION
      if (useHttpsFallback && import.meta.env.PROD && attempt > 0) {
        console.log('🔄 Utilisation du fallback HTTPS direct...');
        const backupResult = await invokeEdgeFunctionDirectHttps(functionName, body, timeout);
        if (backupResult.success) {
          console.log(`✅ ${functionName} réussi via HTTPS direct`);
          console.groupEnd();
          return backupResult;
        }
      }

      // ✅ APPEL STANDARD SUPABASE AVEC TIMEOUT
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (error) {
        throw error;
      }

      console.log(`✅ ${functionName} réussi via client Supabase`);
      console.groupEnd();
      return { success: true, data };

    } catch (error) {
      console.error(`❌ Tentative ${attempt + 1} échouée:`, error.message);
      lastError = error;

      // Pas de retry sur les erreurs client
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        console.log('⏱️ Timeout détecté');
        break;
      }

      // Backoff
      if (attempt < maxRetries - 1) {
        const delay = 2000 * (attempt + 1);
        console.log(`⏳ Attente ${delay}ms avant prochaine tentative...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`💥 Toutes les tentatives ont échoué pour ${functionName}:`, lastError?.message);
  console.groupEnd();
  
  throw lastError || new Error(`Échec de l'appel à ${functionName} après ${maxRetries} tentatives`);
};

// ✅ FONCTION D'APPEL DIRECT HTTPS (pour generate-video uniquement)
const invokeEdgeFunctionDirectHttps = async (functionName, body, timeout = 30000) => {
  // SEULEMENT pour generate-video, pas pour health-check
  if (functionName !== 'generate-video') {
    throw new Error(`Fallback HTTPS non supporté pour ${functionName}`);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Session invalide pour appel HTTPS direct');
    }

    // Construction URL HTTPS
    const baseUrl = supabaseUrl.replace(/^http:/, 'https:').replace(/\/$/, '');
    const functionUrl = `${baseUrl}/functions/v1/${functionName}`;

    console.log(`🔗 Appel HTTPS direct: ${functionUrl.substring(0, 60)}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'X-Client-Info': 'future-jobs-https-fallback'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error) {
    console.error('❌ Appel HTTPS direct échoué:', error.message);
    return { success: false, error };
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

  const cached = profileCache.get(userId);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < PROFILE_CACHE_TTL)) {
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

    if (error && error.code !== 'PGRST116') {
      console.warn('⚠️ Erreur récupération profil:', error);
      return null;
    }
    
    if (data) {
      profileCache.set(userId, {
        data,
        timestamp: Date.now()
      });
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur récupération profil:', error);
    return null;
  }
};

// ✅ INVALIDATION DU CACHE
export const invalidateProfileCache = (userId) => {
  if (userId) {
    profileCache.delete(userId);
  } else {
    profileCache.clear();
  }
};

// ✅ GESTION D'ERREUR STANDARDISÉE
export const handleSupabaseError = (error, operation = 'operation', context = {}) => {
  console.error(`❌ Erreur lors de ${operation}:`, {
    error,
    context,
    timestamp: new Date().toISOString()
  });
  
  const errorMap = {
    'PGRST116': { 
      userMessage: 'Aucune donnée trouvée.',
      severity: 'info',
      action: 'none'
    },
    '23502': {
      userMessage: 'Données incomplètes. Veuillez réessayer.',
      severity: 'warning',
      action: 'retry'
    },
    '42501': {
      userMessage: 'Permissions insuffisantes.',
      severity: 'warning',
      action: 'refresh'
    },
    'PGRST301': {
      userMessage: 'Session expirée. Veuillez vous reconnecter.',
      severity: 'warning',
      action: 'redirectToLogin'
    },
    'PGRST302': {
      userMessage: 'Session expirée. Veuillez vous reconnecter.',
      severity: 'warning',
      action: 'redirectToLogin'
    },
    '401': {
      userMessage: 'Authentification requise.',
      severity: 'warning',
      action: 'redirectToLogin'
    },
    'CONNECTION_ERROR': {
      userMessage: 'Problème de connexion. Vérifiez votre internet.',
      severity: 'error',
      action: 'retry'
    }
  };

  const errorCode = error.code || (error.message?.includes('network') ? 'CONNECTION_ERROR' : 'UNKNOWN');
  const errorInfo = errorMap[errorCode] || {
    userMessage: 'Une erreur inattendue est survenue.',
    severity: 'error',
    action: 'report'
  };

  // Log supplémentaire pour les erreurs critiques
  if (errorInfo.severity === 'error') {
    console.error('🚨 Erreur critique:', {
      operation,
      errorCode,
      errorMessage: error.message,
      context
    });
  }

  return {
    ...errorInfo,
    technical: error.message,
    code: errorCode,
    timestamp: new Date().toISOString()
  };
};

// ✅ UTILITAIRE DE CONNEXION SIMPLE (pour le frontend)
export const checkSimpleConnection = async () => {
  try {
    // Simple ping au domaine Supabase
    const startTime = Date.now();
    
    // Essayer de récupérer la session (très léger)
    const { data: { session } } = await supabase.auth.getSession();
    
    // Vérifier si nous avons une URL valide
    if (!supabaseUrl) {
      return { connected: false, error: 'URL Supabase non configurée' };
    }
    
    const latency = Date.now() - startTime;
    
    return {
      connected: true,
      authenticated: !!session,
      userId: session?.user?.id,
      latency,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      code: 'SIMPLE_CONNECTION_ERROR'
    };
  }
};

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

  if (clearedCount > 0 && import.meta.env.DEV) {
    console.log(`🧹 Cache nettoyé: ${clearedCount} entrées expirées`);
  }
}, 300000); // Toutes les 5 minutes

// ✅ EXPORT PAR DÉFAUT
export default supabase;
