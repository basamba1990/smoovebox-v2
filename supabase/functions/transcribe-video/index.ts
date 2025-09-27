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

    // Récupérer les données de la requête
    let videoUrl: string | null = null
    if (req.method === 'POST') {
      try {
        const requestBody = await req.text()
        console.log('Corps de la requête:', requestBody)
        
        if (requestBody.trim()) {
          const requestData = JSON.parse(requestBody)
          videoId = requestData.videoId
          videoUrl = requestData.videoUrl
          console.log(`VideoId: ${videoId}, VideoUrl: ${videoUrl}`)
        }
      } catch (parseError) {
        console.error('Erreur parsing JSON:', parseError)
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

    // Récupérer la vidéo depuis la base
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      console.error('Erreur récupération vidéo:', videoError)
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Mettre à jour le statut
    await serviceClient
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.PROCESSING, 
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId)

    // CORRECTION : Vérifier et utiliser l'URL
    if (!videoUrl) {
      videoUrl = video.public_url
    }

    // Si l'URL n'est pas valide, générer une nouvelle URL signée
    if (!videoUrl || !videoUrl.startsWith('http')) {
      console.log('Génération d\'une nouvelle URL signée...')
      if (!video.storage_path) {
        throw new Error('Storage path manquant pour générer l\'URL')
      }
      
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from('videos')
        .createSignedUrl(video.storage_path, 60 * 60)
      
      if (signedUrlError) {
        console.error('Erreur génération URL signée:', signedUrlError)
        throw new Error(`Impossible de générer l'URL: ${signedUrlError.message}`)
      }
      
      videoUrl = signedUrlData.signedUrl
      console.log('Nouvelle URL signée générée:', videoUrl.substring(0, 100))
    }

    // Vérifier que l'URL est valide
    if (!videoUrl.startsWith('http')) {
      throw new Error(`URL invalide: ${videoUrl}`)
    }

    console.log('Téléchargement de la vidéo depuis:', videoUrl.substring(0, 100))
    
    // Télécharger la vidéo
    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`Échec téléchargement: ${response.status} ${response.statusText}`)
    }
    
    const audioBlob = await response.blob()
    console.log('Téléchargement réussi, taille:', audioBlob.size)

    if (audioBlob.size === 0) {
      throw new Error('Fichier vidéo vide')
    }

    // Transcription avec OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey })
    const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'fr',
      response_format: 'verbose_json'
    })

    // Calcul score de confiance
    const confidenceScore = transcription.segments && transcription.segments.length > 0 
      ? transcription.segments.reduce((sum, segment) => sum + (segment.confidence || 0), 0) / transcription.segments.length 
      : null

    // Enregistrement transcription
    const transcriptionData = {
      text: transcription.text,
      segments: transcription.segments,
      language: transcription.language,
      duration: transcription.duration,
      confidence_score: confidenceScore
    }

    await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId,
        full_text: transcription.text,
        segments: transcription.segments,
        transcription_data: transcriptionData,
        confidence_score: confidenceScore,
        language: transcription.language,
        duration: transcription.duration,
        status: 'completed',
        updated_at: new Date().toISOString()
      }, { onConflict: 'video_id' })

    // Mettre à jour la vidéo
    await serviceClient
      .from('videos')
      .update({
        transcription_text: transcription.text,
        transcription_data: transcriptionData,
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    console.log('Transcription terminée avec succès')

    return new Response(
      JSON.stringify({
        message: 'Transcription terminée',
        videoId,
        transcription_length: transcription.text.length,
        confidence_score: confidenceScore
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Erreur générale:', error)
    
    if (videoId) {
      try {
        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        )
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
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
