import OpenAI from 'npm:openai@4.68.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète', details: 'OPENAI_API_KEY manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérification de l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const { text, voice = 'nova', speed = 1.0 } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Texte requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation des paramètres
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'nova';
    const selectedSpeed = Math.min(2.0, Math.max(0.25, parseFloat(speed) || 1.0));

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: selectedVoice,
      input: text,
      speed: selectedSpeed
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Erreur TTS:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur lors de la synthèse vocale', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
