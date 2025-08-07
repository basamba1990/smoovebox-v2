import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Token d\'authentification manquant')
    }

    // Initialiser Supabase avec les variables d'environnement sécurisées
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Vérifier le token utilisateur
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Token d\'authentification invalide')
    }

    // Récupérer les données de la requête
    const { video_id } = await req.json()
    
    if (!video_id) {
      throw new Error('ID de vidéo requis')
    }

    // Vérifier que la vidéo appartient à l'utilisateur
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', video_id)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      throw new Error('Vidéo non trouvée ou accès non autorisé')
    }

    // Vérifier que la vidéo a un fichier
    if (!video.file_path) {
      throw new Error('Aucun fichier vidéo trouvé')
    }

    // Initialiser OpenAI avec la clé sécurisée
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('Clé OpenAI non configurée')
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    })

    // Mettre à jour le statut de la vidéo
    await supabase
      .from('videos')
      .update({ 
        status: 'transcribing',
        updated_at: new Date().toISOString()
      })
      .eq('id', video_id)

    try {
      // Obtenir l'URL signée du fichier vidéo
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(video.file_path, 3600) // 1 heure

      if (urlError || !signedUrlData?.signedUrl) {
        throw new Error('Impossible d\'accéder au fichier vidéo')
      }

      // Télécharger le fichier vidéo
      const videoResponse = await fetch(signedUrlData.signedUrl)
      if (!videoResponse.ok) {
        throw new Error('Erreur lors du téléchargement de la vidéo')
      }

      const videoBlob = await videoResponse.blob()
      const videoFile = new File([videoBlob], `video_${video_id}.mp4`, { type: 'video/mp4' })

      // Transcrire avec OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: videoFile,
        model: 'whisper-1',
        language: 'fr', // Français par défaut
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      })

      // Sauvegarder la transcription
      const { error: transcriptionError } = await supabase
        .from('transcriptions')
        .insert({
          video_id: video_id,
          user_id: user.id,
          content: transcription.text,
          segments: transcription.segments || [],
          words: transcription.words || [],
          language: transcription.language || 'fr',
          duration: transcription.duration || 0,
          confidence_score: 0.95, // Score par défaut pour Whisper
          created_at: new Date().toISOString()
        })

      if (transcriptionError) {
        console.error('Erreur lors de la sauvegarde de la transcription:', transcriptionError)
        throw new Error('Erreur lors de la sauvegarde de la transcription')
      }

      // Mettre à jour le statut de la vidéo
      await supabase
        .from('videos')
        .update({ 
          status: 'transcribed',
          updated_at: new Date().toISOString()
        })
        .eq('id', video_id)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Transcription terminée avec succès',
          transcription: {
            text: transcription.text,
            language: transcription.language,
            duration: transcription.duration
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )

    } catch (transcriptionError) {
      console.error('Erreur lors de la transcription:', transcriptionError)
      
      // Mettre à jour le statut d'erreur
      await supabase
        .from('videos')
        .update({ 
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', video_id)

      throw transcriptionError
    }

  } catch (error) {
    console.error('Erreur dans transcribe-video-secure:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur interne du serveur'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

