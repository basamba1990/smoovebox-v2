// Edge Function pour l'analyse vidéo avancée
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Gérer les requêtes OPTIONS pour CORS
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: new Headers(corsHeaders)
  });
}

// Fonction principale
Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    // Initialiser les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      return new Response(
        JSON.stringify({ 
          error: "Configuration incomplète", 
          details: "Variables d'environnement manquantes" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Récupérer les données de la requête
    const requestData = await req.json();
    const { videoId, transcription, videoMetadata } = requestData;
    
    if (!videoId || !transcription) {
      return new Response(
        JSON.stringify({ error: 'videoId et transcription sont requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ 
          error: "Authentification requise", 
          details: "Token d'authentification manquant ou invalide" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Initialiser le client avec le token utilisateur
    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: "Authentification échouée", 
          details: authError?.message || "Utilisateur non trouvé" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Client service pour les opérations privilégiées
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier que la vidéo appartient à l'utilisateur
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ 
          error: "Vidéo non trouvée", 
          details: videoError?.message || "Vidéo introuvable ou accès non autorisé" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Récupérer l'historique des analyses pour contextualisation
    const { data: userHistory, error: historyError } = await serviceClient
      .from('videos')
      .select('id, title, transcription, analysis')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);
      
    if (historyError) {
      console.error("Erreur lors de la récupération de l'historique:", historyError);
    }

    // Initialiser le client OpenAI
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Analyse du contenu de la vidéo avec OpenAI
    const analysis = await analyzeVideoContent(openai, transcription, videoMetadata, userHistory || []);
    
    // Mise à jour de la vidéo avec l'analyse
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        analysis: analysis,
        status: 'analyzed',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
      
    if (updateError) {
      return new Response(
        JSON.stringify({ 
          error: "Erreur lors de la mise à jour de l'analyse", 
          details: updateError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Enregistrer cette activité
    EdgeRuntime.waitUntil(
      serviceClient.from('user_activities').insert({
        user_id: user.id,
        activity_type: 'video_analysis',
        details: {
          video_id: videoId,
          analysis_type: 'comprehensive'
        },
        created_at: new Date().toISOString()
      }).catch(err => console.error("Erreur d'enregistrement de l'activité:", err))
    );

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error("Erreur:", error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Fonction pour analyser le contenu de la vidéo avec OpenAI
async function analyzeVideoContent(openai, transcription, videoMetadata, userHistory = []) {
  try {
    // Créer un contexte à partir des données
    const context = {
      transcription: transcription,
      metadata: videoMetadata || {},
      previousVideos: userHistory.map(v => ({
        id: v.id,
        title: v.title,
        transcription: v.transcription ? v.transcription.substring(0, 200) + '...' : null,
        previousAnalysis: v.analysis
      }))
    };

    // Appeler l'API OpenAI pour l'analyse
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Tu es un expert en analyse de pitchs vidéo pour sportifs. Tu dois analyser cette transcription de vidéo et fournir une analyse détaillée dans les domaines suivants:

          1. STRUCTURE: Évalue l'organisation du discours, son fil conducteur et sa clarté.
          2. CLARTÉ: Analyse la précision du message et l'accessibilité du langage.
          3. ENGAGEMENT: Évalue le potentiel d'engagement et l'impact émotionnel.
          4. TON: Analyse le ton utilisé et son adéquation avec le message.
          5. RECOMMANDATIONS: Propose des améliorations concrètes et applicables.
          
          Réponds au format JSON avec cette structure:
          {
            "scores": {
              "structure": {
                "score": 0-100,
                "commentaire": "Explication du score attribué"
              },
              "clarté": {
                "score": 0-100,
                "commentaire": "Explication du score attribué"
              },
              "engagement": {
                "score": 0-100,
                "commentaire": "Explication du score attribué"
              },
              "ton": {
                "score": 0-100,
                "commentaire": "Explication du score attribué"
              }
            },
            "analyse_globale": "Analyse générale sur l'efficacité et l'impact du pitch",
            "points_forts": ["Point fort 1", "Point fort 2", "Point fort 3"],
            "points_amélioration": ["Point d'amélioration 1", "Point d'amélioration 2", "Point d'amélioration 3"],
            "recommandations": ["Recommandation 1", "Recommandation 2", "Recommandation 3"],
            "prochaines_étapes": ["Prochaine étape 1", "Prochaine étape 2", "Prochaine étape 3"]
          }`
        },
        {
          role: "user",
          content: JSON.stringify(context)
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Extraire et retourner l'analyse
    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error("Erreur lors de l'analyse OpenAI:", error);
    throw new Error(`Erreur d'analyse: ${error.message}`);
  }
}
