// supabase/functions/match-profiles/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  console.log('Fonction match-profiles appelée:', req.method, req.url);

  if (req.method === 'OPTIONS') {
    console.info('Préflight OPTIONS reçu');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.warn('Méthode non autorisée:', req.method);
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Variables d\'environnement manquantes:', { supabaseUrl, supabaseServiceKey });
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète', details: 'Variables d\'environnement manquantes' }),
        { status: 500, headers: corsHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extraire le token d'authentification
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      console.error('Token manquant dans l\'en-tête Authorization');
      return new Response(
        JSON.stringify({ error: 'Authentification requise', details: 'Token manquant' }),
        { status: 401, headers: corsHeaders },
      );
    }

    // Vérifier l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Erreur authentification:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentification échouée', details: userError?.message || 'Utilisateur non trouvé' }),
        { status: 401, headers: corsHeaders },
      );
    }

    // Parser les données de la requête
    const { user_id, target_user_id, video_id } = await req.json();
    console.log('Payload reçu:', { user_id, target_user_id, video_id });

    if (!user_id || !target_user_id || !video_id) {
      console.error('Paramètres manquants:', { user_id, target_user_id, video_id });
      return new Response(
        JSON.stringify({ error: 'Données manquantes', details: 'user_id, target_user_id et video_id sont requis' }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Vérifier que user_id correspond à l'utilisateur authentifié
    if (user_id !== user.id) {
      console.error('Incohérence user_id:', { user_id, auth_user_id: user.id });
      return new Response(
        JSON.stringify({ error: 'Non autorisé', details: 'user_id ne correspond pas à l\'utilisateur authentifié' }),
        { status: 403, headers: corsHeaders },
      );
    }

    // Vérifier que l'utilisateur cible existe
    const { data: targetUser, error: targetError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', target_user_id)
      .single();

    if (targetError || !targetUser) {
      console.error('Utilisateur cible non trouvé:', targetError?.message);
      return new Response(
        JSON.stringify({ error: 'Utilisateur cible non trouvé', details: targetError?.message }),
        { status: 404, headers: corsHeaders },
      );
    }

    // Vérifier que la vidéo existe et appartient à l'utilisateur demandeur
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, user_id, storage_path')
      .eq('id', video_id)
      .eq('user_id', user_id)
      .single();

    if (videoError || !video) {
      console.error('Erreur récupération vidéo:', videoError?.message);
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou non associée à l\'utilisateur demandeur' }),
        { status: 404, headers: corsHeaders },
      );
    }

    // Créer une connexion
    const { data: connection, error: insertError } = await supabase
      .from('connections')
      .insert({
        requester_id: user_id,
        target_id: target_user_id,
        video_id,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erreur création connexion:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de la connexion', details: insertError.message }),
        { status: 500, headers: corsHeaders },
      );
    }

    // Générer une URL signée pour la vidéo
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('videos')
      .createSignedUrl(video.storage_path, 3600);

    if (urlError || !signedUrl) {
      console.error('Erreur génération URL signée:', urlError?.message);
      return new Response(
        JSON.stringify({ error: 'Erreur génération URL vidéo', details: urlError?.message }),
        { status: 500, headers: corsHeaders },
      );
    }

    // Appeler send-email avec le token
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        user_id: target_user_id,
        video_id,
        video_url: signedUrl.signedUrl,
      },
      headers: {
        Authorization: `Bearer ${token}`, // Transmettre le token
      },
    });

    if (emailError) {
      console.error('Erreur appel send-email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Erreur envoi notification', details: emailError.message }),
        { status: 500, headers: corsHeaders },
      );
    }

    console.log('Connexion créée et email envoyé:', { connection_id: connection.id, target_user_id });
    return new Response(
      JSON.stringify({
        message: 'Demande de connexion envoyée avec succès',
        connection_id: connection.id,
        video_id,
        target_user_id,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error('Erreur générale:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: error.message }),
      { status: 500, headers: corsHeaders },
    );
  }
});
