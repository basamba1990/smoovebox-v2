// analyze-video.ts - Fonction séparée pour l'analyse IA des vidéos transcrites
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fonction pour journaliser les erreurs avec plus de détails
function logError(message, error, additionalInfo = {}) {
  console.error(`ERROR: ${message}`, {
    error: error?.message || error,
    stack: error?.stack,
    ...additionalInfo
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Fonction analyze-video appelée");
    
    // Initialiser les clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      logError("Variables d'environnement manquantes", null, {
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
    
    console.log("Variables d'environnement vérifiées");
    
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
      logError("Erreur lors de l'analyse du JSON de la requête", parseError);
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

    console.log(`Récupération des informations pour la vidéo ${videoId}`);
    
    // Vérifier si la vidéo existe et récupérer sa transcription
    let video;
    try {
      const { data, error: videoError } = await supabaseClient
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (videoError) {
        logError(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError);
        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors de la récupération de la vidéo', 
            details: videoError.message,
            code: videoError.code
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: videoError.code === 'PGRST116' ? 404 : 500
          }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Vidéo non trouvée' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        );
      }
      
      video = data;
      console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title || 'Sans titre'}`);
      
      // Vérifier que la vidéo a une transcription
      if (!video.transcription && !video.transcription_data) {
        return new Response(
          JSON.stringify({ error: 'Transcription de la vidéo non disponible' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
      
    } catch (error) {
      logError("Erreur non gérée lors de la vérification de la vidéo", error);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors du traitement de la requête', 
          details: error.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }
    
    // Assurer que la colonne analysis existe
    try {
      await supabaseClient.sql(`
        ALTER TABLE public.videos 
        ADD COLUMN IF NOT EXISTS analysis JSONB;
      `);
    } catch (alterError) {
      logError("Erreur lors de l'ajout de la colonne analysis", alterError);
      // Continuer malgré l'erreur
    }
    
    // Mettre à jour le statut de la vidéo pour indiquer que l'analyse est en cours
    try {
      await supabaseClient
        .from('videos')
        .update({
          status: 'analyzing',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      console.log(`Statut de la vidéo mis à jour: analyzing`);
    } catch (updateError) {
      logError("Erreur lors de la mise à jour du statut de la vidéo", updateError);
      // Continuer malgré l'erreur
    }
    
    try {
      // Récupérer le texte de la transcription
      const transcriptionText = video.transcription || 
        (video.transcription_data && video.transcription_data.text) || 
        "";
      
      if (!transcriptionText.trim()) {
        throw new Error("Transcription vide ou invalide");
      }
      
      // Générer l'analyse IA de la transcription
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
            content: transcriptionText
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const analysis = JSON.parse(analysisResponse.choices[0].message.content);
      console.log("Analyse IA générée avec succès");
      
      // Mettre à jour la vidéo avec l'analyse
      const { error: updateError } = await supabaseClient
        .from('videos')
        .update({
          analysis: analysis,
          status: 'analyzed',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour de la vidéo avec l'analyse: ${updateError.message}`);
      }
      
      console.log("Vidéo mise à jour avec l'analyse IA");
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Analyse terminée avec succès',
          videoId,
          analysis
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
      
    } catch (error) {
      logError("Erreur lors de l'analyse", error);
      
      // Mettre à jour le statut de la vidéo pour indiquer l'échec
      try {
        await supabaseClient
          .from('videos')
          .update({
            status: 'error',
            error_message: `Erreur d'analyse: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      } catch (updateError) {
        logError("Erreur lors de la mise à jour du statut d'erreur", updateError);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de l\'analyse', 
          details: error.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

  } catch (error) {
    logError("Erreur générale non gérée", error);
    
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
