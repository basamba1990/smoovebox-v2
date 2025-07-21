import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Vérification des variables d'environnement avec messages d'erreur détaillés
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

console.log('Configuration Supabase:', {
  url: supabaseUrl ? 'Définie' : 'Manquante',
  key: supabaseAnonKey ? 'Définie' : 'Manquante',
  openai: openaiApiKey ? 'Définie' : 'Manquante'
});

if (!supabaseUrl) {
  throw new Error("Variable d'environnement VITE_SUPABASE_URL manquante");
}

if (!supabaseAnonKey) {
  throw new Error("Variable d'environnement VITE_SUPABASE_ANON_KEY manquante");
}

// Initialisation du client Supabase avec configuration robuste
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'smoovebox-v2'
    }
  }
});

// Initialisation du client OpenAI
if (!openaiApiKey) {
  console.warn("Clé OpenAI manquante - Les fonctionnalités IA seront désactivées");
}
export const openai = openaiApiKey ? new OpenAI({ 
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true // Nécessaire pour les applications frontend
}) : null;

/**
 * Téléverse une vidéo dans le stockage Supabase
 * @param {File} file - Fichier vidéo
 * @param {string} userId - ID de l'utilisateur (doit être un UUID string)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const uploadVideo = async (file, userId) => {
  try {
    if (!file || !userId) {
      throw new Error("Paramètres manquants: file et userId sont requis");
    }

    // Générer un nom de fichier unique: userId/uuid-filename
    const fileName = `${userId}/${crypto.randomUUID()}-${file.name}`;

    // Téléverser le fichier
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
        cacheControl: '3600'
      });

    if (error) {
      throw error;
    }

    // Essayer d'enregistrer les métadonnées dans la table 'videos'
    try {
      const profileId = await getProfileId(userId);
      
      const videoData = {
        profile_id: profileId,
        title: file.name,
        file_path: data.path,
        file_name: file.name,
        file_size: file.size,
        status: 'uploaded'
      };

      const { data: dbData, error: dbError } = await supabase
        .from('videos')
        .insert(videoData)
        .select()
        .single();

      if (dbError) {
        console.warn('Impossible d\'enregistrer les métadonnées vidéo:', dbError.message);
        // Retourner quand même le succès du téléversement
        return { 
          success: true, 
          data: { path: data.path, warning: 'Métadonnées non sauvegardées' }
        };
      }

      return { success: true, data: dbData };

    } catch (dbError) {
      console.warn('Erreur base de données lors de l\'enregistrement:', dbError.message);
      return { 
        success: true, 
        data: { path: data.path, warning: 'Métadonnées non sauvegardées' }
      };
    }

  } catch (error) {
    console.error('Erreur lors du téléversement de la vidéo:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Récupère l'ID du profil associé à un user_id (auth)
 * @param {string} userId 
 * @returns {Promise<string>} profile_id
 */
const getProfileId = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error("Table profiles non trouvée");
      }
      throw error;
    }
    
    if (!data) {
      throw new Error("Profil non trouvé pour l'utilisateur");
    }
    
    return data.id;
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error.message);
    throw error;
  }
};

/**
 * Obtient la transcription d'une vidéo via Whisper
 * @param {string} filePath - Chemin du fichier dans le bucket
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export const getTranscription = async (filePath) => {
  try {
    if (!openai) {
      throw new Error("Service OpenAI non disponible - Vérifiez VITE_OPENAI_API_KEY");
    }

    // Télécharger le fichier depuis Supabase Storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('videos')
      .download(filePath);

    if (downloadError) {
      throw downloadError;
    }

    // Créer un objet File pour l'API OpenAI
    const file = new File([fileBlob], 'audio.mp4', { type: fileBlob.type });

    // Appeler l'API Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "text"
    });

    return { success: true, data: transcription };

  } catch (error) {
    console.error('Erreur de transcription:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Analyse un pitch avec GPT-4
 * @param {string} transcription 
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const analyzePitch = async (transcription) => {
  try {
    if (!openai) {
      throw new Error("Service OpenAI non disponible - Vérifiez VITE_OPENAI_API_KEY");
    }

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: `Analyse la transcription suivante d'un pitch vidéo et fournis des suggestions structurées en JSON:
        - suggestions (liste d'objets avec: type, titre, description, priorité)
        - sentiment (positif, neutre, négatif)
        - score_confiance (0-100)
        - mots_cles (liste de chaînes)
        
        Transcription: ${transcription}`
      }],
      response_format: { type: "json_object" }
    });

    const result = chatCompletion.choices[0].message.content;
    return { success: true, data: JSON.parse(result) };

  } catch (error) {
    console.error('Erreur dans l\'analyse du pitch:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Récupère les vidéos d'un utilisateur
 * @param {string} userId 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getUserVideos = async (userId) => {
  try {
    const profileId = await getProfileId(userId);
    
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };

  } catch (error) {
    console.error('Erreur de récupération des vidéos:', error.message);
    return { success: false, error: error.message };
  }
};

// Test de connexion au démarrage
const testConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Erreur de test de connexion Supabase:', error.message);
    } else {
      console.log('Connexion Supabase OK');
    }
  } catch (error) {
    console.error('Erreur de test de connexion:', error.message);
  }
};

// Exécuter le test de connexion
testConnection();

export default supabase;

