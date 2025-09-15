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
    const { video_id } = await req.json();
    if (!video_id) {
      return new Response(
        JSON.stringify({ error: 'video_id requis' }),
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

    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .select('id, user_id, status')
      .eq('id', video_id)
      .eq('user_id', user.id)
      .single();

    if (videoError || !video) {
      console.error('Erreur lors de la récupération de la vidéo:', videoError);
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou non autorisée' }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (video.status === 'transcribed') {
      return new Response(
        JSON.stringify({ message: 'Vidéo déjà transcrite' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('videos')
      .getPublicUrl(`${user.id}/${video_id}.mp4`);

    const openai = createOpenAIClient({
      apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
    });

    const response = await fetch(publicUrl);
    if (!response.ok) {
      throw new Error('Impossible de récupérer la vidéo depuis le stockage');
    }

    const videoBlob = await response.blob();
    const videoFile = new File([videoBlob], `${video_id}.mp4`, { type: 'video/mp4' });

    const transcription = await openai.audio.transcriptions.create({
      file: videoFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
    });

    const { error: transcriptionError } = await supabaseAdmin
      .from('transcriptions')
      .upsert({
        video_id: video_id,
        user_id: user.id,
        full_text: transcription.text,
        transcription_text: transcription.text,
        transcription_data: transcription,
        segments: transcription.segments,
        confidence_score: transcription.segments?.[0]?.avg_logprob || 0,
        status: 'completed',
        updated_at: new Date().toISOString(),
      });

    if (transcriptionError) {
      console.error('Erreur lors de l\'enregistrement de la transcription:', transcriptionError);
      throw transcriptionError;
    }

    const { error: videoUpdateError } = await supabaseAdmin
      .from('videos')
      .update({ status: 'transcribed' })
      .eq('id', video_id)
      .eq('user_id', user.id);

    if (videoUpdateError) {
      console.error('Erreur lors de la mise à jour du statut de la vidéo:', videoUpdateError);
      throw videoUpdateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transcription réussie',
        transcription: transcription.text,
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
