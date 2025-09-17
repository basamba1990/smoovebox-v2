// transcribe-video (corrigé, prêt pour Supabase Edge Functions)
// Fichier : index.ts (ou main.ts) - Deno
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

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
  let attempt = 0;
  let lastError: Error | undefined;
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      lastError = error as Error;
      if (attempt >= maxAttempts) break;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Tentative ${attempt} échouée, nouvelle tentative dans ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError || new Error('Échec après plusieurs tentatives');
}

function ensureSerializable(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => ensureSerializable(item));
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      result[key] = typeof value === 'object' && value !== null ? ensureSerializable(value) : value;
    }
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  let videoId: string | null = null;
  let serviceClient: any = null;

  try {
    console.log('Fonction transcribe-video appelée');

    // Vérifier les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'Configuration incomplète',
          details: 'Vérifiez SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, et OPENAI_API_KEY',
        }),
        { headers: corsHeaders, status: 500 }
      );
    }

    // Initialiser le client Supabase avec timeout réseau étendu (120s)
    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        // wrapper fetch avec timeout pour éviter blocages
        fetch: (input: any, init: any) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s
          return fetch(input, { ...init, signal: controller.signal }).finally(() =>
            clearTimeout(timeoutId)
          ) as unknown as Promise<Response>;
        },
      },
    });

    // Vérifier l'authentification utilisateur (JWT envoyée par le client)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé', details: 'Token JWT requis' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    // getUser avec token (token du client)
    const { data: getUserData, error: userError } = await serviceClient.auth.getUser(token);
    const user = getUserData?.user;
    if (userError || !user) {
      console.error('Erreur de vérification du token:', userError);
      return new Response(
        JSON.stringify({ error: 'Token d\'authentification invalide' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    console.log(`Utilisateur authentifié: ${user.id}`);

    // Extraire videoId du corps JSON (support videoId et video_id)
    let requestData: any = {};
    try {
      requestData = await req.json();
      videoId = requestData.videoId || requestData.video_id;
    } catch {
      return new Response(
        JSON.stringify({ error: 'videoId est requis', details: 'Fournir videoId dans le body JSON' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (!videoId || typeof videoId !== 'string' || !videoId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return new Response(
        JSON.stringify({ error: 'videoId invalide', details: 'videoId doit être un UUID valide' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    console.log(`Traitement de la vidéo: ${videoId}`);

    // IMPORTANT FIX : withRetry renvoie les données directement (pas {data,error})
    // On récupère la row vidéo directement, et on vérifie son existence.
    const video = await withRetry(async () => {
      const { data, error } = await serviceClient
        .from('videos')
        .select('id, storage_path, file_path, user_id, transcription_attempts, public_url')
        .eq('id', videoId)
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      if (!data) throw new Error('Vidéo non trouvée ou non autorisée');
      return data;
    });

    if (!video) {
      return new Response(JSON.stringify({ error: 'Vidéo non trouvée' }), { headers: corsHeaders, status: 404 });
    }

    // Mise à jour du statut à TRANSCRIBING et incrément transcription_attempts
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.TRANSCRIBING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1,
      })
      .eq('id', videoId)
      .eq('user_id', user.id);
    if (updateError) throw new Error(`Échec de la mise à jour du statut: ${updateError.message}`);

    if (!video.storage_path && !video.file_path && !video.public_url) {
      throw new Error('Chemin de stockage manquant pour la vidéo');
    }

    // Extraire bucket et filePath — tolère storage_path ou file_path ou public_url
    let path = video.storage_path || video.file_path || '';
    let bucket = 'videos';
    let filePath = path;
    if (!filePath && video.public_url) {
      // si public_url est present, on peut l'utiliser directement (skip signed url)
      // on laissera fetch(public_url) plus bas
    } else {
      if (path.includes('/')) {
        const parts = path.split('/');
        const possibleBucket = parts[0];
        const { data: buckets } = await serviceClient.storage.listBuckets();
        if (buckets?.some((b: any) => b.name === possibleBucket)) {
          bucket = possibleBucket;
          filePath = parts.slice(1).join('/');
        }
      }
      if (filePath.startsWith(`${bucket}/`)) {
        filePath = filePath.substring(bucket.length + 1);
      }
    }

    // Générer une URL signée si on a filePath / bucket
    let videoUrl: string | null = null;
    if (filePath) {
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600); // 1 heure
      if (signedUrlError) {
        console.warn('signedUrlError, tentative d\'utiliser public_url si disponible', signedUrlError);
        // fallback: try public_url if exists
        if (video.public_url) videoUrl = video.public_url;
        else throw new Error(`Impossible de générer l'URL signée: ${signedUrlError.message}`);
      } else {
        videoUrl = signedUrlData?.signedUrl || null;
      }
    } else if (video.public_url) {
      videoUrl = video.public_url;
    }

    if (!videoUrl) {
      throw new Error('Impossible de déterminer une URL valide pour télécharger la vidéo');
    }

    // Télécharger la vidéo
    const fetchResp = await fetch(videoUrl);
    if (!fetchResp.ok) {
      throw new Error(`Échec du téléchargement: ${fetchResp.status} ${fetchResp.statusText}`);
    }
    const videoBlob = await fetchResp.blob();

    // Transcription OpenAI Whisper
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const rawTranscription = await withRetry(async () => {
      return await openai.audio.transcriptions.create({
        file: new File([videoBlob], `video.${(videoBlob.type || 'video/mp4').split('/')[1] || 'mp4'}`, {
          type: videoBlob.type || 'video/mp4',
        }),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
      });
    });

    // Traiter transcription
    const transcriptionText = String(rawTranscription?.text || '');
    const transcriptionLanguage = String(rawTranscription?.language || 'fr');
    const transcriptionDuration = Number(rawTranscription?.duration || 0);

    const cleanSegments = Array.isArray(rawTranscription?.segments)
      ? rawTranscription.segments.map((segment: any) => ({
          id: segment.id != null ? String(segment.id) : null,
          start: Number(segment.start || 0),
          end: Number(segment.end || 0),
          text: String(segment.text || ''),
          confidence: Number(segment.confidence || 0),
          tokens: Array.isArray(segment.tokens) ? segment.tokens.map(String) : [],
        }))
      : [];

    const confidenceScore = cleanSegments.length
      ? cleanSegments.reduce((sum: number, s: any) => sum + (s.confidence || 0), 0) / cleanSegments.length
      : null;

    const transcriptionData = ensureSerializable({
      text: transcriptionText,
      segments: cleanSegments,
      language: transcriptionLanguage,
      duration: transcriptionDuration,
      confidence_score: confidenceScore,
    });

    // Upsert dans transcriptions
    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert(
        {
          video_id: videoId,
          user_id: user.id,
          full_text: transcriptionText,
          transcription_text: transcriptionText,
          transcription_data: transcriptionData,
          segments: cleanSegments,
          confidence_score: confidenceScore,
          status: 'transcribed',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'video_id' }
      );
    if (transcriptionTableError) {
      throw new Error(`Échec de l'upsert de la transcription: ${transcriptionTableError.message}`);
    }

    // Update videos row
    const { error: videoUpdateError } = await serviceClient
      .from('videos')
      .update({
        transcription_text: transcriptionText,
        transcription_data: transcriptionData,
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId)
      .eq('user_id', user.id);
    if (videoUpdateError) {
      throw new Error(`Échec de la mise à jour de la vidéo: ${videoUpdateError.message}`);
    }

    // Déclencher analyze-transcription (envoi videoId **et** video_id pour compatibilité)
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      const resp = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`, // service role pour autoriser l'action
        },
        body: JSON.stringify({ videoId, video_id: videoId }),
      });
      if (!resp.ok) {
        console.error(`Erreur lors de l'analyse (trigger): ${await resp.text()}`);
      } else {
        console.log('Analyse déclenchée avec succès');
      }
    } catch (invokeError) {
      console.error("Erreur lors de l'invocation de analyze-transcription:", invokeError);
    }

    // Déclencher refresh-user-video-stats (utilise token JWT utilisateur — endpoint vérifie token)
    try {
      const statsEndpoint = `${supabaseUrl}/functions/v1/refresh-user-video-stats`;
      const resp = await fetch(statsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // token utilisateur
        },
      });
      if (!resp.ok) {
        console.warn(`Erreur lors du rafraîchissement des stats (trigger): ${await resp.text()}`);
      } else {
        console.log('Statistiques utilisateur mises à jour (trigger)');
      }
    } catch (statsError) {
      console.error("Erreur lors de l'invocation de refresh-user-video-stats:", statsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transcription terminée avec succès',
        video_id: videoId,
        transcription_length: transcriptionText.length,
        confidence_score: confidenceScore,
      }),
      { headers: corsHeaders, status: 200 }
    );
  } catch (error: any) {
    console.error('Erreur générale dans transcribe-video:', error);
    try {
      // tentative prudente de marquer la vidéo en FAILED si possible
      if (videoId && serviceClient) {
        await serviceClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Erreur de transcription: ${error.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', videoId);
      }
    } catch (updateError) {
      console.error('Erreur lors de la mise à jour du statut FAILED:', updateError);
    }
    return new Response(
      JSON.stringify({
        error: 'Erreur interne du serveur',
        details: error.message || 'Erreur inattendue',
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
