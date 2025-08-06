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
    
    // Vérifier si la table a les colonnes nécessaires
    try {
      const { error: updateTestError } = await supabaseClient
        .from('videos')
        .update({ status: 'processing' })
        .eq('id', videoId);
      
      if (updateTestError) {
        console.error("Erreur lors du test de mise à jour de la table videos:", updateTestError);
        return new Response(
          JSON.stringify({ 
            error: "Structure de table incorrecte", 
            details: "La table videos ne contient pas les colonnes nécessaires. Vérifiez que les colonnes status, transcription, transcription_data, analysis et error_message existent."
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    } catch (structureError) {
      console.error("Erreur lors du test de structure de la table:", structureError);
    }
    
    // Mettre à jour le statut de la vidéo pour indiquer que la transcription est en cours
    await supabaseClient
      .from('videos')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
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
      const { data: signedUrlData, error: signedUrlError } = await supabaseClient
        .storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60); // 1 heure
      
      if (signedUrlError) {
        console.error(`Erreur lors de la création de l'URL signée:`, signedUrlError);
        
        await supabaseClient
          .from('videos')
          .update({
            status: 'error',
            error_message: `Erreur d'accès à la vidéo: ${signedUrlError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
        
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
    }
    
    if (!videoUrl) {
      console.error("Impossible d'obtenir une URL pour la vidéo");
      await supabaseClient
        .from('videos')
        .update({
          status: 'error',
          error_message: "Impossible d'obtenir une URL pour la vidéo",
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
        
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
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      console.log("Vidéo téléchargée avec succès, préparation pour OpenAI");
      const videoBlob = await videoResponse.blob();
      const videoFile = new File([videoBlob], "video.mp4", { type: "video/mp4" });
      
      console.log("Taille du fichier vidéo:", videoFile.size, "octets");
      if (videoFile.size > 25 * 1024 * 1024) {
        throw new Error("La vidéo est trop volumineuse pour être traitée par l'API Whisper (limite de 25 Mo)");
      }
      
      // Transcription avec OpenAI
      console.log("Début de la transcription avec OpenAI Whisper");
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
      
    } catch (error) {
      console.error("Erreur lors de la transcription", error);
      
      // Mettre à jour le statut de la vidéo pour indiquer l'échec
      await supabaseClient
        .from('videos')
        .update({
          status: 'error',
          error_message: `Erreur de transcription: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
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
