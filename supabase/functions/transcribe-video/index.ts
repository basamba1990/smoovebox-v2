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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null;
  let serviceClient: any = null;

  try {
    console.log('Fonction transcribe-video appelée')
    
    // Initialiser les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

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

    // Vérifier que la clé de service n'est pas un placeholder
    if (supabaseServiceKey.includes('SUPABASE_SERVICE_ROLE_KEY') || supabaseServiceKey.length < 50) {
      console.error('Clé de service Supabase invalide ou placeholder détecté')
      return new Response(
        JSON.stringify({
          error: 'Configuration invalide',
          details: "La clé de service Supabase n'est pas configurée correctement"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    console.log('Variables d\'environnement validées avec succès')

    // Créer un client Supabase avec timeout configuré
    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          return fetch(input, {
            ...init,
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId));
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

    // Helper pour mettre à jour le statut de la vidéo de manière sécurisée
    async function updateVideoStatus(
      client: ReturnType<typeof createClient>,
      videoId: string,
      status: string,
      additionalData: Record<string, any> = {},
      method: string = 'direct'
    ): Promise<boolean> {
      try {
        console.log(`🔄 Tentative de mise à jour du statut de la vidéo ${videoId} vers '${status}' (méthode: ${method})`)
        
        const updateData = {
          status,
          updated_at: new Date().toISOString(),
          ...additionalData
        }

        const { error: updateError } = await client
          .from('videos')
          .update(updateData)
          .eq('id', videoId)

        if (updateError) {
          console.error(`❌ Échec de la mise à jour du statut de la vidéo ${videoId}:`, updateError)
          
          // Log détaillé de l'erreur pour le debugging
          console.error('Détails de l\'erreur de mise à jour:', {
            videoId,
            targetStatus: status,
            method,
            error: updateError,
            timestamp: new Date().toISOString()
          })
          
          return false
        }

        console.log(`✅ Statut de la vidéo ${videoId} mis à jour avec succès vers '${status}'`)
        return true
      } catch (err) {
        console.error(`❌ Exception lors de la mise à jour du statut de la vidéo ${videoId}:`, err)
        return false
      }
    }

    // MÉTHODES D'AUTHENTIFICATION MULTIPLES
    let userId: string | null = null
    let token: string | null = null

    // Détecter l'agent utilisateur pour identifier WhatsApp
    const userAgent = req.headers.get('user-agent') || ''
    const isWhatsApp = userAgent.includes('WhatsApp')

    // Pour WhatsApp ou requêtes GET, bypasser l'authentification
    if (isWhatsApp || req.method === 'GET') {
      // Utilisez un ID par défaut ou récupérez-le des paramètres
      const url = new URL(req.url)
      userId = url.searchParams.get('userId') || 'whatsapp-user'
      console.log(`Utilisateur WhatsApp/GET détecté: ${userId}`)
    } else {
      // Méthode 1: Bearer token dans l'en-tête Authorization
      const authHeader = req.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '')
        console.log("Token d'authentification trouvé dans l'en-tête Authorization")
      } else if (req.headers.get('apikey')) {
        // Méthode 2: Token dans l'en-tête 'apikey'
        token = req.headers.get('apikey')
        console.log("Token d'authentification trouvé dans l'en-tête apikey")
      } else {
        // Méthode 3: Extraire le JWT des cookies
        const cookieHeader = req.headers.get('Cookie')
        if (cookieHeader) {
          const supabaseCookie = cookieHeader
            .split(';')
            .find(
              (c) =>
                c.trim().startsWith('sb-access-token=') ||
                c.trim().startsWith('supabase-auth-token=')
            )

          if (supabaseCookie) {
            token = supabaseCookie.split('=')[1].trim()
            if (token.startsWith('"') && token.endsWith('"')) {
              token = token.slice(1, -1) // Enlever les guillemets
            }
            console.log("Token d'authentification trouvé dans les cookies")
          }
        }
      }

      // Vérifier l'authentification et récupérer l'ID utilisateur
      if (token) {
        try {
          const { data, error } = await serviceClient.auth.getUser(token)
          if (error) {
            console.error('Erreur de décodage du JWT:', error)
          } else if (data.user) {
            userId = data.user.id
            console.log(`Utilisateur authentifié: ${userId}`)
          }
        } catch (authError) {
          console.error("Exception lors de l'authentification:", authError)
        }
      }

      // Récupérer l'identifiant d'utilisateur à partir des données de l'URL supabase
      if (!userId) {
        try {
          const url = new URL(req.url)
          const sbParam = url.searchParams.get('sb')
          const supabaseData = sbParam ? JSON.parse(decodeURIComponent(sbParam)) : null

          if (supabaseData?.auth_user) {
            userId = supabaseData.auth_user
            console.log(`Utilisateur trouvé dans les métadonnées Supabase: ${userId}`)
          } else if (supabaseData?.jwt?.authorization?.payload) {
            const payload = supabaseData.jwt.authorization.payload
            if (payload.sub) {
              userId = payload.sub
              console.log(`Utilisateur trouvé dans le payload JWT: ${userId}`)
            } else if ((payload as any).subject) {
              userId = (payload as any).subject
              console.log(`Utilisateur trouvé dans le payload JWT: ${userId}`)
            }
          }
        } catch (sbDataError) {
          console.error("Erreur lors de l'extraction des métadonnées Supabase:", sbDataError)
        }
      }

      // Dernier recours: obtenir l'utilisateur à partir des données de la requête
      if (!userId) {
        try {
          const clonedRequest = req.clone()
          const requestData = await clonedRequest.json()
          if (requestData.user_id) {
            userId = requestData.user_id
            console.log(`Utilisateur trouvé dans les données de la requête: ${userId}`)
          }
        } catch (parseError) {
          console.error("Erreur lors de l'analyse du JSON de la requête:", parseError)
        }
      }

      if (!userId && !isWhatsApp && req.method !== 'GET') {
        return new Response(
          JSON.stringify({
            error: 'Authentification requise',
            details:
              "Impossible d'identifier l'utilisateur. Assurez-vous d'être connecté et d'envoyer le token d'authentification."
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }
    }

    // 2. RÉCUPÉRER LES DONNÉES DE LA REQUÊTE
    let videoUrl: string | null = null

    // Essayer d'abord les paramètres d'URL (plus fiable)
    const url = new URL(req.url)
    videoId = url.searchParams.get('videoId')
    
    if (videoId) {
      console.log(`VideoId récupéré des paramètres d'URL: ${videoId}`)
      // Récupérer aussi videoUrl si fourni en paramètre
      videoUrl = url.searchParams.get('videoUrl')
    }

    // Si pas trouvé dans l'URL et que ce n'est pas une requête GET, essayer le corps de la requête
    if (!videoId && req.method !== 'GET' && !isWhatsApp) {
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
            console.log(`VideoUrl récupéré du corps de la requête: ${videoUrl}`)
          }
        }
      } catch (parseError) {
        console.error("Erreur lors de l'analyse du JSON de la requête:", parseError)
        // Ne pas échouer ici, continuer avec les paramètres d'URL
      }
    }

    // Vérification finale
    if (!videoId) {
      console.error('VideoId non trouvé dans les paramètres d\'URL ni dans le corps de la requête')
      return new Response(
        JSON.stringify({ 
          error: 'videoId est requis dans le corps de la requête ou en paramètre',
          details: 'Veuillez fournir videoId soit dans le corps JSON de la requête, soit comme paramètre d\'URL (?videoId=...)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 3. VÉRIFIER L'ACCÈS À LA VIDÉO
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId as string)
      .single()

    if (videoError) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération de la vidéo', details: videoError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: (videoError as any).code === 'PGRST116' ? 404 : 500
        }
      )
    }

    if (!video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}`)
    console.log(`Statut actuel de la vidéo: ${video.status}`)

    // 4. MISE À JOUR DU STATUT => processing
    const statusUpdated = await updateVideoStatus(
      serviceClient,
      videoId as string,
      VIDEO_STATUS.PROCESSING,
      {
        transcription_attempts: (video.transcription_attempts || 0) + 1
      },
      'processing_start'
    )

    if (!statusUpdated) {
      console.warn(`⚠️ Impossible de mettre à jour le statut vers 'processing', mais on continue...`)
    }

    // 5. RÉCUPÉRER L'URL DE LA VIDÉO
    // Utiliser d'abord videoUrl du corps de la requête si disponible
    if (!videoUrl) {
      videoUrl = (video as any).url
    }

    if (!videoUrl && (video as any).storage_path) {
      console.log(`Génération d'une URL signée pour ${(video as any).storage_path}`)

      // Extraire le bucket et le chemin
      let bucket = 'videos' // Bucket par défaut
      let filePath = (video as any).storage_path as string

      // Gestion intelligente du chemin: détection du bucket dans le chemin
      if (filePath.includes('/')) {
        const parts = filePath.split('/')
        if (parts.length > 1) {
          const possibleBucket = parts[0]

          try {
            const { data: buckets } = await serviceClient.storage.listBuckets()
            console.log('Buckets disponibles:', buckets?.map((b: any) => b.name) || [])
            const bucketExists = (buckets || []).some((b: any) => b.name === possibleBucket)

            if (bucketExists) {
              bucket = possibleBucket
              filePath = parts.slice(1).join('/')
              console.log(`Bucket identifié: ${bucket}, chemin ajusté: ${filePath}`)
            } else {
              console.log(
                `Le segment "${possibleBucket}" n'est pas un bucket valide, utilisation du bucket par défaut: ${bucket}`
              )
            }
          } catch (bucketError) {
            console.error('Erreur lors de la vérification des buckets:', bucketError)
          }
        }
      }

      // Méthode alternative: vérifier si le chemin commence par le nom du bucket
      if (filePath.startsWith(`${bucket}/`)) {
        filePath = filePath.substring(bucket.length + 1)
        console.log(`Préfixe de bucket détecté et supprimé. Nouveau chemin: ${filePath}`)
      }

      console.log(`Création d'URL signée pour bucket: ${bucket}, chemin: ${filePath}`)

      try {
        const parentPath = filePath.split('/').slice(0, -1).join('/') || undefined
        console.log(`Vérification du contenu du dossier: ${parentPath || '(racine)'}`)

        const { data: fileList, error: fileListError } = await serviceClient.storage
          .from(bucket)
          .list(parentPath, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } })

        if (fileListError) {
          console.error("Erreur lors de la vérification de l'existence du fichier:", fileListError)
        } else {
          const fileName = filePath.split('/').pop()
          console.log(
            `Contenu du dossier '${parentPath || '(racine)'}':`,
            (fileList || []).map((f: any) => f.name)
          )
          console.log(`Recherche du fichier ${fileName} dans la liste`)
          const fileFound = (fileList || []).some((f: any) => f.name === fileName)
          console.log(`Fichier ${fileName} trouvé dans le bucket ${bucket}: ${fileFound}`)

          if (!fileFound) {
            throw new Error(`Fichier ${fileName} non trouvé dans le bucket ${bucket}`)
          }
        }

        const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60)

        if (signedUrlError) throw signedUrlError

        videoUrl = signedUrlData.signedUrl
        console.log(`URL signée générée avec succès: ${videoUrl.substring(0, 50)}...`)
      } catch (storageError: any) {
        console.error('Erreur lors de la création de l\'URL signée:', storageError)
        
        // Mettre à jour le statut d'erreur
        await updateVideoStatus(
          serviceClient,
          videoId as string,
          VIDEO_STATUS.FAILED,
          {
            error_message: `Erreur de stockage: ${storageError.message}`
          },
          'storage_error'
        )
        
        return new Response(
          JSON.stringify({
            error: 'Erreur de stockage',
            details: `Impossible de générer l'URL signée pour la vidéo: ${storageError.message}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    if (!videoUrl) {
      await updateVideoStatus(
        serviceClient,
        videoId as string,
        VIDEO_STATUS.FAILED,
        {
          error_message: 'URL vidéo manquante'
        },
        'missing_url'
      )
      
      return new Response(
        JSON.stringify({
          error: 'URL vidéo manquante',
          details: 'Impossible de récupérer ou de générer l\'URL de la vidéo.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 6. TÉLÉCHARGER LA VIDÉO ET LA CONVERTIR EN AUDIO
    console.log('Téléchargement et conversion de la vidéo en audio...')
    
    let audioBlob: Blob;
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Échec du téléchargement: ${response.status} ${response.statusText}`);
      }
      audioBlob = await response.blob();
    } catch (fetchError) {
      console.error('Erreur lors du téléchargement de la vidéo:', fetchError);
      
      await updateVideoStatus(
        serviceClient,
        videoId as string,
        VIDEO_STATUS.FAILED,
        {
          error_message: `Erreur de téléchargement: ${fetchError.message}`
        },
        'download_error'
      )
      
      return new Response(
        JSON.stringify({
          error: 'Erreur de téléchargement',
          details: `Impossible de télécharger la vidéo: ${fetchError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 7. TRANSCRIPTION AVEC OPENAI WHISPER
    console.log('Début de la transcription avec OpenAI Whisper...')
    
    const openai = new OpenAI({ apiKey: openaiApiKey })
    
    let transcription: any;
    try {
      // Créer un fichier temporaire pour l'audio
      const audioFile = new File([audioBlob], 'audio.mp4', { type: 'audio/mp4' });
      
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      });
      
      console.log('Transcription terminée avec succès')
      console.log(`Texte transcrit (${transcription.text.length} caractères):`, transcription.text.substring(0, 200) + '...')
    } catch (transcriptionError) {
      console.error('Erreur lors de la transcription:', transcriptionError)
      
      await updateVideoStatus(
        serviceClient,
        videoId as string,
        VIDEO_STATUS.FAILED,
        {
          error_message: `Erreur de transcription: ${transcriptionError.message}`
        },
        'transcription_error'
      )
      
      return new Response(
        JSON.stringify({
          error: 'Erreur de transcription',
          details: `Échec de la transcription: ${transcriptionError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 8. ENREGISTRER LA TRANSCRIPTION DANS LA BASE DE DONNÉES
    console.log('Enregistrement de la transcription dans la base de données...')
    
    const transcriptionData = {
      text: transcription.text,
      segments: transcription.segments || [],
      language: transcription.language || 'unknown',
      duration: transcription.duration || 0
    }

    // Enregistrer dans la table transcriptions
    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId,
        user_id: userId,
        language: transcription.language || 'unknown',
        full_text: transcription.text,
        segments: transcription.segments || [],
        transcription_text: transcription.text,
        transcription_data: transcriptionData,
        status: 'completed',
        confidence_score: 0.95, // Score par défaut
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'video_id' });

    if (transcriptionTableError) {
      console.error('Erreur lors de l\'enregistrement de la transcription:', transcriptionTableError)
      
      // Mettre à jour le statut de la vidéo à FAILED en cas d'échec
      await updateVideoStatus(
        serviceClient,
        videoId as string,
        VIDEO_STATUS.FAILED,
        {
          error_message: `Échec de l'enregistrement de la transcription: ${transcriptionTableError.message}`
        },
        'database_error'
      )

      return new Response(
        JSON.stringify({ error: 'Erreur de base de données', details: transcriptionTableError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Mettre à jour également la table videos avec les données de transcription
    const videoUpdateSuccess = await updateVideoStatus(
      serviceClient,
      videoId as string,
      VIDEO_STATUS.TRANSCRIBED,
      {
        transcription_text: transcription.text,
        transcription_data: transcriptionData
      },
      'transcription_complete'
    )

    if (!videoUpdateSuccess) {
      console.warn(`⚠️ La transcription de la vidéo ${videoId} a été enregistrée avec succès, mais la mise à jour du statut a échoué. Investigation requise.`)
    }

    console.log('Transcription enregistrée avec succès.')

    // 9. DÉCLENCHER LA FONCTION D'ANALYSE AVEC AUTHENTIFICATION CORRECTE
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      
      // Vérifier que la clé de service est valide avant de l'utiliser
      if (!supabaseServiceKey || supabaseServiceKey.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        throw new Error('Clé de service Supabase invalide pour l\'appel à analyze-transcription');
      }
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      };
      
      console.log(`🔄 Appel de la fonction analyze-transcription via fetch à ${analyzeEndpoint}`);
      console.log('En-têtes d\'authentification configurés avec la clé de service');
      
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ videoId })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erreur de la fonction d'analyse (${response.status}): ${errorText}`);
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Analyse démarrée avec succès:', responseData);
    } catch (invokeError) {
      console.error("⚠️ Erreur lors de l'invocation de la fonction d'analyse:", invokeError)
      // Ne pas échouer complètement, juste logger l'erreur
    }

    // 10. CONFIRMER LA MISE À JOUR DE LA BASE DE DONNÉES
    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId as string)
    if (!confirmed) {
      console.warn(
        `La mise à jour de la base de données pour la vidéo ${videoId} n'a pas pu être confirmée.`
      )
    }

    return new Response(
      JSON.stringify({ 
        message: 'Transcription terminée avec succès', 
        videoId,
        transcription_length: transcription.text.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error: any) {
    console.error('❌ Erreur générale dans la fonction transcribe-video:', error)
    
    // Tentative de mise à jour du statut d'erreur si videoId est disponible
    if (videoId && serviceClient) {
      try {
        await updateVideoStatus(
          serviceClient,
          videoId as string,
          VIDEO_STATUS.FAILED,
          {
            error_message: `Erreur interne: ${error.message}`
          },
          'general_error'
        )
      } catch (updateError) {
        console.error('❌ Erreur lors de la mise à jour du statut d\'erreur:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({
        error: 'Erreur interne du serveur',
        details: error.message || 'Une erreur inattendue est survenue.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
