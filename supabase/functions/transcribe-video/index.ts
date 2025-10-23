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

// ✅ SUPPORT MULTILINGUE ÉTENDU
const SUPPORTED_LANGUAGES = {
  'fr': 'French',
  'en': 'English',
  'es': 'Spanish',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'tr': 'Turkish',
  'nl': 'Dutch',
  'pl': 'Polish',
  'sv': 'Swedish',
  'da': 'Danish',
  'no': 'Norwegian',
  'fi': 'Finnish',
  'el': 'Greek',
  'he': 'Hebrew',
  'th': 'Thai',
  'vi': 'Vietnamese'
};

// ✅ DÉTECTION AUTOMATIQUE DE LANGUE AVEC WHISPER
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
  'ko': 'korean',
  'ar': 'arabic',
  'hi': 'hindi',
  'tr': 'turkish',
  'nl': 'dutch',
  'pl': 'polish',
  'sv': 'swedish',
  'da': 'danish',
  'no': 'norwegian',
  'fi': 'finnish',
  'el': 'greek',
  'he': 'hebrew',
  'th': 'thai',
  'vi': 'vietnamese'
};

Deno.serve(async (req) => {
  console.log("🎤 transcribe-video (multilingue) appelée");

  // ✅ CORRECTION: Gestion CORS améliorée avec OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // ✅ CORRECTION: Vérifier que c'est bien une méthode POST
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
    
    // ✅ CORRECTION: Gestion ROBUSTE du parsing JSON
    let requestBody;
    let rawBody = '';
    
    try {
      rawBody = await req.text();
      console.log("📦 Corps brut reçu (premiers 500 caractères):", rawBody.substring(0, 500));
      
      if (!rawBody || rawBody.trim().length === 0) {
        throw new Error('Corps de requête vide');
      }
      
      requestBody = JSON.parse(rawBody);
      console.log("✅ JSON parsé avec succès");
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
          received: { videoId, userId, videoUrl: videoUrl ? 'présent' : 'manquant' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ CORRECTION: Vérifier que l'URL est accessible
    try {
      new URL(videoUrl);
    } catch (urlError) {
      return new Response(
        JSON.stringify({ error: `URL vidéo invalide: ${videoUrl}. Erreur: ${urlError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration Supabase manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Clé API OpenAI manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ✅ MISE À JOUR AVEC INFORMATIONS DE LANGUE
    console.log("🔄 Mise à jour statut PROCESSING");
    
    // ✅ CORRECTION: Gestion des colonnes manquantes dès le début
    let statusUpdatePayload = {
      status: VIDEO_STATUS.PROCESSING,
      updated_at: new Date().toISOString()
    };

    try {
      // Essayer avec transcription_language
      const statusUpdate = await supabase
        .from('videos')
        .update({ 
          ...statusUpdatePayload, 
          transcription_language: preferredLanguage || 'auto' 
        })
        .eq('id', videoId);

      if (statusUpdate.error) {
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎙️ Début transcription multilingue pour la vidéo:', videoId);
    console.log("🌐 Paramètres langue:", { preferredLanguage, autoDetectLanguage });

    // ✅ TÉLÉCHARGEMENT AVEC GESTION D'ERREUR AMÉLIORÉE
    console.log("📥 Téléchargement vidéo...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    let videoResponse;
    try {
      videoResponse = await fetch(videoUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SpotBulle-Multilingual-Transcription/2.0'
        }
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Timeout lors du téléchargement de la vidéo' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Erreur réseau: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      return new Response(
        JSON.stringify({ 
          error: `Erreur téléchargement vidéo: ${videoResponse.status} ${videoResponse.statusText}`,
          details: errorText.substring(0, 200)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoBlob = await videoResponse.blob();
    console.log(`📊 Taille vidéo téléchargée: ${videoBlob.size} bytes`);

    if (videoBlob.size === 0) {
      return new Response(
        JSON.stringify({ error: 'Fichier vidéo vide ou inaccessible' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ CONFIGURATION WHISPER MULTILINGUE
    const whisperConfig = {
      file: new File([videoBlob], `video-${videoId}.mp4`, { 
        type: 'video/mp4' 
      }),
      model: 'whisper-1',
      response_format: 'verbose_json'
    };

    // ✅ AJOUT DU PARAMÈTRE LANGUE SI SPÉCIFIÉ
    if (preferredLanguage && WHISPER_LANGUAGE_MAPPING[preferredLanguage]) {
      whisperConfig.language = WHISPER_LANGUAGE_MAPPING[preferredLanguage];
      console.log(`🎯 Transcription en langue spécifiée: ${SUPPORTED_LANGUAGES[preferredLanguage]}`);
    } else if (!autoDetectLanguage) {
      whisperConfig.language = 'english';
      console.log("🔍 Détection auto désactivée, utilisation de l'anglais par défaut");
    } else {
      console.log("🌐 Détection automatique de la langue activée");
    }

    // ✅ TRANSCRIPTION AVEC WHISPER - GESTION D'ERREUR AMÉLIORÉE
    console.log("🤖 Appel Whisper multilingue...");
    let transcriptionResponse;
    try {
      transcriptionResponse = await openai.audio.transcriptions.create(whisperConfig);
    } catch (openaiError) {
      console.error('❌ Erreur OpenAI Whisper:', openaiError);
      return new Response(
        JSON.stringify({ 
          error: `Erreur transcription OpenAI: ${openaiError.message}`,
          type: 'openai_error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcriptionText = transcriptionResponse.text;
    const detectedLanguage = transcriptionResponse.language || preferredLanguage || 'fr';
    
    // ✅ CORRECTION: Vérifier que la transcription n'est pas vide
    if (!transcriptionText || transcriptionText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'La transcription est vide - aucun texte détecté dans la vidéo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`✅ Transcription réussie - Langue: ${detectedLanguage}, Longueur: ${transcriptionText.length}`);

    const transcriptionData = {
      text: transcriptionText,
      language: detectedLanguage,
      language_name: SUPPORTED_LANGUAGES[detectedLanguage] || 'Unknown',
      duration: transcriptionResponse.duration,
      words: transcriptionResponse.words || [],
      confidence: transcriptionResponse.confidence || 0.8,
      detected_automatically: !preferredLanguage && autoDetectLanguage
    };

    // ✅ SAUVEGARDE AVEC INFORMATIONS LANGUE - GESTION DE FALLBACK AMÉLIORÉE
    console.log("💾 Sauvegarde transcription multilingue...");
    
    let updatePayload = {
      status: VIDEO_STATUS.TRANSCRIBED,
      transcription_text: transcriptionText,
      transcription_data: transcriptionData,
      updated_at: new Date().toISOString()
    };

    // Essayer d'ajouter transcription_language si la colonne existe
    try {
      const testUpdate = await supabase
        .from('videos')
        .update({ ...updatePayload, transcription_language: detectedLanguage })
        .eq('id', videoId);

      if (testUpdate.error) {
        console.warn("⚠️ Colonne transcription_language non disponible, sauvegarde sans...");
        // Réessayer sans la colonne language
        const { error: fallbackError } = await supabase
          .from('videos')
          .update(updatePayload)
          .eq('id', videoId);

        if (fallbackError) {
          throw new Error(`Erreur mise à jour transcription: ${fallbackError.message}`);
        }
      }
    } catch (updateError) {
      console.error("❌ Erreur sauvegarde transcription:", updateError);
      return new Response(
        JSON.stringify({ error: `Erreur sauvegarde: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ DÉCLENCHEMENT ANALYSE MULTILINGUE - GESTION D'ERREUR AMÉLIORÉE
    console.log("🚀 Déclenchement analyse multilingue...");
    try {
      const analyzeBody = {
        videoId,
        transcriptionText: transcriptionText,
        userId,
        transcriptionLanguage: detectedLanguage
      };

      console.log("📤 Données envoyées à l'analyse:", {
        videoId,
        transcriptionLength: transcriptionText.length,
        userId,
        transcriptionLanguage: detectedLanguage
      });

      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analyzeBody)
      });

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text();
        console.warn('⚠️ Erreur déclenchement analyse:', errorText);
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
        languageName: SUPPORTED_LANGUAGES[detectedLanguage] || 'Inconnue',
        hasTranscriptionText: !!transcriptionText
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erreur transcription multilingue:', error);

    // Mettre à jour le statut d'erreur si videoId est disponible
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
              error_message: error.message.substring(0, 255), // Limiter la longueur
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
        supportedLanguages: Object.keys(SUPPORTED_LANGUAGES)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
