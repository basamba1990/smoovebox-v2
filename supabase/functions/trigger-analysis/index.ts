import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Variables d\'environnement manquantes pour trigger-analysis');
      return new Response(JSON.stringify({ error: 'Configuration incomplète' }), { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { record } = await req.json();
    const videoId = record?.id;

    if (!videoId) {
      console.error('videoId manquant dans le payload du trigger.');
      return new Response(JSON.stringify({ error: 'videoId manquant' }), { status: 400 });
    }

    console.log(`Trigger reçu pour la vidéo ${videoId}. Appel de analyze-transcription...`);

    // Appel de la fonction analyze-transcription avec la vraie URL
    const analyzeResponse = await fetch(`https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/analyze-transcription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('MY_SUPABASE_ANON_KEY')}` // Utilisation de la clé anonyme avec préfixe MY_
      },
      body: JSON.stringify({ videoId: videoId })
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error(`Erreur lors de l\'appel à analyze-transcription pour ${videoId}: ${analyzeResponse.status} - ${errorText}`);
      // Mettre à jour le statut de la vidéo à FAILED si l\'analyse échoue
      await serviceClient.from('videos').update({ status: 'failed', error_message: `Analyse échouée: ${errorText}` }).eq('id', videoId);
      return new Response(JSON.stringify({ error: 'Échec de l\'analyse', details: errorText }), { status: 500 });
    }

    console.log(`Appel à analyze-transcription réussi pour la vidéo ${videoId}.`);
    return new Response(JSON.stringify({ success: true, videoId: videoId }), { status: 200 });

  } catch (error) {
    console.error('Erreur dans la fonction trigger-analysis:', error.message);
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur', details: error.message }), { status: 500 });
  }
});
