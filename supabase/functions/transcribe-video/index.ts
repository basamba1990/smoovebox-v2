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

    console.log('Clé de service Supabase:', supabaseServiceKey ? 'Définie' : 'Non définie');

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
      maxAttempts = 5
    ): Promise<boolean> {
      if (attempts >= maxAttempts) {
        console.error(`Échec de confirmation de la mise à jour après ${maxAttempts} tentatives`)
        return false
      }

      try {
        await new Promise((resolve) => setTimeout(resolve, 1000))
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

    const userAgent = req.headers.get('user-agent') || ''
    const isWhatsApp = userAgent.includes('WhatsApp')

    if (isWhatsApp || req.method === 'GET') {
      const url = new URL(req.url)
      userId = url.searchParams.get('userId') || 'whatsapp-user'
      console.log(`Utilisateur WhatsApp/GET détecté: ${userId}`)
    } else {
      const authHeader = req.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '')
        console.log("Token d'authentification trouvé dans l'en-tête Authorization")
      } else if (req.headers.get('apikey')) {
        token = req.headers.get('apikey')
        console.log("Token d'authentification trouvé dans l'en-tête apikey")
      } else {
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
              token = token.slice(1, -1)
            }
            console.log("Token d'authentification trouvé dans les cookies")
          }
        }
      }

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

      if (!userId) {
        try {
          const clonedRequest = req.clone()
          const requestBody = await clonedRequest.text();
          if (requestBody.trim().length > 0) {
            try {
              const requestData = JSON.parse(requestBody);
              if (requestData.user_id) {
                userId = requestData.user_id;
                console.log(`Utilisateur trouvé dans les données de la requête: ${userId}`);
              }
            } catch (parseError) {
              console.warn("Le corps de la requête n'est pas un JSON valide ou ne contient pas user_id.", parseError);
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
            details: "Impossible d'identifier l'utilisateur."
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }
    }

    // 2. RÉCUPÉRER LES DONNÉES DE LA REQUÊTE
    let videoUrl: string | null = null
    const url = new URL(req.url)
    videoId = url.searchParams.get('videoId')
    
    if (videoId) {
      console.log(`VideoId récupéré des paramètres d'URL: ${videoId}`)
      videoUrl = url.searchParams.get('videoUrl')
    }

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
      }
    }

    if (!videoId) {
      console.error('VideoId non trouvé')
      return new Response(
        JSON.stringify({ 
          error: 'videoId est requis',
          details: 'Veuillez fournir videoId'
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

    // 5. TÉLÉCHARGEMENT ET TRANSCRIPTION
    let audioBlob: Blob | null = null;

    if ((video as any).storage_path) {
      console.log(`Tentative de téléchargement direct depuis le storage: ${(video as any).storage_path}`)
      
      try {
        const storagePath = (video as any).storage_path as string;
        let bucketName: string;
        let filePath: string;

        const pathParts = storagePath.split('/');
        if (pathParts.length > 1 && pathParts[0] === 'videos') {
          bucketName = pathParts[0];
          filePath = pathParts.slice(1).join('/');
        } else {
          bucketName = 'videos';
          filePath = storagePath;
        }
        
        console.log(`Téléchargement direct - Bucket: ${bucketName}, Fichier: ${filePath}`);
        
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
        
        if (fileData.size === 0) {
          throw new Error('Le fichier téléchargé est vide');
        }

        audioBlob = fileData;
        console.log(`Téléchargement direct réussi, type: ${audioBlob.type}`);
        
      } catch (storageError: any) {
        console.error('Échec du téléchargement direct:', storageError.message);
      }
    }

    if (!audioBlob) {
      if (!videoUrl) {
        videoUrl = (video as any).url
      }

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
          
          if (audioBlob.size === 0) {
            throw new Error('Le fichier téléchargé via URL est vide');
          }
          
        } catch (fetchError: any) {
          console.error('Échec du téléchargement via URL:', fetchError.message);
        }
      }
    }

    if (!audioBlob) {
      const errorMessage = `Impossible de télécharger la vidéo. Storage path: ${(video as any).storage_path || 'non défini'}, URL: ${videoUrl || 'non définie'}`;
      console.error(errorMessage);
      
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
      const file = new File([audioBlob], 'audio.mp4', { type: audioBlob.type || 'video/mp4' });
      
      console.log(`Envoi du fichier à OpenAI Whisper, taille: ${file.size} octets`);
      
      transcriptionResult = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      });
      
      console.log('Transcription OpenAI terminée avec succès');
      console.log(`Texte transcrit (${transcriptionResult.text.length} caractères):`, transcriptionResult.text.substring(0, 200) + '...');
      
    } catch (transcriptionError: any) {
      console.error('Erreur lors de la transcription OpenAI:', transcriptionError);
      
      const errorMessage = `Erreur de transcription OpenAI: ${transcriptionError.message}`;
      
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

    if (!transcriptionResult || !transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
      const errorMessage = 'La transcription est vide ou invalide';
      console.error(errorMessage);
      
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
          words: s.words || []
        }))
      };
    } else {
      transcriptionData = {
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        duration: transcriptionResult.duration,
        segments: []
      };
    }
    
    console.log('Données de transcription à enregistrer:', JSON.stringify(transcriptionData, null, 2));

    const updatePayload: any = {
      transcription_text: transcriptionData?.text || '',
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString()
    };

    // Validation stricte pour transcription_data
    if (transcriptionData !== null) {
      if (typeof transcriptionData === 'object' && !Array.isArray(transcriptionData)) {
        try {
          JSON.stringify(transcriptionData);
          updatePayload.transcription_data = transcriptionData;
        } catch (e) {
          console.error('Erreur de sérialisation JSON pour transcription_data:', e);
          updatePayload.error_message = 'Données de transcription malformées';
          updatePayload.transcription_data = null;
        }
      } else {
        console.warn('transcription_data n\'est pas un objet JSON valide, non enregistré.');
        updatePayload.error_message = 'Données de transcription malformées';
        updatePayload.transcription_data = null;
      }
    }

    console.log('Payload de mise à jour pour la table videos:', JSON.stringify(updatePayload, null, 2));

    const { error: transcriptionUpdateError } = await serviceClient
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId as string);

    if (transcriptionUpdateError) {
      console.error('Erreur lors de la mise à jour de la transcription:', transcriptionUpdateError);
      
      console.log('Tentative alternative avec des données simplifiées...');
      
      const simplifiedPayload = {
        transcription_text: transcriptionData?.text || '',
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      };
      
      console.log('Payload simplifié:', JSON.stringify(simplifiedPayload, null, 2));

      const { error: retryError } = await serviceClient
        .from('videos')
        .update(simplifiedPayload)
        .eq('id', videoId as string);
          
      if (retryError) {
        console.error('Échec de la tentative alternative:', retryError);
        
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
      }
    }

    console.log('Transcription enregistrée avec succès dans la table videos.')

    // 8. CONFIRMER LA MISE À JOUR DE LA BASE DE DONNÉES
    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId as string)
    if (!confirmed) {
      console.warn(`La mise à jour de la base de données pour la vidéo ${videoId} n'a pas pu être confirmée.`)
      
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `La transcription a été enregistrée mais la confirmation de la base de données a échoué.`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);
    }

    // 9. DÉCLENCHER LA FONCTION D'ANALYSE
    if (confirmed) {
      try {
        const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        };
        
        console.log(`Appel de la fonction analyze-transcription à ${analyzeEndpoint}`);
        console.log('En-têtes:', JSON.stringify(headers, null, 2));
        
        const response = await fetch(analyzeEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ videoId })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Erreur de la fonction d'analyse (${response.status}): ${errorText}`);
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
    
    return new Response(
      JSON.stringify({
        error: 'Erreur interne du serveur',
        details: error.message || 'Une erreur inattendue est survenue.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
