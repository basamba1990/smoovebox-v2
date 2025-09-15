import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'Configuration incomplète',
          details: 'Vérifiez SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, et OPENAI_API_KEY',
        }),
        { headers: corsHeaders, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé', details: 'Token JWT requis' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Erreur de vérification du token:', userError?.message || userError);
      return new Response(
        JSON.stringify({ error: 'Token d\'authentification invalide', details: userError?.message }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const contentType = req.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type invalide', details: 'application/json requis' }),
        { status: 400, headers: corsHeaders }
      );
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'JSON invalide', details: 'Le corps de la requête doit être un JSON valide' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { text, voice } = requestBody;
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Texte requis', details: 'Fournir un texte valide dans le body JSON' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice || 'alloy',
      input: text,
      speed: 1.0,
    });

    const arrayBuffer = await mp3.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      status: 200,
    });
  } catch (error) {
    console.error('Erreur TTS:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error.message || 'Erreur inattendue' }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
