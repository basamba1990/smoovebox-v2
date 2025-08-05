// analyze-transcription.ts - Fonction pour analyser une transcription existante
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
    console.log("Fonction analyze-transcription appelée");
    
    // Initialiser les clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error("Variables d'environnement manquantes");
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

    // Récupérer la transcription de la vidéo
    const { data: videoData, error: videoError } = await supabaseClient
      .from('video_transcriptions')
      .select('*')
      .eq('video_id', videoId)
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

    if (!videoData) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }
    
    // Vérifier que la vidéo a une transcription
    const transcriptionText = videoData.transcription_text || 
                             videoData.video_transcription || 
                             (videoData.transcription_data && videoData.transcription_data.text);
    
    if (!transcriptionText) {
      return new Response(
        JSON.stringify({ error: 'Aucune transcription disponible pour cette vidéo' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    // Mettre à jour le statut de la vidéo pour indiquer que l'analyse est en cours
    await supabaseClient
      .from('videos')
      .update({
        status: 'analyzing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    try {
      // Générer l'analyse IA de la transcription
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
      await supabaseClient
        .from('videos')
        .update({
          analysis: analysis,
          status: 'analyzed',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      // Vérifier si la table analyses existe et y ajouter l'analyse
      try {
        await supabaseClient
          .from('analyses')
          .upsert({
            video_id: videoId,
            content: analysis,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'video_id'
          });
      } catch (analysesError) {
        console.log("La table analyses n'existe pas ou a une structure incompatible", analysesError);
        // Continuer sans erreur car l'analyse est déjà stockée dans la table videos
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Analyse générée avec succès',
          videoId,
          analysis
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
      
    } catch (error) {
      console.error("Erreur lors de l'analyse", error);
      
      // Mettre à jour le statut de la vidéo pour indiquer l'échec
      await supabaseClient
        .from('videos')
        .update({
          status: 'error',
          error_message: `Erreur d'analyse: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
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
