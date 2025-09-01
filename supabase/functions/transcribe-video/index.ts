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
  let serviceClient: ReturnType<typeof createClient> | null = null;

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
    // Utiliser d'abord videoUrl du corps de la requête si disponible
    if (!videoUrl) {
      videoUrl = (video as any).url
    }

    if (!videoUrl && (video as any).storage_path) {
      console.log(`Génération d'une URL signée pour ${(video as any).storage_path}`)

      const fullStoragePath = (video as any).storage_path as string;
      // Assurer que le storage_path est au format 'bucket_name/path/to/file.ext'
      const pathParts = fullStoragePath.split('/');
      const bucketName = pathParts[0];
      const filePathInBucket = pathParts.slice(1).join('/');

      if (!bucketName || !filePathInBucket) {
        throw new Error(`Chemin de stockage invalide: ${fullStoragePath}`);
      }

      try {
        const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
          .from(bucketName)
          .createSignedUrl(filePathInBucket, 60 * 60); // URL valide pour 1 heure

        if (signedUrlError) {
          throw signedUrlError;
        }
        
        if (!signedUrlData.signedUrl) {
          throw new Error("L'URL signée générée est vide");
        }
        
        videoUrl = signedUrlData.signedUrl;
        console.log(`URL signée générée avec succès: ${videoUrl.substring(0, 50)}...`);
      } catch (storageError: any) {
        console.error('Erreur lors de la création de l\'URL signée:', storageError);
        return new Response(
          JSON.stringify({
            error: 'Erreur de stockage',
            details: `Impossible de générer l'URL signée pour la vidéo: ${storageError.message}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
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
    console.log('Téléchargement et conversion de la vidéo en audio...');
    
    // S'assurer que l'URL est complète avec un protocole
    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      console.log(`URL vidéo sans protocole, ajout de https:// : ${videoUrl}`);
      videoUrl = `https://${videoUrl}`;
    }
    
    let audioBlob: Blob;
    try {
      console.log(`Tentative de téléchargement depuis: ${videoUrl.substring(0, 50)}...`);
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        throw new Error(`Échec du téléchargement de la vidéo. Statut: ${response.status} ${response.statusText}`);
      }
      
      audioBlob = await response.blob();
      console.log(`Vidéo téléchargée avec succès, taille: ${audioBlob.size} octets`);
    } catch (fetchError: any) {
      console.error('Erreur lors du téléchargement de la vidéo:', fetchError);
      // Mettre à jour le statut de la vidéo à FAILED
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur lors du téléchargement de la vidéo: ${fetchError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({
          error: 'Erreur de téléchargement de la vidéo',
          details: fetchError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 7. TRANSCRIRE L'AUDIO AVEC OPENAI WHISPER
    console.log('Transcription de l\'audio avec OpenAI Whisper...');
    const openai = new OpenAI({ apiKey: openaiApiKey });

    let transcription: OpenAI.Audio.Transcriptions.Transcription;
    try {
      const audioFile = new File([audioBlob], 'audio.webm', { type: audioBlob.type });
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      });
      console.log('Transcription réussie:', transcription.text.substring(0, 100) + '...');
    } catch (transcriptionError: any) {
      console.error('Erreur lors de la transcription audio:', transcriptionError);
      // Mettre à jour le statut de la vidéo à FAILED
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec de la transcription: ${transcriptionError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({ error: 'Erreur de transcription', details: transcriptionError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 8. ENREGISTRER LA TRANSCRIPTION DANS LA BASE DE DONNÉES
    console.log('Enregistrement de la transcription dans la base de données...');
    const transcriptionData = { 
      text: transcription.text,
      language: 'french', // Assumer le français pour l'instant
      duration: 0 // Placeholder, à remplacer par la durée réelle si disponible
    };

    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId as string,
        transcription_text: transcription.text,
        transcription_data: transcriptionData,
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'video_id' });

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
        .eq('id', videoId as string)

      return new Response(
        JSON.stringify({ error: 'Erreur de base de données', details: transcriptionTableError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Mettre à jour également la table videos avec les données de transcription
    const { error: videoUpdateError } = await serviceClient
      .from('videos')
      .update({
        transcription_text: transcription.text,
        transcription_data: transcriptionData,
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId as string);

    if (videoUpdateError) {
      console.error('Erreur lors de la mise à jour de la vidéo avec la transcription:', videoUpdateError);
    }

    console.log('Transcription enregistrée avec succès.')

    // 9. DÉCLENCHER LA FONCTION D'ANALYSE
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      };
      
      console.log(`Appel de la fonction analyze-transcription via fetch à ${analyzeEndpoint}`);
      
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ videoId })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erreur de la fonction d'analyse (${response.status}): ${errorText}`);
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Analyse démarrée avec succès:', responseData);
    } catch (invokeError) {
      console.error("Erreur lors de l'invocation de la fonction d'analyse:", invokeError)
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
    console.error('Erreur générale dans la fonction transcribe-video:', error)
    
    // Tentative de mise à jour du statut d'erreur si videoId est disponible et serviceClient initialisé
    try {
      if (videoId && serviceClient) {
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: `Erreur interne: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId as string);
      }
    } catch (updateError) {
      console.error('Erreur lors de la mise à jour du statut d\'erreur:', updateError);
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
