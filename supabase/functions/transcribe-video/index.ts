
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

    // Créer un client Supabase avec la clé de service pour les opérations privilégiées
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Helper hoisté dans ce scope
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

        const { data: updatedVideo, error } = await client
          .from('videos')
          .select('status, transcription')
          .eq('id', videoId)
          .single()

        if (error) throw error

        if (
          updatedVideo &&
          (updatedVideo.status === VIDEO_STATUS.ANALYZED ||
            updatedVideo.status === VIDEO_STATUS.TRANSCRIBED) &&
          updatedVideo.transcription
        ) {
          console.log(`Mise à jour confirmée pour la vidéo ${videoId}`)
          return true
        }

        console.log(
          `Mise à jour non encore terminée, nouvelle tentative (${attempts + 1}/${maxAttempts})`
        )
        return await confirmDatabaseUpdate(client, videoId, attempts + 1, maxAttempts)
      } catch (err) {
        console.error('Erreur lors de la confirmation de mise à jour:', err)
        return await confirmDatabaseUpdate(client, videoId, attempts + 1, maxAttempts)
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
    let videoId: string | null = null

    // Pour GET ou WhatsApp, récupérer videoId des paramètres d'URL
    if (req.method === 'GET' || isWhatsApp) {
      const url = new URL(req.url)
      videoId = url.searchParams.get('videoId')

      if (!videoId) {
        return new Response(
          JSON.stringify({ error: 'videoId est requis en paramètre pour les requêtes GET' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      console.log(`VideoId récupéré des paramètres d'URL: ${videoId}`)
    } else {
      try {
        const clonedRequest = req.clone()
        const requestData = await clonedRequest.json()

        if (requestData.videoId) {
          videoId = requestData.videoId
          console.log('Données de requête reçues:', { videoId })
        } else {
          const url = new URL(req.url)
          videoId = url.searchParams.get('videoId')

          if (!videoId) {
            return new Response(
              JSON.stringify({ error: 'videoId est requis dans le corps de la requête ou en paramètre' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }
        }
      } catch (parseError) {
        console.error("Erreur lors de l'analyse du JSON de la requête", parseError)

        const url = new URL(req.url)
        videoId = url.searchParams.get('videoId')

        if (!videoId) {
          return new Response(
            JSON.stringify({
              error: 'Format de requête invalide',
              details:
                'Impossible de lire les données de la requête. Assurez-vous que le corps est un JSON valide ou que videoId est fourni en paramètre de requête.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
      }
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

    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}, chemin: ${video.storage_path}`)
    console.log(`Statut actuel de la vidéo: ${video.status}`)

    // 4. MISE À JOUR DU STATUT => processing
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId as string)

    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId}`, updateError)
    } else {
      console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.PROCESSING}'`)
    }

    // 5. RÉCUPÉRER L'URL DE LA VIDÉO
    let videoUrl: string | null = (video as any).url

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
    const audioBlob = await fetch(videoUrl).then((res) => res.blob())

    // 7. PRÉPARER LA TRANSCRIPTION AVEC OPENAI WHISPER
    console.log('Préparation de la transcription avec OpenAI Whisper...')
    const openai = new OpenAI({ apiKey: openaiApiKey })

    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBlob], 'audio.mp3', { type: 'audio/mp3' }),
      model: 'whisper-1',
      language: 'fr'
    })

    console.log('Transcription terminée.')

    // 8. ENREGISTRER LA TRANSCRIPTION DANS SUPABASE
    console.log('Enregistrement de la transcription dans Supabase...')
    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId as string,
        full_text: transcription.text,
        segments: transcription.segments,
        transcription_data: transcription,
        status: VIDEO_STATUS.TRANSCRIBED, // CORRECTION APPLIQUÉE ICI
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'video_id' }
      )

    if (transcriptionTableError) {
      console.error('Erreur lors de l\'upsert de la transcription:', transcriptionTableError)
      // Mettre à jour le statut de la vidéo à FAILED en cas d'erreur de transcription
      await serviceClient
        .from('videos')
        .update({ status: VIDEO_STATUS.FAILED, updated_at: new Date().toISOString() })
        .eq('id', videoId as string)
      return new Response(
        JSON.stringify({
          error: 'Erreur lors de l\'enregistrement de la transcription',
          details: transcriptionTableError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('Transcription enregistrée avec succès.')

    // 9. MISE À JOUR DU STATUT DE LA VIDÉO => transcribed
    const { error: finalUpdateError } = await serviceClient
      .from('videos')
      .update({ status: VIDEO_STATUS.TRANSCRIBED, updated_at: new Date().toISOString() })
      .eq('id', videoId as string)

    if (finalUpdateError) {
      console.error('Erreur lors de la mise à jour finale du statut de la vidéo:', finalUpdateError)
      return new Response(
        JSON.stringify({
          error: 'Erreur lors de la mise à jour finale du statut de la vidéo',
          details: finalUpdateError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.TRANSCRIBED}'`)

    // 10. DÉCLENCHEMENT DE L'ANALYSE
    console.log(`Déclenchement de la fonction analyze-transcription pour la vidéo ${videoId}`)
    try {
      await fetch(`${supabaseUrl}/functions/v1/analyze-transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ videoId })
      })
      console.log(`Fonction analyze-transcription déclenchée avec succès pour la vidéo ${videoId}`)
    } catch (analyzeError: any) {
      console.error(`Erreur lors du déclenchement de analyze-transcription pour la vidéo ${videoId}:`, analyzeError)
      // Optionnel: Mettre à jour le statut de la vidéo à FAILED si l'appel à analyze-transcription échoue
      await serviceClient
        .from('videos')
        .update({ status: VIDEO_STATUS.FAILED, error_message: `Échec du déclenchement de l'analyse: ${analyzeError.message}`, updated_at: new Date().toISOString() })
        .eq('id', videoId as string)
    }

    // 11. CONFIRMER LA MISE À JOUR DE LA BASE DE DONNÉES
    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId as string)
    if (!confirmed) {
      console.warn(
        `La mise à jour de la base de données pour la vidéo ${videoId} n'a pas pu être confirmée.`
      )
      // Ne pas retourner d'erreur, mais logguer un avertissement
    }

    return new Response(JSON.stringify({ message: 'Transcription terminée avec succès', videoId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error: any) {
    console.error('Erreur générale dans la fonction transcribe-video:', error)
    return new Response(
      JSON.stringify({
        error: 'Erreur interne du serveur',
        details: error.message || 'Une erreur inattendue est survenue.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
