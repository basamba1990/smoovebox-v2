import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  let video_id: string;
  
  try {
    // 1. Récupération et validation des données
    const { video_id: requestVideoId } = await req.json()
    if (!requestVideoId) {
      return new Response(JSON.stringify({ error: 'video_id requis' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }
    video_id = requestVideoId

    // 2. Récupération du chemin de la vidéo
    const { data: videoData, error: fetchError } = await supabase
      .from('videos')
      .select('path')
      .eq('id', video_id)
      .single()

    if (fetchError || !videoData) throw new Error('Vidéo introuvable en base')
    
    // 3. Construction de l'URL publique
    const projectRef = new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0]
    const videoUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/${videoData.path}`

    // 4. Téléchargement de la vidéo
    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) throw new Error('Échec du téléchargement vidéo')
    const videoBlob = await videoResponse.blob()

    // 5. Transcription avec Whisper
    const formData = new FormData()
    formData.append('file', videoBlob, 'video.mp4')
    formData.append('model', 'whisper-1')
    
    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
        },
        body: formData
      }
    )

    if (!whisperResponse.ok) {
      const error = await whisperResponse.json()
      throw new Error(`Erreur OpenAI: ${error.error?.message || 'Erreur inconnue'}`)
    }

    const { text } = await whisperResponse.json()

    // 6. Mise à jour de la base de données
    const { error: dbError } = await supabase
      .from('videos')
      .update({
        transcription: text,
        processed_at: new Date().toISOString(),
        status: 'COMPLETED'
      })
      .eq('id', video_id)

    if (dbError) throw new Error(`Erreur DB: ${dbError.message}`)

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    // 7. Gestion des erreurs avec protection video_id
    if (video_id!) {
      await supabase
        .from('videos')
        .update({
          status: 'FAILED',
          error: error.message.substring(0, 1000) // Truncation pour le champ texte
        })
        .eq('id', video_id)
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      video_id: video_id! || 'inconnu'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
