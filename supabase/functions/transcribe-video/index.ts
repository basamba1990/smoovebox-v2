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

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId = null;

  try {
    console.log("📨 Headers:", Object.fromEntries(req.headers));
    
    const { videoId: vidId, userId, videoUrl, preferredLanguage, autoDetectLanguage = true } = await req.json();
    videoId = vidId;

    console.log("📦 Paramètres reçus:", { 
      videoId, 
      userId, 
      videoUrl: videoUrl ? videoUrl.substring(0, 100) + "..." : "NULL",
      preferredLanguage,
      autoDetectLanguage
    });

    // ✅ VALIDATION AMÉLIORÉE
    if (!videoId || !userId || !videoUrl) {
      throw new Error('Paramètres manquants: videoId, userId, videoUrl requis');
    }

    // ✅ VÉRIFICATION URL AMÉLIORÉE
    let validatedUrl = videoUrl;
    try {
      new URL(videoUrl);
    } catch (urlError) {
      console.warn('⚠️ URL invalide, tentative de correction...');
      // Si l'URL est relative, essayer de la reconstruire
      if (videoUrl.startsWith('/')) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        validatedUrl = `${supabaseUrl}${videoUrl}`;
        console.log('🔧 URL reconstruite:', validatedUrl);
      } else {
        throw new Error(`URL vidéo invalide: ${videoUrl}. Erreur: ${urlError.message}`);
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuration Supabase manquante');
    }
    if (!openaiApiKey) {
      throw new Error('Clé API OpenAI manquante');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ✅ MISE À JOUR AVEC INFORMATIONS DE LANGUE
    console.log("🔄 Mise à jour statut PROCESSING");
    const { error: statusError } = await supabase
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.PROCESSING,
        transcription_language: preferredLanguage || 'auto',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (statusError) {
      console.error('❌ Erreur mise à jour statut:', statusError);
      throw new Error(`Erreur mise à jour statut: ${statusError.message}`);
    }

    console.log('🎙️ Début transcription multilingue pour la vidéo:', videoId);
    console.log("🌐 Paramètres langue:", { preferredLanguage, autoDetectLanguage });

    // ✅ TÉLÉCHARGEMENT AVEC GESTION D'ERREUR AMÉLIORÉE
    console.log("📥 Téléchargement vidéo depuis:", validatedUrl);
    
    let videoResponse;
    try {
      videoResponse = await fetch(validatedUrl, {
        headers: {
          'User-Agent': 'SpotBulle-Multilingual-Transcription/2.0',
          'Accept': 'video/*'
        },
        timeout: 30000 // 30 secondes timeout
      });
    } catch (fetchError) {
      console.error('❌ Erreur fetch vidéo:', fetchError);
      throw new Error(`Impossible de télécharger la vidéo: ${fetchError.message}`);
    }
    
    if (!videoResponse.ok) {
      const errorText = await videoResponse.text().catch(() => 'Impossible de lire le corps de l\'erreur');
      console.error('❌ Erreur réponse HTTP:', {
        status: videoResponse.status,
        statusText: videoResponse.statusText,
        headers: Object.fromEntries(videoResponse.headers),
        error: errorText
      });
      throw new Error(`Erreur téléchargement vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    console.log(`📊 Taille vidéo téléchargée: ${videoBlob.size} bytes, type: ${videoBlob.type}`);

    if (videoBlob.size === 0) {
      throw new Error('Fichier vidéo vide ou inaccessible');
    }

    // ✅ CONFIGURATION WHISPER MULTILINGUE AVEC GESTION D'ERREUR
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

    // ✅ TRANSCRIPTION AVEC WHISPER - GESTION D'ERREUR RENFORCÉE
    console.log("🤖 Appel Whisper multilingue...");
    let transcriptionResponse;
    try {
      transcriptionResponse = await openai.audio.transcriptions.create(whisperConfig);
    } catch (openaiError) {
      console.error('❌ Erreur OpenAI Whisper:', openaiError);
      throw new Error(`Erreur transcription OpenAI: ${openaiError.message}`);
    }

    const transcriptionText = transcriptionResponse.text;
    const detectedLanguage = transcriptionResponse.language || preferredLanguage || 'fr';
    
    console.log(`✅ Transcription réussie - Langue: ${detectedLanguage}, Longueur: ${transcriptionText.length}`);

    // ✅ VÉRIFICATION QUE LE TEXTE DE TRANSCRIPTION N'EST PAS VIDE
    if (!transcriptionText || transcriptionText.trim().length === 0) {
      console.warn('⚠️ Transcription vide, utilisation de texte par défaut');
      throw new Error('La transcription a retourné un texte vide');
    }

    const transcriptionData = {
      text: transcriptionText,
      language: detectedLanguage,
      language_name: SUPPORTED_LANGUAGES[detectedLanguage] || 'Unknown',
      duration: transcriptionResponse.duration,
      words: transcriptionResponse.words || [],
      confidence: transcriptionResponse.confidence || 0.8,
      detected_automatically: !preferredLanguage && autoDetectLanguage
    };

    // ✅ SAUVEGARDE AVEC INFORMATIONS LANGUE - GESTION DE FALLBACK
    console.log("💾 Sauvegarde transcription multilingue...");
    const updatePayload = {
      status: VIDEO_STATUS.TRANSCRIBED,
      transcription_text: transcriptionText,
      transcription_data: transcriptionData,
      updated_at: new Date().toISOString()
    };

    // ✅ ESSAYER D'AJOUTER LA COLONNE LANGUE SI ELLE EXISTE
    try {
      const { error: updateError } = await supabase
        .from('videos')
        .update({ 
          ...updatePayload,
          transcription_language: detectedLanguage
        })
        .eq('id', videoId);

      if (updateError) {
        console.warn("⚠️ Erreur sauvegarde avec colonne langue, tentative sans...");
        // Fallback sans la colonne language
        const { error: fallbackError } = await supabase
          .from('videos')
          .update(updatePayload)
          .eq('id', videoId);

        if (fallbackError) {
          throw new Error(`Erreur mise à jour transcription: ${fallbackError.message}`);
        }
      }
    } catch (updateError) {
      console.error('❌ Erreur sauvegarde transcription:', updateError);
      throw updateError;
    }

    // ✅ DÉCLENCHEMENT ANALYSE MULTILINGUE AVEC GESTION D'ERREUR
    console.log("🚀 Déclenchement analyse multilingue...");
    try {
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          transcriptionText: transcriptionText, // ✅ CORRECTION : S'assurer que c'est bien envoyé
          userId,
          transcriptionLanguage: detectedLanguage
        })
      });

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text();
        console.warn('⚠️ Erreur déclenchement analyse:', {
          status: analyzeResponse.status,
          error: errorText
        });
        // Ne pas throw ici pour ne pas bloquer le processus de transcription
      } else {
        console.log('✅ Analyse multilingue déclenchée avec succès');
      }
    } catch (analyzeError) {
      console.warn('⚠️ Erreur lors du déclenchement de l\'analyse:', analyzeError);
      // Ne pas throw pour ne pas bloquer le processus principal
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription multilingue terminée avec succès',
        transcriptionLength: transcriptionText.length,
        language: detectedLanguage,
        languageName: SUPPORTED_LANGUAGES[detectedLanguage] || 'Inconnue'
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
              error_message: error.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId)
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
