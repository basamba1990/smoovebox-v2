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
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY')
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

        // Vérifier que la transcription a été sauvegardée dans la table videos
        const { data: video, error: videoError } = await client
          .from('videos')
          .select('transcription_text')
          .eq('id', videoId)
          .single()

        if (videoError || !video?.transcription_text) {
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
            if (token.startsWith('\"') && token.endsWith('\"')) {
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

    // 5. TÉLÉCHARGEMENT ET TRANSCRIPTION - LOGIQUE CORRIGÉE
    let audioBlob: Blob | null = null;

    // PRIORITÉ 1: Téléchargement direct via storage_path (TOUJOURS en premier)
    if ((video as any).storage_path) {
      console.log(`Tentative de téléchargement direct depuis le storage: ${(video as any).storage_path}`)
      
      try {
        // Extraire le chemin de stockage et le parser correctement
        const storagePath = (video as any).storage_path as string;
        
        // Déterminer si le chemin contient déjà le nom du bucket ou non
        let bucketName, filePath;
        
        // Différentes structures possibles de storage_path
        if (storagePath.startsWith('videos/')) {
          // Format "videos/user_id/filename.ext"
          bucketName = 'videos';
          filePath = storagePath.replace('videos/', '');
        } else if (storagePath.includes('/')) {
          // Format "user_id/filename.ext" (bucket implicite "videos")
          bucketName = 'videos';
          filePath = storagePath;
        } else {
          // Format simple "filename.ext" (peu probable, mais par sécurité)
          bucketName = 'videos';
          filePath = storagePath;
        }
        
        console.log(`Téléchargement direct - Bucket: ${bucketName}, Fichier: ${filePath}`);
        
        // TÉLÉCHARGEMENT DIRECT VIA L'API STORAGE
        const { data: fileData, error: downloadError } = await serviceClient.storage
          .from(bucketName)
          .download(filePath);

        if (downloadError) {
          console.error('Erreur de téléchargement direct:', downloadError);
          throw downloadError;
        }

        if (!fileData) {
          throw new Error('Aucune donnée de fichier retournée par le téléchargement');
        }

        console.log(`Fichier téléchargé directement avec succès, taille: ${fileData.size} octets`);
        
        // Vérifier que le fichier n'est pas vide
        if (fileData.size === 0) {
          throw new Error('Le fichier téléchargé est vide');
        }

        // Succès du téléchargement direct
        audioBlob = fileData;
        console.log(`Téléchargement direct réussi, type: ${audioBlob.type}`);
        
      } catch (storageError: any) {
        console.error('Échec du téléchargement direct:', storageError.message);
        console.log('Tentative de fallback vers URL si disponible...');
        // Ne pas retourner d'erreur ici, continuer vers le fallback URL
      }
    }

    // PRIORITÉ 2: Fallback URL SEULEMENT si téléchargement direct a échoué ET URL valide disponible
    if (!audioBlob) {
      // Récupérer videoUrl si pas encore fait
      if (!videoUrl) {
        videoUrl = (video as any).url
      }

      // Vérifier si l'URL est valide AVANT de tenter le téléchargement
      let isValidUrl = false;
      if (videoUrl) {
        try {
          const testUrl = new URL(videoUrl);
          if (testUrl.protocol && testUrl.protocol.startsWith('http')) {
            isValidUrl = true;
            console.log(`URL valide détectée pour fallback: ${videoUrl.substring(0, 50)}...`);
          }
        } catch (urlError) {
          console.log(`URL invalide détectée, ignorée: ${videoUrl}`);
        }
      }

      if (isValidUrl && videoUrl) {
        console.log(`Tentative de téléchargement via URL fallback...`);
        
        try {
          const response = await fetch(videoUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Supabase-Edge-Function/1.0'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Échec du téléchargement via URL. Statut: ${response.status} ${response.statusText}`);
          }
          
          audioBlob = await response.blob();
          console.log(`Téléchargement via URL réussi, taille: ${audioBlob.size} octets`);
          
          // Vérifier que le blob n'est pas vide
          if (audioBlob.size === 0) {
            throw new Error('Le fichier téléchargé via URL est vide');
          }
          
        } catch (fetchError: any) {
          console.error('Échec du téléchargement via URL:', fetchError.message);
          // audioBlob reste null
        }
      }
    }

    // VÉRIFICATION FINALE: Si aucune méthode n'a fonctionné
    if (!audioBlob) {
      const errorMessage = 'Impossible de télécharger le fichier vidéo par aucune méthode disponible';
      console.error(errorMessage);
      
      // Mettre à jour le statut de la vidéo à FAILED
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({
          error: 'Erreur de téléchargement',
          details: errorMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 6. TRANSCRIPTION AVEC OPENAI WHISPER
    console.log('Début de la transcription avec OpenAI Whisper...')
    
    const openai = new OpenAI({
      apiKey: openaiApiKey
    })

    // Créer un fichier temporaire pour l'audio
    const audioFile = new File([audioBlob], 'audio.mp4', { type: audioBlob.type || 'audio/mp4' })
    
    let transcription: any;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'fr', // Français par défaut
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      })
      
      console.log('Transcription réussie:', {
        duration: transcription.duration,
        language: transcription.language,
        text_length: transcription.text?.length || 0
      })
    } catch (transcriptionError: any) {
      console.error('Erreur lors de la transcription:', transcriptionError)
      
      // Mettre à jour le statut de la vidéo à FAILED
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec de la transcription: ${transcriptionError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string)

      return new Response(
        JSON.stringify({
          error: 'Échec de la transcription',
          details: transcriptionError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 7. ENREGISTREMENT DE LA TRANSCRIPTION DANS LA TABLE VIDEOS
    console.log('Enregistrement de la transcription dans la base de données...')
    
    // CORRECTION: Sauvegarder directement dans la table videos au lieu de créer une table transcriptions séparée
    const { error: transcriptionUpdateError } = await serviceClient
      .from('videos')
      .update({
        transcription_text: transcription.text,
        transcription_data: transcription, // Données complètes de la transcription
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId as string);

    if (transcriptionUpdateError) {
      console.error('Erreur lors de la mise à jour de la transcription:', transcriptionUpdateError);
      
      // Mettre à jour le statut de la vidéo à FAILED
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur lors de l'enregistrement de la transcription: ${transcriptionUpdateError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({
          error: 'Erreur d\'enregistrement de la transcription',
          details: transcriptionUpdateError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Transcription enregistrée avec succès dans la table videos.')

    // 8. DÉCLENCHER LA FONCTION D'ANALYSE
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      
      // CORRECTION: Les en-têtes doivent être un objet simple, pas une chaîne JSON
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

    // 9. CONFIRMER LA MISE À JOUR DE LA BASE DE DONNÉES
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
