import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import OpenAI from 'npm:openai@4.104.0';

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
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Vérification robuste de la configuration
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

  // Logs sécurisés pour débogage
  console.log('Configuration vérifiée', {
    supabaseUrl: supabaseUrl ? `✓ (${supabaseUrl.substring(0, 30)}...)` : '✗',
    serviceKey: serviceKey ? `✓ (${serviceKey.length} chars)` : '✗',
    openaiApiKey: openaiApiKey ? `✓ (présente)` : '✗',
  });

  if (!supabaseUrl || !serviceKey || !openaiApiKey) {
    return new Response(
      JSON.stringify({ 
        error: 'Configuration incomplète', 
        details: 'Vérifiez SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et OPENAI_API_KEY' 
      }),
      { headers: corsHeaders, status: 500 }
    );
  }

  // Validation de la clé OpenAI (doit commencer par "sk-")
  if (!openaiApiKey.startsWith('sk-')) {
    console.error('Clé OpenAI invalide - doit commencer par "sk-"', {
      startsWith: openaiApiKey.substring(0, Math.min(10, openaiApiKey.length)) + '...',
      length: openaiApiKey.length
    });
    return new Response(
      JSON.stringify({ error: 'Clé OpenAI invalide' }),
      { headers: corsHeaders, status: 500 }
    );
  }

  const url = new URL(req.url);
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body optionnel
  }

  const videoId = body.videoId || url.searchParams.get('videoId');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;

  // Configuration des clients
  const baseClientOpts = {
    auth: { persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        return fetch(input, { ...init, signal: controller.signal })
          .finally(() => clearTimeout(timeoutId));
      },
    },
  } as const;

  const serviceClient = createClient(supabaseUrl, serviceKey, baseClientOpts);
  const userClient = bearer ? createClient(supabaseUrl, bearer, baseClientOpts) : null;

  // Extraction du userId
  let userId: string | null = body.userId || body.user_id || null;
  if (!userId && bearer) {
    try {
      const { data, error } = await serviceClient.auth.getUser(bearer);
      if (!error && data?.user?.id) {
        userId = data.user.id;
        console.log('UserId extrait du token:', userId.substring(0, 8) + '...');
      } else {
        console.warn('Token utilisateur invalide:', error?.message);
      }
    } catch (e) {
      console.error('Erreur décodage token:', e);
    }
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ 
        error: 'Authentification requise', 
        details: 'Token manquant ou invalide' 
      }),
      { headers: corsHeaders, status: 401 }
    );
  }

  if (!videoId || !/^[0-9a-f-]{36}$/i.test(videoId)) {
    return new Response(
      JSON.stringify({ error: 'videoId invalide' }),
      { headers: corsHeaders, status: 400 }
    );
  }

  try {
    // Lecture de la vidéo - utiliser userClient pour RLS
    const dbClientRead = userClient ?? serviceClient;
    const video = await withRetry(async () => {
      const { data, error } = await dbClientRead
        .from('videos')
        .select('id, user_id, status, storage_path, file_path, public_url, transcription_attempts')
        .eq('id', videoId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        console.error('Vidéo non trouvée:', error);
        throw error ?? new Error('Vidéo non trouvée ou accès non autorisé');
      }
      return data;
    });

    console.log('Vidéo chargée:', { 
      id: video.id, 
      status: video.status,
      user_match: video.user_id === userId
    });

    if (video.status === VIDEO_STATUS.TRANSCRIBED) {
      return new Response(
        JSON.stringify({ success: true, message: 'Déjà transcrite', video_id: videoId }),
        { headers: corsHeaders, status: 200 }
      );
    }

    // Mise à jour du statut - TOUJOURS utiliser userClient pour éviter auth.uid() null
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

    // Préparation URL vidéo
    const bucket = 'videos';
    let objectPath = (video.storage_path || video.file_path || '').trim();
    if (objectPath.startsWith(`${bucket}/`)) {
      objectPath = objectPath.slice(bucket.length + 1);
    }

    let videoUrl = video.public_url || null;
    if (!videoUrl && objectPath) {
      try {
        const { data, error } = await serviceClient.storage
          .from(bucket)
          .createSignedUrl(objectPath, 3600);
        if (error) throw error;
        videoUrl = data?.signedUrl || null;
      } catch (e) {
        console.error('Erreur URL signée:', e);
        throw new Error('Accès fichier refusé');
      }
    }

    if (!videoUrl) throw new Error('URL vidéo indisponible');

    // Téléchargement et transcription
    console.log('Téléchargement vidéo...');
    const resp = await withRetry(() => fetch(videoUrl!));
    if (!resp.ok) throw new Error(`Échec téléchargement: ${resp.status}`);
    
    const blob = await resp.blob();
    console.log('Taille vidéo:', blob.size, 'Type:', blob.type);

    // Test de la clé OpenAI avec une requête simple
    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      // Test rapide de la clé
      await openai.models.list().then(models => models.data.slice(0, 1));
      console.log('Test clé OpenAI réussi');
    } catch (e) {
      console.error('Test clé OpenAI échoué:', e);
      throw new Error('Clé OpenAI invalide ou inactive');
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    console.log('Début transcription Whisper...');
    
    const transcription = await withRetry(() =>
      openai.audio.transcriptions.create({
        file: new File([blob], 'video.webm', { type: blob.type || 'video/webm' }),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
      })
    );

    console.log('Transcription réussie:', {
      duration: (transcription as any)?.duration,
      language: (transcription as any)?.language,
    });

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

    // Sauvegarde avec userClient pour RLS
    await withRetry(async () => {
      const { error } = await dbClientWrite
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
          },
          { onConflict: 'video_id' }
        );
      if (error) throw error;
    });

    // Mise à jour finale avec userClient
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

    console.log('Transcription sauvegardée:', {
      video_id: videoId,
      text_length: fullText.length,
      confidence: confidence,
    });

    // Tâches background (serviceKey OK car pas de RLS)
    const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-transcription`;
    EdgeRuntime.waitUntil(
      fetch(analyzeUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${serviceKey}` 
        },
        body: JSON.stringify({ videoId }),
      }).catch((e) => console.error('Erreur analyse:', e))
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

  } catch (e: any) {
    console.error('Erreur transcribe-video:', e?.message || e);
    
    // Mise à jour d'erreur - UTILISER userClient POUR ÉVITER auth.uid() NULL
    try {
      const clientForErrorUpdate = userClient ?? serviceClient;
      await clientForErrorUpdate
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur: ${e?.message || String(e)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId)
        .eq('user_id', userId); // Critère essentiel pour RLS
    } catch (updateError) {
      console.error('Échec mise à jour statut erreur:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur de transcription', 
        details: e?.message || 'Inconnue' 
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
