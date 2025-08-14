// Edge Function pour l'assistant de pitch interactif
// Cette fonction génère des conseils personnalisés pour aider l'utilisateur à préparer son pitch
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

    // Initialisation du client Supabase avec authentification
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: { persistSession: false }
      }
    );

    // Récupérer le token d'authentification
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

    // Initialiser le client OpenAI
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Extraire les données de la requête
    const requestData = await req.json();
    const { 
      sessionId, 
      currentQuestion, 
      answers = {}, 
      userInfo = {}
    } = requestData;
    
    // Vérification des données requises
    if (!currentQuestion) {
      return new Response(
        JSON.stringify({ error: 'currentQuestion est requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Récupérer ou créer une session d'assistant de pitch
    let pitchSession;
    
    if (sessionId) {
      // Récupérer une session existante
      const { data: existingSession, error: sessionError } = await serviceClient
        .from('pitch_assistant_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();
        
      if (sessionError && sessionError.code !== 'PGRST116') {
        console.error("Erreur lors de la récupération de la session:", sessionError);
      } else if (existingSession) {
        pitchSession = existingSession;
      }
    }
    
    // Si aucune session n'existe ou n'a été trouvée, en créer une nouvelle
    if (!pitchSession) {
      const { data: newSession, error: createError } = await serviceClient
        .from('pitch_assistant_sessions')
        .insert({
          user_id: user.id,
          answers: answers,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (createError) {
        return new Response(
          JSON.stringify({ 
            error: "Erreur de création de session", 
            details: createError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      pitchSession = newSession;
    }

    // Récupérer les informations utilisateur pour personnalisation
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
      
    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Erreur lors de la récupération du profil:", profileError);
    }

    // Récupérer l'historique des vidéos de l'utilisateur pour contexte
    const { data: userVideos, error: videosError } = await serviceClient
      .from('videos')
      .select('id, title, transcription, analysis')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);
      
    if (videosError) {
      console.error("Erreur lors de la récupération des vidéos:", videosError);
    }

    // Construire le contexte pour l'IA
    const context = {
      user: {
        id: user.id,
        email: user.email,
        profile: profile || {}
      },
      question: currentQuestion,
      previousAnswers: answers || {},
      sessionData: pitchSession,
      userVideos: userVideos || [],
      userInfo: userInfo || {}
    };

    // Générer des conseils personnalisés avec OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Tu es un coach expert en communication et pitchs sportifs qui aide à préparer un pitch vidéo de qualité.
          
          La question actuelle est: ${currentQuestion.title}
          Sous-titre: ${currentQuestion.subtitle || ''}
          Catégorie: ${currentQuestion.category || ''}
          
          Tu dois guider l'utilisateur en fournissant des conseils personnalisés qui l'aideront à répondre à cette question spécifique.
          
          Sois encourageant, positif et adapte ton langage à un public jeune sportif (15-25 ans).
          Donne des conseils concrets et actionnables.
          
          Réponds au format JSON avec cette structure:
          {
            "conseil_principal": "Un conseil principal pour aider à répondre à la question",
            "astuces": [
              "Astuce 1 - courte et précise",
              "Astuce 2 - courte et précise",
              "Astuce 3 - courte et précise"
            ],
            "exemple_reponse": "Un exemple concret de bonne réponse à la question posée",
            "suivi": "Une question de relance pour aider l'utilisateur à approfondir sa réponse"
          }`
        },
        {
          role: "user",
          content: JSON.stringify(context)
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const guidance = JSON.parse(completion.choices[0].message.content);
    
    // Mettre à jour la session avec les nouvelles réponses
    const updatedAnswers = { ...pitchSession.answers, ...answers };
    
    const { error: updateError } = await serviceClient
      .from('pitch_assistant_sessions')
      .update({
        answers: updatedAnswers,
        updated_at: new Date().toISOString()
      })
      .eq('id', pitchSession.id);
      
    if (updateError) {
      console.error("Erreur lors de la mise à jour de la session:", updateError);
    }
    
    // Enregistrer cette interaction pour amélioration future
    EdgeRuntime.waitUntil(
      serviceClient.from('user_activities').insert({
        user_id: user.id,
        activity_type: 'pitch_assistant',
        details: {
          session_id: pitchSession.id,
          question_id: currentQuestion.id,
          guidance_provided: guidance
        },
        created_at: new Date().toISOString()
      }).catch(err => console.error("Erreur d'enregistrement de l'activité:", err))
    );

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: pitchSession.id,
        guidance,
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
