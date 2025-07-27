// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { VIDEO_STATUS } from '../constants/videoStatus.js';

// Configuration avec gestion d'erreurs améliorée
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nyxtckjfaajhacboxojd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHRja2pmYWFqaGFjYm94b2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMzY5OTIsImV4cCI6MjA2MTYxMjk5Mn0.9zpLjXat7L6TvfKQB93ef66bnQZgueAreyGZ8fjlPLA';
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

console.log('Configuration Supabase:', {
  url: supabaseUrl ? 'Définie' : 'Manquante',
  key: supabaseAnonKey ? 'Définie' : 'Manquante',
  openai: openaiApiKey ? 'Définie' : 'Manquante'
});

// Initialisation du client Supabase avec configuration robuste
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'smoovebox-auth-token'
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
      dangerouslyAllowBrowser: true
    });
    openaiAvailable = true;
    console.log('Client OpenAI initialisé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation d\'OpenAI:', error);
    openaiAvailable = false;
  }
} else {
  console.warn("Clé OpenAI manquante ou invalide - Les fonctionnalités IA seront désactivées");
  openaiAvailable = false;
}

export const openai = openaiClient;

// Fonction utilitaire pour les tentatives avec retry
export const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Tentative ${attempt}/${maxRetries} échouée:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Attendre avant la prochaine tentative
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
};

/**
 * Vérifie la disponibilité du service OpenAI
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
    // Test simple avec l'API OpenAI
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
 * Récupère l'ID du profil associé à un user_id (auth)
 * @param {string} userId 
 * @returns {Promise<string>} profile_id
 */
export const getProfileId = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

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
        
        const { data: newProfile, error: createError } = await supabase
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

export default supabase;
