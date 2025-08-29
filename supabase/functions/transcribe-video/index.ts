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

// Timeout global pour l'exécution de la fonction
const EXECUTION_TIMEOUT = 300000; // 5 minutes

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null;
  let serviceClient: ReturnType<typeof createClient>;

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
            console.error('Erreur de décodage du JWT:', error.message)
            // Amélioration: Si le JWT est invalide, ne pas essayer d'autres méthodes pour ce token.
            // Le flux continuera pour essayer d'autres méthodes d'identification de l'utilisateur.
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
          // Ne pas échouer ici, continuer avec les paramètres d'URL
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

    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}, chemin: ${video.storage_path}`)
    console.log(`Statut actuel de la vidéo: ${video.status}`)

    // 4. MISE À JOUR DU STATUT => processing
    // Correction: Ajouter une vérification pour éviter de traiter une vidéo déjà en échec ou transcrite
    if (video.status === VIDEO_STATUS.TRANSCRIBED || video.status === VIDEO_STATUS.FAILED) {
      console.log(`La vidéo ${videoId} est déjà en statut '${video.status}', ne pas la traiter à nouveau.`);
      return new Response(
        JSON.stringify({
          message: `La vidéo est déjà en statut '${video.status}'.`,
          videoId: videoId,
          status: video.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

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

    // 5. GÉNÉRER L'URL SIGNÉE POUR LA VIDÉO
    if (!videoUrl && video.storage_path) {
      console.log(`Génération d'une URL signée pour le chemin: ${video.storage_path}`)

      try {
        // Déterminer le bucket et le chemin du fichier
        let bucket = 'videos'; // Bucket par défaut
        let filePath = video.storage_path;

        // Si le chemin contient un slash, le premier segment pourrait être le bucket
        if (filePath.includes('/')) {
          const pathParts = filePath.split('/');
          const possibleBucket = pathParts[0];

          // Vérifier si le premier segment est un bucket valide
          try {
            const { data: buckets } = await serviceClient.storage.listBuckets();
            const bucketExists = buckets?.some((b: any) => b.name === possibleBucket);

            if (bucketExists) {
              bucket = possibleBucket;
              filePath = pathParts.slice(1).join('/');
              console.log(`Bucket détecté: ${bucket}, chemin ajusté: ${filePath}`);
            }
          } catch (bucketError) {
            console.log('Utilisation du bucket par défaut:', bucket);
          }
        }

        // Créer l'URL signée
        const { data: signedUrlData, error: signedUrlError } = await serviceClient
          .storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60); // 1 heure de validité

        if (signedUrlError) {
          throw new Error(`Erreur lors de la création de l'URL signée: ${signedUrlError.message}`);
        }

        videoUrl = signedUrlData.signedUrl;
        console.log(`URL signée générée avec succès: ${videoUrl.substring(0, 100)}...`);

      } catch (storageError: any) {
        console.error('Erreur lors de la génération de l\'URL signée:', storageError);

        await serviceClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Erreur de stockage: ${storageError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId as string);

        return new Response(
          JSON.stringify({
            error: 'Erreur de stockage',
            details: `Impossible de générer l'URL signée: ${storageError.message}`
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

    // 6. TÉLÉCHARGER LA VIDÉO
    console.log('Téléchargement de la vidéo...')

    let videoArrayBuffer: ArrayBuffer;
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Échec du téléchargement: ${response.status} ${response.statusText}`);
      }
      videoArrayBuffer = await response.arrayBuffer();
      console.log(`Vidéo téléchargée, taille: ${videoArrayBuffer.byteLength} octets`);
    } catch (downloadError: any) {
      console.error('Erreur lors du téléchargement de la vidéo:', downloadError);

      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: `Erreur de téléchargement: ${downloadError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({
          error: 'Erreur de téléchargement',
          details: `Impossible de télécharger la vidéo: ${downloadError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 7. PRÉPARER LA TRANSCRIPTION AVEC OPENAI
    const openai = new OpenAI({
      apiKey: openaiApiKey // Ceci est déjà défini en tant que variable d'environnement
    });

    console.log('Préparation de la transcription avec OpenAI...');

    // Créer un objet Blob à partir de l'ArrayBuffer
    const videoBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' }); // Assurez-vous que le type MIME est correct

    // Créer un objet File à partir du Blob pour l'API OpenAI
    const videoFile = new File([videoBlob], 'video.mp4', { type: 'video/mp4' });

    let transcriptionText: string | null = null;
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: videoFile,
        model: 'whisper-1',
      });
      transcriptionText = transcription.text;
      console.log('Transcription OpenAI réussie.');
    } catch (transcriptionError: any) {
      console.error('Erreur lors de la transcription OpenAI:', transcriptionError);

      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: `Erreur de transcription OpenAI: ${transcriptionError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({
          error: 'Erreur de transcription',
          details: `Impossible de transcrire la vidéo avec OpenAI: ${transcriptionError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!transcriptionText) {
      console.error('Transcription vide ou nulle.');
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: 'Transcription vide ou nulle',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({
          error: 'Erreur de transcription',
          details: 'La transcription retournée par OpenAI est vide.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 8. ENREGISTRER LA TRANSCRIPTION DANS LA BASE DE DONNÉES
    console.log('Enregistrement de la transcription dans la base de données...');
    const { data: transcriptionData, error: insertError } = await serviceClient
      .from('transcriptions')
      .insert({
        video_id: videoId as string,
        content: transcriptionText,
        user_id: userId // Assurez-vous que userId est défini
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erreur lors de l\'insertion de la transcription:', insertError);
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: `Erreur d'insertion de transcription: ${insertError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({
          error: 'Erreur de base de données',
          details: `Impossible d'enregistrer la transcription: ${insertError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Transcription enregistrée avec succès pour la vidéo ${videoId}. ID: ${transcriptionData.id}`);

    // 9. MISE À JOUR DU STATUT DE LA VIDÉO => transcribed
    console.log(`Mise à jour du statut de la vidéo ${videoId} à '${VIDEO_STATUS.TRANSCRIBED}'...`);
    const { error: finalUpdateError } = await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId as string);

    if (finalUpdateError) {
      console.error(`Erreur lors de la mise à jour finale du statut de la vidéo ${videoId}:`, finalUpdateError);
      // Ne pas retourner d'erreur ici, car la transcription a été enregistrée
    } else {
      console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.TRANSCRIBED}' avec succès.`);
    }

    // Confirmer la mise à jour dans la base de données
    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId);
    if (!confirmed) {
      console.warn(`La mise à jour du statut de la vidéo ${videoId} n'a pas pu être confirmée.`);
    }

    // 10. RÉPONSE DE SUCCÈS
    return new Response(
      JSON.stringify({
        message: 'Transcription vidéo terminée avec succès',
        videoId: videoId,
        transcriptionId: transcriptionData.id,
        status: VIDEO_STATUS.TRANSCRIBED
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('Erreur inattendue dans la fonction transcribe-video:', err);

    // Tenter de mettre à jour le statut de la vidéo à FAILED en cas d'erreur inattendue
    if (videoId && serviceClient) {
      try {
        await serviceClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Erreur inattendue: ${err.message || 'Une erreur inconnue est survenue'}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
        console.log(`Statut de la vidéo ${videoId} mis à jour à 'FAILED' suite à une erreur inattendue.`);
      } catch (rollbackError) {
        console.error('Erreur lors de la mise à jour du statut FAILED après une erreur inattendue:', rollbackError);
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Erreur interne du serveur',
        details: err.message || 'Une erreur inattendue est survenue lors de la transcription vidéo.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
