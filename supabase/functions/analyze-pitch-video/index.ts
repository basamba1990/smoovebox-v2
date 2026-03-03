import { createClient } from "npm:@supabase/supabase-js@2.45.4";

interface AnalyzePitchRequest {
  videoId: string;
  personaId: string;
  softPromptTask: string;
  agentName: string;
}

interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
}

interface AnalysisResult {
  tone: string;
  emotions: string[];
  confidence: number;
  strengths: string[];
  improvements: string[];
}

interface LumiaScores {
  feu_score: number;
  air_score: number;
  terre_score: number;
  eau_score: number;
}

interface FeedbackResult {
  message: string;
  suggestions: string[];
  encouragement: string;
}

interface AnalyzePitchResponse {
  transcription: string;
  analysis: AnalysisResult;
  feedback: FeedbackResult;
  lumia_scores: LumiaScores;
  tokens_used: number;
  latency_ms: number;
  config_id: string | null;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

/* ===============================
   🔥 CALCUL DES SCORES LUMIA
=================================*/

function calculateLumiaScores(analysis: AnalysisResult): LumiaScores {

  let feu = 50;
  let air = 50;
  let terre = 50;
  let eau = 50;

  // FEU = Leadership / Ton affirmé
  if (analysis.tone.toLowerCase().includes("inspirant")) feu += 15;
  if (analysis.confidence > 0.85) feu += 10;
  feu += analysis.strengths.length * 2;

  // AIR = Communication / Clarté
  if (analysis.tone.toLowerCase().includes("clair")) air += 10;
  air += analysis.emotions.length * 3;

  // TERRE = Structure / Stabilité
  if (analysis.improvements.length < 3) terre += 15;
  terre += Math.max(0, 10 - analysis.improvements.length * 2);

  // EAU = Impact émotionnel
  if (analysis.emotions.includes("empathie")) eau += 15;
  eau += analysis.emotions.length * 4;

  // Clamp 0-100
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  return {
    feu_score: clamp(feu),
    air_score: clamp(air),
    terre_score: clamp(terre),
    eau_score: clamp(eau),
  };
}

/* ===============================
   🔄 MISE À JOUR PROFIL LUMIA
=================================*/

async function updateUserLumiaProfile(
  videoId: string,
  scores: LumiaScores
) {
  // récupérer user_id depuis video
  const { data: video } = await supabase
    .from("videos")
    .select("user_id")
    .eq("id", videoId)
    .single();

  if (!video?.user_id) return;

  // récupérer profil actuel
  const { data: profile } = await supabase
    .from("user_lumia_profiles")
    .select("lumia")
    .eq("user_id", video.user_id)
    .maybeSingle();

  const current = profile?.lumia || {};

  const merged = {
    feu_score: Math.round((current.feu_score ?? 50 + scores.feu_score) / 2),
    air_score: Math.round((current.air_score ?? 50 + scores.air_score) / 2),
    terre_score: Math.round((current.terre_score ?? 50 + scores.terre_score) / 2),
    eau_score: Math.round((current.eau_score ?? 50 + scores.eau_score) / 2),
    territoire: current.territoire ?? "Casablanca"
  };

  await supabase
    .from("user_lumia_profiles")
    .upsert({
      user_id: video.user_id,
      lumia: merged
    });
}

/* ===============================
   🚀 EDGE FUNCTION
=================================*/

Deno.serve(async (req: Request) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {

    const body: AnalyzePitchRequest = await req.json();
    const start = Date.now();

    /* 1️⃣ Récupération vidéo */
    const { data: video } = await supabase
      .from("videos")
      .select("storage_bucket, storage_path")
      .eq("id", body.videoId)
      .single();

    const { data: file } = await supabase.storage
      .from(video.storage_bucket || "videos")
      .download(video.storage_path);

    const buffer = await file!.arrayBuffer();

    /* 2️⃣ Transcription */
    const audioBlob = new Blob([buffer], { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");

    const transcriptionResp = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiApiKey}` },
        body: formData,
      }
    );

    const transcriptionData = await transcriptionResp.json();
    const transcriptionText = transcriptionData.text || "";

    /* 3️⃣ Analyse GPT */
    const analysisResp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Analyse ce pitch et réponds en JSON.",
            },
            {
              role: "user",
              content: transcriptionText.substring(0, 3000),
            },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    const analysisData = await analysisResp.json();
    const analysis: AnalysisResult = JSON.parse(
      analysisData.choices[0].message.content
    );

    /* 4️⃣ Calcul Scores LUMIA */
    const lumiaScores = calculateLumiaScores(analysis);

    /* 5️⃣ Mise à jour profil énergétique */
    await updateUserLumiaProfile(body.videoId, lumiaScores);

    /* 6️⃣ Feedback */
    const feedback: FeedbackResult = {
      message: "Analyse complétée avec succès.",
      suggestions: analysis.improvements || [],
      encouragement: "Continue à développer ton potentiel 🔥",
    };

    /* 7️⃣ Update vidéo */
    await supabase
      .from("videos")
      .update({
        status: "analyzed",
        transcription_text: transcriptionText,
        analysis,
        lumia_scores: lumiaScores
      })
      .eq("id", body.videoId);

    const response: AnalyzePitchResponse = {
      transcription: transcriptionText,
      analysis,
      feedback,
      lumia_scores: lumiaScores,
      tokens_used: analysisData.usage?.total_tokens || 0,
      latency_ms: Date.now() - start,
      config_id: null,
    };

    return new Response(JSON.stringify({ ...response, success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500 }
    );
  }
});
