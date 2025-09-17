import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète', details: 'Variables d\'environnement manquantes' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extraire le token d'authentification
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise', details: 'Token manquant' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Vérifier l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentification échouée', details: userError?.message || 'Utilisateur non trouvé' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parser les données de la requête
    const { user_id, target_user_id, video_id } = await req.json();
    
    if (!user_id || !target_user_id || !video_id) {
      return new Response(
        JSON.stringify({ error: 'Données manquantes', details: 'user_id, target_user_id et video_id sont requis' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Vérifier que l'utilisateur cible existe
    const { data: targetUser, error: targetError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', target_user_id)
      .single();

    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'Utilisateur cible non trouvé' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Vérifier que la vidéo existe
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, user_id')
      .eq('id', video_id)
      .single();

    if (videoError || !video || video.user_id !== target_user_id) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou non associée à l\'utilisateur cible' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Créer une connexion
    const { error: insertError } = await supabase
      .from('connections')
      .insert({
        requester_id: user_id,
        target_id: target_user_id,
        video_id,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Erreur création connexion:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de la connexion', details: insertError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ 
        message: 'Demande de connexion envoyée avec succès', 
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
