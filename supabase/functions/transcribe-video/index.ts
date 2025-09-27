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
} as const

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

  let videoId: string | null = null

  try {
    console.log('Fonction transcribe-video appelée')

    // Initialiser les variables d'environnement
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

    // RÉCUPÉRER LES DONNÉES DE LA REQUÊTE
    let videoUrl: string | null = null
    
    if (req.method === 'POST') {
      try {
        const requestBody = await req.text()
        console.log('Corps de la requête reçu:', requestBody)
        
        if (requestBody.trim()) {
          const requestData = JSON.parse(requestBody)
          videoId = requestData.videoId
          videoUrl = requestData.videoUrl
          console.log(`VideoId: ${videoId}, VideoUrl: ${videoUrl?.substring(0, 100)}`)
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

    // VÉRIFIER L'ACCÈS À LA VIDÉO
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

    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}`)

    // MISE À JOUR DU STATUT => processing
    await serviceClient
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.PROCESSING, 
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId)

    // RÉCUPÉRER L'URL DE LA VIDÉO
    if (!videoUrl) {
      videoUrl = video.public_url || video.url
    }

    // CORRECTION : Vérifier que l'URL est valide et complète
    if (!videoUrl || !videoUrl.startsWith('http')) {
      console.log('URL non valide, génération d\'une URL signée...')
      
      if (!video.storage_path && !video.file_path) {
        throw new Error('Chemin de stockage manquant pour générer l\'URL')
      }
      
      const storagePath = video.storage_path || video.file_path
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from('videos')
        .createSignedUrl(storagePath, 60 * 60)

      if (signedUrlError) {
        console.error('Erreur génération URL signée:', signedUrlError)
        throw new Error(`Impossible de générer l'URL: ${signedUrlError.message}`)
      }
      
      videoUrl = signedUrlData.signedUrl
      console.log('Nouvelle URL signée générée')
    }

    // Validation finale de l'URL
    if (!videoUrl.startsWith('http')) {
      throw new Error(`URL invalide: ${videoUrl}`)
    }

    console.log('Téléchargement de la vidéo...')
    
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
      ? transcription.segments.reduce((sum: number, segment: any) => sum + (segment.confidence || 0), 0) / transcription.segments.length 
      : null

    console.log('Transcription terminée, enregistrement...')

    // CORRECTION : Préparer les données de transcription de manière sécurisée
    const transcriptionData = {
      text: transcription.text,
      segments: transcription.segments || [],
      language: transcription.language || 'fr',
      duration: transcription.duration || 0,
      confidence_score: confidenceScore
    }

    // CORRECTION : Mise à jour sécurisée de la table videos
    const videoUpdateData: any = {
      transcription_text: transcription.text,
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    }

    // Ajouter les champs JSONB de manière sécurisée
    try {
      videoUpdateData.transcription_data = transcriptionData
    } catch (e) {
      console.warn('Erreur préparation transcription_data, utilisation texte simple')
    }

    try {
      videoUpdateData.transcript = { text: transcription.text }
    } catch (e) {
      console.warn('Erreur préparation transcript, utilisation texte simple')
    }

    try {
      videoUpdateData.transcription = { text: transcription.text, segments: transcription.segments?.slice(0, 10) || [] }
    } catch (e) {
      console.warn('Erreur préparation transcription, utilisation texte simple')
    }

    // Ajouter le score de confiance si disponible
    if (confidenceScore !== null) {
      videoUpdateData.performance_score = parseFloat(confidenceScore.toFixed(2))
      videoUpdateData.engagement_score = parseFloat(confidenceScore.toFixed(2))
    }

    // Mise à jour de la vidéo
    const { error: videoUpdateError } = await serviceClient
      .from('videos')
      .update(videoUpdateData)
      .eq('id', videoId)

    if (videoUpdateError) {
      console.error('Erreur mise à jour vidéo:', videoUpdateError)
      // Tentative de mise à jour simplifiée
      await serviceClient
        .from('videos')
        .update({
          transcription_text: transcription.text,
          status: VIDEO_STATUS.TRANSCRIBED,
          updated_at: new Date().toISOString(),
          error_message: videoUpdateError.message
        })
        .eq('id', videoId)
      throw new Error(`Erreur mise à jour vidéo: ${videoUpdateError.message}`)
    }

    // CORRECTION : Mise à jour sécurisée de la table transcriptions
    const transcriptionRecord: any = {
      video_id: videoId,
      user_id: video.user_id,
      language: transcription.language || 'fr',
      full_text: transcription.text,
      transcription_text: transcription.text,
      status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    }

    // Ajouter les champs JSONB de manière conditionnelle et sécurisée
    if (transcription.segments) {
      transcriptionRecord.segments = transcription.segments.slice(0, 100) // Limiter pour éviter les erreurs
    }

    if (confidenceScore !== null) {
      transcriptionRecord.confidence_score = parseFloat(confidenceScore.toFixed(2))
    }

    if (transcription.duration) {
      transcriptionRecord.duration = parseFloat(transcription.duration.toFixed(2))
    }

    try {
      transcriptionRecord.transcription_data = transcriptionData
    } catch (e) {
      console.warn('Erreur préparation transcription_data pour transcriptions table')
    }

    // Insertion dans transcriptions
    const { error: transcriptionError } = await serviceClient
      .from('transcriptions')
      .upsert(transcriptionRecord, { onConflict: 'video_id' })

    if (transcriptionError) {
      console.error('Erreur insertion transcription:', transcriptionError)
      // Ne pas échouer complètement, juste logger
    }

    console.log('Transcription enregistrée avec succès')

    // CORRECTION : Appel sécurisé à la fonction d'analyse
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`
      
      // Utiliser la clé de service correctement formatée
      const analyzeResponse = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ 
          videoId: videoId,
          // Ne pas inclure d'autres données potentiellement problématiques
        })
      })

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text()
        console.warn(`Erreur fonction analyse (${analyzeResponse.status}): ${errorText}`)
        // Ne pas throw, continuer
      } else {
        console.log('Analyse déclenchée avec succès')
      }
    } catch (invokeError) {
      console.warn("Erreur invocation analyse, continuation sans analyse:", invokeError.message)
      // Ne pas bloquer le processus principal
    }

    return new Response(
      JSON.stringify({
        message: 'Transcription terminée avec succès',
        videoId,
        transcription_length: transcription.text.length,
        confidence_score: confidenceScore
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Erreur générale:', error)
    
    // Mettre à jour le statut d'erreur
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
              error_message: error.message,
              transcription_error: error.message,
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
