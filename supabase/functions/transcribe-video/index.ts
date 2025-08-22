import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Valeurs exactes autorisées pour le statut dans la base de données
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DRAFT: 'draft',
  READY: 'ready'
} as const

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Fonction transcribe-video appelée')

    // Initialiser les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey
      })

      return new Response(
        JSON.stringify({
          error: 'Configuration incomplète',
          details: "Variables d'environnement manquantes"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Initialiser OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // Créer un client Supabase avec la clé de service
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // MÉTHODES D'AUTHENTIFICATION
    let userId: string | null = null
    const userAgent = req.headers.get('user-agent') || ''
    const isWhatsApp = userAgent.includes('WhatsApp')

    // Pour WhatsApp ou requêtes GET, bypasser l'authentification
    if (isWhatsApp || req.method === 'GET') {
      const url = new URL(req.url)
      userId = url.searchParams.get('userId') || 'whatsapp-user'
      console.log(`Utilisateur WhatsApp/GET détecté: ${userId}`)
    } else {
      // ... [le reste du code d'authentification reste identique] ...
    }

    // RÉCUPÉRATION DU videoId
    let videoId: string | null = null
    if (req.method === 'GET' || isWhatsApp) {
      const url = new URL(req.url)
      videoId = url.searchParams.get('videoId')
      if (!videoId) {
        return new Response(
          JSON.stringify({ error: 'videoId est requis en paramètre pour les requêtes GET' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    } else {
      try {
        const requestData = await req.json()
        videoId = requestData.videoId
      } catch {
        const url = new URL(req.url)
        videoId = url.searchParams.get('videoId')
      }

      if (!videoId) {
        return new Response(
          JSON.stringify({ error: 'videoId est requis' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // VÉRIFICATION DE LA VIDÉO
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // MISE À JOUR DU STATUT
    await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    // RÉCUPÉRATION DE L'URL
    let videoUrl = video.url
    if (!videoUrl && video.storage_path) {
      const { data: signedUrl } = await serviceClient.storage
        .from('videos')
        .createSignedUrl(video.storage_path, 3600)
      videoUrl = signedUrl?.signedUrl || null
    }

    if (!videoUrl) {
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: 'URL non disponible'
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ error: 'URL de vidéo non disponible' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // RÉPONSE IMMÉDIATE
    const response = new Response(
      JSON.stringify({ success: true, message: 'Transcription démarrée' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    // TRAITEMENT EN ARRIÈRE-PLAN
    EdgeRuntime.waitUntil((async () => {
      try {
        // Téléchargement et transcription
        const audioResponse = await fetch(videoUrl!)
        const audioBlob = await audioResponse.blob()
        const audioFile = new File([audioBlob], `video_${videoId}.mp4`)

        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          language: "fr",
          response_format: "verbose_json"
        })

        // MISE À JOUR DE LA BASE DE DONNÉES
        await serviceClient
          .from('videos')
          .update({
            transcription_text: transcription.text,
            transcription_data: transcription,
            status: VIDEO_STATUS.TRANSCRIBED,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)

        // CORRECTION APPLIQUÉE ICI : Utilisation de VIDEO_STATUS.TRANSCRIBED au lieu de 'completed'
        await serviceClient
          .from('transcriptions')
          .upsert({
            video_id: videoId,
            full_text: transcription.text,
            segments: transcription.segments,
            transcription_data: transcription,
            status: VIDEO_STATUS.TRANSCRIBED, // ← Statut corrigé
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'video_id' })

        // DÉCLENCHEMENT DE L'ANALYSE
        await fetch(`${supabaseUrl}/functions/v1/analyze-transcription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ videoId })
        })

      } catch (error) {
        await serviceClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
      }
    })())

    return response

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
