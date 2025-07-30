import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  try {
    const { video_id, video_url, user_id } = await req.json()
    
    // 1. Télécharger la vidéo
    const videoResponse = await fetch(video_url)
    if (!videoResponse.ok) throw new Error('Échec téléchargement vidéo')
    const videoBlob = await videoResponse.blob()
    
    // 2. Transcrire avec OpenAI
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
      throw new Error(`OpenAI: ${error.error?.message || 'Erreur inconnue'}`)
    }
    
    const { text } = await whisperResponse.json()
    
    // 3. Mettre à jour la base de données
    const { error: dbError } = await supabase
      .from('videos')
      .update({
        transcription: text,
        processed_at: new Date().toISOString(),
        status: 'COMPLETED'
      })
      .eq('id', video_id)
    
    if (dbError) throw new Error(`DB: ${dbError.message}`)
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    })
    
  } catch (error) {
    // Mettre à jour le statut en erreur
    await supabase
      .from('videos')
      .update({ status: 'FAILED', error: error.message })
      .eq('id', video_id)

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
