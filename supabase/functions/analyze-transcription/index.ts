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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function ensureSerializable(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => ensureSerializable(item));
  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) result[key] = (typeof obj[key] === 'object' && obj[key] !== null) ? ensureSerializable(obj[key]) : obj[key];
  }
  return result;
}

function calculateAIScore(analysisResult: any): number {
  let score = 7.0;
  if (analysisResult.summary?.length > 50) score += 0.5;
  if (analysisResult.key_topics?.length >= 3) score += 0.5;
  if (analysisResult.important_entities?.length > 0) score += 0.5;
  if (analysisResult.action_items?.length > 0) score += 0.5;
  if (analysisResult.insights_supplementaires) score += 0.5;
  return Math.min(score, 10.0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

    try { videoId = (await req.json()).videoId; } catch { videoId = new URL(req.url).searchParams.get('videoId'); }
    if (!videoId) return new Response(JSON.stringify({ error: 'videoId requis' }), { headers: corsHeaders, status: 400 });

    const { data: video, error: videoError } = await serviceClient.from('videos')
      .select('id, status, transcription_text, transcription_data')
      .eq('id', videoId).single();
    if (videoError || !video) return new Response(JSON.stringify({ error: 'Vidéo non trouvée' }), { headers: corsHeaders, status: 404 });
    if (video.status !== VIDEO_STATUS.TRANSCRIBED) return new Response(JSON.stringify({ error: 'Vidéo non transcrite' }), { headers: corsHeaders, status: 400 });

    await serviceClient.from('videos').update({ status: VIDEO_STATUS.ANALYZING, updated_at: new Date().toISOString() }).eq('id', videoId);

    let fullText = video.transcription_data?.text || video.transcription_text || '';
    if (!fullText.trim()) return new Response(JSON.stringify({ error: 'Texte de transcription vide' }), { headers: corsHeaders, status: 400 });

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const analysisPrompt = `Analysez la transcription suivante et renvoyez un JSON complet ... Transcription: ${fullText.substring(0, 12000)}`;

    let chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: "Assistant IA expert en analyse vidéo" }, { role: "user", content: analysisPrompt }],
      response_format: { type: "json_object" },
      max_tokens: 2000
    });

    let analysisResult = ensureSerializable(JSON.parse(chatCompletion.choices[0].message.content || '{}'));

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
    if (videoId && serviceClient) {
      await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: error.message, updated_at: new Date().toISOString() }).eq('id', videoId);
    }
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur', details: error.message || 'Erreur inattendue' }), { headers: corsHeaders, status: 500 });
  }
});
