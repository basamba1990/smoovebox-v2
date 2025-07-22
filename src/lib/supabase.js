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
    detectSessionInUrl: true,
    storageKey: 'smoovebox-auth-token',
    storage: window.localStorage
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

// Initialisation du client OpenAI
if (!openaiApiKey) {
  console.warn("Clé OpenAI manquante - Les fonctionnalités IA seront désactivées");
}
export const openai = openaiApiKey ? new OpenAI({ 
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true // Nécessaire pour les applications frontend
}) : null;



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
            username: userData.user.email.split('@')[0],
            full_name: userData.user.user_metadata?.full_name || 
                      `${userData.user.user_metadata?.first_name || ''} ${userData.user.user_metadata?.last_name || ''}`.trim()
          })
          .select()
          .single();
          
        if (createError) throw createError;
        return newProfile.id;
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



// Test de connexion au démarrage
const testConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Erreur de test de connexion Supabase:', error.message);
    } else {
      console.log('Connexion Supabase OK', data.session ? 'Session active' : 'Pas de session');
    }
  } catch (error) {
    console.error('Erreur de test de connexion:', error.message);
  }
};

// Exécuter le test de connexion
testConnection();

export default supabase;




// Fonctions de videoService.js

/**
 * Vérifie si l'utilisateur est connecté
 * @returns {Promise<{user: Object|null, error: Error|null}>}
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return { user: data.user, error: null }
  } catch (error) {
    console.error("Erreur lors de la récupération de l'utilisateur:", error.message)
    return { user: null, error }
  }
}

/**
 * Vérifie si le fichier est une vidéo valide
 * @param {File} file - Le fichier à vérifier
 * @returns {Object} Résultat de la validation
 */
export function validateVideoFile(file) {
  if (!file) {
    return { valid: false, error: "Aucun fichier sélectionné" }
  }

  const ALLOWED_VIDEO_TYPES = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime"
  ]
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: `Type de fichier non supporté. Types acceptés: ${ALLOWED_VIDEO_TYPES.join(", ")}` 
    }
  }

  const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB
  if (file.size > MAX_VIDEO_SIZE) {
    return { 
      valid: false, 
      error: `La taille du fichier dépasse la limite de ${MAX_VIDEO_SIZE / (1024 * 1024)}MB` 
    }
  }

  return { valid: true, error: null }
}

/**
 * Génère une miniature à partir d'une vidéo
 * @param {File} videoFile - Le fichier vidéo
 * @returns {Promise<Blob|null>} La miniature générée ou null en cas d'erreur
 */
export function generateThumbnail(videoFile) {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video")
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      
      video.addEventListener("loadeddata", () => {
        // Prendre une capture à 1 seconde ou au milieu de la vidéo si elle est plus courte
        video.currentTime = Math.min(1, video.duration / 2)
      })
      
      video.addEventListener("seeked", () => {
        // Définir les dimensions de la miniature
        canvas.width = 640
        canvas.height = 360
        
        // Dessiner l'image vidéo sur le canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Convertir le canvas en blob
        canvas.toBlob((blob) => {
          resolve(blob)
        }, "image/jpeg", 0.7)
      })
      
      video.addEventListener("error", () => {
        console.error("Erreur lors du chargement de la vidéo pour la miniature")
        resolve(null)
      })
      
      // Définir la source de la vidéo
      video.src = URL.createObjectURL(videoFile)
    } catch (error) {
      console.error("Erreur lors de la génération de la miniature:", error)
      resolve(null)
    }
  })
}

/**
 * Upload une vidéo et ses métadonnées
 * @param {File} file - Le fichier vidéo
 * @param {Object} metadata - Les métadonnées de la vidéo
 * @param {Function} onProgress - Callback pour suivre la progression
 * @returns {Promise<Object>} Résultat de l'upload
 */
export async function uploadVideo(file, metadata, onProgress = () => {}) {
  try {
    // 1. Vérifier si l'utilisateur est connecté
    const { user, error: userError } = await getCurrentUser()
    
    if (userError || !user) {
      return { 
        success: false, 
        error: userError?.message || "Vous devez être connecté pour uploader une vidéo" 
      }
    }
    
    // 2. Valider le fichier vidéo
    const validation = validateVideoFile(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    
    // 3. Générer un nom de fichier unique
    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`
    
    // 4. Générer une miniature (optionnel)
    let thumbnailPath = null
    let thumbnailUrl = null
    
    if (metadata.generateThumbnail) {
      onProgress({ phase: "thumbnail", progress: 0 })
      const thumbnailBlob = await generateThumbnail(file)
      
      if (thumbnailBlob) {
        const thumbnailName = `${user.id}-${Date.now()}-thumb.jpg`
        const thumbPath = `${user.id}/thumbnails/${thumbnailName}`
        
        onProgress({ phase: "thumbnail", progress: 50 })
        
        const { data: thumbData, error: thumbError } = await supabase.storage
          .from("videos")
          .upload(thumbPath, thumbnailBlob, {
            contentType: "image/jpeg",
            cacheControl: "3600"
          })
        
        if (!thumbError) {
          thumbnailPath = thumbPath
          const { data } = supabase.storage
            .from("videos")
            .getPublicUrl(thumbPath)
          
          thumbnailUrl = data.publicUrl
        }
        
        onProgress({ phase: "thumbnail", progress: 100 })
      }
    }
    
    // 5. Upload du fichier vidéo
    onProgress({ phase: "video", progress: 0 })
    
    const { data: storageData, error: storageError } = await supabase.storage
      .from("videos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        onUploadProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100)
          onProgress({ phase: "video", progress: percent })
        }
      })
    
    if (storageError) {
      console.error("Erreur d'upload storage:", storageError)
      return { 
        success: false, 
        error: `Erreur lors de l'upload: ${storageError.message}` 
      }
    }
    
    // 6. Récupérer l'URL publique du fichier
    const { data: { publicUrl } } = supabase.storage
      .from("videos")
      .getPublicUrl(filePath)
    
    onProgress({ phase: "database", progress: 0 })
    
    // 7. Créer l'entrée dans la table videos
    const { data: videoData, error: videoError } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        title: metadata.title || "Sans titre",
        description: metadata.description || "",
        file_path: filePath,
        thumbnail_url: thumbnailUrl,
        status: "processing", // Vous pourriez avoir un processeur de vidéo en arrière-plan
        is_public: metadata.isPublic || false,
        tags: metadata.tags || []
      })
      .select()
      .single()
    
    if (videoError) {
      console.error("Erreur d'insertion dans la table videos:", videoError)
      // Essayer de supprimer le fichier uploadé si l'insertion échoue
      await supabase.storage.from("videos").remove([filePath])
      if (thumbnailPath) {
        await supabase.storage.from("videos").remove([thumbnailPath])
      }
      
      return { 
        success: false, 
        error: `Erreur lors de l'enregistrement: ${videoError.message}` 
      }
    }
    
    onProgress({ phase: "database", progress: 100 })
    onProgress({ phase: "complete", progress: 100 })
    
    return { 
      success: true, 
      video: videoData,
      url: publicUrl,
      thumbnailUrl
    }
  } catch (err) {
    console.error("Exception lors de l'upload:", err)
    return { 
      success: false, 
      error: "Une erreur inattendue s'est produite" 
    }
  }
}

/**
 * Récupère les vidéos de l'utilisateur courant
 * @returns {Promise<Object>} Les vidéos de l'utilisateur
 */
export async function getUserVideos() {
  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false })
    
    if (error) throw error
    
    return { videos: data, error: null }
  } catch (error) {
    console.error("Erreur lors de la récupération des vidéos:", error)
    return { videos: [], error }
  }
}

/**
 * Récupère une vidéo par son ID
 * @param {number} id - L'ID de la vidéo
 * @returns {Promise<Object>} La vidéo
 */
export async function getVideoById(id) {
  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .single()
    
    if (error) throw error
    
    return { video: data, error: null }
  } catch (error) {
    console.error(`Erreur lors de la récupération de la vidéo ${id}:`, error)
    return { video: null, error }
  }
}

/**
 * Fonction de débogage pour les problèmes d'upload
 * @returns {Promise<Object>} Résultats du débogage
 */
export async function debugStoragePermissions() {
  const results = {
    auth: null,
    buckets: null,
    policies: null,
    testUpload: null
  }
  
  try {
    // 1. Vérifier l'authentification
    const { user, error: authError } = await getCurrentUser()
    results.auth = {
      success: !!user && !authError,
      user: user ? { id: user.id, email: user.email } : null,
      error: authError ? authError.message : null
    }
    
    if (!user) return results
    
    // 2. Vérifier les buckets disponibles
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    results.buckets = {
      success: !!buckets && !bucketsError,
      buckets: buckets || [],
      error: bucketsError ? bucketsError.message : null
    }
    
    // 3. Tester un petit upload (1x1 pixel transparent PNG)
    const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    const base64 = tinyPng.split(",")[1]
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    
    const byteArray = new Uint8Array(byteNumbers)
    const testFile = new File([byteArray], "test.png", { type: "image/png" })
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("videos")
      .upload(`test/${user.id}-${Date.now()}.png`, testFile, {
        cacheControl: "0",
        upsert: false
      })
    
    results.testUpload = {
      success: !!uploadData && !uploadError,
      path: uploadData?.path || null,
      error: uploadError ? uploadError.message : null
    }
    
    return results
  } catch (err) {
    console.error("Erreur lors du débogage:", err)
    return {
      ...results,
      error: err.message
    }
  }
}

