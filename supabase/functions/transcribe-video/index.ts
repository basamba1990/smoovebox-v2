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
    
    // 7. DÉMARRER LE TRAITEMENT EN ARRIÈRE-PLAN
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          // Télécharger la vidéo
          console.log(`Téléchargement de la vidéo...`);
          const videoResponse = await fetch(videoUrl);
          if (!videoResponse.ok) {
            throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
          }
          
          const contentLength = videoResponse.headers.get('content-length');
          console.log(`Vidéo téléchargée avec succès, taille: ${contentLength || 'inconnue'} octets`);
          
          // Vérifier la taille du fichier (limite OpenAI: 25 Mo)
          if (contentLength && parseInt(contentLength) > 25 * 1024 * 1024) {
            throw new Error(`La vidéo est trop volumineuse (${Math.round(parseInt(contentLength) / (1024 * 1024))} Mo). La limite est de 25 Mo pour OpenAI Whisper.`);
          }
          
          const videoBlob = await videoResponse.blob();
          const videoFile = new File([videoBlob], "video.mp4", { type: "video/mp4" });
          
          // Initialiser le client OpenAI
          const openai = new OpenAI({
            apiKey: openaiApiKey
          });
          
          // Sélectionner le modèle en fonction de la taille et de la complexité
          // Whisper pour la précision des transcriptions audio complexes
          const transcriptionModel = "whisper-1";
          
          console.log(`Début de la transcription avec OpenAI ${transcriptionModel}`);
          
          // Options communes
          const transcriptionOptions = {
            file: videoFile,
            language: "fr"
          };
          
          let transcriptionData;
          
          // Transcription avec OpenAI - Utilisation du modèle approprié
          const transcription = await openai.audio.transcriptions.create({
            ...transcriptionOptions,
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["word", "segment"]
          });
          
          transcriptionData = {
            text: transcription.text,
            segments: transcription.segments || [],
            words: transcription.words || [],
            language: transcription.language || "fr",
            duration: transcription.duration || 0
          };
          
          console.log(`Transcription terminée avec succès, longueur: ${transcriptionData.text.length} caractères`);
          
          // Créer un enregistrement dans la table transcriptions
          try {
            const { data: newTranscription, error: transcriptionInsertError } = await serviceClient
              .from('transcriptions')
              .insert({
                video_id: videoId,
                user_id: userId,
                language: transcriptionData.language,
                full_text: transcriptionData.text,
                segments: transcriptionData.segments,
                words: transcriptionData.words || [],
                transcription_text: transcriptionData.text,
                confidence_score: transcriptionData.segments?.length ? 
                  transcriptionData.segments.reduce((acc, segment) => acc + (segment.confidence || 0), 0) / 
                  transcriptionData.segments.length : 
                  0.95, // Score par défaut si pas de segments
                status: 'COMPLETED',
                processed_at: new Date().toISOString(),
                created_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (transcriptionInsertError) {
              console.error(`Erreur lors de l'insertion de la transcription:`, transcriptionInsertError);
            } else {
              console.log(`Transcription insérée avec succès, id: ${newTranscription.id}`);
            }
          } catch (transcriptionTableError) {
            console.log("La table transcriptions n'existe pas ou a une structure incompatible", transcriptionTableError);
            // Continuer sans erreur car on va stocker la transcription dans la table videos
          }
          
          // Mettre à jour la vidéo avec les données de transcription
          const { error: transcriptionUpdateError } = await serviceClient
            .from('videos')
            .update({
              transcription: transcriptionData.text,
              transcription_data: transcriptionData,
              status: VIDEO_STATUS.PUBLISHED,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
            
          if (transcriptionUpdateError) {
            console.error(`Erreur lors de la mise à jour de la transcription:`, transcriptionUpdateError);
            throw transcriptionUpdateError;
          }
          
          console.log(`Vidéo mise à jour avec les données de transcription`);
          
          // Essayer d'appeler la fonction de synchronisation si elle existe
          try {
            const { error: syncError } = await serviceClient.rpc(
              'sync_video_transcription',
              { video_id: videoId }
            );
            
            if (syncError) {
              console.error(`Erreur lors de l'appel à sync_video_transcription:`, syncError);
              // On continue malgré l'erreur
            } else {
              console.log(`Fonction sync_video_transcription appelée avec succès`);
            }
          } catch (syncError) {
            console.error(`Exception lors de l'appel à sync_video_transcription:`, syncError);
            // On continue malgré l'erreur
          }
          
          // Générer l'analyse IA de la transcription
          try {
            console.log(`Début de l'analyse IA du texte transcrit`);
            
            // Utiliser GPT-3.5 Turbo qui est plus largement disponible
            const analysisModel = "gpt-3.5-turbo"; 
            
            const analysisResponse = await openai.chat.completions.create({
              model: analysisModel,
              messages: [
                {
                  role: "system",
                  content: `Tu es un expert en analyse de discours. Analyse la transcription suivante et fournis une analyse au format JSON avec les champs suivants:
                  - clarity_score: note de 1 à 10
                  - vocabulary_score: note de 1 à 10
                  - fluidity_score: note de 1 à 10
                  - overall_score: moyenne des scores précédents
                  - strengths: liste de points forts
                  - improvement_areas: liste de points à améliorer
                  - detailed_analysis: analyse détaillée en plusieurs paragraphes
                  - summary: résumé concis en 2-3 phrases`
                },
                {
                  role: "user",
                  content: `Analyse cette transcription et réponds en format JSON:
                  
${transcriptionData.text}`
                }
              ],
              response_format: { type: "json_object" }
            });
            
            const analysisText = analysisResponse.choices[0].message.content;
            const analysis = JSON.parse(analysisText);
            console.log(`Analyse IA générée avec succès avec ${analysisModel}`);
            
            // Mettre à jour la vidéo avec l'analyse
            const { error: analysisUpdateError } = await serviceClient
              .from('videos')
              .update({
                analysis: analysis,
                performance_analysis: analysis,
                clarity_score: analysis.clarity_score || 0,
                vocabulary_score: analysis.vocabulary_score || 0,
                fluidity_score: analysis.fluidity_score || 0,
                overall_score: analysis.overall_score || 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', videoId);
              
            if (analysisUpdateError) {
              console.error(`Erreur lors de la mise à jour de l'analyse:`, analysisUpdateError);
            } else {
              console.log(`Vidéo mise à jour avec l'analyse IA`);
            }
            
            // Créer ou mettre à jour l'entrée dans la table analyses si elle existe
            try {
              await serviceClient
                .from('analyses')
                .upsert({
                  video_id: videoId,
                  content: analysis,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'video_id'
                });
            } catch (analysesTableError) {
              console.log("La table analyses n'existe pas ou a une structure incompatible", analysesTableError);
              // Continuer sans erreur car l'analyse est déjà stockée dans la table videos
            }
            
          } catch (analysisError) {
            console.error("Erreur lors de l'analyse IA", analysisError);
            // L'analyse a échoué mais la transcription a réussi, donc on ne considère pas ça comme un échec global
          }
          
        } catch (error) {
          console.error("Erreur lors de la transcription", error);
          
          // Mettre à jour le statut de la vidéo pour indiquer l'échec
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
    
    // Retourner immédiatement la réponse pour ne pas bloquer le client
    return responsePromise;

  } catch (error) {
    console.error("Erreur générale non gérée", error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
