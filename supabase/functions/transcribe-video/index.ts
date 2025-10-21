// supabase/functions/transcribe-video/index.js
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// ✅ NOUVEAU : Système de cache pour les transcriptions
const transcriptionCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 heure

// ✅ NOUVEAU : Rate limiting basique
const requestTracker = new Map();
const MAX_REQUESTS_PER_MINUTE = 10;

const VIDEO_STATUS = { 
  UPLOADED: 'uploaded', 
  PROCESSING: 'processing', 
  TRANSCRIBED: 'transcribed', 
  ANALYZING: 'analyzing', 
  ANALYZED: 'analyzed', 
  PUBLISHED: 'published', 
  FAILED: 'failed' 
}

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 
  'Access-Control-Allow-Methods': 'POST, OPTIONS' 
}

// ✅ SUPPORT MULTILINGUE ÉTENDU ET OPTIMISÉ
const SUPPORTED_LANGUAGES = {
  'fr': { name: 'French', whisperCode: 'french', priority: 1 },
  'ar': { name: 'Arabic', whisperCode: 'arabic', priority: 2 },
  'en': { name: 'English', whisperCode: 'english', priority: 3 },
  'es': { name: 'Spanish', whisperCode: 'spanish', priority: 4 },
  'de': { name: 'German', whisperCode: 'german', priority: 5 },
  'it': { name: 'Italian', whisperCode: 'italian', priority: 6 },
  'pt': { name: 'Portuguese', whisperCode: 'portuguese', priority: 7 },
  'ru': { name: 'Russian', whisperCode: 'russian', priority: 8 },
  'zh': { name: 'Chinese', whisperCode: 'chinese', priority: 9 },
  'ja': { name: 'Japanese', whisperCode: 'japanese', priority: 10 }
};

// ✅ NOUVEAU : Détection automatique améliorée
const LANGUAGE_DETECTION_THRESHOLD = 0.1;

Deno.serve(async (req) => {
  console.log("🎤 transcribe-video (sécurisée et optimisée) appelée");

  // ✅ GESTION CORS AMÉLIORÉE
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // ✅ VÉRIFICATION RATE LIMITING
  const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const clientRequests = requestTracker.get(clientIP) || [];
  const recentRequests = clientRequests.filter(time => now - time < 60000); // 1 minute
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    return new Response(
      JSON.stringify({ error: 'Trop de requêtes. Veuillez réessayer dans 1 minute.' }),
      { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  requestTracker.set(clientIP, [...recentRequests, now]);

  // ✅ VÉRIFICATION MÉTHODE POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  let videoId = null;

  try {
    // ✅ VALIDATION ROBUSTE DU CORPS
    let requestBody;
    let rawBody = '';
    
    try {
      rawBody = await req.text();
      
      if (!rawBody || rawBody.trim().length === 0) {
        throw new Error('Corps de requête vide');
      }
      
      if (rawBody.length > 50000) { // 50KB max pour les métadonnées
        throw new Error('Corps de requête trop volumineux');
      }
      
      requestBody = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Corps de requête JSON invalide',
          details: parseError.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { videoId: vidId, userId, videoUrl, preferredLanguage, autoDetectLanguage = true } = requestBody;
    videoId = vidId;

    // ✅ VALIDATION STRICTE DES PARAMÈTRES
    if (!videoId || !userId || !videoUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'Paramètres manquants: videoId, userId, videoUrl requis',
          received: { 
            videoId: !!videoId, 
            userId: !!userId, 
            videoUrl: !!videoUrl 
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VALIDATION DE L'URL
    try {
      const url = new URL(videoUrl);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Protocole non supporté');
      }
    } catch (urlError) {
      return new Response(
        JSON.stringify({ error: `URL vidéo invalide: ${urlError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ RÉCUPÉRATION SÉCURISÉE DES CLÉS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('❌ Configuration manquante');
      return new Response(
        JSON.stringify({ error: 'Configuration serveur incomplète' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ✅ VÉRIFICATION QUE LA VIDÉO EXISTE
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VÉRIFICATION DES PERMISSIONS
    if (video.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Accès non autorisé à cette vidéo' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("🔄 Mise à jour statut PROCESSING");
    
    // ✅ MISE À JOUR DU STATUT
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_language: preferredLanguage || 'auto'
      })
      .eq('id', videoId);

    if (updateError) {
      throw new Error(`Erreur mise à jour statut: ${updateError.message}`);
    }

    console.log('🎙️ Début transcription sécurisée pour la vidéo:', videoId);
    console.log("🌐 Paramètres langue:", { preferredLanguage, autoDetectLanguage });

    // ✅ VÉRIFICATION DU CACHE
    const cacheKey = `transcription_${videoId}_${videoUrl}`;
    const cachedTranscription = transcriptionCache.get(cacheKey);
    
    if (cachedTranscription && (Date.now() - cachedTranscription.timestamp < CACHE_TTL)) {
      console.log("✅ Utilisation de la transcription en cache");
      
      await saveTranscriptionResults(supabase, videoId, cachedTranscription.data);
      await triggerAnalysis(supabase, videoId, userId, cachedTranscription.data.text);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Transcription terminée avec succès (cache)',
          transcriptionLength: cachedTranscription.data.text.length,
          language: cachedTranscription.data.language,
          languageName: SUPPORTED_LANGUAGES[cachedTranscription.data.language]?.name || 'Inconnue',
          fromCache: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ✅ TÉLÉCHARGEMENT SÉCURISÉ DE LA VIDÉO
    console.log("📥 Téléchargement vidéo sécurisé...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout
    
    let videoResponse;
    try {
      videoResponse = await fetch(videoUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SpotBulle-Transcription-Secure/2.0',
          'Range': 'bytes=0-10485760' // Limiter à 10MB pour la transcription
        }
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Timeout lors du téléchargement de la vidéo');
      }
      throw new Error(`Erreur réseau: ${fetchError.message}`);
    }
    
    if (!videoResponse.ok) {
      const errorText = await videoResponse.text().catch(() => 'Impossible de lire la réponse');
      throw new Error(`Erreur téléchargement vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    // ✅ VALIDATION DE LA TAILLE DU FICHIER
    const contentLength = videoResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) { // 100MB max
      throw new Error('Fichier vidéo trop volumineux (>100MB)');
    }

    const videoBlob = await videoResponse.blob();
    console.log(`📊 Taille vidéo téléchargée: ${videoBlob.size} bytes`);

    if (videoBlob.size === 0) {
      throw new Error('Fichier vidéo vide ou inaccessible');
    }

    if (videoBlob.size > 25 * 1024 * 1024) { // 25MB max pour Whisper
      throw new Error('Fichier vidéo trop volumineux pour la transcription (>25MB)');
    }

    // ✅ CONFIGURATION WHISPER OPTIMISÉE
    const whisperConfig = {
      file: new File([videoBlob], `video-${videoId}.mp4`, { 
        type: 'video/mp4' 
      }),
      model: 'whisper-1',
      response_format: 'verbose_json',
      temperature: 0.0, // Plus de consistance
    };

    // ✅ GESTION INTELLIGENTE DE LA LANGUE
    let targetLanguage = 'fr';
    if (preferredLanguage && SUPPORTED_LANGUAGES[preferredLanguage]) {
      targetLanguage = preferredLanguage;
      whisperConfig.language = SUPPORTED_LANGUAGES[preferredLanguage].whisperCode;
      console.log(`🎯 Transcription en langue spécifiée: ${SUPPORTED_LANGUAGES[preferredLanguage].name}`);
    } else if (!autoDetectLanguage) {
      console.log("🔍 Détection auto désactivée, utilisation du français par défaut");
    } else {
      console.log("🌐 Détection automatique de la langue activée");
    }

    // ✅ TRANSCRIPTION AVEC GESTION D'ERREUR AVANCÉE
    console.log("🤖 Appel Whisper optimisé...");
    let transcriptionResponse;
    try {
      transcriptionResponse = await openai.audio.transcriptions.create(whisperConfig);
    } catch (openaiError) {
      console.error('❌ Erreur OpenAI Whisper:', openaiError);
      
      // Tentative de fallback sans langue spécifiée
      if (whisperConfig.language) {
        console.log("🔄 Tentative de fallback sans langue spécifiée...");
        delete whisperConfig.language;
        transcriptionResponse = await openai.audio.transcriptions.create(whisperConfig);
      } else {
        throw new Error(`Erreur transcription OpenAI: ${openaiError.message}`);
      }
    }

    const transcriptionText = transcriptionResponse.text?.trim();
    let detectedLanguage = transcriptionResponse.language || preferredLanguage || targetLanguage;
    
    // ✅ VALIDATION DE LA TRANSCRIPTION
    if (!transcriptionText || transcriptionText.length === 0) {
      throw new Error('La transcription est vide - aucun texte détecté dans la vidéo');
    }

    // ✅ CORRECTION DE LA LANGUE DÉTECTÉE
    if (!SUPPORTED_LANGUAGES[detectedLanguage]) {
      console.warn(`⚠️ Langue détectée non supportée: ${detectedLanguage}, utilisation du français`);
      detectedLanguage = 'fr';
    }
    
    console.log(`✅ Transcription réussie - Langue: ${detectedLanguage}, Longueur: ${transcriptionText.length}`);

    // ✅ PRÉPARATION DES DONNÉES DE TRANSCRIPTION
    const transcriptionData = {
      text: transcriptionText,
      language: detectedLanguage,
      language_name: SUPPORTED_LANGUAGES[detectedLanguage]?.name || 'Unknown',
      duration: transcriptionResponse.duration,
      words: transcriptionResponse.words || [],
      segments: transcriptionResponse.segments || [],
      confidence: transcriptionResponse.confidence || calculateConfidence(transcriptionText),
      detected_automatically: !preferredLanguage && autoDetectLanguage,
      model: 'whisper-1',
      processed_at: new Date().toISOString()
    };

    // ✅ SAUVEGARDE DES RÉSULTATS
    await saveTranscriptionResults(supabase, videoId, transcriptionData);

    // ✅ MISE EN CACHE
    transcriptionCache.set(cacheKey, {
      data: transcriptionData,
      timestamp: Date.now()
    });

    // ✅ DÉCLENCHEMENT DE L'ANALYSE
    await triggerAnalysis(supabase, videoId, userId, transcriptionText);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription multilingue terminée avec succès',
        transcriptionLength: transcriptionText.length,
        language: detectedLanguage,
        languageName: SUPPORTED_LANGUAGES[detectedLanguage]?.name || 'Inconnue',
        confidence: transcriptionData.confidence,
        fromCache: false
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erreur transcription sécurisée:', error);

    // ✅ SAUVEGARDE DE L'ERREUR
    if (videoId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          await supabase
            .from('videos')
            .update({ 
              status: VIDEO_STATUS.FAILED,
              error_message: error.message.substring(0, 500),
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
          console.log("📝 Statut erreur sauvegardé");
        }
      } catch (updateError) {
        console.error('❌ Erreur mise à jour statut erreur:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de la transcription sécurisée', 
        details: error.message,
        videoId: videoId
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// ✅ FONCTIONS UTILITAIRES AMÉLIORÉES

async function saveTranscriptionResults(supabase, videoId, transcriptionData) {
  const updatePayload = {
    status: VIDEO_STATUS.TRANSCRIBED,
    transcription_text: transcriptionData.text,
    transcription_data: transcriptionData,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from('videos')
      .update({
        ...updatePayload,
        transcription_language: transcriptionData.language
      })
      .eq('id', videoId);

    if (error) {
      console.warn("⚠️ Colonne transcription_language non disponible");
      await supabase
        .from('videos')
        .update(updatePayload)
        .eq('id', videoId);
    }
  } catch (error) {
    console.error("❌ Erreur sauvegarde transcription:", error);
    throw error;
  }
}

async function triggerAnalysis(supabase, videoId, userId, transcriptionText) {
  try {
    console.log("🚀 Déclenchement analyse sécurisée...");
    
    const { data, error } = await supabase.functions.invoke('analyze-transcription', {
      body: {
        videoId,
        transcriptionText: transcriptionText,
        userId
      }
    });

    if (error) {
      console.warn('⚠️ Erreur déclenchement analyse:', error);
      // Ne pas échouer la transcription à cause de l'analyse
    } else {
      console.log('✅ Analyse déclenchée avec succès');
    }
  } catch (analyzeError) {
    console.warn('⚠️ Erreur lors du déclenchement de l\'analyse:', analyzeError);
  }
}

function calculateConfidence(text) {
  if (!text || text.length === 0) return 0;
  
  // Calcul de confiance basé sur des heuristiques simples
  let confidence = 0.5; // Confiance de base
  
  // Bonus pour la longueur du texte
  if (text.length > 100) confidence += 0.2;
  if (text.length > 500) confidence += 0.1;
  
  // Bonus pour la présence de ponctuation
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;
  if (sentenceCount > 3) confidence += 0.1;
  
  // Bonus pour la diversité lexicale
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const uniqueWords = new Set(words.map(word => word.toLowerCase()));
  const diversity = uniqueWords.size / words.length;
  confidence += diversity * 0.1;
  
  return Math.min(Math.max(confidence, 0.1), 0.95);
}

// ✅ NETTOYAGE PERIODIQUE DU CACHE
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of transcriptionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      transcriptionCache.delete(key);
    }
  }
  
  // Nettoyage du rate limiting
  const oneMinuteAgo = now - 60000;
  for (const [ip, requests] of requestTracker.entries()) {
    const recentRequests = requests.filter(time => time > oneMinuteAgo);
    if (recentRequests.length === 0) {
      requestTracker.delete(ip);
    } else {
      requestTracker.set(ip, recentRequests);
    }
  }
}, 60000); // Toutes les minutes
