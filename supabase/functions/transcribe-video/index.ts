// supabase/functions/transcribe-video/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

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

// ✅ SUPPORT MULTILINGUE ÉTENDU - CORRIGÉ
const SUPPORTED_LANGUAGES = {
  'fr': { name: 'French', whisperCode: 'fr' },
  'en': { name: 'English', whisperCode: 'en' },
  'es': { name: 'Spanish', whisperCode: 'es' },
  'de': { name: 'German', whisperCode: 'de' },
  'it': { name: 'Italian', whisperCode: 'it' },
  'pt': { name: 'Portuguese', whisperCode: 'pt' },
  'ru': { name: 'Russian', whisperCode: 'ru' },
  'zh': { name: 'Chinese', whisperCode: 'zh' },
  'ja': { name: 'Japanese', whisperCode: 'ja' },
  'ar': { name: 'Arabic', whisperCode: 'ar' }
};

// ✅ WHISPER LANGUAGE MAPPING CORRECT
const WHISPER_LANGUAGE_MAPPING = {
  'fr': 'french',
  'en': 'english', 
  'es': 'spanish',
  'de': 'german',
  'it': 'italian',
  'pt': 'portuguese',
  'ru': 'russian',
  'zh': 'chinese',
  'ja': 'japanese',
  'ar': 'arabic'
};

Deno.serve(async (req) => {
  console.log("🎤 transcribe-video (multilingue corrigée) appelée");

  // ✅ GESTION CORS CORRECTE
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

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
    console.log("📨 Headers:", Object.fromEntries(req.headers));
    
    // ✅ CORRECTION CRITIQUE: Gestion ROBUSTE du parsing JSON
    let requestBody;
    let rawBody = '';
    
    try {
      rawBody = await req.text();
      console.log("📦 Corps brut reçu (premiers 500 caractères):", rawBody.substring(0, 500));
      
      if (!rawBody || rawBody.trim().length === 0) {
        throw new Error('Corps de requête vide');
      }
      
      requestBody = JSON.parse(rawBody);
      console.log("✅ JSON parsé avec succès:", { 
        videoId: requestBody.videoId,
        userId: requestBody.userId,
        hasVideoUrl: !!requestBody.videoUrl 
      });
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Corps de requête JSON invalide',
          details: parseError.message,
          bodyPreview: rawBody.substring(0, 200)
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { videoId: vidId, userId, videoUrl, preferredLanguage, autoDetectLanguage = true } = requestBody;
    videoId = vidId;

    // ✅ VALIDATION AMÉLIORÉE
    if (!videoId || !userId || !videoUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'Paramètres manquants: videoId, userId, videoUrl requis',
          received: { 
            videoId: videoId, 
            userId: userId, 
            videoUrl: videoUrl ? 'présent' : 'manquant' 
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ✅ VALIDATION URL CORRECTE
    try {
      new URL(videoUrl);
    } catch (urlError) {
      return new Response(
        JSON.stringify({ error: `URL vidéo invalide: ${videoUrl}. Erreur: ${urlError.message}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ✅ RÉCUPÉRATION SÉCURISÉE DES CLÉS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Configuration Supabase manquante');
      return new Response(
        JSON.stringify({ error: 'Configuration Supabase manquante' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!openaiApiKey) {
      console.error('❌ Clé API OpenAI manquante');
      return new Response(
        JSON.stringify({ error: 'Clé API OpenAI manquante' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ✅ VÉRIFICATION QUE LA VIDÉO EXISTE ET APPARTIENT À L'UTILISATEUR
    console.log("🔍 Vérification vidéo:", videoId);
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('❌ Vidéo non trouvée:', videoError);
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ✅ VÉRIFICATION DES PERMISSIONS
    if (video.user_id !== userId) {
      console.error('❌ Accès non autorisé:', { videoUserId: video.user_id, requestUserId: userId });
      return new Response(
        JSON.stringify({ error: 'Accès non autorisé à cette vidéo' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("🔄 Mise à jour statut PROCESSING");

    // ✅ MISE À JOUR STATUT - GESTION DE FALLBACK
    let statusUpdatePayload: any = {
      status: VIDEO_STATUS.PROCESSING,
      updated_at: new Date().toISOString()
    };

    try {
      // Essayer avec transcription_language
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          ...statusUpdatePayload,
          transcription_language: preferredLanguage || 'auto'
        })
        .eq('id', videoId);

      if (updateError) {
        console.warn("⚠️ Colonne transcription_language non disponible, mise à jour sans...");
        // Réessayer sans la colonne
        const { error: fallbackError } = await supabase
          .from('videos')
          .update(statusUpdatePayload)
          .eq('id', videoId);
        
        if (fallbackError) throw fallbackError;
      }
    } catch (updateError) {
      console.error("❌ Erreur mise à jour statut:", updateError);
      return new Response(
        JSON.stringify({ error: `Erreur mise à jour statut: ${updateError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🎙️ Début transcription multilingue pour la vidéo:', videoId);
    console.log("🌐 Paramètres langue:", { preferredLanguage, autoDetectLanguage });

    // ✅ TÉLÉCHARGEMENT SÉCURISÉ AVEC TIMEOUT
    console.log("📥 Téléchargement vidéo...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout
    
    let videoResponse;
    try {
      videoResponse = await fetch(videoUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SpotBulle-Multilingual-Transcription/2.0',
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

    const videoBlob = await videoResponse.blob();
    console.log(`📊 Taille vidéo téléchargée: ${videoBlob.size} bytes`);

    if (videoBlob.size === 0) {
      throw new Error('Fichier vidéo vide ou inaccessible');
    }

    if (videoBlob.size > 25 * 1024 * 1024) {
      throw new Error('Fichier vidéo trop volumineux pour la transcription (>25MB)');
    }

    // ✅ CONFIGURATION WHISPER CORRECTE
    const whisperConfig: any = {
      file: new File([videoBlob], `video-${videoId}.mp4`, { 
        type: 'video/mp4' 
      }),
      model: 'whisper-1',
      response_format: 'verbose_json',
      temperature: 0.0,
    };

    // ✅ GESTION LANGUE CORRECTE
    if (preferredLanguage && WHISPER_LANGUAGE_MAPPING[preferredLanguage]) {
      whisperConfig.language = WHISPER_LANGUAGE_MAPPING[preferredLanguage];
      console.log(`🎯 Transcription en langue spécifiée: ${SUPPORTED_LANGUAGES[preferredLanguage]?.name}`);
    } else if (!autoDetectLanguage) {
      whisperConfig.language = 'french';
      console.log("🔍 Détection auto désactivée, utilisation du français par défaut");
    } else {
      console.log("🌐 Détection automatique de la langue activée");
    }

    // ✅ TRANSCRIPTION AVEC GESTION D'ERREUR
    console.log("🤖 Appel Whisper multilingue...");
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
    const detectedLanguage = transcriptionResponse.language || preferredLanguage || 'fr';
    
    // ✅ VALIDATION TRANSCRIPTION
    if (!transcriptionText || transcriptionText.length === 0) {
      throw new Error('La transcription est vide - aucun texte détecté dans la vidéo');
    }

    console.log(`✅ Transcription réussie - Langue: ${detectedLanguage}, Longueur: ${transcriptionText.length}`);

    // ✅ PRÉPARATION DONNÉES TRANSCRIPTION
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

    // ✅ SAUVEGARDE RÉSULTATS AVEC FALLBACK
    console.log("💾 Sauvegarde transcription multilingue...");
    const updatePayload: any = {
      status: VIDEO_STATUS.TRANSCRIBED,
      transcription_text: transcriptionText,
      transcription_data: transcriptionData,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('videos')
        .update({
          ...updatePayload,
          transcription_language: detectedLanguage
        })
        .eq('id', videoId);

      if (error) {
        console.warn("⚠️ Colonne transcription_language non disponible, sauvegarde sans...");
        await supabase
          .from('videos')
          .update(updatePayload)
          .eq('id', videoId);
      }
    } catch (updateError) {
      console.error("❌ Erreur sauvegarde transcription:", updateError);
      throw new Error(`Erreur sauvegarde: ${updateError.message}`);
    }

    // ✅ DÉCLENCHEMENT ANALYSE SÉCURISÉ
    console.log("🚀 Déclenchement analyse multilingue...");
    try {
      const { data, error } = await supabase.functions.invoke('analyze-transcription', {
        body: {
          videoId,
          transcriptionText: transcriptionText,
          userId,
          transcriptionLanguage: detectedLanguage
        }
      });

      if (error) {
        console.warn('⚠️ Erreur déclenchement analyse:', error);
      } else {
        console.log('✅ Analyse multilingue déclenchée avec succès');
      }
    } catch (analyzeError) {
      console.warn('⚠️ Erreur lors du déclenchement de l\'analyse:', analyzeError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription multilingue terminée avec succès',
        transcriptionLength: transcriptionText.length,
        language: detectedLanguage,
        languageName: SUPPORTED_LANGUAGES[detectedLanguage]?.name || 'Inconnue',
        confidence: transcriptionData.confidence
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erreur transcription multilingue:', error);

    // ✅ SAUVEGARDE ERREUR
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
        error: 'Erreur lors de la transcription multilingue', 
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

// ✅ FONCTION UTILITAIRE POUR CALCULER LA CONFIANCE
function calculateConfidence(text: string): number {
  if (!text || text.length === 0) return 0;
  
  let confidence = 0.5;
  
  if (text.length > 100) confidence += 0.2;
  if (text.length > 500) confidence += 0.1;
  
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;
  if (sentenceCount > 3) confidence += 0.1;
  
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const uniqueWords = new Set(words.map(word => word.toLowerCase()));
  const diversity = uniqueWords.size / words.length;
  confidence += diversity * 0.1;
  
  return Math.min(Math.max(confidence, 0.1), 0.95);
}
