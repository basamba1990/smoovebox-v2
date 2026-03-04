import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// --- Interfaces ---
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

// --- Configuration & Clients ---
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

// --- Helper Functions ---

function errorResponse(msg: string, status: number = 400) {
  console.error(`[Error Response] ${status}: ${msg}`);
  return new Response(JSON.stringify({ error: msg, success: false }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Nettoie et parse le JSON de manière ultra-robuste.
 * Gère les blocs de code Markdown, les textes parasites et les erreurs de formatage.
 */
function robustJsonParse(text: string, fallback: any = {}): any {
  if (!text) return fallback;
  
  let cleanText = text.trim();
  
  // 1. Supprimer les blocs de code Markdown ```json ... ```
  cleanText = cleanText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.warn("[JSON Parse] Premier essai échoué, tentative d'extraction par regex...");
    
    // 2. Tenter d'extraire le premier objet JSON valide { ... }
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error("[JSON Parse] Échec de l'extraction regex:", e2.message);
      }
    }
    
    // 3. Si tout échoue, on retourne le fallback
    console.error("[JSON Parse] Échec total du parsing. Texte reçu:", text.substring(0, 100));
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

  if (error) throw new Error(`DB Error: ${error.message}`);
  if (!video) throw new Error(`Vidéo introuvable (ID: ${cleanId})`);

  const bucket = video.storage_bucket || "videos";
  const path = video.storage_path;

  // Tentative 1: Storage
  if (path) {
    console.log(`[Storage] Téléchargement: bucket=${bucket}, path=${path}`);
    const { data: file, error: dlError } = await supabase.storage.from(bucket).download(path);
    if (!dlError && file) {
      return { buffer: await file.arrayBuffer(), duration: video.duration || 120 };
    }
    console.warn(`[Storage] Échec: ${dlError?.message}`);
  }

  // Tentative 2: URL publique
  if (video.url) {
    console.log(`[URL] Téléchargement via URL: ${video.url}`);
    const resp = await fetch(video.url);
    if (resp.ok) return { buffer: await resp.arrayBuffer(), duration: video.duration || 120 };
  }

  throw new Error("Impossible de récupérer le contenu de la vidéo (Storage et URL ont échoué)");
}

async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<TranscriptionResult> {
  const bytes = new Uint8Array(audioBuffer);
  if (bytes.length > 25_000_000) throw new Error("Fichier audio trop volumineux pour Whisper (>25MB)");

  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type: "audio/webm" }), "audio.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "fr");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Whisper Error (${resp.status}): ${errText}`);
  }
  
  const data = await resp.json();
  return { text: String(data.text ?? "").trim(), confidence: 0.95, language: "fr" };
}

async function analyzePitch(transcription: string, softPrompt: string | null, config: any, personaId: string): Promise<{ analysis: AnalysisResult; tokens: number }> {
  let systemPrompt = config?.configuration?.system_prompt || "Tu es SpotCoach, coach expert. Réponds exclusivement en JSON.";
  if (personaId === "young-talent") systemPrompt += "\n\nInstructions: Sois encourageant, utilise un langage simple et direct.";
  if (softPrompt) systemPrompt += `\n\nContexte pédagogique: ${softPrompt}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyse ce pitch et retourne un JSON structuré : "${transcription.substring(0, 3000)}"` }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI Analysis Error (${resp.status})`);
  const data = await resp.json();
  const content = robustJsonParse(data.choices[0].message.content);

  // Normalisation et calcul des scores LUMIA
  const analysis: AnalysisResult = {
    tone: content.tone || "Neutre",
    emotions: Array.isArray(content.emotions) ? content.emotions : [],
    confidence: typeof content.confidence === "number" ? content.confidence : 0.8,
    strengths: Array.isArray(content.strengths) ? content.strengths : [],
    improvements: Array.isArray(content.improvements) ? content.improvements : [],
    FEU: typeof content.FEU === "number" ? content.FEU : (content.strengths?.includes("FEU") ? 90 : 50),
    AIR: typeof content.AIR === "number" ? content.AIR : (content.strengths?.includes("AIR") ? 90 : 50),
    TERRE: typeof content.TERRE === "number" ? content.TERRE : (content.strengths?.includes("TERRE") ? 90 : 50),
    EAU: typeof content.EAU === "number" ? content.EAU : (content.strengths?.includes("EAU") ? 90 : 50),
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
        { role: "system", content: "Tu es SpotCoach. Génère un feedback constructif basé sur l'analyse fournie. Réponds en JSON avec les clés: message, suggestions, encouragement." },
        { role: "user", content: JSON.stringify(analysis) }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!resp.ok) throw new Error("OpenAI Feedback Error");
  const data = await resp.json();
  const content = robustJsonParse(data.choices[0].message.content);

  return {
    message: content.message || "Super pitch !",
    suggestions: Array.isArray(content.suggestions) ? content.suggestions : [],
    encouragement: content.encouragement || "Continue comme ça !",
  };
}

// --- Main Handler ---

Deno.serve(async (req: Request) => {
  // Gestion du CORS (Preflight)
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const body: AnalyzePitchRequest = await req.json();
    if (!body.videoId) return errorResponse("videoId manquant", 400);

    const start = Date.now();

    // 1. Récupération & Transcription
    const { buffer } = await getVideoFromStorage(body.videoId);
    const transcription = await transcribeAudio(buffer);

    // 2. Chargement des configurations en parallèle
    const [softPromptResult, agentConfigResult] = await Promise.all([
      supabase.from("llm_soft_prompts").select("prompt_text").eq("task_name", body.softPromptTask).eq("is_active", true).maybeSingle(),
      supabase.from("agent_configurations").select("id, configuration").eq("agent_name", body.agentName).eq("is_active", true).maybeSingle()
    ]);

    const softPrompt = softPromptResult.data?.prompt_text || null;
    const agentConfig = agentConfigResult.data;

    if (!agentConfig) throw new Error(`Configuration de l'agent '${body.agentName}' introuvable`);

    // 3. Analyse & Feedback
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

    // 4. Mise à jour de la base de données & Logs
    // On met à jour la vidéo et on log l'exécution
    const updatePromise = supabase.from("videos").update({
      status: "analyzed",
      transcription_text: transcription.text,
      analysis: analysis,
      feu_score: analysis.FEU,
      air_score: analysis.AIR,
      terre_score: analysis.TERRE,
      eau_score: analysis.EAU,
      updated_at: new Date().toISOString()
    }).eq("id", body.videoId.trim());

    const logPromise = supabase.from("agent_execution_logs").insert({
      input_data: body,
      output_data: response,
      status: "success"
    });

    await Promise.all([updatePromise, logPromise]);

    return new Response(JSON.stringify({ ...response, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error(`[Fatal Error] ${err.message}`);
    return errorResponse(err.message, 500);
  }
});
