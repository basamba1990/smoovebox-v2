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

// Fonction utilitaire pour valider et normaliser les URLs
function validateAndNormalizeUrl(url: string, supabaseUrl?: string): string {
  try {
    // Si l'URL est déjà complète, la retourner telle quelle
    new URL(url);
    return url;
  } catch {
    // Si ce n'est pas une URL valide, essayer de la construire
    if (supabaseUrl && url.startsWith('/')) {
      // URL relative commençant par /
      return `${supabaseUrl.replace(/\/$/, '')}${url}`;
    } else if (supabaseUrl && !url.includes('://')) {
      // Chemin relatif sans protocole
      return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${url}`;
    }
    
    // Si on ne peut pas construire une URL valide, lever une erreur
    throw new Error(`URL invalide: ${url}`);
  }
}

// Fonction pour détecter automatiquement le bon bucket
async function detectCorrectBucket(serviceClient: any, storagePath: string): Promise<{ bucket: string, filePath: string }> {
  console.log(`Détection automatique du bucket pour le chemin: ${storagePath}`);
  
  // Lister tous les buckets disponibles
  const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets();
  
  if (bucketsError) {
    console.error('Erreur lors de la récupération des buckets:', bucketsError);
    throw new Error(`Impossible de récupérer les buckets: ${bucketsError.message}`);
  }
  
  const availableBuckets = (buckets || []).map((b: any) => b.name);
  console.log('Buckets disponibles:', availableBuckets);
  
  if (availableBuckets.length === 0) {
    throw new Error('Aucun bucket de stockage disponible');
  }
  
  // Si le chemin contient déjà un bucket, l'extraire
  if (storagePath.includes('/')) {
    const parts = storagePath.split('/');
    const possibleBucket = parts[0];
    
    if (availableBuckets.includes(possibleBucket)) {
      const filePath = parts.slice(1).join('/');
      console.log(`Bucket détecté dans le chemin: ${possibleBucket}, fichier: ${filePath}`);
      return { bucket: possibleBucket, filePath };
    }
  }
  
  // Essayer les buckets courants pour les vidéos
  const commonBuckets = ['videos', 'video', 'uploads', 'files', 'media'];
  for (const bucketName of commonBuckets) {
    if (availableBuckets.includes(bucketName)) {
      console.log(`Utilisation du bucket commun: ${bucketName}`);
      return { bucket: bucketName, filePath: storagePath };
    }
  }
  
  // Utiliser le premier bucket disponible
  const defaultBucket = availableBuckets[0];
  console.log(`Utilisation du bucket par défaut: ${defaultBucket}`);
  return { bucket: defaultBucket, filePath: storagePath };
}

// Fonction utilitaire pour télécharger un fichier avec retry et en-têtes appropriés
async function downloadVideoWithRetry(url: string, maxRetries = 3): Promise<Blob> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentative de téléchargement ${attempt}/${maxRetries}: ${url.substring(0, 100)}...`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Supabase-Edge-Functions/1.0',
          'Accept': '*/*',
          'Cache-Control': 'no-cache'
        },
        // Timeout pour éviter les blocages
        signal: AbortSignal.timeout(60000) // 60 secondes
      });
      
      console.log(`Réponse reçue: ${response.status} ${response.statusText}`);
      console.log('En-têtes de réponse:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Impossible de lire le corps de la réponse');
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
      }
      
      const blob = await response.blob();
      console.log(`Téléchargement réussi, taille: ${blob.size} bytes, type: ${blob.type}`);
      
      if (blob.size === 0) {
        throw new Error('Le fichier téléchargé est vide');
      }
      
      return blob;
      
    } catch (error: any) {
      lastError = error;
      console.error(`Échec de la tentative ${attempt}:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Backoff exponentiel
        console.log(`Attente de ${delay}ms avant la prochaine tentative...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Échec du téléchargement après ${maxRetries} tentatives. Dernière erreur: ${lastError?.message}`);
}

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null;

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
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
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

      try {
        // Détecter automatiquement le bon bucket
        const { bucket, filePath } = await detectCorrectBucket(serviceClient, (video as any).storage_path);
        
        console.log(`Bucket détecté: ${bucket}, chemin du fichier: ${filePath}`);

        // Vérifier l'existence du fichier dans le bucket
        const parentPath = filePath.split('/').slice(0, -1).join('/') || undefined
        console.log(`Vérification du contenu du dossier: ${parentPath || '(racine)'}`);

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

        // Créer une URL signée avec une durée plus longue et des permissions appropriées
        const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600) // 1 heure

        if (signedUrlError) throw signedUrlError

        videoUrl = signedUrlData.signedUrl
        console.log(`URL signée générée avec succès: ${videoUrl.substring(0, 100)}...`)
        
        // Vérifier que l'URL signée est accessible
        try {
          const testResponse = await fetch(videoUrl, { method: 'HEAD' });
          console.log(`Test de l'URL signée: ${testResponse.status} ${testResponse.statusText}`);
          if (!testResponse.ok) {
            console.warn(`L'URL signée n'est pas accessible: ${testResponse.status}`);
          }
        } catch (testError) {
          console.warn(`Impossible de tester l'URL signée:`, testError);
        }
        
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

    // VALIDATION ET NORMALISATION DE L'URL AVANT LE TÉLÉCHARGEMENT
    try {
      videoUrl = validateAndNormalizeUrl(videoUrl, supabaseUrl);
      console.log(`URL validée et normalisée: ${videoUrl.substring(0, 100)}...`);
    } catch (urlError) {
      console.error('Erreur de validation de l\'URL:', urlError);
      return new Response(
        JSON.stringify({
          error: 'URL vidéo invalide',
          details: `L'URL de la vidéo n'est pas valide: ${urlError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 6. TÉLÉCHARGER LA VIDÉO ET LA CONVERTIR EN AUDIO
    console.log('Téléchargement et conversion de la vidéo en audio...')
    
    let audioBlob: Blob;
    try {
      audioBlob = await downloadVideoWithRetry(videoUrl, 3);
    } catch (fetchError) {
      console.error('Erreur lors du téléchargement de la vidéo:', fetchError);
      
      // Mettre à jour le statut de la vidéo à FAILED
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec du téléchargement: ${fetchError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string)
      
      return new Response(
        JSON.stringify({
          error: 'Erreur de téléchargement',
          details: `Impossible de télécharger la vidéo: ${fetchError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 7. PRÉPARER LA TRANSCRIPTION AVEC OPENAI WHISPER
    console.log('Préparation de la transcription avec OpenAI Whisper...')
    const openai = new OpenAI({ apiKey: openaiApiKey })

    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: new File([audioBlob], 'audio.mp3', { type: 'audio/mp3' }),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json' // Important pour avoir les segments et les scores de confiance
      })
      console.log('Transcription OpenAI terminée avec succès')
    } catch (transcriptionError: any) {
      console.error('Erreur lors de la transcription OpenAI:', transcriptionError)
      
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
          error: 'Erreur de transcription',
          details: `Impossible de transcrire la vidéo: ${transcriptionError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 8. ENREGISTRER LA TRANSCRIPTION DANS LA BASE DE DONNÉES
    console.log('Enregistrement de la transcription dans la base de données...')

    // Préparer les données de transcription
    const transcriptionData = {
      text: transcription.text,
      language: transcription.language || 'fr',
      duration: transcription.duration || 0,
      segments: transcription.segments || [],
      words: (transcription as any).words || []
    }

    // Calculer le score de confiance moyen
    let averageConfidence = 0;
    if (transcription.segments && transcription.segments.length > 0) {
      const confidenceSum = transcription.segments.reduce((sum: number, segment: any) => {
        return sum + (segment.avg_logprob || 0);
      }, 0);
      averageConfidence = confidenceSum / transcription.segments.length;
    }

    // Insérer dans la table transcriptions
    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId,
        text: transcription.text,
        language: transcription.language || 'fr',
        duration: transcription.duration || 0,
        confidence_score: averageConfidence,
        segments: transcription.segments || [],
        words: (transcription as any).words || [],
        raw_response: transcriptionData,
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
    
    // Tentative de mise à jour du statut d'erreur si videoId est disponible
    try {
      if (videoId) {
        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
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
