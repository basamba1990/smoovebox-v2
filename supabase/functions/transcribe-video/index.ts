// transcribe-video: edge function (Deno) - version mise à jour et corrigée
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import OpenAI from 'npm:openai@5.23.0';

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

async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e as Error;
      if (attempt === maxAttempts - 1) break;
      const delay = baseDelay * 2 ** attempt;
      console.log(`Tentative ${attempt + 1} échouée, nouvelle tentative dans ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
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

  // Minimal sanity checks (présence seulement — pas de dump)
  if (!supabaseUrl || !serviceKey || !openaiApiKey) {
    console.error('Configuration manquante', {
      supabaseUrl: !!supabaseUrl,
      serviceKey: !!serviceKey,
      openaiApiKey: !!openaiApiKey,
    });
    return new Response(JSON.stringify({ error: 'Configuration incomplète' }), {
      headers: corsHeaders,
      status: 500,
    });
  }

  // Vérification simple de longueur et format
  if (serviceKey.length < 40) {
    console.error('Clé de service invalide (trop courte)');
    return new Response(JSON.stringify({ error: 'Configuration Supabase invalide' }), {
      headers: corsHeaders,
      status: 500,
    });
  }

  if (openaiApiKey.length < 50 || !openaiApiKey.startsWith('sk-')) {
    console.error('Clé OpenAI invalide (longueur ou format)', { openaiApiKeyLength: openaiApiKey.length });
    return new Response(JSON.stringify({ error: 'Configuration OpenAI invalide' }), {
      headers: corsHeaders,
      status: 500,
    });
  }

  const url = new URL(req.url);
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const videoId = body.videoId || url.searchParams.get('videoId');
  const bearer =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    null;

  // Clients Supabase
  const baseClientOpts = {
    auth: { persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        return fetch(input, { ...init, signal: controller.signal }).finally(() =>
          clearTimeout(timeoutId)
        );
      },
    },
  } as const;

  const serviceClient = createClient(supabaseUrl, serviceKey, baseClientOpts);
  const userClient = bearer ? createClient(supabaseUrl, bearer, baseClientOpts) : null;

  // Déduire userId depuis body ou via token (userClient auth)
  let userId: string | null = body.userId || body.user_id || null;
  if (!userId && bearer) {
    try {
      // getUser avec token (serviceClient.auth.getUser(bearer) est OK ici)
      const { data, error } = await serviceClient.auth.getUser(bearer);
      if (!error && data?.user?.id) userId = data.user.id;
    } catch (e) {
      console.error('Erreur décodage token utilisateur:', (e as any)?.message || e);
    }
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Authentification requise', details: 'userId manquant' }),
      { headers: corsHeaders, status: 401 }
    );
  }

  // Vérification minimale videoId (UUID)
  if (!videoId || !/^[0-9a-fA-F-]{36}$/.test(String(videoId))) {
    return new Response(JSON.stringify({ error: 'videoId invalide' }), {
      headers: corsHeaders,
      status: 400,
    });
  }

  try {
    // Lecture : utiliser userClient si présent (pour RLS), sinon serviceClient
    const dbClientRead = userClient ?? serviceClient;
    const video = await withRetry(async () => {
      const { data, error } = await dbClientRead
        .from('videos')
        .select('id, user_id, status, storage_path, file_path, public_url, transcription_attempts')
        .eq('id', videoId)
        .eq('user_id', userId)
        .single();
      if (error || !data) throw error ?? new Error('Vidéo non trouvée');
      return data;
    });

    // Normaliser objectPath
    const bucket = 'videos';
    let objectPath = String((video.storage_path || video.file_path || '')).trim();
    if (objectPath.startsWith(`${bucket}/`)) objectPath = objectPath.slice(bucket.length + 1);

    if (video.status === VIDEO_STATUS.TRANSCRIBED) {
      return new Response(
        JSON.stringify({ success: true, message: 'Déjà transcrite', video_id: videoId }),
        { headers: corsHeaders, status: 200 }
      );
    }

    // Mise à jour statut : utiliser userClient pour respecter RLS
    const dbClientWrite = userClient ?? serviceClient;
    await withRetry(async () => {
      const { error } = await dbClientWrite
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

    // Obtenir URL via serviceClient (signed URL) si pas de public_url
    let videoUrl = video.public_url || null;
    if (!videoUrl && objectPath) {
      const { data: signData, error: signErr } = await serviceClient.storage
        .from(bucket)
        .createSignedUrl(objectPath, 3600);
      if (signErr) throw signErr;
      // new SDK returns { data: { signedUrl } } ou { signedUrl }
      videoUrl = (signData as any)?.signedUrl || (signData as any)?.signedURL || null;
    }
    if (!videoUrl) throw new Error('Aucune URL de lecture disponible');

    const resp = await withRetry(() => fetch(videoUrl));
    if (!resp.ok) throw new Error(`Téléchargement vidéo: ${resp.status} ${resp.statusText}`);
    const blob = await resp.blob();

    // Transcription OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const transcription = await withRetry(() =>
      openai.audio.transcriptions.create({
        file: new File([blob], 'video.webm', { type: blob.type || 'video/webm' }),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
      })
    );

    const segments = Array.isArray((transcription as any)?.segments)
      ? (transcription as any).segments.map((s: any) => ({
          id: String(s.id ?? ''),
          start: Number(s.start || 0),
          end: Number(s.end || 0),
          text: String(s.text || ''),
          confidence: Number(s.confidence || 0),
        }))
      : [];

    const confidence =
      segments.length > 0
        ? Number((segments.reduce((a, s) => a + (s.confidence || 0), 0) / segments.length).toFixed(4))
        : null;

    const fullText = String((transcription as any)?.text || '');
    const tData = ensureSerializable({
      text: fullText,
      segments,
      language: String((transcription as any)?.language || 'fr'),
      duration: Number((transcription as any)?.duration || 0),
      confidence_score: confidence,
    });

    // Upsert transcription (RLS) — userClient preferred
    await withRetry(async () => {
      const { error } = await dbClientWrite.from('transcriptions').upsert(
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

    // Mise à jour finale de la vidéo (RLS)
    await withRetry(async () => {
      const { error } = await dbClientWrite
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

    // Tâches admin asynchrones (serviceKey) : lancement des Edge Functions internes
    try {
      const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-transcription`;
      // EdgeRuntime.waitUntil is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(
        fetch(analyzeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ videoId }),
        }).catch((e) => console.error('Erreur appel analyse:', (e as any)?.message || e))
      );

      const statsUrl = `${supabaseUrl}/functions/v1/refresh-user-video-stats`;
      EdgeRuntime.waitUntil(
        fetch(statsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ userId }),
        }).catch((e) => console.error('Erreur appel stats:', (e as any)?.message || e))
      );
    } catch (e) {
      console.error('Erreur scheduling tasks admin:', (e as any)?.message || e);
    }

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
  } catch (e: any) {
    console.error('Erreur transcribe-video:', (e?.message || e));

    // Essayons d'écrire statut FAILED avec serviceClient (admin) pour garantir update même si RLS bloque
    try {
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: `Erreur de transcription: ${(e?.message || String(e)).slice(0, 1000)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId ?? '')
        .eq('user_id', userId);
    } catch (u) {
      console.error('Erreur MAJ statut échec:', (u as any)?.message || u);
    }

    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur', details: e?.message || 'Inconnue' }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
