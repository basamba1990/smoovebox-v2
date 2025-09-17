// ==========================
// Fonction Edge : transcribe-video
// ==========================
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

// Retry avec backoff exponentiel
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
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

// Nettoyage d’objets pour éviter les valeurs non sérialisables
function ensureSerializable(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => ensureSerializable(item));
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      result[key] =
        typeof value === 'object' && value !== null
          ? ensureSerializable(value)
          : value;
    }
  }
  return result;
}

// Handler principal
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  let videoId: string | null = null;
  let userId: string | null = null;
  let serviceClient: any = null;
  let token: string | null = null;

  try {
    console.log('Fonction transcribe-video appelée');

    // 🔑 Vérification des variables d’environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d’environnement manquantes', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey,
      });
      return new Response(
        JSON.stringify({
          error: 'Configuration incomplète',
          details: 'Vérifiez SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, et OPENAI_API_KEY',
        }),
        { headers: corsHeaders, status: 500 }
      );
    }

    // 📦 Client Supabase (180s timeout réseau)
    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input: any, init: any) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 180000);
          return fetch(input, {
            ...init,
            signal: controller.signal,
          }).finally(() => clearTimeout(timeoutId)) as unknown as Promise<Response>;
        },
      },
    });

    // 🔒 Authentification flexible
    const userAgent = req.headers.get('user-agent') || '';
    const isWhatsApp = userAgent.includes('WhatsApp');
    const url = new URL(req.url);

    if (isWhatsApp || req.method === 'GET') {
      userId = url.searchParams.get('userId') || 'whatsapp-user';
      console.log(`Utilisateur WhatsApp/GET détecté: ${userId}`);
    } else {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
        console.log("Token d'authentification trouvé dans l'en-tête Authorization");
      } else if (req.headers.get('apikey')) {
        token = req.headers.get('apikey');
        console.log("Token d'authentification trouvé dans l'en-tête apikey");
      } else {
        const cookieHeader = req.headers.get('Cookie');
        if (cookieHeader) {
          const supabaseCookie = cookieHeader
            .split(';')
            .find(
              (c) =>
                c.trim().startsWith('sb-access-token=') ||
                c.trim().startsWith('supabase-auth-token=')
            );
          if (supabaseCookie) {
            token = supabaseCookie.split('=')[1].trim();
            if (token.startsWith('"') && token.endsWith('"')) {
              token = token.slice(1, -1);
            }
            console.log("Token d'authentification trouvé dans les cookies");
          }
        }
      }

      if (token) {
        const { data, error } = await withRetry(async () => {
          return await serviceClient.auth.getUser(token);
        });
        if (error || !data.user) {
          console.error('Erreur de décodage du JWT:', error);
          return new Response(
            JSON.stringify({ error: "Token d'authentification invalide" }),
            { headers: corsHeaders, status: 401 }
          );
        }
        userId = data.user.id;
        console.log(`Utilisateur authentifié: ${userId}`);
      }

      if (!userId) {
        try {
          const sbParam = url.searchParams.get('sb');
          const supabaseData = sbParam ? JSON.parse(decodeURIComponent(sbParam)) : null;
          if (supabaseData?.auth_user) {
            userId = supabaseData.auth_user;
            console.log(`Utilisateur trouvé dans les métadonnées Supabase: ${userId}`);
          } else if (supabaseData?.jwt?.authorization?.payload) {
            const payload = supabaseData.jwt.authorization.payload;
            userId = payload.sub || (payload as any).subject;
            if (userId) {
              console.log(`Utilisateur trouvé dans le payload JWT: ${userId}`);
            }
          }
        } catch (sbDataError) {
          console.error("Erreur lors de l'extraction des métadonnées Supabase:", sbDataError);
        }

        if (!userId) {
          try {
            const requestData = await req.json();
            userId = requestData.user_id || requestData.userId;
            if (userId) {
              console.log(`Utilisateur trouvé dans les données de la requête: ${userId}`);
            }
          } catch (parseError) {
            console.error("Erreur lors de l'analyse du JSON de la requête:", parseError);
          }
        }
      }

      if (!userId) {
        return new Response(
          JSON.stringify({
            error: 'Authentification requise',
            details:
              "Impossible d'identifier l'utilisateur. Assurez-vous d'être connecté et d'envoyer le token d'authentification.",
          }),
          { headers: corsHeaders, status: 401 }
        );
      }
    }

    // 🎯 Extraction videoId
    try {
      const requestData = await req.json();
      videoId = requestData.videoId || requestData.video_id || url.searchParams.get('videoId');
    } catch {
      videoId = url.searchParams.get('videoId');
    }

    if (
      !videoId ||
      typeof videoId !== 'string' ||
      !videoId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    ) {
      return new Response(
        JSON.stringify({
          error: 'videoId invalide',
          details: 'videoId doit être un UUID valide dans le corps JSON ou les paramètres d’URL',
        }),
        { headers: corsHeaders, status: 400 }
      );
    }
    console.log(`Traitement de la vidéo: ${videoId}`);

    // 🔍 Récupération vidéo
    const video = await withRetry(async () => {
      const { data, error } = await serviceClient
        .from('videos')
        .select('id, storage_path, file_path, user_id, transcription_attempts, public_url, status')
        .eq('id', videoId)
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      if (!data) throw new Error('Vidéo non trouvée ou non autorisée');
      return data;
    });

    // 📌 Vérifier le statut de la vidéo
    if (video.status === VIDEO_STATUS.TRANSCRIBED) {
      console.log(`La vidéo ${videoId} est déjà transcrite`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Vidéo déjà transcrite',
          video_id: videoId,
        }),
        { headers: corsHeaders, status: 200 }
      );
    }

    // 📌 Statut = TRANSCRIBING
    const { error: updateError } = await withRetry(async () => {
      return await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.TRANSCRIBING,
          updated_at: new Date().toISOString(),
          transcription_attempts: (video.transcription_attempts || 0) + 1,
        })
        .eq('id', videoId)
        .eq('user_id', userId);
    });
    if (updateError) throw updateError;

    // 🎬 Génération URL signée
    let bucket = 'videos';
    let filePath = video.storage_path || video.file_path || '';
    if (filePath && filePath.startsWith(`${bucket}/`)) {
      filePath = filePath.substring(bucket.length + 1);
    }
    let videoUrl: string | null = null;
    if (filePath) {
      try {
        const { data: signedUrlData, error: signedUrlError } = await withRetry(async () => {
          return await serviceClient.storage.from(bucket).createSignedUrl(filePath, 3600);
        });
        if (signedUrlError && !video.public_url) throw signedUrlError;
        videoUrl = signedUrlData?.signedUrl || video.public_url || null;
      } catch (signedUrlError) {
        if (video.public_url) {
          videoUrl = video.public_url;
        } else {
          throw signedUrlError;
        }
      }
    } else if (video.public_url) {
      videoUrl = video.public_url;
    }
    if (!videoUrl) throw new Error('Impossible de générer une URL vidéo');

    // 📥 Télécharger vidéo
    const fetchResp = await withRetry(async () => {
      const resp = await fetch(videoUrl!);
      if (!resp.ok) {
        throw new Error(`Échec du téléchargement: ${resp.status} ${resp.statusText}`);
      }
      return resp;
    });
    const videoBlob = await fetchResp.blob();

    // 🗣️ Transcription via Whisper
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const rawTranscription = await withRetry(async () => {
      return await openai.audio.transcriptions.create({
        file: new File(
          [videoBlob],
          `video.${(videoBlob.type || 'video/mp4').split('/')[1] || 'mp4'}`,
          { type: videoBlob.type || 'video/mp4' }
        ),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
      });
    });

    // Extraction infos
    const transcriptionText = String(rawTranscription?.text || '');
    const transcriptionLanguage = String(rawTranscription?.language || 'fr');
    const transcriptionDuration = Number(rawTranscription?.duration || 0);

    const cleanSegments = Array.isArray(rawTranscription?.segments)
      ? rawTranscription.segments.map((segment: any) => ({
          id: String(segment.id ?? ''),
          start: Number(segment.start || 0),
          end: Number(segment.end || 0),
          text: String(segment.text || ''),
          confidence: Number(segment.confidence || 0),
        }))
      : [];

    const confidenceScore = cleanSegments.length
      ? Number(
          (
            cleanSegments.reduce((sum: number, s: any) => sum + (s.confidence || 0), 0) /
            cleanSegments.length
          ).toFixed(4)
        )
      : null;

    const transcriptionData = ensureSerializable({
      text: transcriptionText,
      segments: cleanSegments,
      language: transcriptionLanguage,
      duration: transcriptionDuration,
      confidence_score: confidenceScore,
    });

    // 📝 Upsert dans transcriptions
    const { error: transcriptionTableError } = await withRetry(async () => {
      return await serviceClient
        .from('transcriptions')
        .upsert(
          {
            video_id: videoId,
            user_id: userId,
            full_text: transcriptionText,
            transcription_text: transcriptionText,
            transcription_data: transcriptionData,
            segments: cleanSegments,
            confidence_score: confidenceScore,
            status: VIDEO_STATUS.TRANSCRIBED,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          { onConflict: 'video_id' }
        );
    });
    if (transcriptionTableError) throw transcriptionTableError;

    // 📌 Mise à jour vidéo
    const { error: videoUpdateError } = await withRetry(async () => {
      return await serviceClient
        .from('videos')
        .update({
          transcription_text: transcriptionText,
          transcription_data: transcriptionData,
          status: VIDEO_STATUS.TRANSCRIBED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId)
        .eq('user_id', userId);
    });
    if (videoUpdateError) {
      console.error('Erreur lors de la mise à jour de la vidéo:', videoUpdateError);
      throw new Error(`Échec de la mise à jour de la vidéo: ${videoUpdateError.message}`);
    }

    // 🚀 Trigger analyze-transcription
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      const analyzeResp = await withRetry(async () => {
        const resp = await fetch(analyzeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ videoId }),
        });
        if (!resp.ok) {
          throw new Error(`Erreur HTTP ${resp.status}: ${await resp.text()}`);
        }
        return resp;
      });
      console.log('Analyse démarrée:', await analyzeResp.json());
    } catch (invokeError) {
      console.error('Erreur invoke analyze-transcription:', invokeError);
    }

    // 🚀 Trigger refresh-user-video-stats
    try {
      const statsEndpoint = `${supabaseUrl}/functions/v1/refresh-user-video-stats`;
      const statsResp = await withRetry(async () => {
        const resp = await fetch(statsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ userId }),
        });
        if (!resp.ok) {
          throw new Error(`Erreur HTTP ${resp.status}: ${await resp.text()}`);
        }
        return resp;
      });
      console.log('Stats utilisateur mis à jour:', await statsResp.json());
    } catch (statsError) {
      console.error('Erreur invoke refresh-user-video-stats:', statsError);
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
      console.error('Erreur update FAILED:', updateError);
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
