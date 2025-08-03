// transcribe-video.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VideoData {
  id: string
  title: string
  url: string
  status: string
  transcript?: string
  ai_result?: string
  error_message?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Récupérer les données de la requête
    const { videoId } = await req.json()
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Récupérer les informations de la vidéo
    const { data: video, error: videoError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}:`, videoError)
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    // Mettre à jour le statut de la vidéo à "processing"
    await supabaseClient
      .from('videos')
      .update({ status: 'processing' })
      .eq('id', videoId)

    console.log(`Vidéo ${videoId} - Début de la transcription`)

    try {
      // Récupérer l'URL de la vidéo depuis le stockage si nécessaire
      let videoUrl = video.url
      if (!videoUrl.startsWith('http')) {
        const { data: signedUrl } = await supabaseClient
          .storage
          .from('videos')
          .createSignedUrl(videoUrl, 3600)
        
        videoUrl = signedUrl?.signedUrl || ''
      }

      // Initialiser OpenAI
      const openai = new OpenAI({
        apiKey: Deno.env.get('OPENAI_API_KEY') || '',
      })

      // Transcription de la vidéo avec Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: await fetch(videoUrl).then(res => res.blob()),
        model: 'whisper-1',
        language: 'fr',
      })

      const transcript = transcription.text

      // Analyse du contenu avec GPT
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant qui analyse des transcriptions de vidéos. Résume les points clés en 3-5 puces.'
          },
          {
            role: 'user',
            content: `Voici la transcription d'une vidéo. Analyse-la et résume les points clés en 3-5 puces:\n\n${transcript}`
          }
        ],
      })

      const aiResult = completion.choices[0].message.content

      // IMPORTANT: Mettre à jour la base de données avec les résultats
      const { error: updateError } = await supabaseClient
        .from('videos')
        .update({
          status: 'done',
          transcript: transcript,
          ai_result: aiResult,
          processed_at: new Date().toISOString()
        })
        .eq('id', videoId)

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour des résultats: ${updateError.message}`)
      }

      console.log(`Vidéo ${videoId} traitée avec succès`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Transcription terminée',
          videoId,
          status: 'done'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )

    } catch (error) {
      console.error(`Erreur lors du traitement de la vidéo ${videoId}:`, error)
      
      // Mettre à jour le statut de la vidéo à "error"
      await supabaseClient
        .from('videos')
        .update({ 
          status: 'error',
          error_message: `Erreur de traitement: ${error.message}`
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors du traitement de la vidéo',
          details: error.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

  } catch (error) {
    console.error('Erreur générale:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
