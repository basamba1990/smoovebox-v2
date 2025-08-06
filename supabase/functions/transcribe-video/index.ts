import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valeurs possibles pour le statut (à ajuster selon votre schéma)
const VALID_STATUS = {
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error',
  // Essayons ces valeurs alternatives
  DONE: 'done',
  FINISHED: 'finished',
  COMPLETE: 'complete',
  SUCCESS: 'success',
  TRANSCRIBED: 'transcribed',
  ANALYZED: 'analyzed'
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
    
    // IMPORTANT: Vérifier les valeurs autorisées pour le statut
    console.log(`Statut actuel de la vidéo: ${video.status}`);
    
    // Récupérer les valeurs autorisées pour le statut
    try {
      const { data: statusValues, error: statusError } = await supabaseClient.rpc(
        'get_enum_values',
        { enum_name: 'video_status' }
      );
      
      if (statusError) {
        console.error("Erreur lors de la récupération des valeurs de statut:", statusError);
      } else if (statusValues && statusValues.length > 0) {
        console.log("Valeurs autorisées pour le statut:", statusValues);
      }
    } catch (enumError) {
      console.error("Erreur lors de l'appel à get_enum_values:", enumError);
      // Continuons même si cette vérification échoue
    }
    
    // Mettre à jour le statut de la vidéo pour indiquer que la transcription est en cours
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({
        status: VALID_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId);
      
    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId}`, updateError);
      // On continue malgré l'erreur
    } else {
      console.log(`Statut de la vidéo ${videoId} mis à jour à '${VALID_STATUS.PROCESSING}'`);
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
            status: VALID_STATUS.ERROR,
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
          status: VALID_STATUS.ERROR,
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
    
    // CORRECTION: Démarrer le processus de transcription immédiatement (sans waitUntil)
    // Nous allons quand même retourner une réponse rapide au client
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
    
    // Démarrer le processus de transcription
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
        
        console.log(`Début de la transcription avec OpenAI Whisper`);
        
        // Transcription avec OpenAI
        try {
          const transcription = await openai.audio.transcriptions.create({
            file: videoFile,
            model: "whisper-1",
            response_format: "verbose_json",
            language: "fr"
          });
          
          console.log(`Transcription terminée avec succès, longueur: ${transcription.text.length} caractères`);
          
          // Formater les données de transcription
          const transcriptionData = {
            text: transcription.text,
            segments: transcription.segments.map(segment => ({
              id: segment.id,
              start: segment.start,
              end: segment.end,
              text: segment.text,
              confidence: segment.confidence
            })),
            language: transcription.language
          };
          
          // Essayer différentes valeurs de statut jusqu'à ce qu'une fonctionne
          let transcriptionUpdateSuccess = false;
          
          // Essayer d'abord avec le statut actuel (si c'est 'ready' ou 'processing')
          if (video.status === VALID_STATUS.READY || video.status === VALID_STATUS.PROCESSING) {
            try {
              const { error: transcriptionUpdateError } = await supabaseClient
                .from('videos')
                .update({
                  transcription: transcriptionData.text,
                  transcription_data: transcriptionData,
                  // Garder le même statut
                  status: video.status,
                  updated_at: new Date().toISOString()
                })
                .eq('id', videoId);
                
              if (!transcriptionUpdateError) {
                console.log(`Vidéo mise à jour avec les données de transcription (statut inchangé: ${video.status})`);
                transcriptionUpdateSuccess = true;
              } else {
                console.error(`Erreur lors de la mise à jour avec statut inchangé:`, transcriptionUpdateError);
              }
            } catch (updateError) {
              console.error(`Exception lors de la mise à jour avec statut inchangé:`, updateError);
            }
          }
          
          // Si la première tentative a échoué, essayer avec différentes valeurs de statut
          if (!transcriptionUpdateSuccess) {
            // Essayer chaque valeur de statut possible
            for (const statusKey of Object.keys(VALID_STATUS)) {
              const statusValue = VALID_STATUS[statusKey];
              if (statusValue === VALID_STATUS.PROCESSING || statusValue === VALID_STATUS.ERROR) {
                // Sauter les statuts qui ne sont pas pertinents pour une transcription terminée
                continue;
              }
              
              try {
                console.log(`Tentative de mise à jour avec le statut: ${statusValue}`);
                const { error: transcriptionUpdateError } = await supabaseClient
                  .from('videos')
                  .update({
                    transcription: transcriptionData.text,
                    transcription_data: transcriptionData,
                    status: statusValue,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', videoId);
                  
                if (!transcriptionUpdateError) {
                  console.log(`Vidéo mise à jour avec les données de transcription (statut: ${statusValue})`);
                  transcriptionUpdateSuccess = true;
                  break; // Sortir de la boucle si la mise à jour a réussi
                } else {
                  console.error(`Erreur lors de la mise à jour avec statut ${statusValue}:`, transcriptionUpdateError);
                }
              } catch (updateError) {
                console.error(`Exception lors de la mise à jour avec statut ${statusValue}:`, updateError);
              }
            }
          }
          
          // Si aucune mise à jour n'a réussi, essayer sans changer le statut
          if (!transcriptionUpdateSuccess) {
            try {
              console.log(`Tentative de mise à jour sans changer le statut`);
              const { error: transcriptionUpdateError } = await supabaseClient
                .from('videos')
                .update({
                  transcription: transcriptionData.text,
                  transcription_data: transcriptionData,
                  updated_at: new Date().toISOString()
                })
                .eq('id', videoId);
                
              if (!transcriptionUpdateError) {
                console.log(`Vidéo mise à jour avec les données de transcription (statut inchangé)`);
                transcriptionUpdateSuccess = true;
              } else {
                console.error(`Erreur lors de la mise à jour sans changer le statut:`, transcriptionUpdateError);
                throw transcriptionUpdateError;
              }
            } catch (finalUpdateError) {
              console.error(`Exception lors de la mise à jour finale:`, finalUpdateError);
              throw finalUpdateError;
            }
          }
          
          // Générer l'analyse IA de la transcription
          try {
            console.log(`Début de l'analyse IA du texte transcrit`);
            
            const analysisResponse = await openai.chat.completions.create({
              model: "gpt-3.5-turbo",
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
            
            // Mettre à jour la vidéo avec l'analyse sans changer le statut
            try {
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
            } catch (analysisUpdateError) {
              console.error(`Exception lors de la mise à jour de l'analyse:`, analysisUpdateError);
            }
          } catch (analysisError) {
            console.error("Erreur lors de l'analyse IA", analysisError);
            // L'analyse a échoué mais la transcription a réussi
          }
        } catch (whisperError) {
          console.error("Erreur lors de l'appel à l'API Whisper:", whisperError);
          throw new Error(`Erreur de transcription OpenAI: ${whisperError.message || JSON.stringify(whisperError)}`);
        }
        
      } catch (error) {
        console.error("Erreur lors de la transcription", error);
        
        // Mettre à jour le statut de la vidéo pour indiquer l'échec
        try {
          await supabaseClient
            .from('videos')
            .update({
              status: VALID_STATUS.ERROR,
              error_message: `Erreur de transcription: ${error.message}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
        } catch (updateError) {
          console.error("Erreur lors de la mise à jour du statut d'erreur:", updateError);
        }
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

// Fonction pour créer une fonction RPC qui retourne les valeurs d'un enum
// Vous devez l'exécuter une fois dans votre base de données
/*
CREATE OR REPLACE FUNCTION get_enum_values(enum_name text)
RETURNS text[] AS $$
DECLARE
    enum_values text[];
BEGIN
    SELECT array_agg(enumlabel)
    INTO enum_values
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = enum_name;
    
    RETURN enum_values;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
