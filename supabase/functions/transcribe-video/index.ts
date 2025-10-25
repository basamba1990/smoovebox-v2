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

// ✅ CORRECTION CORS - Headers complets
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Content-Type': 'application/json',
}

// ✅ SUPPORT MULTILINGUE ÉTENDU
const SUPPORTED_LANGUAGES = {
  'fr': { name: 'French', whisperCode: 'fr' },
  'en': { name: 'English', whisperCode: 'en' },
  'es': { name: 'Spanish', whisperCode: 'es' },
  'ar': { name: 'Arabic', whisperCode: 'ar' },
  'de': { name: 'German', whisperCode: 'de' },
  'it': { name: 'Italian', whisperCode: 'it' },
  'pt': { name: 'Portuguese', whisperCode: 'pt' },
  'ru': { name: 'Russian', whisperCode: 'ru' },
  'zh': { name: 'Chinese', whisperCode: 'zh' },
  'ja': { name: 'Japanese', whisperCode: 'ja' }
}

Deno.serve(async (req) => {
  console.log("🎤 transcribe-video (optimisée) appelée")

  // ✅ CORRECTION CORS - Gestion OPTIONS améliorée
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  let videoId = null

  try {
    // ✅ PARSING SÉCURISÉ
    let requestBody
    try {
      const rawBody = await req.text()
      if (!rawBody || rawBody.trim().length === 0) {
        throw new Error('Corps vide')
      }
      requestBody = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError)
      return new Response(
        JSON.stringify({
          error: 'JSON invalide',
          details: parseError.message
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      )
    }

    const { videoId: vidId, userId, videoUrl, preferredLanguage, autoDetectLanguage = true } = requestBody
    videoId = vidId

    // ✅ VALIDATION
    if (!videoId || !userId || !videoUrl) {
      return new Response(
        JSON.stringify({
          error: 'Paramètres manquants: videoId, userId, videoUrl requis',
          received: { videoId: !!videoId, userId: !!userId, videoUrl: !!videoUrl }
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // ✅ CONFIGURATION
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('❌ Configuration manquante')
      return new Response(
        JSON.stringify({ error: 'Configuration serveur incomplète' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // ✅ VÉRIFICATION VIDÉO
    console.log(`🔍 Vérification vidéo: ${videoId}`)
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      console.error('❌ Vidéo non trouvée:', videoError)
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (video.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Accès non autorisé' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // ✅ MISE À JOUR STATUT
    console.log("🔄 Mise à jour statut PROCESSING")
    const { error: statusError } = await supabase
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (statusError) {
      throw new Error(`Erreur mise à jour statut: ${statusError.message}`)
    }

    console.log('🎙️ Début transcription pour:', videoId)

    // ✅ TÉLÉCHARGEMENT VIDÉO
    console.log("📥 Téléchargement vidéo...")
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    let videoResponse
    try {
      videoResponse = await fetch(videoUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SpotBulle-Transcription/2.0' }
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      throw new Error(`Erreur téléchargement: ${fetchError.message}`)
    }

    if (!videoResponse.ok) {
      throw new Error(`Erreur HTTP: ${videoResponse.status}`)
    }

    const videoBlob = await videoResponse.blob()
    console.log(`📊 Taille vidéo: ${videoBlob.size} bytes`)

    if (videoBlob.size === 0) {
      throw new Error('Fichier vidéo vide')
    }

    // ✅ CONFIGURATION WHISPER
    const whisperConfig: any = {
      file: new File([videoBlob], `video-${videoId}.mp4`, { type: 'video/mp4' }),
      model: 'whisper-1',
      response_format: 'verbose_json',
      temperature: 0.0,
    }

    // ✅ GESTION LANGUE
    if (preferredLanguage && SUPPORTED_LANGUAGES[preferredLanguage]) {
      whisperConfig.language = SUPPORTED_LANGUAGES[preferredLanguage].whisperCode
      console.log(`🎯 Langue spécifiée: ${SUPPORTED_LANGUAGES[preferredLanguage].name}`)
    } else if (!autoDetectLanguage) {
      whisperConfig.language = 'fr'
      console.log("🔍 Détection auto désactivée")
    } else {
      console.log("🌐 Détection automatique activée")
    }

    // ✅ TRANSCRIPTION
    console.log("🤖 Appel Whisper...")
    let transcriptionResponse
    try {
      transcriptionResponse = await openai.audio.transcriptions.create(whisperConfig)
    } catch (openaiError) {
      console.error('❌ Erreur Whisper:', openaiError)

      // Fallback sans langue
      if (whisperConfig.language) {
        console.log("🔄 Fallback sans langue...")
        delete whisperConfig.language
        transcriptionResponse = await openai.audio.transcriptions.create(whisperConfig)
      } else {
        throw new Error(`Erreur Whisper: ${openaiError.message}`)
      }
    }

    const transcriptionText = transcriptionResponse.text?.trim()
    const detectedLanguage = transcriptionResponse.language || preferredLanguage || 'fr'

    if (!transcriptionText) {
      throw new Error('Transcription vide')
    }

    console.log(`✅ Transcription réussie: ${transcriptionText.length} caractères`)

    // ✅ SAUVEGARDE
    const transcriptionData = {
      text: transcriptionText,
      language: detectedLanguage,
      language_name: SUPPORTED_LANGUAGES[detectedLanguage]?.name || 'Unknown',
      duration: transcriptionResponse.duration,
      words: transcriptionResponse.words || [],
      segments: transcriptionResponse.segments || [],
      confidence: transcriptionResponse.confidence || 0.8,
      model: 'whisper-1',
      processed_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('videos')
      .update({
        status: VIDEO_STATUS.TRANSCRIBED,
        transcription_text: transcriptionText,
        transcription_data: transcriptionData,
        transcription_language: detectedLanguage,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (updateError) {
      throw new Error(`Erreur sauvegarde transcription: ${updateError.message}`)
    }

    // ✅ DÉCLENCHEMENT ANALYSE
    console.log("🚀 Déclenchement analyse...")
    try {
      const { error: analyzeError } = await supabase.functions.invoke('analyze-transcription', {
        body: {
          videoId,
          transcriptionText: transcriptionText,
          userId,
          transcriptionLanguage: detectedLanguage
        }
      })

      if (analyzeError) {
        console.warn('⚠️ Erreur déclenchement analyse:', analyzeError)
      } else {
        console.log('✅ Analyse déclenchée')
      }
    } catch (analyzeError) {
      console.warn('⚠️ Erreur déclenchement analyse:', analyzeError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transcription terminée avec succès',
        transcriptionLength: transcriptionText.length,
        language: detectedLanguage,
        languageName: SUPPORTED_LANGUAGES[detectedLanguage]?.name || 'Inconnue'
      }),
      {
        status: 200,
        headers: corsHeaders
      }
    )

  } catch (error) {
    console.error('❌ Erreur transcription:', error)

    // ✅ SAUVEGARDE ERREUR
    if (videoId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey)
          await supabase
            .from('videos')
            .update({
              status: VIDEO_STATUS.FAILED,
              error_message: error.message.substring(0, 500),
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId)
        }
      } catch (updateError) {
        console.error('❌ Erreur sauvegarde statut:', updateError)
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Erreur transcription',
        details: error.message,
        videoId: videoId
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    )
  }
})
