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

// Timeout global pour l'exécution de la fonction
const EXECUTION_TIMEOUT = 300000; // 5 minutes

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
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

    // CORRECTION : Vérifier si les clés sont des placeholders
    if (supabaseServiceKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
      console.error('Clé de service Supabase non configurée correctement (placeholder détecté)')
      return new Response(
        JSON.stringify({ 
          error: 'Configuration incomplète', 
          details: "Clé de service Supabase manquante ou placeholder" 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey
      })
      return new Response(
        JSON.stringify({ 
          error: 'Configuration incomplète', 
          details: "Variables d'environnement manquantes" 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    // Créer un client Supabase avec timeout configuré
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
        }
      }
    })

    // Helper pour confirmer la mise à jour de la base de données
    async function confirmDatabaseUpdate(
      client: ReturnType<typeof createClient>,
      videoId: string,
      attempts = 0,
      maxAttempts = 3
    ): Promise<boolean> {
      if (attempts >= maxAttempts) {
        console.error(`Échec de confirmation de la mise à jour après ${maxAttempts} tentatives`)
        return false
      }
      
      try {
        // Attendre 2 secondes avant de vérifier
        await new Promise((resolve) => setTimeout(resolve, 2000))
        
        // Vérifier simplement si la transcription existe
        const { data: transcription, error: transcriptionError } = await client
          .from('transcriptions')
          .select('id')
          .eq('video_id', videoId)
          .single()

        if (transcriptionError) {
          console.log('Transcription pas encore disponible, nouvelle tentative...')
          return await confirmDatabaseUpdate(client, videoId, attempts + 1, maxAttempts)
        }

        console.log(`Transcription confirmée pour la vidéo ${videoId}`)
        return true
      } catch (err) {
        console.error('Erreur lors de la confirmation de mise à jour:', err)
        return await confirmDatabaseUpdate(client, videoId, attempts + 1, maxAttempts)
      }
    }

    // RÉCUPÉRER LES DONNÉES DE LA REQUÊTE
    let videoUrl: string | null = null
    
    // Essayer d'abord le corps de la requête
    if (req.method === 'POST') {
      try {
        const requestBody = await req.text()
        console.log('Corps de la requête reçu:', requestBody)
        
        if (requestBody.trim()) {
          const requestData = JSON.parse(requestBody)
          console.log('Données de requête parsées:', requestData)
          
          if (requestData.videoId) {
            videoId = requestData.videoId
            console.log(`VideoId récupéré du corps de la requête: ${videoId}`)
          }
          
          if (requestData.videoUrl) {
            videoUrl = requestData.videoUrl
            console.log(`VideoUrl récupéré du corps de la requête (tronqué): ${videoUrl.substring(0, 50)}...`)
          }
        }
      } catch (parseError) {
        console.error("Erreur lors de l'analyse du JSON de la requête:", parseError)
        return new Response(
          JSON.stringify({ 
            error: 'Format de requête invalide', 
            details: 'Le corps de la requête doit être un JSON valide' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 400 
          }
        )
      }
    }

    // Vérification finale du videoId
    if (!videoId) {
      console.error('VideoId non trouvé dans le corps de la requête')
      return new Response(
        JSON.stringify({ 
          error: 'videoId est requis dans le corps de la requête',
          details: 'Veuillez fournir videoId dans le corps JSON de la requête' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    // VÉRIFIER L'ACCÈS À LA VIDÉO
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError)
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la récupération de la vidéo', 
          details: videoError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: (videoError as any).code === 'PGRST116' ? 404 : 500 
        }
      )
    }

    if (!video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 404 
        }
      )
    }

    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}, chemin: ${video.storage_path}`)
    console.log(`Statut actuel de la vidéo: ${video.status}`)

    // MISE À JOUR DU STATUT => processing
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.PROCESSING, 
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId)

    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId}`, updateError)
    } else {
      console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.PROCESSING}'`)
    }

    // RÉCUPÉRER L'URL DE LA VIDÉO
    // Utiliser d'abord videoUrl du corps de la requête si disponible
    if (!videoUrl) {
      videoUrl = video.public_url
      console.log(`VideoUrl fallback vers public_url (tronqué): ${videoUrl ? videoUrl.substring(0, 50) + '...' : 'null'}`)
    }

    // CORRECTION : Vérifier la validité de l'URL et régénérer si nécessaire (ex. : si c'est juste un chemin)
    if (!videoUrl || !videoUrl.startsWith('http')) {
      if (!video.storage_path) {
        throw new Error('Chemin de stockage manquant pour générer l\'URL signée')
      }
      console.log(`URL invalide détectée (${videoUrl ? 'non-http' : 'null'}), génération d'une URL signée pour ${video.storage_path}`)
      
      try {
        const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
          .from('videos')
          .createSignedUrl(video.storage_path, 60 * 60) // 1 heure

        if (signedUrlError) throw signedUrlError
        
        videoUrl = signedUrlData.signedUrl
        console.log(`URL signée régénérée avec succès (tronquée): ${videoUrl.substring(0, 50)}...`)
      } catch (storageError: any) {
        console.error('Erreur lors de la création de l\'URL signée:', storageError)
        return new Response(
          JSON.stringify({ 
            error: 'Erreur de stockage', 
            details: `Impossible de générer l'URL signée pour la vidéo: ${storageError.message}` 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 500 
          }
        )
      }
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'URL vidéo manquante', 
          details: 'Impossible de récupérer ou de générer l\'URL de la vidéo.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    // TÉLÉCHARGER LA VIDÉO ET LA CONVERTIR EN AUDIO
    console.log('Téléchargement et conversion de la vidéo en audio...')
    let audioBlob: Blob
    
    try {
      // Log sécurisé de l'URL avant fetch
      console.log(`Tentative de téléchargement avec URL valide (tronquée): ${videoUrl.substring(0, 50)}...`)
      
      const response = await fetch(videoUrl, { 
        signal: AbortSignal.timeout(30000) // Timeout de 30s pour le fetch
      })
      if (!response.ok) {
        throw new Error(`Échec du téléchargement: ${response.status} ${response.statusText}`)
      }
      audioBlob = await response.blob()
      console.log(`Téléchargement réussi, taille: ${audioBlob.size} bytes, type: ${audioBlob.type}`)
    } catch (fetchError: any) {
      console.error('Erreur lors du téléchargement de la vidéo:', fetchError)
      
      // Mise à jour du statut FAILED avec détail
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur de téléchargement: ${fetchError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ 
          error: 'Erreur de téléchargement', 
          details: `Impossible de télécharger la vidéo: ${fetchError.message}` 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    // Vérifier que le blob n'est pas vide
    if (audioBlob.size === 0) {
      console.error('Blob vidéo vide après téléchargement')
      
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: 'Vidéo téléchargée vide ou corrompue',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ 
          error: 'Vidéo vide', 
          details: 'La vidéo téléchargée est vide ou corrompue' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    // PRÉPARER LA TRANSCRIPTION AVEC OPENAI WHISPER
    console.log('Préparation de la transcription avec OpenAI Whisper...')
    const openai = new OpenAI({ apiKey: openaiApiKey })
    let transcription
    
    try {
      // Créer un File object à partir du Blob
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
      
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json'
      })
      
      console.log('Transcription terminée avec succès')
    } catch (openaiError: any) {
      console.error('Erreur OpenAI lors de la transcription:', openaiError)
      
      // Mettre à jour le statut de la vidéo à FAILED
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur OpenAI: ${openaiError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ 
          error: 'Erreur de transcription OpenAI', 
          details: openaiError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    // Calculer un score de confiance moyen basé sur les segments
    const confidenceScore = transcription.segments && transcription.segments.length > 0 
      ? transcription.segments.reduce((sum: number, segment: any) => sum + (segment.confidence || 0), 0) / transcription.segments.length 
      : null

    console.log(`Transcription terminée: ${transcription.text.length} caractères, score de confiance: ${confidenceScore}`)

    // ENREGISTRER LA TRANSCRIPTION DANS SUPABASE
    console.log('Enregistrement de la transcription dans Supabase...')
    
    // Préparer les données de transcription (CORRECTION : objet simple pour jsonb, sans wrapping en array)
    const transcriptionData = {
      text: transcription.text,
      segments: transcription.segments,
      language: transcription.language,
      duration: transcription.duration,
      confidence_score: confidenceScore
    }

    // Insérer ou mettre à jour dans la table transcriptions (segments comme jsonb)
    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId,
        language: transcription.language,
        full_text: transcription.text,
        transcription_text: transcription.text,
        segments: transcription.segments, // Array d'objets -> jsonb
        transcription_data: transcriptionData, // Objet simple pour jsonb
        confidence_score: confidenceScore,
        duration: transcription.duration,
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'video_id'
      })

    if (transcriptionTableError) {
      console.error('Erreur lors de l\'enregistrement de la transcription:', transcriptionTableError)
      
      // Mettre à jour le statut de la vidéo à FAILED en cas d'échec
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec de l'enregistrement de la transcription: ${transcriptionTableError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ 
          error: 'Erreur de base de données', 
          details: transcriptionTableError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    console.log('Transcription enregistrée avec succès dans la table transcriptions')

    // Mettre à jour également la table videos avec les données de transcription (CORRECTION : objet simple pour jsonb)
    const { error: videoUpdateError } = await serviceClient
      .from('videos')
      .update({
        transcription_text: transcription.text,
        transcription_data: transcriptionData, // Objet simple, pas d'array
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (videoUpdateError) {
      console.error('Erreur lors de la mise à jour de la vidéo avec la transcription:', videoUpdateError)
      
      // CORRECTION : Ne pas échouer complètement ; logger et continuer, mais updater en FAILED si DB critique
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec mise à jour vidéo: ${videoUpdateError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ 
          error: 'Erreur mise à jour vidéo', 
          details: videoUpdateError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    } else {
      console.log('Statut de la vidéo mis à jour à TRANSCRIBED')
    }

    // DÉCLENCHER LA FONCTION D'ANALYSE (CORRECTION : Gestion robuste des erreurs 401)
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      }

      // Log sécurisé
      console.log(`Appel de la fonction analyze-transcription via fetch à ${analyzeEndpoint.substring(0, 50)}...`)

      console.log(`Clé de service utilisée (tronquée): ${supabaseServiceKey.substring(0, 20)}...`)
      
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ videoId })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Erreur de la fonction d'analyse (${response.status}): ${errorText}`)
        
        // CORRECTION : Pour 401 (Invalid JWT), logger spécifiquement et ne pas updater en FAILED pour transcription
        if (response.status === 401) {
          console.error('Erreur 401 : Vérifiez la clé de service Supabase dans les variables d\'environnement')
        }
        
        // Mettre à jour avec erreur d'analyse, mais garder TRANSCRIBED
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.TRANSCRIBED,
            error_message: `Échec déclenchement analyse: ${response.status} - ${errorText}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
        
        // Ne pas throw, continuer le processus
      } else {
        const responseData = await response.json()
        console.log('Analyse démarrée avec succès:', responseData)
        
        // Mettre à jour en ANALYZING après succès
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.ANALYZING,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
      }
    } catch (invokeError: any) {
      console.error("Erreur lors de l'invocation de la fonction d'analyse:", invokeError)
      
      // Mettre à jour avec erreur mais ne pas échouer la transcription
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.TRANSCRIBED,
          error_message: `Exception invocation analyse: ${invokeError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)
      
      // Ne pas échouer complètement, juste logger l'erreur
    }

    // CONFIRMER LA MISE À JOUR DE LA BASE DE DONNÉES
    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId)
    if (!confirmed) {
      console.warn(`La mise à jour de la base de données pour la vidéo ${videoId} n'a pas pu être confirmée.`)
    }

    return new Response(
      JSON.stringify({
        message: 'Transcription terminée avec succès',
        videoId,
        transcription_length: transcription.text.length,
        confidence_score: confidenceScore,
        language: transcription.language
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('Erreur générale dans la fonction transcribe-video:', error)
    
    // Tentative de mise à jour du statut d'erreur si videoId est disponible
    try {
      if (videoId) {
        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        )
        
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: `Erreur interne: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
      }
    } catch (updateError) {
      console.error('Erreur lors de la mise à jour du statut d\'erreur:', updateError)
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur', 
        details: error.message || 'Une erreur inattendue est survenue.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})
