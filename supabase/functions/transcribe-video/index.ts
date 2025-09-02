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
      maxAttempts = 5 // Augmenté à 5 tentatives
    ): Promise<boolean> {
      if (attempts >= maxAttempts) {
        console.error(`Échec de confirmation de la mise à jour après ${maxAttempts} tentatives`)
        return false
      }

      try {
        // Attendre 1 seconde avant de vérifier (réduit le délai)
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Vérifier que la transcription a été sauvegardée dans la table videos
        const { data: video, error: videoError } = await client
          .from('videos')
          .select('transcription_text, status')
          .eq('id', videoId)
          .single()

        if (videoError) {
          console.log('Erreur lors de la vérification de la transcription:', videoError)
          return await confirmDatabaseUpdate(client, videoId, attempts + 1, maxAttempts)
        }

        if (!video?.transcription_text || video.status !== VIDEO_STATUS.TRANSCRIBED) {
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
          const requestBody = await clonedRequest.text(); // Lire le corps comme texte
          if (requestBody.trim().length > 0) {
            try {
              const requestData = JSON.parse(requestBody);
              if (requestData.user_id) {
                userId = requestData.user_id;
                console.log(`Utilisateur trouvé dans les données de la requête: ${userId}`);
              }
            } catch (parseError) {
              console.warn("Le corps de la requête n'est pas un JSON valide ou ne contient pas user_id.", parseError);
              // C'est ici que l'erreur 22P02 pourrait se produire si le corps est malformé et traité comme des données
            }
          }
        } catch (readError) {
          console.error("Erreur lors de la lecture du corps de la requête:", readError);
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
        console.error("Erreur lors de l'analyse du JSON de la requête (pour videoId/videoUrl):", parseError)
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
        const storagePath = (video as any).storage_path as string;
        let bucketName: string;
        let filePath: string;

        // Simplification du parsing de storage_path
        const pathParts = storagePath.split('/');
        if (pathParts.length > 1 && pathParts[0] === 'videos') {
          bucketName = pathParts[0];
          filePath = pathParts.slice(1).join('/');
        } else {
          // Si le chemin ne commence pas par 'videos/', on suppose que c'est le filePath dans le bucket 'videos'
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
          // Continuer vers l'erreur finale si aucune méthode n'a fonctionné
        }
      }
    }

    // ÉCHEC FINAL: Aucune méthode de téléchargement n'a fonctionné
    if (!audioBlob) {
      const errorMessage = `Impossible de télécharger la vidéo. Storage path: ${(video as any).storage_path || 'non défini'}, URL: ${videoUrl || 'non définie'}`;
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
        JSON.stringify({ error: 'Téléchargement impossible', details: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 6. TRANSCRIPTION AVEC OPENAI WHISPER
    console.log('Début de la transcription avec OpenAI Whisper...');
    
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    let transcriptionResult: any;
    try {
      // Créer un fichier temporaire pour OpenAI
      const file = new File([audioBlob], 'audio.mp4', { type: audioBlob.type || 'video/mp4' });
      
      console.log(`Envoi du fichier à OpenAI Whisper, taille: ${file.size} octets`);
      
      transcriptionResult = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'fr', // Français par défaut
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      });
      
      console.log('Transcription OpenAI terminée avec succès');
      console.log(`Texte transcrit (${transcriptionResult.text.length} caractères):`, transcriptionResult.text.substring(0, 200) + '...');
      
    } catch (transcriptionError: any) {
      console.error('Erreur lors de la transcription OpenAI:', transcriptionError);
      
      const errorMessage = `Erreur de transcription OpenAI: ${transcriptionError.message}`;
      
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
        JSON.stringify({ error: 'Erreur de transcription', details: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Vérifier que la transcription n'est pas vide
    if (!transcriptionResult || !transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
      const errorMessage = 'La transcription est vide ou invalide';
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
        JSON.stringify({ error: 'Transcription vide', details: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 7. ENREGISTRER LA TRANSCRIPTION DANS LA BASE DE DONNÉES
    console.log('Enregistrement de la transcription dans la base de données...');

    // Préparer les données de transcription pour l'insertion
    let transcriptionData: any = null;
    if (transcriptionResult.segments) {
      transcriptionData = {
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        duration: transcriptionResult.duration,
        segments: transcriptionResult.segments.map((s: any) => ({
          id: s.id,
          seek: s.seek,
          start: s.start,
          end: s.end,
          text: s.text,
          tokens: s.tokens,
          temperature: s.temperature,
          avg_logprob: s.avg_logprob,
          compression_ratio: s.compression_ratio,
          no_speech_prob: s.no_speech_prob,
          words: s.words || [] // Assurer que words est un tableau même s'il est vide
        }))
      };
    } else {
      // Fallback pour les cas où segments n'est pas disponible
      transcriptionData = {
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        duration: transcriptionResult.duration,
        segments: []
      };
    }
    
    // Log pour débogage
    console.log('Données de transcription à enregistrer:', JSON.stringify(transcriptionData, null, 2));

    const updatePayload: any = {
      transcription_text: transcriptionData?.text || '',
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString()
    };

    // Si transcriptionData est null, nous ne mettrons pas à jour transcription_data
    if (transcriptionData !== null) {
      // CORRECTION: Assurer que les données sont dans un format compatible avec PostgreSQL
      // Valider que transcriptionData est un objet JSON valide et non un tableau malformé
      if (typeof transcriptionData === 'object' && !Array.isArray(transcriptionData)) {
        updatePayload.transcription_data = transcriptionData;
      } else {
        console.warn('transcription_data n\'est pas un objet JSON valide, ne sera pas enregistré.');
        // Optionnel: Mettre à jour error_message si ce cas est considéré comme une erreur grave
        // updatePayload.error_message = 'Données de transcription malformées';
      }
    }

    console.log('Payload de mise à jour:', JSON.stringify(updatePayload, null, 2));

    const { error: transcriptionUpdateError } = await serviceClient
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId as string);

    if (transcriptionUpdateError) {
      console.error('Erreur lors de la mise à jour de la transcription:', transcriptionUpdateError);
      
      // CORRECTION: Tentative alternative avec des données simplifiées
      console.log('Tentative alternative avec des données simplifiées...');
      
      // Essayer avec seulement les données essentielles
      const simplifiedPayload = {
        transcription_text: transcriptionData?.text || '',
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      };
      
      const { error: retryError } = await serviceClient
        .from('videos')
        .update(simplifiedPayload)
        .eq('id', videoId as string);
          
      if (retryError) {
        console.error('Échec de la tentative alternative:', retryError);
        
        // Mettre à jour le statut de la vidéo à FAILED
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: `Erreur lors de l'enregistrement de la transcription: ${retryError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId as string);

        return new Response(
          JSON.stringify({
            error: 'Erreur d\'enregistrement de la transcription',
            details: retryError.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      } else {
        console.log('Tentative alternative réussie!');
        // Continuer le traitement normal
      }
    }

    console.log('Transcription enregistrée avec succès dans la table videos.')

    // 8. CONFIRMER LA MISE À JOUR DE LA BASE DE DONNÉES
    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId as string)
    if (!confirmed) {
      console.warn(
        `La mise à jour de la base de données pour la vidéo ${videoId} n'a pas pu être confirmée.`
      )
      
      // Mettre à jour le statut de la vidéo à FAILED si la confirmation échoue
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `La transcription a été enregistrée mais la confirmation de la base de données a échoué.`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      // Ne pas échouer pour autant, juste logger un avertissement
    }

    // 9. DÉCLENCHER LA FONCTION D'ANALYSE SEULEMENT SI LA TRANSCRIPTION EST CONFIRMÉE
    if (confirmed) {
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
          // Mettre à jour le statut de la vidéo à FAILED si l'appel à l'analyse échoue
          await serviceClient
            .from('videos')
            .update({ 
              status: VIDEO_STATUS.FAILED, 
              error_message: `Échec de l'appel à la fonction d'analyse: ${errorText}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId as string);
        } else {
          const responseData = await response.json();
          console.log('Analyse démarrée avec succès:', responseData);
        }
      } catch (invokeError: any) {
        console.error("Erreur lors de l'invocation de la fonction d'analyse:", invokeError)
        // Mettre à jour le statut de la vidéo à FAILED si l'invocation de l'analyse échoue
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: `Erreur lors de l'invocation de la fonction d'analyse: ${invokeError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId as string);
      }
    } else {
      console.warn('Analyse non déclenchée car la transcription n\'a pas été confirmée');
    }

    return new Response(
      JSON.stringify({ 
        message: 'Transcription terminée avec succès', 
        videoId,
        transcription_length: transcriptionResult.text.length,
        transcription_confirmed: confirmed
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

