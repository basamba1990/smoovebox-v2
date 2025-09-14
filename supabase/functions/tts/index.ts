import OpenAI from 'npm:openai@4.68.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'audio/mpeg'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Méthode non autorisée'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({
        error: 'Configuration incomplète',
        details: 'OPENAI_API_KEY manquante'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });
    const { text } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({
        error: 'Texte requis'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'nova',
      input: text,
      speed: 1.0
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Erreur TTS:', error);
    return new Response(JSON.stringify({
      error: 'Erreur lors de la synthèse vocale',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
