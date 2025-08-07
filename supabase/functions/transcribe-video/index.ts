import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valeurs exactes autorisées pour le statut dans la base de données
const VIDEO_STATUS = {
  DRAFT: 'draft',           // En attente ou prêt pour traitement
  PROCESSING: 'processing', // En cours de traitement
  PUBLISHED: 'published',   // Traitement terminé avec succès
  FAILED: 'failed'          // Échec du traitement
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Fonction transcribe-video appelée");
    
    // Initialiser les clients
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
    
    // Utilisation de la clé de service avec l'option auth: { persistSession: false }
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false
      }
    });
    
    // Initialisation du client OpenAI avec logging pour déboguer
    console.log("Initialisation du client OpenAI avec la clé: " + openaiApiKey.substring(0, 5) + "...");
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Récupérer les données de la requête
    let requestData;
    try {
      requestData = await req.json();
      console.log("Données de requête reçues:", { videoId: requestData.videoId });
    } catch (parseError) {
      console.error("Erreur lors de l'analyse du JSON de la requête", parseError);
      return new Response(
        JSON.stringify({ error: "Format de requête invalide", details: parseError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    const { videoId } = requestData;
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Vérifier si la vidéo existe et récupérer son URL
    const { data: video, error: videoError } = await supabaseClient
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
    
    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}, chemin: ${video.storage_path}`);
    console.log(`Statut actuel de la vidéo: ${video.status}`);
    
    // Mettre à jour le statut de la vidéo pour indiquer que la transcription est en cours
    const { error: updateError } = await supabaseClient
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
    
    // Récupérer l'URL de la vidéo depuis Storage si nécessaire
    let videoUrl = video.url;
    
    if (!videoUrl && video.storage_path) {
      console.log(`Génération d'une URL signée pour ${video.storage_path}`);
      
      // Extraire le bucket et le chemin
      let bucket = 'videos'; // Bucket par défaut
      let filePath = video.storage_path;
      
      // CORRECTION: Gestion correcte du préfixe de bucket dans le chemin
      if (filePath.includes('/')) {
        const parts = filePath.split('/');
        if (parts.length > 1) {
          // Le premier segment pourrait être le nom du bucket
          const possibleBucket = parts[0];
          
          // Vérifier si ce bucket existe dans le projet
          try {
            const { data: buckets } = await supabaseClient.storage.listBuckets();
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
            // En cas d'erreur, on suppose que le premier segment n'est pas un bucket
          }
        }
      }
      
      // Méthode alternative si la précédente échoue: vérifier si le chemin commence par le nom du bucket
      if (filePath.startsWith(`${bucket}/`)) {
        filePath = filePath.substring(bucket.length + 1);
        console.log(`Préfixe de bucket détecté et supprimé. Nouveau chemin: ${filePath}`);
      }
      
      console.log(`Création d'URL signée pour bucket: ${bucket}, chemin: ${filePath}`);
      
      try {
        // Vérifier si le fichier existe dans le bucket
        const parentPath = filePath.split('/').slice(0, -1).join('/') || undefined;
        console.log(`Vérification du contenu du dossier: ${parentPath || '(racine)'}`);
        
        const { data: fileList, error: fileListError } = await supabaseClient
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
        const { data: signedUrlData, error: signedUrlError } = await supabaseClient
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
        
        await supabaseClient
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
      
      await supabaseClient
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
    
    // Démarrer le processus de transcription en arrière-plan
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
        
        console.log(`Début de la transcription avec OpenAI gpt-4o-transcribe`);
        
        // Transcription avec OpenAI - Utilisation du nouveau modèle gpt-4o-transcribe
        const transcription = await openai.audio.transcriptions.create({
          file: videoFile,
          model: "gpt-4o-transcribe",
          response_format: "json",  // gpt-4o-transcribe ne supporte que json ou text
          language: "fr",
          prompt: "Cette transcription concerne une vidéo en français. Veuillez transcrire avec précision, en incluant la ponctuation et les paragraphes appropriés."
        });
        
        console.log(`Transcription terminée avec succès, longueur: ${transcription.text.length} caractères`);
        
        // Formater les données de transcription
        // Note: gpt-4o-transcribe ne fournit pas de segments comme whisper-1 avec verbose_json
        // Nous allons donc créer une structure compatible avec le reste du code
        const transcriptionData = {
          text: transcription.text,
          segments: [], // Pas de segments disponibles avec gpt-4o-transcribe en format json
          language: "fr" // Le modèle ne renvoie pas la langue détectée, on utilise celle fournie
        };
        
        // Mettre à jour la vidéo avec les données de transcription
        const { error: transcriptionUpdateError } = await supabaseClient
          .from('videos')
          .update({
            transcription: transcriptionData.text,
            transcription_data: transcriptionData,
            status: VIDEO_STATUS.PUBLISHED, // Utiliser PUBLISHED pour indiquer que la transcription est terminée
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
          
        if (transcriptionUpdateError) {
          console.error(`Erreur lors de la mise à jour de la transcription:`, transcriptionUpdateError);
          throw transcriptionUpdateError;
        }
        
        console.log(`Vidéo mise à jour avec les données de transcription`);
        
        // Appeler la fonction de synchronisation
        try {
          const { error: syncError } = await supabaseClient.rpc(
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
          
          const analysisResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `Tu es un expert en analyse de discours. Analyse la transcription suivante et fournit:
                1. Un résumé concis (5-7 phrases)
                2. 5-7 points clés
                3. Une évaluation de la clarté et de la structure (note de 1 à 10)
                4. 3-5 suggestions d'amélioration
                5. 3-5 points forts
                
                Réponds au format JSON avec les clés suivantes:
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
                content: transcriptionData.text
              }
            ],
            response_format: { type: "json_object" }
          });
          
          const analysis = JSON.parse(analysisResponse.choices[0].message.content);
          console.log(`Analyse IA générée avec succès`);
          
          // Mettre à jour la vidéo avec l'analyse (sans changer le statut)
          const { error: analysisUpdateError } = await supabaseClient
            .from('videos')
            .update({
              analysis: analysis,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
            
          if (analysisUpdateError) {
            console.error(`Erreur lors de la mise à jour de l'analyse:`, analysisUpdateError);
          } else {
            console.log(`Vidéo mise à jour avec l'analyse IA`);
          }
        } catch (analysisError) {
          console.error("Erreur lors de l'analyse IA", analysisError);
          // L'analyse a échoué mais la transcription a réussi
        }
        
      } catch (error) {
        console.error("Erreur lors de la transcription", error);
        
        // Mettre à jour le statut de la vidéo pour indiquer l'échec
        await supabaseClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Erreur de transcription: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      }
    })();
    
    // Retourner immédiatement une réponse pour ne pas bloquer le client
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
