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
    status: status,
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
  const { data: video, error } = await supabase
    .from("videos")
    .select("storage_bucket, storage_path, duration, url")
    .eq("id", videoId)
    .maybeSingle();

  if (error) {
    console.error("DB error fetching video:", error.message);
  }

  if (!video) {
    throw new Error("Vidéo introuvable dans la base de données");
  }

  // CORRECTION: Si storage_bucket est nul, on utilise le bucket par défaut 'videos'
  const bucket = video.storage_bucket || "videos";
  const path = video.storage_path;

  if (path) {
    console.log(`Tentative de téléchargement depuis le bucket: ${bucket}, chemin: ${path}`);
    const { data: file, error: dlError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (!dlError && file) {
      const buffer = await file.arrayBuffer();
      const duration = video.duration || 120;
      return { buffer, duration };
    }
    
    console.warn(`Échec du téléchargement depuis Storage (${dlError?.message}), tentative via URL...`);
  }

  // Fallback via l'URL si le storage échoue ou si path est manquant
  if (video.url) {
    const resp = await fetch(video.url);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      const duration = video.duration || 120;
      return { buffer, duration };
    }
  }

  throw new Error(`Vidéo introuvable (ID: ${videoId}). Vérifiez que storage_path ou url est renseigné.`);
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
      console.error(`Whisper API error ${resp.status}: ${errorText}`);
      throw new Error(`Transcription failed: ${resp.status}`);
    }

    const data = await resp.json();
    return { text: String(data.text ?? "").trim(), confidence: 0.95, language: "fr" };
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as any).name === "AbortError") throw new Error("Transcription timeout (60s)");
    throw err;
  }
}

async function loadSoftPrompt(taskName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("llm_soft_prompts")
      .select("prompt_text")
      .eq("task_name", taskName)
      .eq("is_active", true)
      .maybeSingle();
    return data?.prompt_text || null;
  } catch {
    return null;
  }
}

async function loadAgentConfig(
  agentName: string,
): Promise<{ id: string; configuration: any } | null> {
  try {
    const { data, error } = await supabase
      .from("agent_configurations")
      .select("id, configuration")
      .eq("agent_name", agentName)
      .eq("is_active", true)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

async function analyzePitch(
  transcription: string,
  softPromptText: string | null,
  agentConfig: any,
  personaId: string,
): Promise<{ analysis: AnalysisResult; tokensUsed: number }> {
  let systemPrompt = agentConfig?.configuration?.system_prompt ??
    "Tu es SpotCoach, un expert coach analysant le pitch d'un jeune talent. Réponds en JSON.";

  if (personaId === "young-talent") {
    systemPrompt += `\n\nInstructions: Sois encourageant, utilise un langage simple.`;
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

  if (!resp.ok) throw new Error("Erreur OpenAI Analysis");

  const data = await resp.json();
  const content = JSON.parse(data.choices[0].message.content);

  return {
    analysis: {
      tone: content.tone || "Neutre",
      emotions: content.emotions || [],
      confidence: content.confidence || 0.8,
      strengths: content.strengths || [],
      improvements: content.improvements || [],
    },
    tokensUsed: data.usage.total_tokens,
  };
}

async function generateFeedback(analysis: AnalysisResult, agentConfig: any): Promise<FeedbackResult> {
  const systemPrompt = "Tu es SpotCoach. Génère un feedback constructif en JSON.";
  const userMessage = `Analyse: ${JSON.stringify(analysis)}`;

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

  const data = await resp.json();
  const content = JSON.parse(data.choices[0].message.content);

  return {
    message: content.message || "",
    suggestions: content.suggestions || [],
    encouragement: content.encouragement || "",
  };
}

async function logExecution(request: AnalyzePitchRequest, result: AnalyzePitchResponse): Promise<void> {
  try {
    await supabase.from("agent_execution_logs").insert({
      input_data: request,
      output_data: result,
      status: "success"
    });
  } catch (e) {
    console.error("Log error:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body: AnalyzePitchRequest = await req.json();
    const start = Date.now();

    // 1. Récupération Vidéo
    const { buffer } = await getVideoFromStorage(body.videoId);

    // 2. Transcription
    const audioBase64 = bufferToBase64(buffer);
    const transcription = await transcribeAudio(audioBase64);

    // 3. Configuration & Prompts
    const softPromptText = await loadSoftPrompt(body.softPromptTask);
    const agentConfig = await loadAgentConfig(body.agentName);

    if (!agentConfig) throw new Error(`Config non trouvée: ${body.agentName}`);

    // 4. Analyse & Feedback
    const { analysis, tokensUsed } = await analyzePitch(transcription.text, softPromptText, agentConfig, body.personaId);
    const feedback = await generateFeedback(analysis, agentConfig);

    const response: AnalyzePitchResponse = {
      transcription: transcription.text,
      analysis,
      feedback,
      tokens_used: tokensUsed,
      latency_ms: Date.now() - start,
      config_id: agentConfig.id,
    };

    // Logging & Update
    await logExecution(body, response);
    await supabase.from("videos").update({ status: "analyzed", transcription_text: transcription.text, analysis: analysis }).eq("id", body.videoId);

    return new Response(JSON.stringify({ ...response, success: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    });

  } catch (err) {
    console.error("analyze-pitch-video error:", err);
    return errorResponse(err.message, 500);
  }
});
