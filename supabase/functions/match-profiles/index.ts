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
      throw new Error('Variables d\'environnement Supabase manquantes');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { requester_id, target_id, video_id, analysis_data } = await req.json();
    
    console.log('Données reçues:', { requester_id, target_id, video_id, analysis_data });

    if (!requester_id || !target_id) {
      return new Response(
        JSON.stringify({ error: 'requester_id et target_id sont requis' }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Vérifier si la connexion existe déjà
    const { data: existingConnection, error: checkError } = await supabase
      .from('connections')
      .select('id')
      .eq('requester_id', requester_id)
      .eq('target_id', target_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = aucun résultat
      throw checkError;
    }

    if (existingConnection) {
      return new Response(
        JSON.stringify({ error: 'Connexion déjà existante' }),
        { status: 409, headers: corsHeaders },
      );
    }

    // Créer la nouvelle connexion AVEC LES DONNÉES D'ANALYSE
    const { data, error } = await supabase
      .from('connections')
      .insert({
        requester_id,
        target_id,
        video_id: video_id || null,
        status: 'pending',
        analysis_data: analysis_data || null, // NOUVELLES DONNÉES D'ANALYSE
        match_score: analysis_data?.score || null, // SCORE DE MATCHING
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) throw error;

    console.log('Connexion créée avec succès avec analyse:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        message: 'Demande de connexion envoyée avec succès' 
      }),
      { status: 200, headers: corsHeaders },
    );

  } catch (error) {
    console.error('Erreur générale:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur serveur', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
