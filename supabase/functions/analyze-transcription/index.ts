import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Alignement avec les statuts définis dans constants/videoStatus.js
const VIDEO_STATUS = {
  DRAFT: 'draft',           // En attente ou prêt pour traitement
  PROCESSING: 'processing', // En cours de traitement
  PUBLISHED: 'published',   // Traitement terminé avec succès
  FAILED: 'failed',         // Échec du traitement
  ANALYZING: 'analyzing'   // Statut spécial pour l'analyse en cours
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      // Si JSON parsing échoue, essayer les paramètres d'URL
      const url = new URL(req.url);
      const videoId = url.searchParams.get('videoId');
      if (videoId) {
        requestData = { videoId };
      } else {
        console.error("Erreur lors de l'analyse du JSON de la requête", parseError);
        return new Response(
          JSON.stringify({ error: "Format de requête invalide", details: parseError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
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

    // Récupérer la vidéo
    const { data: videoData, error: videoError } = await supabaseClient
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
    // Stratégie adaptative pour récupérer le texte de la transcription selon la structure de données
    let transcriptionText = null;
    
    if (videoData.transcription_text) {
      transcriptionText = videoData.transcription_text;
    } else if (videoData.transcription) {
      // Peut être du texte direct ou un objet JSON
      if (typeof videoData.transcription === 'string') {
        transcriptionText = videoData.transcription;
      } else if (typeof videoData.transcription === 'object') {
        transcriptionText = videoData.transcription.text || JSON.stringify(videoData.transcription);
      }
    } else if (videoData.transcription_data) {
      // Peut contenir un champ 'text' ou être un tableau de segments
      if (typeof videoData.transcription_data === 'object') {
        if (videoData.transcription_data.text) {
          transcriptionText = videoData.transcription_data.text;
        } else if (Array.isArray(videoData.transcription_data.segments)) {
          // Concaténer les segments
          transcriptionText = videoData.transcription_data.segments
            .map(segment => segment.text)
            .join(' ');
        }
      }
    }
    
    // Vérifier aussi dans la table transcriptions
    if (!transcriptionText) {
      const { data: transcriptionData, error: transcriptionError } = await supabaseClient
        .from('transcriptions')
        .select('full_text, transcription_text')
        .eq('video_id', videoId)
        .single();
        
      if (!transcriptionError && transcriptionData) {
        transcriptionText = transcriptionData.full_text || transcriptionData.transcription_text;
      }
    }
    
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
        status: VIDEO_STATUS.ANALYZING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    // Générer immédiatement une réponse pour ne pas faire attendre l'utilisateur
    const immediateResponse = new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analyse démarrée avec succès',
        videoId,
        status: VIDEO_STATUS.ANALYZING
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202  // 202 Accepted indique que le traitement a été accepté mais pas encore terminé
      }
    );

    // Exécuter l'analyse en arrière-plan
    EdgeRuntime.waitUntil((async () => {
      try {
        // Génération de l'analyse IA de la transcription
        // Utiliser un modèle plus léger pour une réponse rapide
        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Tu es un expert en analyse de discours. Analyse la transcription suivante et fournis:
              1. Un résumé concis (5-7 phrases)
              2. 5-7 points clés numérotés
              3. Une évaluation de la performance orale sur 10 pour: clarté, structure, rythme, expressivité
              4. 3-5 suggestions d'amélioration concrètes et applicables
              5. 3-5 points forts identifiés dans la présentation
              6. Une liste de 3-5 mots-clés/sujets principaux abordés
              
              Réponds au format JSON avec les clés suivantes:
              {
                "resume": "string",
                "points_cles": ["string", "string", ...],
                "evaluation": {
                  "clarte": number,
                  "structure": number,
                  "rythme": number,
                  "expressivite": number,
                  "score_global": number
                },
                "suggestions": ["string", "string", ...],
                "points_forts": ["string", "string", ...],
                "sujets": ["string", "string", ...]
              }`
            },
            {
              role: "user",
              content: transcriptionText.substring(0, 15000) // Limiter pour les modèles avec contexte réduit
            }
          ],
          response_format: { type: "json_object" }
        });
        
        const analysis = JSON.parse(analysisResponse.choices[0].message.content);
        console.log("Analyse IA générée avec succès");
        
        // Enrichir l'analyse avec des insights supplémentaires en utilisant un modèle avancé si disponible
        let enhancedInsights = {};
        try {
          const insightsResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `Analyse cette transcription et fournis des insights supplémentaires sur:
                1. Le public cible probable
                2. Le niveau d'expertise requis pour comprendre
                3. L'engagement émotionnel généré
                4. Des suggestions de formats visuels qui compléteraient bien ce contenu
                
                Réponds au format JSON strict:
                {
                  "public_cible": ["string", "string", ...],
                  "niveau_expertise": "débutant|intermédiaire|avancé",
                  "engagement_emotionnel": {
                    "type": "string",
                    "niveau": number
                  },
                  "formats_visuels_suggeres": ["string", "string", ...]
                }`
              },
              {
                role: "user",
                content: transcriptionText.substring(0, 8000)
              }
            ],
            response_format: { type: "json_object" }
          });
          
          enhancedInsights = JSON.parse(insightsResponse.choices[0].message.content);
          console.log("Insights supplémentaires générés");
        } catch (insightsError) {
          console.error("Erreur lors de la génération des insights supplémentaires", insightsError);
          // Continuer sans les insights supplémentaires
        }
        
        // Fusion des analyses
        const completeAnalysis = {
          ...analysis,
          insights: enhancedInsights,
          analyzed_at: new Date().toISOString(),
          video_id: videoId
        };
        
        // Mettre à jour la vidéo avec l'analyse
        try {
          await supabaseClient
            .from("videos")
            .update({
              analysis: completeAnalysis,
              status: VIDEO_STATUS.PUBLISHED,
              updated_at: new Date().toISOString(),
            })
            .eq("id", videoId);
        } catch (updateError) {
          console.error("Erreur lors de la mise à jour de la vidéo avec l'analyse", updateError);
          await supabaseClient
            .from("videos")
            .update({
              status: VIDEO_STATUS.FAILED,
              error_message: `Erreur de mise à jour: ${updateError.message}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", videoId);
          throw updateError; // Re-throw the error to be caught by the outer catch block
        }
        
        // Vérifier si la table analyses existe et y ajouter l'analyse
        try {
          await supabaseClient
            .from('analyses')
            .upsert({
              video_id: videoId,
              content: completeAnalysis,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'video_id'
            });
        } catch (analysesError) {
          console.log("La table analyses n'existe pas ou a une structure incompatible", analysesError);
          // Continuer sans erreur car l'analyse est déjà stockée dans la table videos
        }
        
        console.log(`Analyse terminée avec succès pour la vidéo ${videoId}`);
        
      } catch (error) {
        console.error("Erreur lors de l'analyse", error);
        
        // Mettre à jour le statut de la vidéo pour indiquer l'échec
        await supabaseClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Erreur d'analyse: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      }
    })());
    
    // Retourner la réponse immédiate
    return immediateResponse;

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
