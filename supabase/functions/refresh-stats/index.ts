import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

// Cette fonction permet de rafraîchir les statistiques utilisateur
Deno.serve(async (req: Request) => {
  try {
    // Vérification que la méthode est POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Récupération du token d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];

    // Création du client Supabase avec le token de l'utilisateur
    const supabaseClient = createClient(
      Deno.env.get('MY_SUPABASE_URL') ?? '',
      Deno.env.get('MY_SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
        }
      }
    );

    // Vérification de l'authentification
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non authentifié', details: userError }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Création du client Supabase avec le rôle service pour rafraîchir les vues matérialisées
    const supabaseAdmin = createClient(
      Deno.env.get('MY_SUPABASE_URL') ?? '',
      Deno.env.get('MY_UPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Exécution des requêtes pour rafraîchir les vues matérialisées
    const { error: refreshUserStatsError } = await supabaseAdmin.rpc(
      'refresh_materialized_view',
      { view_name: 'private.user_video_stats' }
    );

    const { error: refreshGlobalStatsError } = await supabaseAdmin.rpc(
      'refresh_materialized_view',
      { view_name: 'public.global_stats' }
    );

    if (refreshUserStatsError || refreshGlobalStatsError) {
      console.error('Erreur lors du rafraîchissement des vues matérialisées:', { 
        userStatsError: refreshUserStatsError,
        globalStatsError: refreshGlobalStatsError
      });
      
      return new Response(JSON.stringify({ 
        error: 'Erreur lors du rafraîchissement des statistiques',
        details: {
          userStatsError: refreshUserStatsError?.message,
          globalStatsError: refreshGlobalStatsError?.message
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Statistiques rafraîchies avec succès'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erreur dans la fonction refresh-stats:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur interne', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
