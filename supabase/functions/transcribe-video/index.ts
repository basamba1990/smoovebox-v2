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
      auth: { persistSession: false }
    });

    // MÉTHODES D'AUTHENTIFICATION MULTIPLES
    let userId = null;
    let token = null;
    
    // Détecter l'agent utilisateur pour identifier WhatsApp
    const userAgent = req.headers.get('user-agent') || '';
    const isWhatsApp = userAgent.includes('WhatsApp');
    
    // Pour WhatsApp ou requêtes GET, bypasser l'authentification
    if (isWhatsApp || req.method === 'GET') {
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
            userId = payload.sub || payload.subject;
            if (userId) console.log(`Utilisateur trouvé dans le payload JWT: ${userId}`);
          }
        } catch (sbDataError) {
          console.error("Erreur lors de l'extraction des métadonnées Supabase:", sbDataError);
        }
      }

      // Dernier recours: obtenir l'utilisateur à partir des données de la requête
      if (!userId) {
        try {
          const requestData = await req.json().catch(() => ({}));
          userId = requestData.user_id || requestData.userId;
          if (userId) console.log(`Utilisateur trouvé dans les données de la requête: ${userId}`);
        } catch (parseError) {
          console.error("Erreur lors de l'analyse du JSON de la requête:", parseError);
        }
      }
      
      if (!userId && !isWhatsApp && req.method !== 'GET') {
        return new Response(
          JSON.stringify({ 
            error: 'Authentification requise', 
            details: "Impossible d'identifier l'utilisateur"
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }
    }

    // RÉCUPÉRER LES DONNÉES DE LA REQUÊTE
    let videoId;
    let performAnalysis = false; // Option pour enchaîner avec une analyse après transcription
    
    // Pour GET ou WhatsApp, récupérer les paramètres d'URL
    if (req.method === 'GET' || isWhatsApp) {
      const url = new URL(req.url);
      videoId = url.searchParams.get('videoId');
      performAnalysis = url.searchParams.get('analyze') === 'true';
      
      if (!videoId) {
        return new Response(
          JSON.stringify({ error: 'videoId est requis en paramètre' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
    } else {
      try {
        // Clone la requête pour pouvoir la lire plusieurs fois si nécessaire
        const clonedRequest = req.clone();
        const requestData = await clonedRequest.json();
        
        videoId = requestData.videoId;
        performAnalysis = requestData.analyze === true;
        
        if (!videoId) {
          // Essayer de récupérer l'ID vidéo des paramètres de requête
          const url = new URL(req.url);
          videoId = url.searchParams.get('videoId');
          performAnalysis = url.searchParams.get('analyze') === 'true';
          
          if (!videoId) {
            return new Response(
              JSON.stringify({ error: 'videoId est requis dans le corps ou en paramètre' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400 
              }
            );
          }
        }
      } catch (parseError) {
        // Essayer de récupérer l'ID vidéo des paramètres de requête
        const url = new URL(req.url);
        videoId = url.searchParams.get('videoId');
        performAnalysis = url.searchParams.get('analyze') === 'true';
        
        if (!videoId) {
          return new Response(
            JSON.stringify({ 
              error: "Format de requête invalide", 
              details: "Impossible de lire les données de la requête" 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }
      }
    }

    // VÉRIFIER L'ACCÈS À LA VIDÉO
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
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }
    
    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}`);
    console.log(`Statut actuel: ${video.status}, Chemin: ${video.storage_path || 'Non spécifié'}`);
    
    // MISE À JOUR DU STATUT
    await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId);
    
    console.log(`Statut mis à jour à '${VIDEO_STATUS.PROCESSING}'`);
    
    // RÉCUPÉRER L'URL DE LA VIDÉO
    let videoUrl = video.url;
    
    if (!videoUrl && video.storage_path) {
      console.log(`Génération d'URL signée pour ${video.storage_path}`);
      
      // Extraire le bucket et le chemin
      let bucket = 'videos'; // Bucket par défaut
      let filePath = video.storage_path;
      
      // Gestion du chemin: détection du bucket dans le chemin
      if (filePath.includes('/')) {
        const parts = filePath.split('/');
        if (parts.length > 1) {
          // Vérifier si le premier segment est un bucket valide
          const { data: buckets } = await serviceClient.storage.listBuckets();
          const possibleBucket = parts[0];
          
          if (buckets && buckets.some(b => b.name === possibleBucket)) {
            bucket = possibleBucket;
            filePath = parts.slice(1).join('/');
            console.log(`Bucket identifié: ${bucket}, chemin ajusté: ${filePath}`);
          }
        }
      }
      
      // Si le chemin commence par le nom du bucket, ajuster
      if (filePath.startsWith(`${bucket}/`)) {
        filePath = filePath.substring(bucket.length + 1);
      }
      
      try {
        // Vérifier si le fichier existe
        const parentPath = filePath.split('/').slice(0, -1).join('/') || undefined;
        const fileName = filePath.split('/').pop();
        
        const { data: fileList } = await serviceClient
          .storage
          .from(bucket)
          .list(parentPath, { limit: 100 });
          
        const fileFound = fileList && fileList.some(f => f.name === fileName);
        
        if (!fileFound) {
          throw new Error(`Fichier ${fileName} non trouvé dans ${bucket}`);
        }
        
        // Créer l'URL signée (valide 1 heure)
        const { data: signedUrlData, error: signedUrlError } = await serviceClient
          .storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60);
        
        if (signedUrlError) {
          throw signedUrlError;
        }
        
        videoUrl = signedUrlData.signedUrl;
        console.log(`URL signée générée avec succès`);
      } catch (storageError) {
        console.error(`Erreur lors de la création de l'URL signée:`, storageError);
        
        await serviceClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Erreur d'accès: ${storageError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
        
        return new Response(
          JSON.stringify({ 
            error: "Erreur d'accès à la vidéo", 
            details: storageError.message
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
          error_message: 'URL de la vidéo non disponible',
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
    
    // PRÉPARER LA RÉPONSE IMMÉDIATE
    const responsePromise = new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription démarrée avec succès',
        videoId,
        willAnalyze: performAnalysis
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202 // Accepted
      }
    );
    
    // DÉMARRER LE TRAITEMENT EN ARRIÈRE-PLAN
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          // Télécharger la vidéo
          console.log(`Téléchargement de la vidéo...`);
          const videoResponse = await fetch(videoUrl);
          if (!videoResponse.ok) {
            throw new Error(`Erreur lors du téléchargement: ${videoResponse.status}`);
          }
          
          const contentLength = videoResponse.headers.get('content-length');
          const sizeInMB = contentLength ? (parseInt(contentLength) / (1024 * 1024)).toFixed(2) : 'inconnue';
          console.log(`Vidéo téléchargée, taille: ${sizeInMB} Mo`);
          
          // Vérifier la taille du fichier (limite OpenAI: 25 Mo)
          if (contentLength && parseInt(contentLength) > 25 * 1024 * 1024) {
            throw new Error(`Vidéo trop volumineuse (${sizeInMB} Mo). Limite: 25 Mo.`);
          }
          
          const videoBlob = await videoResponse.blob();
          const videoFile = new File([videoBlob], "video.mp4", { type: "video/mp4" });
          
          // Initialiser le client OpenAI
          const openai = new OpenAI({ apiKey: openaiApiKey });
          
          // Sélectionner le modèle approprié
          const shouldUseWhisper = contentLength && parseInt(contentLength) > 10 * 1024 * 1024;
          const transcriptionModel = shouldUseWhisper ? "whisper-1" : "gpt-4o-transcribe";
          
          console.log(`Transcription avec modèle ${transcriptionModel}`);
          
          // Options de transcription
          const transcriptionOptions = {
            file: videoFile,
            language: "fr"
          };
          
          let transcriptionData;
          
          // Transcription avec le modèle sélectionné
          if (transcriptionModel === "whisper-1") {
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
          } else {
            // GPT-4o-transcribe
            const transcription = await openai.audio.transcriptions.create({
              ...transcriptionOptions,
              model: "gpt-4o-transcribe",
              response_format: "json",
              prompt: "Veuillez transcrire avec précision cette vidéo en français."
            });
            
            transcriptionData = {
              text: transcription.text,
              segments: [],
              language: "fr"
            };
          }
          
          console.log(`Transcription terminée: ${transcriptionData.text.length} caractères`);
          
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
                  0.95,
                status: 'COMPLETED',
                processed_at: new Date().toISOString(),
                created_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (transcriptionInsertError) {
              console.error(`Erreur d'insertion transcription:`, transcriptionInsertError);
            } else {
              console.log(`Transcription insérée, id: ${newTranscription.id}`);
            }
          } catch (transcriptionTableError) {
            console.log("Table transcriptions non disponible", transcriptionTableError);
          }
          
          // Déterminer le statut final en fonction de l'analyse demandée
          const finalStatus = performAnalysis ? VIDEO_STATUS.ANALYZING : VIDEO_STATUS.PUBLISHED;
          
          // Mettre à jour la vidéo avec les données de transcription
          await serviceClient
            .from('videos')
            .update({
              transcription: transcriptionData.text,
              transcription_data: transcriptionData,
              status: finalStatus,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
            
          console.log(`Vidéo mise à jour avec transcription, statut: ${finalStatus}`);
          
          // Essayer d'appeler la fonction de synchronisation si elle existe
          try {
            await serviceClient.rpc('sync_video_transcription', { video_id: videoId });
            console.log(`Fonction sync_video_transcription appelée`);
          } catch (syncError) {
            console.log(`sync_video_transcription non disponible`, syncError);
          }
          
          // Si l'analyse est demandée, la lancer automatiquement
          if (performAnalysis) {
            console.log("Lancement de l'analyse après transcription");
            try {
              // Générer une analyse standard avec GPT-3.5 Turbo
              const openai = new OpenAI({ apiKey: openaiApiKey });
              
              const analysisResponse = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                  {
                    role: "system",
                    content: `Analyse cette transcription et fournis:
                    1. Un résumé concis (5-7 phrases)
                    2. 5-7 points clés
                    3. Une évaluation de la clarté et de la structure (note de 1 à 10)
                    4. 3-5 suggestions d'amélioration
                    5. 3-5 points forts
                    
                    Réponds au format JSON:
                    {
                      "resume": "string",
                      "points_cles": ["string", "string", ...],
                      "evaluation": {
                        "clarte": number,
                        "structure": number
                      },
                      "suggestions": ["string", "string", ...],
                      "strengths": ["string", "string", ...]
                    }`
                  },
                  {
                    role: "user",
                    content: transcriptionData.text.substring(0, 15000)
                  }
                ],
                response_format: { type: "json_object" }
              });
              
              const analysis = JSON.parse(analysisResponse.choices[0].message.content);
              console.log(`Analyse IA générée`);
              
              // Extraire des tags potentiels à partir des points clés
              const potentialTags = analysis.points_cles
                .map(point => point.split(' ').slice(0, 3).join(' '))
                .filter(tag => tag.length < 20);
              
              // Mettre à jour la vidéo avec l'analyse
              await serviceClient
                .from('videos')
                .update({
                  analysis: analysis,
                  tags: potentialTags.slice(0, 10),
                  status: VIDEO_STATUS.PUBLISHED,
                  updated_at: new Date().toISOString()
                })
                .eq('id', videoId);
                
              console.log(`Vidéo mise à jour avec l'analyse IA`);
              
            } catch (analysisError) {
              console.error("Erreur lors de l'analyse IA", analysisError);
              
              // La transcription a réussi malgré l'échec de l'analyse
              await serviceClient
                .from('videos')
                .update({
                  status: VIDEO_STATUS.PUBLISHED,
                  error_message: `Transcription réussie, analyse échouée: ${analysisError.message}`,
                  updated_at: new Date().toISOString()
                })
                .eq('id', videoId);
            }
          }
          
        } catch (error) {
          console.error("Erreur lors de la transcription", error);
          
          // Mettre à jour le statut en échec
          await serviceClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.FAILED,
              error_message: `Erreur: ${error.message}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
        }
      })()
    );
    
    // Retourner immédiatement la réponse
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
