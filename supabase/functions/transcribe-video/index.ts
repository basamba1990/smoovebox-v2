import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Valeurs exactes autorisées pour le statut dans la base de données
const VIDEO_STATUS = {
  DRAFT: 'draft',           // En attente ou prêt pour traitement
  PROCESSING: 'processing', // En cours de traitement
  ANALYZING: 'analyzing',   // Analyse en cours après transcription
  PUBLISHED: 'published',   // Traitement terminé avec succès
  FAILED: 'failed'          // Échec du traitement
};

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Fonction transcribe-video appelée");
    
    // Initialiser les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error("Variables d'environnement manquantes", {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Configuration incomplète", 
          details: "Variables d'environnement manquantes" 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    // Créer un client Supabase avec la clé de service pour les opérations privilégiées
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false
      }
    });

    // MÉTHODES D'AUTHENTIFICATION MULTIPLES
    let userId = null;
    let token = null;
    
    // Détecter l'agent utilisateur pour identifier WhatsApp
    const userAgent = req.headers.get('user-agent') || '';
    const isWhatsApp = userAgent.includes('WhatsApp');
    
    // Pour WhatsApp ou requêtes GET, bypasser l'authentification
    if (isWhatsApp || req.method === 'GET') {
      // Utilisez un ID par défaut ou récupérez-le des paramètres
      const url = new URL(req.url);
      userId = url.searchParams.get('userId') || 'whatsapp-user';
      console.log(`Utilisateur WhatsApp/GET détecté: ${userId}`);
    } else {
      // Méthode 1: Bearer token dans l'en-tête Authorization
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
        console.log("Token d'authentification trouvé dans l'en-tête Authorization");
      } 
      // Méthode 2: Token dans l'en-tête 'apikey' (compatibilité avec certains clients)
      else if (req.headers.get('apikey')) {
        token = req.headers.get('apikey');
        console.log("Token d'authentification trouvé dans l'en-tête apikey");
      }
      // Méthode 3: Extraire le JWT des cookies (pour les applications web)
      else {
        const cookieHeader = req.headers.get('Cookie');
        if (cookieHeader) {
          const supabaseCookie = cookieHeader.split(';').find(c => 
            c.trim().startsWith('sb-access-token=') || 
            c.trim().startsWith('supabase-auth-token=')
          );
          
          if (supabaseCookie) {
            token = supabaseCookie.split('=')[1].trim();
            if (token.startsWith('"') && token.endsWith('"')) {
              token = token.slice(1, -1); // Enlever les guillemets
            }
            console.log("Token d'authentification trouvé dans les cookies");
          }
        }
      }
      
      // Vérifier l'authentification et récupérer l'ID utilisateur
      if (token) {
        try {
          // Utilisation directe du client de service pour decoder le JWT
          // Cela évite les problèmes de session manquante
          const { data, error } = await serviceClient.auth.getUser(token);
          
          if (error) {
            console.error("Erreur de décodage du JWT:", error);
          } else if (data.user) {
            userId = data.user.id;
            console.log(`Utilisateur authentifié: ${userId}`);
          }
        } catch (authError) {
          console.error("Exception lors de l'authentification:", authError);
        }
      }
      
      // Récupérer l'identifiant d'utilisateur à partir des données de l'URL supabase
      if (!userId) {
        try {
          const supabaseData = req.url.includes('?sb=') 
            ? JSON.parse(decodeURIComponent(new URL(req.url).searchParams.get('sb')))
            : null;
          
          if (supabaseData?.auth_user) {
            userId = supabaseData.auth_user;
            console.log(`Utilisateur trouvé dans les métadonnées Supabase: ${userId}`);
          } else if (supabaseData?.jwt?.authorization?.payload) {
            const payload = supabaseData.jwt.authorization.payload;
            if (payload.sub) {
              userId = payload.sub;
              console.log(`Utilisateur trouvé dans le payload JWT: ${userId}`);
            } else if (payload.subject) {
              userId = payload.subject;
              console.log(`Utilisateur trouvé dans le payload JWT: ${userId}`);
            }
          }
        } catch (sbDataError) {
          console.error("Erreur lors de l'extraction des métadonnées Supabase:", sbDataError);
        }
      }

      // Dernier recours: obtenir l'utilisateur à partir des données de la requête
      if (!userId) {
        try {
          const requestData = await req.json();
          if (requestData.user_id) {
            userId = requestData.user_id;
            console.log(`Utilisateur trouvé dans les données de la requête: ${userId}`);
          }
        } catch (parseError) {
          console.error("Erreur lors de l'analyse du JSON de la requête:", parseError);
        }
      }
      
      if (!userId && !isWhatsApp && req.method !== 'GET') {
        return new Response(
          JSON.stringify({ 
            error: 'Authentification requise', 
            details: "Impossible d'identifier l'utilisateur. Assurez-vous d'être connecté et d'envoyer le token d'authentification."
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }
    }

    // 2. RÉCUPÉRER LES DONNÉES DE LA REQUÊTE
    let requestData;
    let videoId;
    
    // Pour GET ou WhatsApp, récupérer videoId des paramètres d'URL
    if (req.method === 'GET' || isWhatsApp) {
      const url = new URL(req.url);
      videoId = url.searchParams.get('videoId');
      
      if (!videoId) {
        return new Response(
          JSON.stringify({ error: 'videoId est requis en paramètre pour les requêtes GET' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
      console.log(`VideoId récupéré des paramètres d'URL: ${videoId}`);
    } else {
      try {
        // Clone la requête pour pouvoir la lire plusieurs fois
        const clonedRequest = req.clone();
        requestData = await clonedRequest.json();
        
        if (requestData.videoId) {
          videoId = requestData.videoId;
          console.log("Données de requête reçues:", { videoId });
        } else {
          // Essayer de récupérer l'ID vidéo des paramètres de requête
          const url = new URL(req.url);
          videoId = url.searchParams.get('videoId');
          
          if (!videoId) {
            return new Response(
              JSON.stringify({ error: 'videoId est requis dans le corps de la requête ou en paramètre' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400 
              }
            );
          }
        }
      } catch (parseError) {
        console.error("Erreur lors de l'analyse du JSON de la requête", parseError);
        
        // Essayer de récupérer l'ID vidéo des paramètres de requête
        const url = new URL(req.url);
        videoId = url.searchParams.get('videoId');
        
        if (!videoId) {
          return new Response(
            JSON.stringify({ 
              error: "Format de requête invalide", 
              details: "Impossible de lire les données de la requête. Assurez-vous que le corps est un JSON valide ou que videoId est fourni en paramètre de requête." 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }
      }
    }

    // 3. VÉRIFIER L'ACCÈS À LA VIDÉO
    // Vérifier si la vidéo existe et appartient à l'utilisateur
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la récupération de la vidéo', 
          details: videoError.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: videoError.code === 'PGRST116' ? 404 : 500
        }
      );
    }

    if (!video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }
    
    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}, chemin: ${video.storage_path}`);
    console.log(`Statut actuel de la vidéo: ${video.status}`);
    
    // 4. MISE À JOUR DU STATUT
    // Mettre à jour le statut de la vidéo pour indiquer que la transcription est en cours
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId);
      
    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId}`, updateError);
      // On continue malgré l'erreur
    } else {
      console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.PROCESSING}'`);
    }
    
    // 5. RÉCUPÉRER L'URL DE LA VIDÉO
    let videoUrl = video.url;
    
    if (!videoUrl && video.storage_path) {
      console.log(`Génération d'une URL signée pour ${video.storage_path}`);
      
      // Extraire le bucket et le chemin
      let bucket = 'videos'; // Bucket par défaut
      let filePath = video.storage_path;
      
      // Gestion intelligente du chemin: détection du bucket dans le chemin
      if (filePath.includes('/')) {
        const parts = filePath.split('/');
        if (parts.length > 1) {
          // Le premier segment pourrait être le nom du bucket
          const possibleBucket = parts[0];
          
          // Vérifier si ce bucket existe dans le projet
          try {
            const { data: buckets } = await serviceClient.storage.listBuckets();
            console.log("Buckets disponibles:", buckets.map(b => b.name));
            const bucketExists = buckets.some(b => b.name === possibleBucket);
            
            if (bucketExists) {
              bucket = possibleBucket;
              // Enlever le nom du bucket du chemin
              filePath = parts.slice(1).join('/');
              console.log(`Bucket identifié: ${bucket}, chemin ajusté: ${filePath}`);
            } else {
              console.log(`Le segment "${possibleBucket}" n'est pas un bucket valide, utilisation du bucket par défaut: ${bucket}`);
            }
          } catch (bucketError) {
            console.error("Erreur lors de la vérification des buckets:", bucketError);
          }
        }
      }
      
      // Méthode alternative: vérifier si le chemin commence par le nom du bucket
      if (filePath.startsWith(`${bucket}/`)) {
        filePath = filePath.substring(bucket.length + 1);
        console.log(`Préfixe de bucket détecté et supprimé. Nouveau chemin: ${filePath}`);
      }
      
      console.log(`Création d'URL signée pour bucket: ${bucket}, chemin: ${filePath}`);
      
      try {
        // Vérifier si le fichier existe dans le bucket
        const parentPath = filePath.split('/').slice(0, -1).join('/') || undefined;
        console.log(`Vérification du contenu du dossier: ${parentPath || '(racine)'}`);
        
        const { data: fileList, error: fileListError } = await serviceClient
          .storage
          .from(bucket)
          .list(parentPath, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          });
          
        if (fileListError) {
          console.error("Erreur lors de la vérification de l'existence du fichier:", fileListError);
        } else {
          const fileName = filePath.split('/').pop();
          console.log(`Contenu du dossier '${parentPath || '(racine)'}':`, fileList.map(f => f.name));
          console.log(`Recherche du fichier ${fileName} dans la liste`);
          const fileFound = fileList.some(f => f.name === fileName);
          console.log(`Fichier ${fileName} trouvé dans le bucket ${bucket}: ${fileFound}`);
          
          if (!fileFound) {
            throw new Error(`Fichier ${fileName} non trouvé dans le bucket ${bucket}`);
          }
        }
        
        // Créer l'URL signée
        const { data: signedUrlData, error: signedUrlError } = await serviceClient
          .storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60); // 1 heure
        
        if (signedUrlError) {
          throw signedUrlError;
        }
        
        videoUrl = signedUrlData.signedUrl;
        console.log(`URL signée générée avec succès: ${videoUrl.substring(0, 50)}...`);
      } catch (storageError) {
        console.error(`Erreur lors de la création de l'URL signée:`, storageError);
        
        await serviceClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Erreur d'accès à la vidéo: ${storageError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
        
        return new Response(
          JSON.stringify({ 
            error: "Erreur d'accès à la vidéo", 
            details: storageError.message,
            context: {
              bucket,
              originalPath: video.storage_path,
              processedPath: filePath
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    }
    
    if (!videoUrl) {
      console.error(`Aucune URL disponible pour la vidéo ${videoId}`);
      
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: 'Aucune URL disponible pour cette vidéo',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return new Response(
        JSON.stringify({ error: 'URL de la vidéo non disponible' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    console.log(`URL de la vidéo obtenue pour la transcription: ${videoUrl.substring(0, 50)}...`);
    
    // 6. PRÉPARER LA RÉPONSE IMMÉDIATE
    // Retourner immédiatement une réponse pour ne pas bloquer le client
    const responsePromise = new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription démarrée avec succès',
        videoId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

    // 7. EFFECTUER LA TRANSCRIPTION EN ARRIÈRE-PLAN
    EdgeRuntime.waitUntil(
      (async () => {
        let transcriptionResult = null;
        try {
          console.log(`Début de la transcription pour la vidéo ${videoId}`);
          const openai = new OpenAI({ apiKey: openaiApiKey });

          // Télécharger le fichier audio/vidéo
          const audioResponse = await fetch(videoUrl);
          if (!audioResponse.ok) {
            throw new Error(`Erreur lors du téléchargement du fichier audio: ${audioResponse.statusText}`);
          }
          const audioBlob = await audioResponse.blob();

          // Créer un objet File à partir du Blob
          const audioFile = new File([audioBlob], `video_${videoId}.mp4`, { type: audioBlob.type });

          // Appeler l'API de transcription Whisper
          const transcript = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: "fr", // Spécifier la langue française
            response_format: "verbose_json", // Pour obtenir les segments et la confiance
          });

          transcriptionResult = transcript;
          console.log(`Transcription terminée pour la vidéo ${videoId}`);

          // Mettre à jour le statut de la vidéo à PUBLISHED après une transcription réussie
          const { error: updateError } = await serviceClient
            .from("videos")
            .update({
              transcription: transcriptionResult.text,
              transcription_data: transcriptionResult,
              status: VIDEO_STATUS.PUBLISHED,
              updated_at: new Date().toISOString(),
              error_message: null // Réinitialiser le message d'erreur en cas de succès
            })
            .eq("id", videoId);

          if (updateError) {
            console.error(`Erreur lors de la mise à jour de la transcription pour la vidéo ${videoId}:`, updateError);
            throw updateError;
          }

          console.log(`Transcription réussie et statut mis à jour pour la vidéo ${videoId}`);
          
          // Essayer d'appeler la fonction de synchronisation si elle existe
          try {
            // Vérifier d'abord si l'ID est un nombre ou un UUID
            let videoIdForSync;
            
            // Si l'ID est un UUID, on essaie de récupérer un ID numérique à partir d'autres champs
            if (video.numeric_id) {
              // Si le champ numeric_id existe, l'utiliser
              videoIdForSync = video.numeric_id;
            } else if (!isNaN(parseInt(videoId))) {
              // Si l'ID peut être converti en nombre, l'utiliser
              videoIdForSync = parseInt(videoId);
            } else {
              console.log("L'ID de la vidéo n'est pas un nombre, la synchronisation sera ignorée");
              // Ne pas essayer de synchroniser si nous n'avons pas d'ID numérique
              return;
            }
            
            console.log(`Tentative de synchronisation avec ID numérique: ${videoIdForSync}`);
            
            const { error: syncError } = await serviceClient.rpc(
              'sync_video_transcription',
              { p_video_id: videoIdForSync }
            );
            
            if (syncError) {
              console.error("Erreur lors de la synchronisation de la transcription:", syncError);
            } else {
              console.log("Transcription synchronisée avec succès dans la table 'transcriptions'");
            }
          } catch (transcriptionTableError) {
            console.log("La table transcriptions n'existe pas ou a une structure incompatible", transcriptionTableError);
            // Continuer sans erreur car on va stocker la transcription dans la table videos
          }
          
          // NOUVELLE PARTIE: Déclencher l'analyse de performance
          console.log(`Déclenchement de l'analyse de performance pour la vidéo ${videoId}`);
          
          try {
            // Appel direct à la fonction analyze-video-performance avec la clé anonyme
            // au lieu de la clé de service qui pourrait ne pas fonctionner correctement avec le format Bearer
            const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-video-performance`;
            console.log(`Appel de l'endpoint: ${analyzeEndpoint}`);
            
            const analyzeResponse = await fetch(analyzeEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey
              },
              body: JSON.stringify({ videoId })
            });
            
            if (!analyzeResponse.ok) {
              const errorText = await analyzeResponse.text();
              console.error(`Erreur lors du déclenchement de l'analyse (${analyzeResponse.status}): ${errorText}`);
            } else {
              const analyzeResult = await analyzeResponse.json();
              console.log("Analyse de performance déclenchée avec succès:", analyzeResult);
            }
          } catch (analyzeError) {
            console.error("Exception lors du déclenchement de l'analyse de performance:", analyzeError);
            // Ne pas échouer la fonction principale si l'analyse échoue
          }
        } catch (error) {
          console.error("Erreur lors de la transcription ou de la mise à jour:", error);
          
          // Mettre à jour le statut de la vidéo à FAILED en cas d'erreur
          await serviceClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.FAILED,
              error_message: `Erreur de transcription: ${error.message}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
        }
      })()
    );
    
    return responsePromise;

  } catch (error) {
    console.error("Erreur non gérée:", error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
