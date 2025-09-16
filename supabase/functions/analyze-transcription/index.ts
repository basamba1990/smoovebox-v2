// analyze-transcription (déjà présent — version ajustée)
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DRAFT: 'draft',
  READY: 'ready'
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function ensureSerializable(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => ensureSerializable(item));
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      result[key] = (typeof value === 'object' && value !== null) ? ensureSerializable(value) : value;
    }
  }
  return result;
}

function calculateAIScore(analysisResult: any): number {
  let score = 7.0;
  if (analysisResult?.summary && String(analysisResult.summary).length > 50) score += 0.5;
  if (Array.isArray(analysisResult?.key_topics) && analysisResult.key_topics.length >= 3) score += 0.5;
  if (Array.isArray(analysisResult?.important_entities) && analysisResult.important_entities.length > 0) score += 0.5;
  if (Array.isArray(analysisResult?.action_items) && analysisResult.action_items.length > 0) score += 0.5;
  if (analysisResult?.insights_supplementaires) score += 0.5;
  return Math.min(score, 10.0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  let videoId: string | null = null;
  let serviceClient: any = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      return new Response(JSON.stringify({ error: 'Configuration incomplète' }), { headers: corsHeaders, status: 500 });
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // accept videoId in body as videoId or video_id, or querystring
    try {
      const body = await req.json().catch(() => ({}));
      videoId = body?.videoId || body?.video_id;
    } catch {
      // fallback to query param
      videoId = new URL(req.url).searchParams.get('videoId') || new URL(req.url).searchParams.get('video_id');
    }

    if (!videoId) return new Response(JSON.stringify({ error: 'videoId requis' }), { headers: corsHeaders, status: 400 });

    const { data: video, error: videoError } = await serviceClient.from('videos')
      .select('id, status, transcription_text, transcription_data')
      .eq('id', videoId).single();
    if (videoError || !video) return new Response(JSON.stringify({ error: 'Vidéo non trouvée' }), { headers: corsHeaders, status: 404 });
    if (video.status !== VIDEO_STATUS.TRANSCRIBED) return new Response(JSON.stringify({ error: 'Vidéo non transcrite' }), { headers: corsHeaders, status: 400 });

    await serviceClient.from('videos').update({ status: VIDEO_STATUS.ANALYZING, updated_at: new Date().toISOString() }).eq('id', videoId);

    let fullText = video.transcription_data?.text || video.transcription_text || '';
    if (!String(fullText).trim()) return new Response(JSON.stringify({ error: 'Texte de transcription vide' }), { headers: corsHeaders, status: 400 });

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const analysisPrompt = `Analysez la transcription suivante et renvoyez un JSON complet: ${String(fullText).substring(0, 12000)}`;

    // Create chat completion - guard for response format
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: "Assistant IA expert en analyse vidéo" }, { role: "user", content: analysisPrompt }],
      response_format: { type: "json_object" },
      max_tokens: 2000
    });

    const rawContent = chatCompletion?.choices?.[0]?.message?.content || '{}';
    let analysisResult: any = {};
    try {
      analysisResult = ensureSerializable(JSON.parse(rawContent));
    } catch (parseErr) {
      console.warn('Impossible de parser la réponse JSON de l\'IA, tentative d\'utiliser la chaîne brute.');
      analysisResult = ensureSerializable({ raw: rawContent });
    }

    const { error: analysisSaveError } = await serviceClient.from('videos').update({
      analysis: analysisResult,
      status: VIDEO_STATUS.ANALYZED,
      updated_at: new Date().toISOString(),
      performance_score: calculateAIScore(analysisResult)
    }).eq('id', videoId);
    if (analysisSaveError) throw analysisSaveError;

    await serviceClient.from('transcriptions').update({ analysis_result: analysisResult, updated_at: new Date().toISOString() }).eq('video_id', videoId);

    return new Response(JSON.stringify({ message: 'Analyse terminée avec succès', videoId, analysisResult }), { headers: corsHeaders, status: 200 });

  } catch (error: any) {
    console.error('Erreur analyze-transcription:', error);
    // mark failed if possible
    try {
      if (videoId && serviceClient) {
        await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: error.message, updated_at: new Date().toISOString() }).eq('id', videoId);
      }
    } catch (e) {
      console.error('Erreur lors du marquage FAILED:', e);
    }
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur', details: error.message || 'Erreur inattendue' }), { headers: corsHeaders, status: 500 });
  }
});
