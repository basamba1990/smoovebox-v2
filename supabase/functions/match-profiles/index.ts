// supabase/functions/match-profiles/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Vérifier la méthode POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée', details: 'Seule la méthode POST est supportée' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Vérifier les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Variables d\'environnement manquantes:', { supabaseUrl, supabaseServiceKey });
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète', details: 'Variables d\'environnement SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extraire le token d'authentification
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      console.error('Token d\'authentification manquant');
      return new Response(
        JSON.stringify({ error: 'Authentification requise', details: 'Token Bearer manquant dans l\'en-tête Authorization' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Vérifier l'utilisateur authentifié
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Erreur authentification:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentification échouée', details: userError?.message || 'Utilisateur non trouvé' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parser les données de la requête
    const { user_id, target_user_id, video_id } = await req.json();
    
    console.log('Requête reçue:', { user_id, target_user_id, video_id });

    if (!user_id || !target_user_id || !video_id) {
      console.error('Données manquantes:', { user_id, target_user_id, video_id });
      return new Response(
        JSON.stringify({ error: 'Données manquantes', details: 'user_id, target_user_id et video_id sont requis' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Vérifier que user_id correspond à l'utilisateur authentifié
    if (user_id !== user.id) {
      console.error('Incohérence utilisateur:', { provided_user_id: user_id, auth_user_id: user.id });
      return new Response(
        JSON.stringify({ error: 'Accès non autorisé', details: 'user_id ne correspond pas à l\'utilisateur authentifié' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Vérifier que l'utilisateur cible existe dans public.profiles
    const { data: targetUser, error: targetError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', target_user_id)
      .single();

    if (targetError || !targetUser) {
      console.error('Utilisateur cible non trouvé:', targetError?.message);
      return new Response(
        JSON.stringify({ error: 'Utilisateur cible non trouvé', details: targetError?.message || 'Aucun profil correspondant' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Vérifier que la vidéo existe et appartient à l'utilisateur demandeur
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, user_id')
      .eq('id', video_id)
      .eq('user_id', user_id) // Vérifier que la vidéo appartient au demandeur
      .single();

    if (videoError || !video) {
      console.error('Erreur vidéo:', videoError?.message);
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée', details: 'La vidéo n\'existe pas ou n\'appartient pas à l\'utilisateur demandeur' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Créer une connexion dans la table connections
    const { data: connection, error: insertError } = await supabase
      .from('connections')
      .insert({
        requester_id: user_id,
        target_id: target_user_id,
        video_id,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erreur création connexion:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de la connexion', details: insertError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('Connexion créée avec succès:', connection);
    return new Response(
      JSON.stringify({ 
        message: 'Demande de connexion envoyée avec succès', 
        connection_id: connection.id,
        video_id, 
        target_user_id 
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Erreur générale:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
