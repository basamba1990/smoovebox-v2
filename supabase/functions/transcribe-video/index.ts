import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import OpenAI from 'npm:openai@4.58.1';

const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBING: 'transcribing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  FAILED: 'failed',
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

async function withRetry<T>(operation: () => Promise<T>, maxAttempts = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e as Error;
      if (attempt === maxAttempts - 1) break;
      await new Promise(resolve => setTimeout(resolve, baseDelay * 2 ** attempt));
      console.log(`Tentative ${attempt + 1} échouée, nouvelle tentative dans ${baseDelay * 2 ** attempt}ms`);
    }
  }
  throw lastError ?? new Error('Échec après plusieurs tentatives');
}

function ensureSerializable(obj: any): any {
  if (obj == null || typeof obj !== 'object') return obj ?? null;
  if (Array.isArray(obj)) return obj.map(ensureSerializable);
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) out[k] = ensureSerializable(obj[k]);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders, status: 204 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !serviceKey || !openaiApiKey) {
    return new Response(JSON.stringify({ error: 'Configuration incomplète' }), { headers: corsHeaders, status: 500 });
  }

  const url = new URL(req.url);
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const videoId = body.videoId || url.searchParams.get('videoId');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;

  // Décoder l’utilisateur depuis le token client si présent; sinon, accepter userId explicite
  let userId = body.userId || body.user_id || null;
  const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (!userId && bearer) {
    const { data, error } = await serviceClient.auth.getUser(bearer);
    if (!error && data?.user?.id) userId = data.user.id;
  }
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentification requise', details: 'userId manquant' }), { headers: corsHeaders, status: 401 });
  }

  if (!videoId || !/^[0-9a-f-]{36}$/i.test(videoId)) {
    return new Response(JSON.stringify({ error: 'videoId invalide' }), { headers: corsHeaders, status: 400 });
  }

  try {
    // Charger vidéo (chemins normalisés)
    const video = await withRetry(async () => {
      const { data, error } = await serviceClient
        .from('videos')
        .select('id, user_id, status, storage_path, file_path, public_url, transcription_attempts')
        .eq('id', videoId)
        .eq('user_id', userId)
        .single();
      if (error || !data) throw error ?? new Error('Vidéo non trouvée');
      return data;
    });

    // Normaliser objectPath: jamais préfixé par le nom du bucket
    const bucket = 'videos';
    let objectPath = (video.storage_path || video.file_path || '').trim();
    if (objectPath.startsWith(`${bucket}/`)) objectPath = objectPath.slice(bucket.length + 1);

    if (video.status === VIDEO_STATUS.TRANSCRIBED) {
      return new Response(JSON.stringify({ success: true, message: 'Déjà transcrite', video_id: videoId }), { headers: corsHeaders, status: 200 });
    }

    await withRetry(async () => {
      const { error } = await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.TRANSCRIBING,
          updated_at: new Date().toISOString(),
          transcription_attempts: (video.transcription_attempts || 0) + 1,
        })
        .eq('id', videoId)
        .eq('user_id', userId);
      if (error) throw error;
    });

    // Obtenir URL lecture
    let videoUrl = video.public_url || null;
    if (!videoUrl && objectPath) {
      const { data, error } = await serviceClient.storage.from(bucket).createSignedUrl(objectPath, 3600);
      if (error) throw error;
      videoUrl = data?.signedUrl || null;
    }
    if (!videoUrl) throw new Error('Aucune URL de lecture disponible');

    const resp = await withRetry(() => fetch(videoUrl!));
    if (!resp.ok) throw new Error(`Téléchargement vidéo: ${resp.status} ${resp.statusText}`);
    const blob = await resp.blob();

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const transcription = await withRetry(() =>
      openai.audio.transcriptions.create({
        file: new File([blob], 'video.webm', { type: blob.type || 'video/webm' }),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
      })
    );

    const segments = Array.isArray(transcription?.segments)
      ? transcription.segments.map((s) => ({
          id: String(s.id ?? ''),
          start: Number(s.start || 0),
          end: Number(s.end || 0),
          text: String(s.text || ''),
          confidence: Number(s.confidence || 0),
        }))
      : [];
    const confidence = segments.length
      ? Number((segments.reduce((a, s) => a + (s.confidence || 0), 0) / segments.length).toFixed(4))
      : null;

    const fullText = String(transcription?.text || '');
    const tData = ensureSerializable({
      text: fullText,
      segments,
      language: String(transcription?.language || 'fr'),
      duration: Number(transcription?.duration || 0),
      confidence_score: confidence,
    });

    await withRetry(async () => {
      const { error } = await serviceClient
        .from('transcriptions')
        .upsert(
          {
            video_id: videoId,
            user_id: userId,
            full_text: fullText,
            transcription_text: fullText,
            transcription_data: tData,
            segments,
            confidence_score: confidence,
            status: VIDEO_STATUS.TRANSCRIBED,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          { onConflict: 'video_id' }
        );
      if (error) throw error;
    });

    await withRetry(async () => {
      const { error } = await serviceClient
        .from('videos')
        .update({
          transcription_text: fullText,
          transcription_data: tData,
          status: VIDEO_STATUS.TRANSCRIBED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId)
        .eq('user_id', userId);
      if (error) throw error;
    });

    // Appels en arrière-plan
    const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-transcription`;
    EdgeRuntime.waitUntil(
      fetch(analyzeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ videoId }),
      }).catch(() => {})
    );

    const statsUrl = `${supabaseUrl}/functions/v1/refresh-user-video-stats`;
    EdgeRuntime.waitUntil(
      fetch(statsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ userId }),
      }).catch(() => {})
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transcription terminée',
        video_id: videoId,
        transcription_length: fullText.length,
        confidence_score: confidence,
      }),
      { headers: corsHeaders, status: 200 }
    );
  } catch (e) {
    console.error('Erreur transcribe-video:', e);
    try {
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: `Erreur de transcription: ${e?.message || String(e)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId ?? '')
        .eq('user_id', userId);
    } catch {}
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur', details: e?.message || 'Inconnue' }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
