// transcribe-video.ts - Version simplifiée et robuste
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
    
    // Vérifier que la vidéo a une URL
    if (!video.url) {
      return new Response(
        JSON.stringify({ error: 'URL de la vidéo non disponible' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
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
    
    if (videoUrl.startsWith('/') || !videoUrl.startsWith('http')) {
      // C'est un chemin relatif, obtenir l'URL signée
      const bucket = videoUrl.includes('/storage/') ? 
        videoUrl.split('/storage/')[1].split('/')[0] : 'videos';
      
      const filePath = videoUrl.replace(/^\/storage\/[^/]+\//, '');
      
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
    }
    
    console.log("URL de la vidéo obtenue pour la transcription");
    
    try {
      // Télécharger la vidéo
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      const videoBlob = await videoResponse.blob();
      const videoFile = new File([videoBlob], "video.mp4", { type: "video/mp4" });
      
      // Transcription avec OpenAI
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
      await supabaseClient
        .from('videos')
        .update({
          transcription: transcriptionData.text,
          transcription_data: transcriptionData,
          status: 'transcribed',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      console.log("Vidéo mise à jour avec les données de transcription");
      
      // Générer l'analyse IA de la transcription
      try {
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
        await supabaseClient
          .from('videos')
          .update({
            analysis: analysis,
            status: 'analyzed',
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
        
        console.log("Vidéo mise à jour avec l'analyse IA");
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
