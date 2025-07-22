import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { VIDEO_STATUS } from '../constants/videoStatus.js';

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
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
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
 * Obtient la transcription d'une vidéo via Whisper - VERSION CORRIGÉE
 * @param {string} filePath - Chemin du fichier dans le bucket
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export const getTranscription = async (filePath) => {
  try {
    // Vérifier la disponibilité d'OpenAI avant de continuer
    const availability = await checkOpenAIAvailability();
    if (!availability.available) {
      return { 
        success: false, 
        error: availability.error || "Service d'analyse IA temporairement indisponible" 
      };
    }

    // Télécharger le fichier depuis Supabase Storage avec retry
    const { data: fileBlob, error: downloadError } = await retryOperation(async () => {
      return await supabase.storage
        .from('videos')
        .download(filePath);
    });

    if (downloadError) {
      throw new Error(`Erreur de téléchargement: ${downloadError.message}`);
    }

    if (!fileBlob || fileBlob.size === 0) {
      throw new Error("Fichier vidéo vide ou non trouvé");
    }

    // Créer un objet File pour l'API OpenAI
    const file = new File([fileBlob], 'audio.mp4', { type: fileBlob.type });

    // Appeler l'API Whisper avec retry
    const transcription = await retryOperation(async () => {
      return await openaiClient.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        response_format: "text",
        language: "fr" // Forcer le français pour de meilleurs résultats
      });
    });

    if (!transcription || typeof transcription !== 'string') {
      throw new Error("Transcription invalide reçue de l'API");
    }

    return { success: true, data: transcription };

  } catch (error) {
    console.error('Erreur de transcription:', error);
    
    // Messages d'erreur plus spécifiques pour l'utilisateur
    let userMessage = "Service d'analyse IA temporairement indisponible";
    
    if (error.message.includes('quota') || error.message.includes('billing')) {
      userMessage = "Quota API dépassé. Veuillez réessayer plus tard.";
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      userMessage = "Problème de connexion. Veuillez vérifier votre connexion internet.";
    } else if (error.message.includes('file') || error.message.includes('format')) {
      userMessage = "Format de fichier non supporté pour la transcription.";
    } else if (error.message.includes('size')) {
      userMessage = "Fichier trop volumineux pour la transcription.";
    }
    
    return { success: false, error: userMessage };
  }
};

/**
 * Analyse un pitch avec GPT-4 - VERSION CORRIGÉE
 * @param {string} transcription 
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const analyzePitch = async (transcription) => {
  try {
    // Vérifier la disponibilité d'OpenAI
    const availability = await checkOpenAIAvailability();
    if (!availability.available) {
      return { 
        success: false, 
        error: availability.error || "Service d'analyse IA temporairement indisponible" 
      };
    }

    if (!transcription || transcription.trim().length === 0) {
      throw new Error("Transcription vide - impossible d'analyser");
    }

    const chatCompletion = await retryOperation(async () => {
      return await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: `Analyse la transcription suivante d'un pitch vidéo et fournis des suggestions structurées en JSON:
          
          Format de réponse attendu:
          {
            "suggestions": [
              {
                "type": "structure|contenu|presentation|technique",
                "titre": "Titre court de la suggestion",
                "description": "Description détaillée",
                "priorite": "haute|moyenne|basse"
              }
            ],
            "sentiment": "positif|neutre|negatif",
            "score_confiance": 85,
            "mots_cles": ["mot1", "mot2", "mot3"],
            "resume": "Résumé en une phrase du pitch",
            "points_forts": ["Point fort 1", "Point fort 2"],
            "points_amelioration": ["Amélioration 1", "Amélioration 2"]
          }
          
          Transcription: ${transcription}`
        }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500
      });
    });

    if (!chatCompletion?.choices?.[0]?.message?.content) {
      throw new Error("Réponse invalide de l'API d'analyse");
    }

    const result = JSON.parse(chatCompletion.choices[0].message.content);
    
    // Validation du format de réponse
    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      throw new Error("Format de réponse d'analyse invalide");
    }

    return { success: true, data: result };

  } catch (error) {
    console.error('Erreur dans l\'analyse du pitch:', error);
    
    // Messages d'erreur spécifiques
    let userMessage = "Service d'analyse IA temporairement indisponible";
    
    if (error.message.includes('quota') || error.message.includes('billing')) {
      userMessage = "Quota API dépassé. Veuillez réessayer plus tard.";
    } else if (error.message.includes('JSON') || error.message.includes('parse')) {
      userMessage = "Erreur de traitement de l'analyse. Veuillez réessayer.";
    } else if (error.message.includes('vide')) {
      userMessage = "Transcription vide - impossible d'analyser le contenu.";
    }
    
    return { success: false, error: userMessage };
  }
};

// Mode dégradé : analyse basique sans IA
export const getBasicAnalysis = (transcription) => {
  if (!transcription || transcription.trim().length === 0) {
    return {
      success: false,
      error: "Aucun contenu à analyser"
    };
  }

  const words = transcription.split(/\s+/).filter(word => word.length > 0);
  const sentences = transcription.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Analyse basique
  const wordCount = words.length;
  const avgWordsPerSentence = sentences.length > 0 ? Math.round(wordCount / sentences.length) : 0;
  const estimatedDuration = Math.round(wordCount / 150); // ~150 mots par minute
  
  // Mots-clés simples (mots de plus de 5 caractères, fréquents)
  const longWords = words.filter(word => word.length > 5);
  const wordFreq = {};
  longWords.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
  });
  
  const keywords = Object.entries(wordFreq)
    .filter(([word, freq]) => freq > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return {
    success: true,
    data: {
      suggestions: [
        {
          type: "analyse",
          titre: "Analyse basique disponible",
          description: "L'analyse IA complète n'est pas disponible. Voici une analyse basique de votre pitch.",
          priorite: "moyenne"
        }
      ],
      sentiment: "neutre",
      score_confiance: 50,
      mots_cles: keywords,
      resume: `Pitch de ${wordCount} mots en ${sentences.length} phrases`,
      statistiques: {
        nombre_mots: wordCount,
        nombre_phrases: sentences.length,
        mots_par_phrase: avgWordsPerSentence,
        duree_estimee: `${estimatedDuration} minute${estimatedDuration > 1 ? 's' : ''}`
      },
      points_forts: ["Contenu transcrit avec succès"],
      points_amelioration: ["Analyse IA complète recommandée"]
    }
  };
};

// Test de connexion au démarrage avec gestion d'erreur améliorée
const testConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Erreur de test de connexion Supabase:', error.message);
    } else {
      console.log('Connexion Supabase OK', data.session ? 'Session active' : 'Pas de session');
    }
    
    // Test OpenAI
    if (openaiAvailable) {
      const availability = await checkOpenAIAvailability();
      console.log('OpenAI disponible:', availability.available);
      if (!availability.available) {
        console.warn('OpenAI indisponible:', availability.error);
      }
    }
  } catch (error) {
    console.error('Erreur de test de connexion:', error.message);
  }
};

// Exécuter le test de connexion
testConnection();

export default supabase;

// Fonctions de videoService.js améliorées (reste du code identique...)

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
    "video/quicktime",
    "video/mov",
    "video/avi"
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
 * Upload une vidéo et ses métadonnées - VERSION CORRIGÉE
 * @param {File} file - Le fichier vidéo
 * @param {Object} metadata - Les métadonnées de la vidéo
 * @param {Function} onProgress - Callback pour suivre la progression
 * @returns {Promise<Object>} Résultat de l'upload
 */
export async function uploadVideo(file, metadata = {}, onProgress = () => {}) {
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
    
    // 5. Upload du fichier vidéo avec gestion d'erreur améliorée
    onProgress({ phase: "video", progress: 0 })
    
    // Vérifier d'abord si le bucket existe
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    if (bucketsError) {
      throw new Error(`Erreur d'accès au storage: ${bucketsError.message}`)
    }
    
    const videoBucket = buckets.find(bucket => bucket.name === 'videos')
    if (!videoBucket) {
      throw new Error("Le bucket 'videos' n'existe pas. Vérifiez la configuration Supabase Storage.")
    }
    
    const { data: storageData, error: storageError } = await supabase.storage
      .from("videos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false
      })
    
    if (storageError) {
      console.error("Erreur d'upload storage:", storageError)
      
      // Messages d'erreur plus spécifiques
      let errorMessage = `Erreur lors de l'upload: ${storageError.message}`
      
      if (storageError.message.includes('not found')) {
        errorMessage = "Bucket de stockage non trouvé. Vérifiez la configuration Supabase."
      } else if (storageError.message.includes('permission')) {
        errorMessage = "Permissions insuffisantes pour uploader. Vérifiez les politiques RLS."
      } else if (storageError.message.includes('size')) {
        errorMessage = "Fichier trop volumineux pour le stockage."
      }
      
      return { success: false, error: errorMessage }
    }
    
    // 6. Récupérer l'URL publique du fichier
    const { data: { publicUrl } } = supabase.storage
      .from("videos")
      .getPublicUrl(filePath)
    
    onProgress({ phase: "database", progress: 0 })
    
    // 7. Créer l'entrée dans la table videos avec gestion d'erreur
    try {
      const { data: videoData, error: videoError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          title: metadata.title || file.name || "Sans titre",
          description: metadata.description || "",
          file_path: filePath,
          thumbnail_url: thumbnailUrl,
          status: VIDEO_STATUS.DRAFT,
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
        
        let errorMessage = `Erreur lors de l'enregistrement: ${videoError.message}`
        
        if (videoError.message.includes('not found')) {
          errorMessage = "Table 'videos' non trouvée. Vérifiez les migrations de base de données."
        } else if (videoError.message.includes('permission')) {
          errorMessage = "Permissions insuffisantes pour enregistrer en base de données."
        }
        
        return { success: false, error: errorMessage }
      }
      
      onProgress({ phase: "database", progress: 100 })
      onProgress({ phase: "complete", progress: 100 })
      
      return { 
        success: true, 
        video: videoData,
        url: publicUrl,
        thumbnailUrl
      }
      
    } catch (dbError) {
      console.error("Exception lors de l'insertion en base:", dbError)
      
      // Nettoyer les fichiers uploadés
      await supabase.storage.from("videos").remove([filePath])
      if (thumbnailPath) {
        await supabase.storage.from("videos").remove([thumbnailPath])
      }
      
      return { 
        success: false, 
        error: "Erreur de base de données. Vérifiez la configuration Supabase." 
      }
    }
    
  } catch (err) {
    console.error("Exception lors de l'upload:", err)
    return { 
      success: false, 
      error: `Une erreur inattendue s'est produite: ${err.message}` 
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
 * Fonction de débogage pour les problèmes d'upload - AMÉLIORÉE
 * @returns {Promise<Object>} Résultats du débogage
 */
export async function debugStoragePermissions() {
  const results = {
    auth: null,
    buckets: null,
    policies: null,
    testUpload: null,
    environment: null,
    openai: null
  }
  
  try {
    // 0. Vérifier les variables d'environnement
    results.environment = {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseAnonKey,
      openaiKey: !!openaiApiKey,
      urls: {
        supabase: supabaseUrl,
        // Ne pas exposer les clés complètes
        supabaseKeyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : null
      }
    }
    
    // Test OpenAI
    results.openai = {
      configured: openaiAvailable,
      keyValid: validateOpenAIKey(openaiApiKey),
      available: false
    }
    
    if (openaiAvailable) {
      const availability = await checkOpenAIAvailability();
      results.openai.available = availability.available;
      results.openai.error = availability.error;
    }
    
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
      hasVideosBucket: buckets ? buckets.some(b => b.name === 'videos') : false,
      error: bucketsError ? bucketsError.message : null
    }
    
    // 3. Tester un petit upload (1x1 pixel transparent PNG)
    const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    const base64 = tinyPng.split(",")[1]
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    
    const byteArray = new Uint8Array(byteNumbers)
    const testFile = new File([byteArray], "test.png", { type: "image/png" })
    
    const testPath = `test/${user.id}-${Date.now()}.png`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("videos")
      .upload(testPath, testFile, {
        cacheControl: "0",
        upsert: false
      })
    
    results.testUpload = {
      success: !!uploadData && !uploadError,
      path: uploadData?.path || null,
      error: uploadError ? uploadError.message : null
    }
    
    // Nettoyer le fichier de test
    if (uploadData?.path) {
      await supabase.storage.from("videos").remove([testPath])
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

