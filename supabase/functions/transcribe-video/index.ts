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
} as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null

  try {
    console.log('Fonction transcribe-video appelée')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes')
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Récupération des données
    let videoUrl: string | null = null
    
    if (req.method === 'POST') {
      try {
        const requestBody = await req.text()
        console.log('Corps de la requête reçu:', requestBody)
        
        if (requestBody.trim()) {
          const requestData = JSON.parse(requestBody)
          videoId = requestData.videoId
          videoUrl = requestData.videoUrl
          console.log(`VideoId: ${videoId}`)
        }
      } catch (parseError) {
        console.error("Erreur lors de l'analyse du JSON de la requête:", parseError)
        return new Response(
          JSON.stringify({ error: 'Format de requête invalide' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Vérifier l'accès à la vidéo
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError)
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Mise à jour du statut
    await serviceClient
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.PROCESSING, 
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    // Récupérer l'URL de la vidéo
    if (!videoUrl) {
      videoUrl = video.public_url || video.url
    }

    if (!videoUrl || !videoUrl.startsWith('http')) {
      if (!video.storage_path && !video.file_path) {
        throw new Error('Chemin de stockage manquant pour générer l\'URL')
      }
      
      const storagePath = video.storage_path || video.file_path
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from('videos')
        .createSignedUrl(storagePath, 60 * 60)

      if (signedUrlError) {
        throw new Error(`Impossible de générer l'URL: ${signedUrlError.message}`)
      }
      
      videoUrl = signedUrlData.signedUrl
    }

    // Télécharger et transcrire la vidéo
    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`Échec téléchargement: ${response.status}`)
    }
    
    const audioBlob = await response.blob()
    if (audioBlob.size === 0) {
      throw new Error('Fichier vidéo vide')
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })
    const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'fr',
      response_format: 'verbose_json'
    })

    // Enregistrer la transcription
    const videoUpdateData = {
      transcription_text: transcription.text,
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    }

    const { error: updateError } = await serviceClient
      .from('videos')
      .update(videoUpdateData)
      .eq('id', videoId)

    if (updateError) {
      throw new Error(`Erreur mise à jour vidéo: ${updateError.message}`)
    }

    // CORRECTION CRITIQUE : Appel avec x-supabase-service-role au lieu de Authorization
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`
      
      console.log('Appel de la fonction analyse-transcription...')
      
      const analyzeResponse = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-service-role': supabaseServiceKey  // CORRECTION ICI
        },
        body: JSON.stringify({ 
          videoId: videoId
        })
      })

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text()
        console.warn(`Erreur fonction analyse (${analyzeResponse.status}): ${errorText}`)
      } else {
        console.log('Analyse déclenchée avec succès')
      }
    } catch (invokeError) {
      console.warn("Erreur invocation analyse, continuation sans analyse:", invokeError.message)
    }

    return new Response(
      JSON.stringify({
        message: 'Transcription terminée avec succès',
        videoId,
        transcription_length: transcription.text.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Erreur générale:', error)
    
    if (videoId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        
        if (supabaseUrl && supabaseServiceKey) {
          const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
          await serviceClient
            .from('videos')
            .update({ 
              status: VIDEO_STATUS.FAILED, 
              error_message: error.message.substring(0, 500),
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId)
        }
      } catch (updateError) {
        console.error('Erreur mise à jour statut:', updateError)
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur de transcription', 
        details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
