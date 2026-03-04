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
  throw new Error("Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errorResponse(msg: string, status: number = 400) {
  return new Response(JSON.stringify({ error: msg, success: false }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Helper pour parser le JSON de manière sécurisée
function safeJsonParse(text: string, fallback: any = {}): any {
  try {
    // Nettoyage basique pour éviter les erreurs de caractères invisibles ou de formatage
    const cleanText = text.trim().replace(/^```json\s*|\s*```$/g, "");
    return JSON.parse(cleanText);
  } catch (err) {
    console.error("JSON Parse Error:", err.message, "Original text:", text);
    // Tentative d'extraction par regex si le parse direct échoue
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

async function getVideoFromStorage(videoId: string): Promise<{ buffer: ArrayBuffer; duration: number }> {
  const cleanId = videoId.trim();
  const { data: video, error } = await supabase
    .from("videos")
    .select("storage_bucket, storage_path, duration, url")
    .eq("id", cleanId)
    .maybeSingle();

  if (error) throw new Error("DB error: " + error.message);
  if (!video) throw new Error("Vidéo introuvable (ID: " + cleanId + ")");

  const bucket = video.storage_bucket || "videos";
  const path = video.storage_path;

  if (path) {
    const { data: file, error: dlError } = await supabase.storage.from(bucket).download(path);
    if (!dlError && file) {
      return { buffer: await file.arrayBuffer(), duration: video.duration || 120 };
    }
  }

  if (video.url) {
    const resp = await fetch(video.url);
    if (resp.ok) return { buffer: await resp.arrayBuffer(), duration: video.duration || 120 };
  }

  throw new Error("Impossible de récupérer le fichier vidéo");
}

async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<TranscriptionResult> {
  const bytes = new Uint8Array(audioBuffer);
  if (bytes.length > 25_000_000) throw new Error("Fichier trop volumineux (>25MB)");

  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type: "audio/webm" }), "audio.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "fr");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}` },
    body: formData,
  });

  if (!resp.ok) throw new Error(`Whisper error: ${resp.status}`);
  const data = await resp.json();
  return { text: String(data.text ?? "").trim(), confidence: 0.95, language: "fr" };
}

async function analyzePitch(transcription: string, softPrompt: string | null, config: any, personaId: string): Promise<{ analysis: AnalysisResult; tokens: number }> {
  let systemPrompt = config?.configuration?.system_prompt || "Tu es SpotCoach, coach expert. Réponds en JSON.";
  if (personaId === "young-talent") systemPrompt += "\n\nSois encourageant et simple.";
  if (softPrompt) systemPrompt += `\n\nContexte: ${softPrompt}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyse ce pitch : "${transcription.substring(0, 3000)}"` }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!resp.ok) throw new Error("OpenAI Analysis Error");
  const data = await resp.json();
  const content = safeJsonParse(data.choices[0].message.content);

  // Calcul des scores LUMIA
  const analysis: AnalysisResult = {
    tone: content.tone || "Neutre",
    emotions: content.emotions || [],
    confidence: content.confidence || 0.8,
    strengths: content.strengths || [],
    improvements: content.improvements || [],
    FEU: content.FEU ?? (content.strengths?.includes("FEU") ? 90 : 50),
    AIR: content.AIR ?? (content.strengths?.includes("AIR") ? 90 : 50),
    TERRE: content.TERRE ?? (content.strengths?.includes("TERRE") ? 90 : 50),
    EAU: content.EAU ?? (content.strengths?.includes("EAU") ? 90 : 50),
  };

  return { analysis, tokens: data.usage?.total_tokens || 0 };
}

async function generateFeedback(analysis: AnalysisResult): Promise<FeedbackResult> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Génère un feedback constructif en JSON avec les clés: message, suggestions, encouragement." },
        { role: "user", content: JSON.stringify(analysis) }
      ],
      response_format: { type: "json_object" }
    }),
  });

  const data = await resp.json();
  const content = safeJsonParse(data.choices[0].message.content);

  return {
    message: content.message || "",
    suggestions: content.suggestions || [],
    encouragement: content.encouragement || "",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const body: AnalyzePitchRequest = await req.json();
    const start = Date.now();

    // 1. Vidéo & Transcription
    const { buffer } = await getVideoFromStorage(body.videoId);
    const transcription = await transcribeAudio(buffer);

    // 2. Config & Analyse
    const [softPrompt, agentConfig] = await Promise.all([
      supabase.from("llm_soft_prompts").select("prompt_text").eq("task_name", body.softPromptTask).eq("is_active", true).maybeSingle().then(r => r.data?.prompt_text),
      supabase.from("agent_configurations").select("id, configuration").eq("agent_name", body.agentName).eq("is_active", true).maybeSingle().then(r => r.data)
    ]);

    if (!agentConfig) throw new Error("Agent configuration non trouvée");

    const { analysis, tokens } = await analyzePitch(transcription.text, softPrompt, agentConfig, body.personaId);
    const feedback = await generateFeedback(analysis);

    const response: AnalyzePitchResponse = {
      transcription: transcription.text,
      analysis,
      feedback,
      tokens_used: tokens,
      latency_ms: Date.now() - start,
      config_id: agentConfig.id,
    };

    // 3. Update DB & Log
    await Promise.all([
      supabase.from("videos").update({
        status: "analyzed",
        transcription_text: transcription.text,
        analysis: analysis,
        feu_score: analysis.FEU,
        air_score: analysis.AIR,
        terre_score: analysis.TERRE,
        eau_score: analysis.EAU,
        updated_at: new Date().toISOString()
      }).eq("id", body.videoId.trim()),
      supabase.from("agent_execution_logs").insert({
        input_data: body,
        output_data: response,
        status: "success"
      })
    ]);

    return new Response(JSON.stringify({ ...response, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("Error:", err.message);
    return errorResponse(err.message, 500);
  }
});
