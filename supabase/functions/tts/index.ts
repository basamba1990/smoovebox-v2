import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { createClient as createOpenAIClient } from 'npm:@openai/openai@0.0.5';

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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { text, voice = 'alloy' } = await req.json();
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Texte requis' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('Erreur de vérification du token:', userError);
      return new Response(
        JSON.stringify({ error: 'Token d\'authentification invalide' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const openai = createOpenAIClient({
      apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
    });

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
      response_format: 'mp3',
    });

    const arrayBuffer = await mp3.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const audioId = crypto.randomUUID();
    const { error: uploadError } = await supabaseAdmin.storage
      .from('audio')
      .upload(`${user.id}/${audioId}.mp3`, buffer, {
        contentType: 'audio/mp3',
      });

    if (uploadError) {
      console.error('Erreur lors de l\'upload de l\'audio:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('audio')
      .getPublicUrl(`${user.id}/${audioId}.mp3`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Synthèse vocale réussie',
        audio_url: publicUrl,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Exception inattendue:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur inattendue' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
