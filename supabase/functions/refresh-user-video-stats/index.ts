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
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { 
        auth: { 
          persistSession: false,
          autoRefreshToken: false
        } 
      }
    );

    // Vérifier le token avec getUser
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Token invalide',
          details: userError?.message 
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Appel de la fonction RPC corrigée
    const { data: stats, error: statsError } = await supabaseAdmin
      .rpc('apt_user_video_stats', { _user_id: user.id })
      .single();

    if (statsError) {
      return new Response(
        JSON.stringify({ 
          error: 'Erreur statistiques',
          details: statsError.message 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_videos: stats.total_videos || 0,
          total_duration: stats.total_duration || 0,
          last_upload: stats.last_upload || null,
          total_views: stats.total_views || 0,
          total_likes: stats.total_likes || 0,
          transcribed_videos: stats.transcribed_videos || 0
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne',
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
