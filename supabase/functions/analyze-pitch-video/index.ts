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
  FEU?: number;
  AIR?: number;
  TERRE?: number;
  EAU?: number;
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
  tokens_used: number;
  latency_ms: number;
  config_id: string | null;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
  throw new Error(
    "Variables d'environnement manquantes: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function errorResponse(msg: string, status: number = 400) {
  return new Response(JSON.stringify({ error: msg, success: false }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

async function getVideoFromStorage(
  videoId: string,
): Promise<{ buffer: ArrayBuffer; duration: number }> {

  if (!videoId) {
    throw new Error("videoId manquant");
  }

  const cleanVideoId = videoId.trim();

  const { data: video, error } = await supabase
    .from("videos")
    .select("storage_bucket, storage_path, duration")
    .eq("id", cleanVideoId)
    .maybeSingle();

  if (error) {
    throw new Error("Erreur base de données: " + error.message);
  }

  if (!video) {
    throw new Error("Vidéo introuvable dans la base de données");
  }

  const bucket = video.storage_bucket || "videos";
  const path = video.storage_path;

  if (!path) {
    throw new Error("storage_path manquant pour cette vidéo");
  }

  console.log(`Téléchargement depuis bucket: ${bucket}, path: ${path}`);

  const { data: file, error: dlError } = await supabase.storage
    .from(bucket)
    .download(path);

  if (dlError || !file) {
    throw new Error("Erreur téléchargement Storage: " + dlError?.message);
  }

  const buffer = await file.arrayBuffer();
  const duration = video.duration || 120;

  return { buffer, duration };
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function transcribeAudio(audioBase64: string): Promise<TranscriptionResult> {
  if (audioBase64.length > 25_000_000) {
    throw new Error("Audio trop volumineux pour Whisper (max 25MB)");
  }

  const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const audioBlob = new Blob([bytes], { type: "audio/webm" });

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "fr");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Transcription failed: ${resp.status} ${errorText}`);
    }

    const data = await resp.json();
    return {
      text: String(data.text ?? "").trim(),
      confidence: 0.95,
      language: "fr"
    };

  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as any).name === "AbortError") {
      throw new Error("Transcription timeout (60s)");
    }
    throw err;
  }
}

async function loadSoftPrompt(taskName: string): Promise<string | null> {
  const { data } = await supabase
    .from("llm_soft_prompts")
    .select("prompt_text")
    .eq("task_name", taskName)
    .eq("is_active", true)
    .maybeSingle();

  return data?.prompt_text || null;
}

async function loadAgentConfig(
  agentName: string,
): Promise<{ id: string; configuration: any } | null> {

  const { data } = await supabase
    .from("agent_configurations")
    .select("id, configuration")
    .eq("agent_name", agentName)
    .eq("is_active", true)
    .maybeSingle();

  return data || null;
}

async function analyzePitch(
  transcription: string,
  softPromptText: string | null,
  agentConfig: any,
  personaId: string,
): Promise<{ analysis: AnalysisResult; tokensUsed: number }> {

  let systemPrompt =
    agentConfig?.configuration?.system_prompt ??
    "Tu es SpotCoach, coach expert analysant un pitch. Réponds en JSON.";

  if (personaId === "young-talent") {
    systemPrompt += "\n\nSois encourageant et utilise un langage simple.";
  }

  if (softPromptText) {
    systemPrompt += `\n\nContexte: ${softPromptText}`;
  }

  const userMessage = `Analyse ce pitch : "${transcription.substring(0, 3000)}"`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    throw new Error("Erreur OpenAI Analysis");
  }

  const data = await resp.json();
  const content = JSON.parse(data.choices[0].message.content);

  // Générer scores LUMIA dynamiques basés sur forces/améliorations
  const elementsScores: AnalysisResult = {
    ...content,
    FEU: Math.min(100, Math.max(0, content.strengths?.includes("FEU") ? 90 : 50)),
    AIR: Math.min(100, Math.max(0, content.strengths?.includes("AIR") ? 90 : 50)),
    TERRE: Math.min(100, Math.max(0, content.strengths?.includes("TERRE") ? 90 : 50)),
    EAU: Math.min(100, Math.max(0, content.strengths?.includes("EAU") ? 90 : 50)),
  };

  return {
    analysis: elementsScores,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

async function generateFeedback(
  analysis: AnalysisResult
): Promise<FeedbackResult> {

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Génère un feedback constructif en JSON." },
        { role: "user", content: JSON.stringify(analysis) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const data = await resp.json();
  const content = JSON.parse(data.choices[0].message.content);

  return {
    message: content.message || "",
    suggestions: content.suggestions || [],
    encouragement: content.encouragement || "",
  };
}

async function logExecution(
  request: AnalyzePitchRequest,
  result: AnalyzePitchResponse
): Promise<void> {

  await supabase.from("agent_execution_logs").insert({
    input_data: request,
    output_data: result,
    status: "success"
  });
}

// ------------------- Serve Edge Function -------------------
Deno.serve(async (req: Request) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {

    const body: AnalyzePitchRequest = await req.json();
    const start = Date.now();

    // 1. Récupérer la vidéo
    const { buffer } = await getVideoFromStorage(body.videoId);

    // 2. Transcrire audio
    const audioBase64 = bufferToBase64(buffer);
    const transcription = await transcribeAudio(audioBase64);

    // 3. Charger soft prompt et config agent
    const softPromptText = await loadSoftPrompt(body.softPromptTask);
    const agentConfig = await loadAgentConfig(body.agentName);

    if (!agentConfig) {
      throw new Error(`Config non trouvée: ${body.agentName}`);
    }

    // 4. Analyse GPT
    const { analysis, tokensUsed } = await analyzePitch(
      transcription.text,
      softPromptText,
      agentConfig,
      body.personaId
    );

    // 5. Générer feedback
    const feedback = await generateFeedback(analysis);

    const response: AnalyzePitchResponse = {
      transcription: transcription.text,
      analysis,
      feedback,
      tokens_used: tokensUsed,
      latency_ms: Date.now() - start,
      config_id: agentConfig.id,
    };

    // 6. Log execution
    await logExecution(body, response);

    // 7. Mettre à jour vidéo et scores LUMIA dynamiques
    await supabase
      .from("videos")
      .update({
        status: "analyzed",
        transcription_text: transcription.text,
        analysis: analysis,
        feu_score: analysis.FEU,
        air_score: analysis.AIR,
        terre_score: analysis.TERRE,
        eau_score: analysis.EAU,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.videoId.trim());

    return new Response(JSON.stringify({ ...response, success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("analyze-pitch-video error:", err);
    return errorResponse((err as Error).message, 500);
  }
});
