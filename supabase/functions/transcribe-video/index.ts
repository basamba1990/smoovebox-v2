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
  FAILED: 'failed' 
}

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 
  'Access-Control-Allow-Methods': 'POST, OPTIONS' 
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId = null

  try {
    console.log('Fonction transcribe-video appelée')

    const { videoId: vidId, userId, videoUrl } = await req.json()
    videoId = vidId

    if (!videoId || !userId || !videoUrl) {
      throw new Error('Paramètres manquants: videoId, userId, videoUrl requis')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuration Supabase manquante')
    }
    if (!openaiApiKey) {
      throw new Error('Clé API OpenAI manquante')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // Mettre à jour le statut de la vidéo
    await supabase
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    console.log('Début de la transcription pour la vidéo:', videoId)

    // Transcrire l'audio avec OpenAI Whisper
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: await fetch(videoUrl).then(r => r.blob()),
      model: 'whisper-1',
      language: 'fr',
      response_format: 'verbose_json'
    })

    const transcriptionText = transcriptionResponse.text
    const transcriptionData = {
      text: transcriptionText,
      language: transcriptionResponse.language,
      duration: transcriptionResponse.duration,
      words: transcriptionResponse.words || []
    }

    console.log('Transcription réussie, longueur:', transcriptionText.length)

    // Mettre à jour la vidéo avec la transcription
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        status: VIDEO_STATUS.TRANSCRIBED,
        transcription_text: transcriptionText,
        transcription_data: transcriptionData,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (updateError) {
      throw new Error(`Erreur mise à jour transcription: ${updateError.message}`)
    }

    // Déclencher l'analyse de la transcription
    try {
      const analyzeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          transcriptionText,
          userId
        })
      })

      if (!analyzeResponse.ok) {
        console.warn('Erreur déclenchement analyse:', await analyzeResponse.text())
      } else {
        console.log('Analyse déclenchée avec succès')
      }
    } catch (analyzeError) {
      console.warn('Erreur lors du déclenchement de l\'analyse:', analyzeError)
      // Continuer même si l'analyse échoue
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription terminée avec succès',
        transcriptionLength: transcriptionText.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erreur transcription:', error)

    // Mettre à jour le statut d'erreur si videoId est disponible
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
              error_message: error.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId)
        }
      } catch (updateError) {
        console.error('Erreur mise à jour statut erreur:', updateError)
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de la transcription', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
