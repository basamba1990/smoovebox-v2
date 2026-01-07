import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

// Basic CORS headers (same pattern as other functions)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  console.log('🔍 extract-profile-information called');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  let videoId: string | null = null;

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non supportée. Utilisez POST.' }),
        { status: 405, headers: corsHeaders },
      );
    }

    const rawBody = await req.text();
    if (!rawBody || rawBody.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Corps de requête vide' }),
        { status: 400, headers: corsHeaders },
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error('❌ JSON invalide dans extract-profile-information:', e);
      return new Response(
        JSON.stringify({ error: 'JSON invalide', details: (e as Error).message }),
        { status: 400, headers: corsHeaders },
      );
    }

    videoId = body.videoId || body.video_id || null;
    const userId = body.userId || null;

    if (!videoId) {
      return new Response(
        JSON.stringify({
          error: 'Paramètre manquant: videoId requis',
          received: { videoId: !!videoId },
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('❌ Configuration manquante pour extract-profile-information:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey,
      });
      throw new Error('Configuration serveur incomplète');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Fetch video to get transcription
    console.log('🔍 Récupération vidéo pour profil:', videoId);
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('❌ Vidéo non trouvée pour extract-profile-information:', videoError);
      throw new Error(`Vidéo non trouvée: ${videoError?.message || 'Aucune donnée'}`);
    }

    if (userId && video.user_id && video.user_id !== userId) {
      throw new Error('Accès non autorisé pour cette vidéo');
    }

    // Get transcription text
    let transcriptionText: string | null = video.transcription_text || null;
    if (!transcriptionText && video.transcription_data) {
      try {
        const transcriptionData =
          typeof video.transcription_data === 'string'
            ? JSON.parse(video.transcription_data)
            : video.transcription_data;
        transcriptionText = transcriptionData?.text || transcriptionData?.full_text || null;
      } catch (e) {
        console.warn('⚠️ Erreur parsing transcription_data dans extract-profile-information:', e);
      }
    }

    if (!transcriptionText || transcriptionText.trim().length < 10) {
      return new Response(
        JSON.stringify({
          error: 'Aucune transcription suffisante disponible pour cette vidéo.',
          videoStatus: video.status,
          hasTranscriptionText: !!video.transcription_text,
          hasTranscriptionData: !!video.transcription_data,
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    const cleanText = transcriptionText.trim().substring(0, 8000);
    console.log(`📝 Texte pour extraction de profil: ${cleanText.length} caractères`);

    const systemMessage = `
Tu es un extracteur de profil personnel très strict.
À partir de la transcription fournie, tu dois identifier UNIQUEMENT les informations explicitement mentionnées.
Ne devine JAMAIS: si une information n'est pas clairement dite, mets la valeur à null.

Tu dois répondre STRICTEMENT avec un JSON de la forme:
{
  "profile_information": {
    "full_name": string | null,
    "preferred_name": string | null,
    "approx_age": number | null,
    "birth_place": string | null,
    "current_city": string | null,
    "languages": string[] | null,
    "studies": string | null,
    "current_role": string | null,
    "interests": string[] | null,
    "other_explicit_details": string[] | null
  }
}`;

    const userMessage = `Transcription:\n${cleanText}\n\nRappels importants:\n- Utilise null pour toute information non mentionnée explicitement.\n- Ne jamais inventer ni déduire à partir de l'âge visuel ou d'autres suppositions.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 800,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    console.log('✅ Réponse brute extract-profile-information:', content?.substring(0, 300));

    if (!content) {
      throw new Error('Réponse vide du modèle lors de l’extraction du profil');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('❌ Erreur parsing JSON profil:', e);
      throw new Error('JSON de profil invalide retourné par le modèle');
    }

    const profileInformation =
      parsed?.profile_information && typeof parsed.profile_information === 'object'
        ? parsed.profile_information
        : null;

    console.log('✅ Profil extrait:', profileInformation);

    // Update videos.profile_information
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        profile_information: profileInformation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId);

    if (updateError) {
      console.error('❌ Erreur mise à jour profile_information:', updateError);
      throw new Error(`Erreur sauvegarde profil: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        profile_information: profileInformation,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error('💥 Erreur extract-profile-information:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        videoId,
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});


