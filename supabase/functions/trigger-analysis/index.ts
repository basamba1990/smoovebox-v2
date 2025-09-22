// functions/trigger-analysis/index.ts (version corrigée)
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Variables d\'environnement manquantes');
      return new Response(JSON.stringify({ error: 'Configuration incomplète' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Vérifier si c'est un trigger de base de données
    const { type, record, table } = await req.json();
    
    if (type === 'INSERT' && table === 'videos' && record?.status === 'uploaded') {
      const videoId = record.id;
      
      console.log(`📥 Trigger activé pour la vidéo ${videoId}`);

      // Appeler directement transcribe-video
      const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ videoId })
      });

      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text();
        console.error(`❌ Erreur transcription: ${errorText}`);
        
        await serviceClient
          .from('videos')
          .update({ 
            status: 'failed', 
            error_message: `Échec transcription: ${errorText}` 
          })
          .eq('id', videoId);
          
        return new Response(JSON.stringify({ error: 'Échec transcription' }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ Transcription déclenchée pour ${videoId}`);
      return new Response(JSON.stringify({ success: true, videoId }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ message: 'Trigger ignoré - pas une nouvelle vidéo' }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erreur trigger-analysis:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
