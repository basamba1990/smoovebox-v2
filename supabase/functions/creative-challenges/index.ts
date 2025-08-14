// Edge Function pour les défis créatifs et ateliers ludiques
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

// Fonction pour gérer les requêtes OPTIONS (CORS preflight)
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: new Headers(corsHeaders)
  });
}

// Initialisation des clients Supabase
function initClients(req) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Token d'authentification
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

  // Client authentifié pour l'utilisateur
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  });

  // Client avec le rôle de service pour les opérations privilégiées
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  return { userClient, serviceClient };
}

// Point d'entrée principal
Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/creative-challenges', '');
    const { userClient, serviceClient } = initClients(req);

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

    // Routes
    if (req.method === 'GET') {
      if (path === '/list' || path === '') {
        return await listChallenges(serviceClient, user.id, corsHeaders);
      } else if (path.startsWith('/detail/')) {
        const challengeId = path.replace('/detail/', '');
        return await getChallengeDetail(serviceClient, challengeId, user.id, corsHeaders);
      } else if (path === '/user-badges') {
        return await getUserBadges(serviceClient, user.id, corsHeaders);
      }
    } else if (req.method === 'POST') {
      if (path === '/submit') {
        const requestData = await req.json();
        return await submitChallenge(serviceClient, user.id, requestData, corsHeaders);
      } else if (path === '/complete') {
        const requestData = await req.json();
        return await completeChallenge(serviceClient, user.id, requestData, corsHeaders);
      }
    } else if (req.method === 'PUT') {
      if (path.startsWith('/update/')) {
        const challengeId = path.replace('/update/', '');
        const requestData = await req.json();
        return await updateChallengeProgress(serviceClient, user.id, challengeId, requestData, corsHeaders);
      }
    }

    return new Response(
      JSON.stringify({ error: "Route non trouvée" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
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

// Fonction pour lister tous les défis disponibles
async function listChallenges(supabaseClient, userId, corsHeaders) {
  // Récupérer tous les défis actifs
  const { data: challenges, error } = await supabaseClient
    .from('creative_challenges')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Erreur lors de la récupération des défis", details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  // Récupérer les défis déjà complétés par l'utilisateur
  const { data: completedChallenges, error: completedError } = await supabaseClient
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .eq('category', 'challenge');

  if (completedError) {
    console.error("Erreur lors de la récupération des défis complétés:", completedError);
  }

  // Marquer les défis déjà complétés
  const completedIds = completedChallenges?.map(c => c.badge_id) || [];
  const challengesWithStatus = challenges.map(challenge => ({
    ...challenge,
    completed: completedIds.includes(challenge.id)
  }));

  return new Response(
    JSON.stringify({ challenges: challengesWithStatus }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

// Fonction pour récupérer les détails d'un défi spécifique
async function getChallengeDetail(supabaseClient, challengeId, userId, corsHeaders) {
  // Récupérer les détails du défi
  const { data: challenge, error } = await supabaseClient
    .from('creative_challenges')
    .select('*')
    .eq('id', challengeId)
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: "Défi non trouvé", details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    );
  }

  // Vérifier si l'utilisateur a déjà complété ce défi
  const { data: completedChallenge, error: completedError } = await supabaseClient
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .eq('badge_id', challengeId)
    .maybeSingle();

  if (completedError) {
    console.error("Erreur lors de la vérification du statut du défi:", completedError);
  }

  return new Response(
    JSON.stringify({
      challenge,
      completed: completedChallenge !== null,
      completionData: completedChallenge || null
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

// Fonction pour soumettre un défi
async function submitChallenge(supabaseClient, userId, requestData, corsHeaders) {
  const { challengeId, submission } = requestData;

  if (!challengeId || !submission) {
    return new Response(
      JSON.stringify({ error: "Données incomplètes", details: "challengeId et submission sont requis" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  // Récupérer les informations du défi
  const { data: challenge, error: challengeError } = await supabaseClient
    .from('creative_challenges')
    .select('*')
    .eq('id', challengeId)
    .single();

  if (challengeError) {
    return new Response(
      JSON.stringify({ error: "Défi non trouvé", details: challengeError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    );
  }

  // Enregistrer la soumission
  const { data: submissionData, error: submissionError } = await supabaseClient
    .from('challenge_submissions')
    .insert({
      user_id: userId,
      challenge_id: challengeId,
      submission_data: submission,
      status: 'submitted'
    })
    .select()
    .single();

  if (submissionError) {
    return new Response(
      JSON.stringify({ error: "Erreur lors de la soumission", details: submissionError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Défi soumis avec succès",
      submissionId: submissionData.id
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

// Fonction pour compléter un défi et attribuer un badge
async function completeChallenge(supabaseClient, userId, requestData, corsHeaders) {
  const { challengeId, submissionId } = requestData;

  if (!challengeId) {
    return new Response(
      JSON.stringify({ error: "Données incomplètes", details: "challengeId est requis" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  // Récupérer les informations du défi
  const { data: challenge, error: challengeError } = await supabaseClient
    .from('creative_challenges')
    .select('*')
    .eq('id', challengeId)
    .single();

  if (challengeError) {
    return new Response(
      JSON.stringify({ error: "Défi non trouvé", details: challengeError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    );
  }

  // Vérifier si le badge a déjà été attribué
  const { data: existingBadge, error: badgeError } = await supabaseClient
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .eq('badge_id', challengeId)
    .maybeSingle();

  if (badgeError) {
    console.error("Erreur lors de la vérification du badge:", badgeError);
  }

  // Si le badge n'existe pas encore, l'attribuer
  if (!existingBadge) {
    const { error: awardError } = await supabaseClient
      .from('user_badges')
      .insert({
        user_id: userId,
        badge_id: challengeId,
        badge_name: challenge.title,
        badge_description: challenge.description,
        points: challenge.points,
        category: 'challenge'
      });

    if (awardError) {
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'attribution du badge", details: awardError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Mettre à jour le statut de la soumission si submissionId est fourni
    if (submissionId) {
      const { error: updateError } = await supabaseClient
        .from('challenge_submissions')
        .update({ status: 'completed' })
        .eq('id', submissionId)
        .eq('user_id', userId);

      if (updateError) {
        console.error("Erreur lors de la mise à jour de la soumission:", updateError);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Défi complété et badge attribué",
      points: challenge.points
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

// Fonction pour mettre à jour la progression d'un défi
async function updateChallengeProgress(supabaseClient, userId, challengeId, requestData, corsHeaders) {
  const { progress, status } = requestData;

  // Mettre à jour la progression
  const { error: progressError } = await supabaseClient
    .from('challenge_progress')
    .upsert({
      user_id: userId,
      challenge_id: challengeId,
      progress_data: progress,
      status: status || 'in_progress'
    });

  if (progressError) {
    return new Response(
      JSON.stringify({ error: "Erreur lors de la mise à jour de la progression", details: progressError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Progression mise à jour"
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

// Fonction pour récupérer les badges de l'utilisateur
async function getUserBadges(supabaseClient, userId, corsHeaders) {
  const { data: badges, error } = await supabaseClient
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Erreur lors de la récupération des badges", details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ badges }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}
