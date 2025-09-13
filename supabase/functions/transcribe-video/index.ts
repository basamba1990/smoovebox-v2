import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBING: 'transcribing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  FAILED: 'failed'
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

async function withRetry<T>(operation: () => Promise<T>, maxAttempts = 3, baseDelay = 1000): Promise<T> {
  let attempt = 0;
  let lastError: Error;
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      lastError = error as Error;
      if (attempt >= maxAttempts) break;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Tentative ${attempt} échouée, nouvelle tentative dans ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function ensureSerializable(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => ensureSerializable(item));
  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      result[key] = (typeof value === 'object' && value !== null) ? ensureSerializable(value) : value;
    }
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let videoId: string | null = null;
  let serviceClient: any = null;

  try {
    console.log('Fonction transcribe-video appelée');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète', details: "Variables d'environnement manquantes" }),
        { headers: corsHeaders, status: 500 }
      );
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
        }
      }
    });

    // Auth utilisateur (facultatif)
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const { data } = await serviceClient.auth.getUser(token);
        if (data?.user) userId = data.user.id;
      } catch (authError) {
        console.error("Erreur d'authentification:", authError);
      }
    }

    const url = new URL(req.url);
    videoId = url.searchParams.get('videoId');
    if (!videoId) {
      try { const requestData = await req.json(); videoId = requestData.videoId; } catch {}
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis', details: 'Fournir videoId dans l\'URL ou le body' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    console.log(`Traitement de la vidéo: ${videoId}`);

    const video = await withRetry(async () => {
      const { data, error } = await serviceClient.from('videos').select('*').eq('id', videoId).single();
      if (error) throw error;
      if (!data) throw new Error('Vidéo non trouvée');
      return data;
    });

    // Mise à jour statut TRANSCRIBING
    const { error: updateError } = await serviceClient.from('videos').update({
      status: VIDEO_STATUS.TRANSCRIBING,
      updated_at: new Date().toISOString(),
      transcription_attempts: (video.transcription_attempts || 0) + 1
    }).eq('id', videoId);
    if (updateError) throw updateError;

    if (!video.storage_path) throw new Error('Chemin de stockage manquant pour la vidéo');

    let bucket = 'videos';
    let filePath = video.storage_path;
    if (filePath.includes('/')) {
      const parts = filePath.split('/');
      if (parts.length > 1) {
        const possibleBucket = parts[0];
        const { data: buckets } = await serviceClient.storage.listBuckets();
        if ((buckets || []).some((b: any) => b.name === possibleBucket)) {
          bucket = possibleBucket;
          filePath = parts.slice(1).join('/');
        }
      }
    }
    if (filePath.startsWith(`${bucket}/`)) filePath = filePath.substring(bucket.length + 1);

    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage.from(bucket).createSignedUrl(filePath, 60 * 60);
    if (signedUrlError) throw new Error(`Impossible de générer l'URL signée: ${signedUrlError.message}`);
    const videoUrl = signedUrlData.signedUrl;

    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Échec téléchargement: ${response.status} ${response.statusText}`);
    const videoBlob = await response.blob();

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const rawTranscription = await withRetry(async () => {
      return await openai.audio.transcriptions.create({
        file: new File([videoBlob], `video.${videoBlob.type.split('/')[1] || 'mp4'}`, { type: videoBlob.type }),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json'
      });
    });

    const transcriptionText = String(rawTranscription.text || '');
    const transcriptionLanguage = String(rawTranscription.language || 'fr');
    const transcriptionDuration = Number(rawTranscription.duration || 0);

    const cleanSegments = Array.isArray(rawTranscription.segments)
      ? rawTranscription.segments.map((segment: any) => ({
          id: segment.id ? String(segment.id) : null,
          start: Number(segment.start || 0),
          end: Number(segment.end || 0),
          text: String(segment.text || ''),
          confidence: Number(segment.confidence || 0),
          tokens: Array.isArray(segment.tokens) ? segment.tokens.map(String) : []
        }))
      : [];

    const confidenceScore = cleanSegments.length
      ? cleanSegments.reduce((sum, s) => sum + (s.confidence || 0), 0) / cleanSegments.length
      : null;

    const transcriptionData = ensureSerializable({
      text: transcriptionText,
      segments: cleanSegments,
      language: transcriptionLanguage,
      duration: transcriptionDuration,
      confidence_score: confidenceScore
    });

    // Upsert transcription
    const { error: transcriptionTableError } = await serviceClient.from('transcriptions').upsert({
      video_id: videoId,
      user_id: userId,
      full_text: transcriptionText,
      transcription_text: transcriptionText,
      transcription_data: transcriptionData,
      segments: cleanSegments,
      confidence_score: confidenceScore,
      status: 'transcribed',
      updated_at: new Date().toISOString()
    }, { onConflict: 'video_id' });
    if (transcriptionTableError) throw transcriptionTableError;

    // Update video
    const { error: videoUpdateError } = await serviceClient.from('videos').update({
      transcription_text: transcriptionText,
      transcription_data: transcriptionData,
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString()
    }).eq('id', videoId);
    if (videoUpdateError) throw videoUpdateError;

    // Trigger analyze-transcription
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ videoId })
      });
      if (!response.ok) console.error(`Erreur analyse: ${await response.text()}`);
    } catch (invokeError) {
      console.error("Erreur lors de l'invocation de la fonction d'analyse:", invokeError);
    }

    return new Response(
      JSON.stringify({
        message: 'Transcription terminée avec succès',
        videoId,
        transcription_length: transcriptionText.length,
        confidence_score: confidenceScore
      }),
      { headers: corsHeaders, status: 200 }
    );

  } catch (error: any) {
    console.error('Erreur générale dans transcribe-video:', error);
    try {
      if (videoId && serviceClient) {
        await serviceClient.from('videos').update({
          status: VIDEO_STATUS.FAILED,
          error_message: `Erreur: ${error.message}`,
          updated_at: new Date().toISOString()
        }).eq('id', videoId);
      }
    } catch {}
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur', details: error.message || 'Erreur inattendue' }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
