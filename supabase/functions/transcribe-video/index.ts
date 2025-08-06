import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    
    // Vérifier la validité de la clé OpenAI (format basique)
    if (!openaiApiKey.startsWith('sk-') || openaiApiKey.length < 20) {
      const maskedKey = openaiApiKey ? 
        `${openaiApiKey.substring(0, 3)}...${openaiApiKey.substring(openaiApiKey.length - 4)}` : 
        'non définie';
      console.error("Clé OpenAI invalide:", maskedKey, "longueur:", openaiApiKey?.length || 0);
      
      return new Response(
        JSON.stringify({ 
          error: "Configuration incorrecte", 
          details: "La clé API OpenAI semble invalide" 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Récupérer les données de la requête
    let requestData;
    try {
      requestData = await req.json();
      console.log("Données de requête reçues:", requestData);
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
    console.log(`Recherche de la vidéo avec ID: ${videoId}`);
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
    
    console.log("Vidéo trouvée:", { 
      id: video.id, 
      title: video.title, 
      url: video.url ? "URL présente" : "URL absente",
      storage_path: video.storage_path || "Chemin non défini"
    });
    
    // Vérifier que la vidéo a une URL ou un chemin de stockage
    if (!video.url && !video.storage_path) {
      return new Response(
        JSON.stringify({ error: 'URL de la vidéo non disponible' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    // Mettre à jour le statut de la vidéo pour indiquer que la transcription est en cours
    try {
      const { error: updateError } = await supabaseClient
        .from('videos')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
        
      if (updateError) {
        console.error("Erreur lors de la mise à jour du statut:", updateError);
        // Continuer malgré l'erreur
      }
    } catch (updateError) {
      console.error("Exception lors de la mise à jour du statut:", updateError);
      // Continuer malgré l'erreur
    }
    
    // Récupérer l'URL de la vidéo depuis Storage si nécessaire
    let videoUrl = video.url;
    
    if (!videoUrl && video.storage_path) {
      console.log("Génération d'une URL signée pour le chemin:", video.storage_path);
      // C'est un chemin relatif, obtenir l'URL signée
      const bucket = 'videos'; // Par défaut
      let filePath = video.storage_path;
      
      // Nettoyer le chemin si nécessaire
      if (filePath.startsWith('videos/')) {
        filePath = filePath.substring(7); // Enlever le préfixe 'videos/'
      }
      
      console.log(`Création d'URL signée pour bucket: ${bucket}, chemin: ${filePath}`);
      try {
        const { data: signedUrlData, error: signedUrlError } = await supabaseClient
          .storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60); // 1 heure
        
        if (signedUrlError) {
          console.error(`Erreur lors de la création de l'URL signée:`, signedUrlError);
          
          try {
            await supabaseClient
              .from('videos')
              .update({
                status: 'error',
                error_message: `Erreur d'accès à la vidéo: ${signedUrlError.message}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', videoId);
          } catch (updateError) {
            console.error("Erreur lors de la mise à jour du statut d'erreur:", updateError);
          }
          
          return new Response(
            JSON.stringify({ 
              error: "Erreur d'accès à la vidéo", 
              details: signedUrlError.message 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500 
            }
          );
        }
        
        videoUrl = signedUrlData.signedUrl;
        console.log("URL signée générée avec succès");
      } catch (signedUrlException) {
        console.error("Exception lors de la création de l'URL signée:", signedUrlException);
        
        try {
          await supabaseClient
            .from('videos')
            .update({
              status: 'error',
              error_message: `Exception lors de la création de l'URL signée: ${signedUrlException.message}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
        } catch (updateError) {
          console.error("Erreur lors de la mise à jour du statut d'erreur:", updateError);
        }
        
        return new Response(
          JSON.stringify({ 
            error: "Exception lors de la création de l'URL signée", 
            details: signedUrlException.message 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    }
    
    if (!videoUrl) {
      console.error("Impossible d'obtenir une URL pour la vidéo");
      
      try {
        await supabaseClient
          .from('videos')
          .update({
            status: 'error',
            error_message: "Impossible d'obtenir une URL pour la vidéo",
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      } catch (updateError) {
        console.error("Erreur lors de la mise à jour du statut d'erreur:", updateError);
      }
        
      return new Response(
        JSON.stringify({ 
          error: "URL de la vidéo non disponible", 
          details: "Ni l'URL ni le chemin de stockage ne permettent d'accéder à la vidéo" 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    console.log("URL de la vidéo obtenue pour la transcription");
    
    try {
      // Télécharger la vidéo
      console.log("Téléchargement de la vidéo depuis:", videoUrl.substring(0, 50) + "...");
      const videoResponse = await fetch(videoUrl, {
        headers: {
          'Accept': 'video/*',
          'User-Agent': 'Supabase Edge Function'
        }
      });
      
      if (!videoResponse.ok) {
        throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      // Vérifier le type de contenu
      const contentType = videoResponse.headers.get('content-type');
      console.log("Type de contenu de la vidéo:", contentType);
      
      if (!contentType || !contentType.startsWith('video/')) {
        console.log("Attention: Le type de contenu n'est pas une vidéo. Tentative de traitement quand même.");
      }
      
      console.log("Vidéo téléchargée avec succès, préparation pour OpenAI");
      const videoBlob = await videoResponse.blob();
      console.log("Taille du blob vidéo:", videoBlob.size, "octets");
      
      // Vérifier si le fichier est vide
      if (videoBlob.size === 0) {
        throw new Error("Le fichier vidéo téléchargé est vide");
      }
      
      // Vérifier la taille maximale pour Whisper (25 Mo)
      if (videoBlob.size > 25 * 1024 * 1024) {
        throw new Error(`La vidéo est trop volumineuse pour être traitée par l'API Whisper (${(videoBlob.size / (1024 * 1024)).toFixed(2)} Mo, limite de 25 Mo)`);
      }
      
      // Créer un fichier avec le bon type MIME
      let mimeType = 'video/mp4';
      if (contentType && contentType.startsWith('video/')) {
        mimeType = contentType;
      }
      
      const videoFile = new File([videoBlob], "video.mp4", { type: mimeType });
      console.log("Fichier préparé pour OpenAI:", {
        name: videoFile.name,
        type: videoFile.type,
        size: videoFile.size
      });
      
      // Transcription avec OpenAI
      console.log("Début de la transcription avec OpenAI Whisper");
      try {
        const transcription = await openai.audio.transcriptions.create({
          file: videoFile,
          model: "whisper-1",
          response_format: "verbose_json",
          language: "fr"
        });
        
        console.log("Transcription terminée avec succès");
        
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
        
        // Mettre à jour la vidéo avec les données de transcription
        console.log("Mise à jour de la vidéo avec les données de transcription");
        try {
          const { error: updateError } = await supabaseClient
            .from('videos')
            .update({
              transcription: transcriptionData.text,
              transcription_data: transcriptionData,
              status: 'transcribed',
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
            
          if (updateError) {
            console.error("Erreur lors de la mise à jour de la transcription:", updateError);
            throw new Error(`Erreur lors de la mise à jour de la transcription: ${updateError.message}`);
          }
          
          console.log("Vidéo mise à jour avec les données de transcription");
        } catch (updateError) {
          console.error("Exception lors de la mise à jour de la transcription:", updateError);
          throw new Error(`Exception lors de la mise à jour de la transcription: ${updateError.message}`);
        }
        
        // Générer l'analyse IA de la transcription
        try {
          console.log("Début de l'analyse IA de la transcription");
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
          console.log("Analyse IA générée avec succès");
          
          // Mettre à jour la vidéo avec l'analyse
          try {
            const { error: analysisUpdateError } = await supabaseClient
              .from('videos')
              .update({
                analysis: analysis,
                status: 'analyzed',
                updated_at: new Date().toISOString()
              })
              .eq('id', videoId);
              
            if (analysisUpdateError) {
              console.error("Erreur lors de la mise à jour de l'analyse:", analysisUpdateError);
            } else {
              console.log("Vidéo mise à jour avec l'analyse IA");
            }
          } catch (analysisUpdateError) {
            console.error("Exception lors de la mise à jour de l'analyse:", analysisUpdateError);
          }
        } catch (analysisError) {
          console.error("Erreur lors de l'analyse IA", analysisError);
          // L'analyse a échoué mais la transcription a réussi
          // On ne change pas le statut 'transcribed'
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Transcription terminée avec succès',
            videoId
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      } catch (openaiError) {
        console.error("Erreur OpenAI détaillée:", {
          message: openaiError.message,
          type: openaiError.constructor.name,
          status: openaiError.status,
          code: openaiError.code,
          param: openaiError.param
        });
        
        throw new Error(`Erreur OpenAI: ${openaiError.message}`);
      }
      
    } catch (error) {
      console.error("Erreur lors de la transcription", error);
      
      // Mettre à jour le statut de la vidéo pour indiquer l'échec
      try {
        await supabaseClient
          .from('videos')
          .update({
            status: 'error',
            error_message: `Erreur de transcription: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      } catch (updateError) {
        console.error("Erreur lors de la mise à jour du statut d'erreur:", updateError);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la transcription', 
          details: error.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

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
