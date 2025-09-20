// functions/tts/index.js
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

    // (Optionnel) Vérification simple d'auth : on exige la présence d'un Bearer
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const body = await req.json();
    const { text, voice = 'nova', speed = 1.0 } = body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Texte requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'nova';
    const selectedSpeed = Math.min(2.0, Math.max(0.25, parseFloat(speed) || 1.0));

    // Appel OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: selectedVoice,
      input: text,
      speed: selectedSpeed
    });

    // Convertir la réponse en ArrayBuffer (compatible Deno)
    // La plupart des SDK renvoient un objet avec arrayBuffer() ou un Blob-like
    const arrayBuffer = await mp3.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(uint8.length),
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('Erreur TTS:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur lors de la synthèse vocale', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
