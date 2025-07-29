// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { VIDEO_STATUS } from '../constants/videoStatus.js';

// Configuration avec gestion d'erreurs améliorée et fallbacks robustes
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nyxtckjfaajhacboxojd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHRja2pmYWFqaGFjYm94b2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMzY5OTIsImV4cCI6MjA2MTYxMjk5Mn0.9zpLjXat7L6TvfKQB93ef66bnQZgueAreyGZ8fjlPLA';
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

console.log('Configuration Supabase (version corrigée):', {
  url: supabaseUrl ? 'Définie' : 'Manquante',
  key: supabaseAnonKey ? 'Définie' : 'Manquante',
  openai: openaiApiKey ? 'Définie' : 'Manquante'
});

// Initialisation du client Supabase avec configuration robuste et gestion d'erreurs
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'smoovebox-auth-token',
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'smoovebox-v2-fixed'
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

// Validation et initialisation du client OpenAI avec gestion d'erreur améliorée
let openaiClient = null;
let openaiAvailable = false;

const validateOpenAIKey = (key) => {
  if (!key) return false;
  // Vérifier le format de la clé OpenAI
  if (!key.startsWith('sk-')) return false;
  // Vérifier la longueur minimale
  if (key.length < 50) return false;
  return true;
};

if (openaiApiKey && validateOpenAIKey(openaiApiKey)) {
  try {
    openaiClient = new OpenAI({ 
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: true,
      timeout: 30000,
      maxRetries: 3
    });
    openaiAvailable = true;
    console.log('Client OpenAI initialisé avec succès (version corrigée)');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation d\'OpenAI:', error);
    openaiAvailable = false;
  }
} else {
  console.warn("Clé OpenAI manquante ou invalide - Les fonctionnalités IA seront désactivées");
  openaiAvailable = false;
}

export const openai = openaiClient;

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
 * Vérifie la disponibilité du service OpenAI avec retry
 * @returns {Promise<{available: boolean, error?: string}>}
 */
export const checkOpenAIAvailability = async () => {
  if (!openaiAvailable || !openaiClient) {
    return { 
      available: false, 
      error: "Service OpenAI non configuré ou clé API invalide" 
    };
  }

  try {
    // Test simple avec l'API OpenAI avec retry
    await retryOperation(async () => {
      const response = await openaiClient.models.list();
      if (!response || !response.data) {
        throw new Error("Réponse invalide de l'API OpenAI");
      }
    }, 2, 500);
    
    return { available: true };
  } catch (error) {
    console.error('Test de disponibilité OpenAI échoué:', error);
    return { 
      available: false, 
      error: `Service OpenAI indisponible: ${error.message}` 
    };
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
 * Fonction utilitaire pour récupérer les données du dashboard avec gestion d'erreurs
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
export const fetchDashboardData = async (userId) => {
  try {
    console.log('Récupération des données dashboard pour userId:', userId);
    
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
    console.error('Erreur lors de la récupération des données dashboard:', error);
    throw new Error(`Erreur dashboard: ${error.message}`);
  }
};

export default supabase;

