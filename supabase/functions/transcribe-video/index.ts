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
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { videoId } = await req.json()
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { data: video, error: videoError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      console.error(`Erreur vidéo ${videoId}:`, videoError)
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    await supabaseClient
      .from('videos')
      .update({ status: 'processing' })
      .eq('id', videoId)

    console.log(`Début transcription vidéo ${videoId}`)

    try {
      let videoUrl = video.url

      if (!videoUrl.startsWith('http')) {
        const { data: signedUrl, error: signedUrlError } = await supabaseClient
          .storage
          .from('videos')
          .createSignedUrl(videoUrl, 3600)

        if (signedUrlError || !signedUrl?.signedUrl) {
          throw new Error('Impossible de générer l'URL signée')
        }

        videoUrl = signedUrl.signedUrl
      }

      const videoRes = await fetch(videoUrl)
      if (!videoRes.ok) {
        throw new Error(`Erreur téléchargement vidéo : ${videoRes.statusText}`)
      }

      const videoFile = new File(
        [await videoRes.arrayBuffer()],
        "video.mp4",
        { type: "video/mp4" }
      )

      const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') || '' })

      const transcription = await openai.audio.transcriptions.create({
        file: videoFile,
        model: 'whisper-1',
        language: 'fr',
      })

      const transcript = transcription.text

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant qui analyse des transcriptions de vidéos. Résume les points clés en 3-5 puces.'
          },
          {
            role: 'user',
            content: `Voici la transcription d'une vidéo. Analyse-la et résume les points clés:\n\n${transcript}`
          }
        ],
      })

      const aiResult = completion.choices[0].message.content

      const { error: updateError } = await supabaseClient
        .from('videos')
        .update({
          status: 'done',
          transcript,
          ai_result: aiResult,
          processed_at: new Date().toISOString()
        })
        .eq('id', videoId)

      if (updateError) {
        throw new Error(`Erreur update: ${updateError.message}`)
      }

      console.log(`Vidéo ${videoId} traitée.`)

      return new Response(
        JSON.stringify({ success: true, message: 'Transcription terminée', videoId, status: 'done' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )

    } catch (error) {
      console.error(`Erreur traitement vidéo ${videoId}:`, error)

      await supabaseClient
        .from('videos')
        .update({ status: 'error', error_message: `Erreur: ${error.message}` })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ error: 'Erreur traitement', details: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

  } catch (error) {
    console.error('Erreur générale:', error)

    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
