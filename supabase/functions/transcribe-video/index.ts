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

    // 5. TÉLÉCHARGEMENT ET TRANSCRIPTION - VERSION CORRIGÉE
    let audioBlob: Blob | null = null;

    // Fonction améliorée pour télécharger depuis Supabase Storage
    async function downloadFromSupabaseStorage(storagePath: string): Promise<Blob | null> {
      try {
        console.log(`Tentative de téléchargement depuis le storage: ${storagePath}`);
        
        // Extraire le bucket et le chemin du fichier
        const pathParts = storagePath.split('/');
        let bucketName = 'videos';
        let filePath = storagePath;

        // Si le chemin commence par le nom du bucket, l'extraire
        if (pathParts.length > 1 && pathParts[0] === 'videos') {
          bucketName = pathParts[0];
          filePath = pathParts.slice(1).join('/');
        }
        
        console.log(`Téléchargement - Bucket: ${bucketName}, Fichier: ${filePath}`);
        
        // Méthode 1: Téléchargement direct
        try {
          const { data: fileData, error: downloadError } = await serviceClient!.storage
            .from(bucketName)
            .download(filePath);

          if (downloadError) {
            console.warn('Échec du téléchargement direct, tentative avec URL signée...');
            throw downloadError;
          }

          if (!fileData) {
            throw new Error('Aucune donnée de fichier retournée');
          }

          if (fileData.size === 0) {
            throw new Error('Le fichier téléchargé est vide');
          }

          console.log(`Téléchargement direct réussi, taille: ${fileData.size} octets, type: ${fileData.type}`);
          return fileData;
        } catch (directError) {
          // Méthode 2: URL signée
          console.log('Tentative avec URL signée...');
          const { data: signedUrlData, error: signedError } = await serviceClient!.storage
            .from(bucketName)
            .createSignedUrl(filePath, 60); // 60 secondes

          if (signedError) {
            console.warn('Échec de génération d\'URL signée:', signedError);
            throw signedError;
          }

          if (signedUrlData?.signedUrl) {
            const response = await fetch(signedUrlData.signedUrl);
            if (!response.ok) {
              throw new Error(`Échec du téléchargement via URL signée: ${response.status}`);
            }
            
            const blob = await response.blob();
            if (blob.size === 0) {
              throw new Error('Le fichier téléchargé via URL signée est vide');
            }
            
            console.log(`Téléchargement via URL signée réussi, taille: ${blob.size} octets`);
            return blob;
          }
        }
      } catch (error: any) {
        console.error('Échec du téléchargement depuis Supabase Storage:', error.message);
        return null;
      }
      return null;
    }

    // TENTATIVE PRINCIPALE: Téléchargement depuis Supabase Storage
    if ((video as any).storage_path) {
      audioBlob = await downloadFromSupabaseStorage((video as any).storage_path);
    }

    // FALLBACK: Téléchargement via URL
    if (!audioBlob) {
      if (!videoUrl) {
        videoUrl = (video as any).url;
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

    // VÉRIFICATION FINALE
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
        JSON.stringify({ 
          error: 'Téléchargement impossible', 
          details: errorMessage,
          suggestions: [
            'Vérifier que le fichier existe dans Supabase Storage',
            'Vérifier les permissions du bucket videos',
            'Vérifier que le storage_path est correct'
          ]
        }),
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
      // Déterminer le type MIME correct
      const mimeType = audioBlob.type || 'audio/mp4';
      const fileExtension = mimeType.includes('webm') ? 'webm' : 'mp4';
      const fileName = `audio.${fileExtension}`;
      
      const file = new File([audioBlob], fileName, { type: mimeType });
      
      console.log(`Envoi du fichier à OpenAI Whisper, taille: ${file.size} octets, type: ${mimeType}`);
      
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
