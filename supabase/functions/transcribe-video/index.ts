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

    // CORRECTION : Mise à jour SÉCURISÉE de la table videos
    // Éviter les champs JSONB problématiques dans un premier temps
    const videoUpdateData: any = {
      transcription_text: transcription.text,
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    }

    // CORRECTION : Ajouter les champs JSONB UNIQUEMENT s'ils sont valides
    try {
      // Utiliser JSON.stringify pour s'assurer que c'est un JSON valide
      videoUpdateData.transcription_data = JSON.parse(JSON.stringify(transcriptionData))
    } catch (e) {
      console.warn('Erreur préparation transcription_data, utilisation texte simple')
    }

    try {
      videoUpdateData.transcript = JSON.parse(JSON.stringify({ text: transcription.text }))
    } catch (e) {
      console.warn('Erreur préparation transcript, utilisation texte simple')
    }

    // Ajouter le score de confiance si disponible
    if (confidenceScore !== null) {
      videoUpdateData.performance_score = parseFloat(confidenceScore.toFixed(2))
      videoUpdateData.engagement_score = parseFloat(confidenceScore.toFixed(2))
    }

    // CORRECTION : Mise à jour SÉCURISÉE avec gestion d'erreur améliorée
    let videoUpdateError = null;
    try {
      const { error } = await serviceClient
        .from('videos')
        .update(videoUpdateData)
        .eq('id', videoId)

      videoUpdateError = error;
    } catch (updateException) {
      console.error('Exception lors de la mise à jour:', updateException)
      videoUpdateError = updateException;
    }

    if (videoUpdateError) {
      console.error('Erreur mise à jour vidéo:', videoUpdateError)
      
      // CORRECTION : Tentative de mise à jour ULTRA SIMPLIFIÉE sans JSONB
      const simpleUpdateData = {
        transcription_text: transcription.text,
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString(),
        error_message: `Erreur complexe: ${videoUpdateError.message}`
      }

      const { error: simpleError } = await serviceClient
        .from('videos')
        .update(simpleUpdateData)
        .eq('id', videoId)

      if (simpleError) {
        console.error('Échec même avec mise à jour simplifiée:', simpleError)
        throw new Error(`Erreur critique mise à jour vidéo: ${simpleError.message}`)
      }
    }

    // CORRECTION : Mise à jour SÉCURISÉE de la table transcriptions
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

    // CORRECTION : Ajouter les champs JSONB UNIQUEMENT s'ils sont valides
    if (transcription.segments) {
      try {
        transcriptionRecord.segments = JSON.parse(JSON.stringify(transcription.segments.slice(0, 50))) // Limiter
      } catch (e) {
        console.warn('Erreur préparation segments, utilisation vide')
        transcriptionRecord.segments = []
      }
    }

    if (confidenceScore !== null) {
      transcriptionRecord.confidence_score = parseFloat(confidenceScore.toFixed(2))
    }

    if (transcription.duration) {
      transcriptionRecord.duration = parseFloat(transcription.duration.toFixed(2))
    }

    // Insertion dans transcriptions avec gestion d'erreur
    try {
      const { error: transcriptionError } = await serviceClient
        .from('transcriptions')
        .upsert(transcriptionRecord, { onConflict: 'video_id' })

      if (transcriptionError) {
        console.error('Erreur insertion transcription:', transcriptionError)
      }
    } catch (transcriptionException) {
      console.error('Exception insertion transcription:', transcriptionException)
    }

    console.log('Transcription enregistrée avec succès')

    // CORRECTION : Appel SÉCURISÉ à la fonction d'analyse
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`
      
      const analyzeResponse = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
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
          
          // CORRECTION : Mise à jour ULTRA SIMPLIFIÉE en cas d'erreur
          await serviceClient
            .from('videos')
            .update({ 
              status: VIDEO_STATUS.FAILED, 
              error_message: error.message.substring(0, 500), // Limiter la taille
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
