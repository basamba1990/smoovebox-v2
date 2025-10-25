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

// ✅ CORRECTION CORS COMPLÈTE
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
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
  console.log("🎤 transcribe-video (VERSION CORRIGÉE) appelée")
  console.log("📨 Méthode:", req.method)
  console.log("🔗 URL:", req.url)

  // ✅ GESTION CORS AMÉLIORÉE
  if (req.method === 'OPTIONS') {
    console.log("✅ Réponse OPTIONS CORS")
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  // ✅ VÉRIFICATION MÉTHODE
  if (req.method !== 'POST') {
    console.error('❌ Méthode non autorisée:', req.method)
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }),
      {
        status: 405,
        headers: corsHeaders
      }
    )
  }

  let videoId = null

  try {
    // ✅ PARSING SÉCURISÉ DU CORPS
    console.log("📦 Début parsing du corps...")
    let requestBody
    try {
      const rawBody = await req.text()
      console.log("📄 Corps brut reçu:", rawBody.substring(0, 500) + "...")
      
      if (!rawBody || rawBody.trim().length === 0) {
        throw new Error('Corps de requête vide')
      }
      
      requestBody = JSON.parse(rawBody)
      console.log("✅ Corps JSON parsé avec succès")
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError)
      return new Response(
        JSON.stringify({
          error: 'JSON invalide dans le corps de la requête',
          details: parseError.message
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      )
    }

    const { 
      videoId: vidId, 
      userId, 
      videoUrl, 
      preferredLanguage, 
      autoDetectLanguage = true 
    } = requestBody
    
    videoId = vidId

    console.log("📋 Paramètres reçus:", {
      videoId,
      userId: userId ? '***' : 'NULL',
      videoUrl: videoUrl ? videoUrl.substring(0, 100) + "..." : "NULL",
      preferredLanguage,
      autoDetectLanguage
    })

    // ✅ VALIDATION DES PARAMÈTRES OBLIGATOIRES
    if (!videoId) {
      throw new Error('videoId est requis')
    }
    if (!userId) {
      throw new Error('userId est requis')
    }
    if (!videoUrl) {
      throw new Error('videoUrl est requis')
    }

    // ✅ VALIDATION URL
    try {
      new URL(videoUrl)
    } catch (urlError) {
      throw new Error(`URL vidéo invalide: ${videoUrl}. Erreur: ${urlError.message}`)
    }

    // ✅ CONFIGURATION SUPABASE
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    console.log("🔧 Vérification configuration...")
    console.log("📍 Supabase URL:", supabaseUrl ? "✓ Défini" : "✗ Manquant")
    console.log("🔑 Supabase Service Key:", supabaseServiceKey ? "✓ Défini" : "✗ Manquant")
    console.log("🤖 OpenAI API Key:", openaiApiKey ? "✓ Défini" : "✗ Manquant")

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      throw new Error('Configuration serveur incomplète. Vérifiez les variables d\'environnement.')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // ✅ VÉRIFICATION DE LA VIDÉO EN BASE
    console.log(`🔍 Recherche vidéo: ${videoId}`)
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError) {
      console.error('❌ Erreur recherche vidéo:', videoError)
      throw new Error(`Erreur base de données: ${videoError.message}`)
    }

    if (!video) {
      throw new Error(`Vidéo non trouvée avec l'ID: ${videoId}`)
    }

    console.log("✅ Vidéo trouvée:", {
      id: video.id,
      title: video.title,
      user_id: video.user_id,
      status: video.status
    })

    // ✅ VÉRIFICATION DES PERMISSIONS
    if (video.user_id !== userId) {
      throw new Error('Accès non autorisé: l\'utilisateur ne correspond pas à la vidéo')
    }

    // ✅ MISE À JOUR DU STATUT
    console.log("🔄 Mise à jour statut PROCESSING...")
    const { error: statusError } = await supabase
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (statusError) {
      console.error('❌ Erreur mise à jour statut:', statusError)
      throw new Error(`Erreur mise à jour statut: ${statusError.message}`)
    }

    console.log('🎙️ Début transcription pour la vidéo:', videoId)

    // ✅ TÉLÉCHARGEMENT DE LA VIDÉO
    console.log("📥 Téléchargement vidéo depuis:", videoUrl)
    
    // Configuration du timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout téléchargement déclenché')
      controller.abort()
    }, 120000) // 2 minutes

    let videoResponse
    try {
      videoResponse = await fetch(videoUrl, {
        signal: controller.signal,
        headers: { 
          'User-Agent': 'SpotBulle-Transcription/2.0',
          'Accept': 'video/*'
        }
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.error('❌ Erreur fetch vidéo:', fetchError)
      throw new Error(`Erreur téléchargement vidéo: ${fetchError.message}`)
    }

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text().catch(() => 'Impossible de lire le corps d\'erreur')
      throw new Error(`Erreur HTTP ${videoResponse.status}: ${videoResponse.statusText}. Détails: ${errorText}`)
    }

    const videoBlob = await videoResponse.blob()
    console.log(`📊 Taille vidéo téléchargée: ${videoBlob.size} bytes`)

    if (videoBlob.size === 0) {
      throw new Error('Fichier vidéo vide ou inaccessible')
    }

    // ✅ CONFIGURATION WHISPER
    const whisperConfig: any = {
      file: new File([videoBlob], `video-${videoId}.mp4`, { type: 'video/mp4' }),
      model: 'whisper-1',
      response_format: 'verbose_json',
      temperature: 0.0,
    }

    // ✅ GESTION DE LA LANGUE
    if (preferredLanguage && SUPPORTED_LANGUAGES[preferredLanguage]) {
      whisperConfig.language = SUPPORTED_LANGUAGES[preferredLanguage].whisperCode
      console.log(`🎯 Langue spécifiée: ${SUPPORTED_LANGUAGES[preferredLanguage].name}`)
    } else if (!autoDetectLanguage) {
      whisperConfig.language = 'fr'
      console.log("🔍 Détection auto désactivée, utilisation du français par défaut")
    } else {
      console.log("🌐 Détection automatique activée")
    }

    // ✅ TRANSCRIPTION AVEC WHISPER
    console.log("🤖 Appel OpenAI Whisper...")
    let transcriptionResponse
    try {
      transcriptionResponse = await openai.audio.transcriptions.create(whisperConfig)
      console.log("✅ Transcription Whisper réussie")
    } catch (openaiError: any) {
      console.error('❌ Erreur Whisper:', openaiError)
      
      // Tentative de fallback sans langue spécifique
      if (whisperConfig.language) {
        console.log("🔄 Tentative fallback sans langue spécifique...")
        delete whisperConfig.language
        try {
          transcriptionResponse = await openai.audio.transcriptions.create(whisperConfig)
          console.log("✅ Fallback réussi")
        } catch (fallbackError: any) {
          throw new Error(`Erreur Whisper (fallback aussi): ${fallbackError.message}`)
        }
      } else {
        throw new Error(`Erreur Whisper: ${openaiError.message}`)
      }
    }

    const transcriptionText = transcriptionResponse.text?.trim()
    const detectedLanguage = transcriptionResponse.language || preferredLanguage || 'fr'

    if (!transcriptionText) {
      throw new Error('Transcription vide reçue de Whisper')
    }

    console.log(`✅ Transcription réussie: ${transcriptionText.length} caractères, langue: ${detectedLanguage}`)

    // ✅ PRÉPARATION DES DONNÉES DE TRANSCRIPTION
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

    // ✅ SAUVEGARDE DE LA TRANSCRIPTION
    console.log("💾 Sauvegarde transcription en base...")
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
      console.error('❌ Erreur sauvegarde transcription:', updateError)
      throw new Error(`Erreur sauvegarde transcription: ${updateError.message}`)
    }

    console.log("✅ Transcription sauvegardée avec succès")

    // ✅ DÉCLENCHEMENT DE L'ANALYSE
    console.log("🚀 Déclenchement analyse transcription...")
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
        // On ne throw pas ici pour ne pas faire échouer toute la transcription
      } else {
        console.log('✅ Analyse déclenchée avec succès')
      }
    } catch (analyzeError: any) {
      console.warn('⚠️ Erreur lors du déclenchement de l\'analyse:', analyzeError)
      // On continue malgré l'erreur d'analyse
    }

    // ✅ RÉPONSE DE SUCCÈS
    const successResponse = {
      success: true,
      message: 'Transcription terminée avec succès',
      transcriptionLength: transcriptionText.length,
      language: detectedLanguage,
      languageName: SUPPORTED_LANGUAGES[detectedLanguage]?.name || 'Inconnue',
      videoId: videoId
    }

    console.log("🎉 Transcription complètement terminée avec succès")
    return new Response(
      JSON.stringify(successResponse),
      {
        status: 200,
        headers: corsHeaders
      }
    )

  } catch (error: any) {
    console.error('💥 ERREUR CRITIQUE transcription:', error)
    
    // ✅ SAUVEGARDE DE L'ERREUR EN BASE
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
          console.log("✅ Erreur sauvegardée en base")
        }
      } catch (updateError) {
        console.error('❌ Erreur sauvegarde statut erreur:', updateError)
      }
    }

    // ✅ RÉPONSE D'ERREUR DÉTAILLÉE
    const errorResponse = {
      error: 'Erreur lors de la transcription',
      details: error.message,
      videoId: videoId,
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: corsHeaders
      }
    )
  }
})
