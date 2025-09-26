// transcribe-video: edge function (Deno) - version mise à jour et corrigée (26/09/2025)
// HARDCODE ACTIVÉ POUR TEST - SUPPRIMEZ APRÈS SUCCÈS ET REDEPLIEZ AVEC ENV VARS
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import OpenAI from 'npm:openai@5.23.0';  // v5.23.0 pour fix sk-proj en edge

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

// HARDCODE POUR TEST (REMPLACEZ PAR VOS VRAIES VALEURS - SUPPRIMEZ CETTE SECTION APRÈS)
const supabaseUrl = 'https://nyxtckjfaajhacboxojd.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHRja2pmYWFqaGFjYm94b2pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAzNjk5MiwiZXhwIjoyMDYxNjEyOTkyfQ.lGxR0dmDqOkcH-fO5rBAev19j6KcAAqSa9ZaBICZVHg';
const openaiApiKey = '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';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHRja2pmYWFqaGFjYm94b2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMzY5OTIsImV4cCI6MjA2MTYxMjk5Mn0.9zpLjXat7L6TvfKQB93ef66bnQZgueAreyGZ8fjlPLA';
console.log('DEBUG HARDCODE - Keys loaded from hardcoded values (test only - remove after)');

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

  // DEBUG LOGS (SUPPRIMEZ APRÈS TEST - VÉRIFIEZ DANS SUPABASE LOGS)
  console.log('DEBUG - Keys loaded:', {
    supabaseUrl: !!supabaseUrl,
    serviceKeyLen: serviceKey?.length || 0,
    openaiKeyPrefix: openaiApiKey?.startsWith('sk-proj-') ? 'OK' : 'NO',
    openaiKeyLen: openaiApiKey?.length || 0,
    anonKeyLen: anonKey?.length || 0,
  });

  // Minimal sanity checks
  if (!supabaseUrl || !serviceKey || !openaiApiKey || !anonKey) {
    console.error('Configuration manquante', {
      supabaseUrl: !!supabaseUrl,
      serviceKey: !!serviceKey,
      openaiApiKey: !!openaiApiKey,
      anonKey: !!anonKey,
    });
    return new Response(JSON.stringify({ error: 'Configuration incomplète' }), {
      headers: corsHeaders,
      status: 500,
    });
  }

  // Vérifications format/longueur
  if (serviceKey.length < 40 || anonKey.length < 40) {
    console.error('Clés Supabase invalides (longueur)', { serviceKeyLen: serviceKey.length, anonKeyLen: anonKey.length });
    return new Response(JSON.stringify({ error: 'Configuration Supabase invalide' }), {
      headers: corsHeaders,
      status: 500,
    });
  }

  if (openaiApiKey.length < 50 || !openaiApiKey.startsWith('sk-')) {
    console.error('Clé OpenAI invalide (longueur/format)', { openaiKeyLen: openaiApiKey.length });
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
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null;

  // Clients Supabase (utilisez serviceClient pour bypass RLS, anon pour fallback)
  const baseClientOpts = {
    auth: { persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
      },
    },
  } as const;

  const serviceClient = createClient(supabaseUrl, serviceKey, baseClientOpts);  // Bypass RLS
  const anonClient = createClient(supabaseUrl, anonKey, baseClientOpts);  // Pour ops publiques si besoin
  const userClient = bearer ? createClient(supabaseUrl, bearer, baseClientOpts) : null;

  // Déduire userId du JWT (validation auth)
  let userId: string | null = body.userId || body.user_id || null;
  if (!userId && bearer) {
    try {
      const { data, error } = await serviceClient.auth.getUser(bearer);  // Service pour décoder
      if (!error && data?.user?.id) userId = data.user.id;
    } catch (e) {
      console.error('Erreur décodage token:', (e as any)?.message || e);
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Auth requise', details: 'userId manquant' }), { headers: corsHeaders, status: 401 });
  }

  // Vérif videoId UUID
  if (!videoId || !/^[0-9a-fA-F-]{36}$/.test(String(videoId))) {
    return new Response(JSON.stringify({ error: 'videoId invalide' }), { headers: corsHeaders, status: 400 });
  }

  try {
    // Fetch vidéo avec serviceClient (bypass RLS) + validation manuelle user_id
    const video = await withRetry(async () => {
      const { data, error } = await serviceClient  // Service pour bypass
        .from('videos')
        .select('id, user_id, status, storage_path, file_path, public_url, transcription_attempts')
        .eq('id', videoId)
        .eq('user_id', userId)  // Validation ownership manuelle
        .single();
      if (error || !data || data.user_id !== userId) throw error ?? new Error('Vidéo non trouvée ou accès refusé');
      return data;
    });

    // Normaliser path
    const bucket = 'videos';
    let objectPath = String((video.storage_path || video.file_path || '')).trim();
    if (objectPath.startsWith(`${bucket}/`)) objectPath = objectPath.slice(bucket.length + 1);

    if (video.status === VIDEO_STATUS.TRANSCRIBED) {
      return new Response(JSON.stringify({ success: true, message: 'Déjà transcrite', video_id: videoId }), { headers: corsHeaders, status: 200 });
    }

    // Update statut avec serviceClient (bypass RLS) + eq user_id
    await withRetry(async () => {
      const { error } = await serviceClient  // Service pour bypass
        .from('videos')
        .update({
          status: VIDEO_STATUS.TRANSCRIBING,
          updated_at: new Date().toISOString(),
          transcription_attempts: (video.transcription_attempts || 0) + 1,
        })
        .eq('id', videoId)
        .eq('user_id', userId);  // Validation manuelle
      if (error) throw error;
    });

    // Signed URL avec serviceClient
    let videoUrl = video.public_url || null;
    if (!videoUrl && objectPath) {
      const { data: signData, error: signErr } = await serviceClient.storage.from(bucket).createSignedUrl(objectPath, 3600);
      if (signErr) throw signErr;
      videoUrl = (signData as any)?.signedUrl || (signData as any)?.signedURL || null;
    }
    if (!videoUrl) throw new Error('Aucune URL disponible');

    // Download blob
    const resp = await withRetry(() => fetch(videoUrl));
    if (!resp.ok) throw new Error(`Download: ${resp.status} ${resp.statusText}`);
    const blob = await resp.blob();

    // OpenAI avec project (fix sk-proj) et nouvelle clé
    const openai = new OpenAI({
      apiKey: openaiApiKey,
      project: 'proj_3iwNcqHx5DlEHIKxVAzFO9Pe',  // Votre Projet ID
    });

    // DEBUG TEST AUTH (SUPPRIMEZ APRÈS - VÉRIFIE SANS FICHIER)
    try {
      console.log('DEBUG - Test OpenAI auth...');
      const models = await openai.models.list();
      console.log('DEBUG - OpenAI auth OK, models count:', models.data.length);
    } catch (authErr) {
      console.error('DEBUG - OpenAI auth failed:', (authErr as any)?.message || authErr);
      throw new Error(`Auth OpenAI: ${(authErr as any)?.message}`);
    }

    // Transcription
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

    const confidence = segments.length > 0
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

    // Upsert transcription avec serviceClient + eq user_id
    await withRetry(async () => {
      const { error } = await serviceClient  // Service pour bypass
        .from('transcriptions')
        .upsert({
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
        }, { onConflict: 'video_id' })
        .eq('video_id', videoId)
        .eq('user_id', userId);  // Validation manuelle
      if (error) throw error;
    });

    // Update vidéo finale avec serviceClient + eq user_id
    await withRetry(async () => {
      const { error } = await serviceClient  // Service pour bypass
        .from('videos')
        .update({
          transcription_text: fullText,
          transcription_data: tData,
          status: VIDEO_STATUS.TRANSCRIBED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId)
        .eq('user_id', userId);  // Validation manuelle
      if (error) throw error;
    });

    // Tâches admin async
    try {
      const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-transcription`;
      EdgeRuntime.waitUntil(
        fetch(analyzeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ videoId }),
        }).catch((e) => console.error('Erreur analyse:', (e as any)?.message || e))
      );

      const statsUrl = `${supabaseUrl}/functions/v1/refresh-user-video-stats`;
      EdgeRuntime.waitUntil(
        fetch(statsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ userId }),
        }).catch((e) => console.error('Erreur stats:', (e as any)?.message || e))
      );
    } catch (e) {
      console.error('Erreur scheduling:', (e as any)?.message || e);
    }

    console.log('DEBUG - Transcription réussie, longueur:', fullText.length);
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

    // Update failed avec serviceClient + eq user_id
    try {
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: `Erreur: ${(e?.message || String(e)).slice(0, 1000)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId ?? '')
        .eq('user_id', userId);
    } catch (u) {
      console.error('Erreur update failed:', (u as any)?.message || u);
    }

    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: e?.message || 'Inconnue' }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
