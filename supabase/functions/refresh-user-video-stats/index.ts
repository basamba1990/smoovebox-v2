import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée', details: 'Seule la méthode POST est supportée' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé', details: 'Token JWT requis' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('Erreur de vérification du token:', userError?.message || userError);
      return new Response(
        JSON.stringify({ error: 'Token d\'authentification invalide', details: userError?.message }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log(`Utilisateur authentifié: ${user.id}`);

    const { data: stats, error: statsError } = await supabaseAdmin
      .rpc('get_user_video_stats', { _user_id: user.id })
      .single();
    if (statsError) {
      console.error('Erreur lors de la récupération des statistiques:', statsError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération des statistiques', details: statsError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from('user_video_stats')
      .upsert({
        user_id: user.id,
        total_videos: stats.total_videos,
        total_duration: stats.total_duration,
        last_upload: stats.last_upload,
        total_views: stats.total_views,
        total_likes: stats.total_likes,
        transcribed_videos: stats.transcribed_videos,
        last_updated: new Date().toISOString()
      }, { onConflict: 'user_id' });
    if (upsertError) {
      console.error('Erreur lors de la mise à jour des statistiques:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la mise à jour des statistiques', details: upsertError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Statistiques utilisateur mises à jour avec succès',
        stats,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Exception inattendue:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error.message || 'Erreur inattendue' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
