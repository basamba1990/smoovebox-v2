import { createClient } from "npm:@supabase/supabase-js@2.45.4"

interface AnalyzePitchRequest {
  audio: string
  duration: number
  personaId?: string | null
}

interface TranscriptionResult {
  text: string
  confidence: number
  language: string
}

interface AnalysisResult {
  tone: string
  emotions: string[]
  confidence: number
  strengths: string[]
  improvements: string[]
}

interface FeedbackResult {
  message: string
  suggestions: string[]
  encouragement: string
}

interface AnalyzePitchResponse {
  transcription: string
  analysis: AnalysisResult
  feedback: FeedbackResult
  tokens_used: number
  latency_ms: number
  config_id: string | null
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
  throw new Error("Variables d'environnement manquantes: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  })
}

async function transcribeAudio(audioBase64: string): Promise<TranscriptionResult> {
  if (audioBase64.length > 20_000_000) throw new Error("Audio trop volumineux")
  const binaryString = atob(audioBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
  const audioBlob = new Blob([bytes], { type: "audio/webm" })

  const formData = new FormData()
  formData.append("file", audioBlob, "audio.webm")
  formData.append("model", "whisper-1")
  formData.append("language", "fr")

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}` },
    body: formData,
  })
  if (!resp.ok) throw new Error(`Whisper API error: ${resp.status} ${resp.statusText} ${await resp.text().catch(()=>"")}`)
  const data = await resp.json()
  return { text: String(data.text ?? "").trim(), confidence: 0.95, language: "fr" }
}

async function loadSoftPrompt(): Promise<string | null> {
  const { data, error } = await supabase
    .from("llm_soft_prompts")
    .select("embeddings")
    .eq("task_name", "pitch_analysis")
    .eq("is_active", true)
    .maybeSingle()
  if (error) { console.warn("Soft prompt non trouvé:", error.message); return null }
  return data?.embeddings ? JSON.stringify(data.embeddings) : null
}

async function loadAgentConfig(): Promise<{ id: string; configuration: any } | null> {
  const { data, error } = await supabase
    .from("agent_configurations")
    .select("id, configuration")
    .eq("agent_name", "pitch_analysis_agent")
    .eq("is_active", true)
    .maybeSingle()
  if (error) { console.warn("Configuration agent non trouvée:", error.message); return null }
  return data ?? null
}

function safeJsonExtractObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try { return JSON.parse(match[0]) } catch { return {} }
}

async function analyzePitch(
  transcription: string,
  softPrompt: string | null,
  agentConfig: any
): Promise<{ analysis: AnalysisResult; tokensUsed: number }> {
  const systemPrompt =
    agentConfig?.configuration?.system_prompt ??
    "You are Spot, an expert coach analyzing a young talent's pitch. Provide constructive feedback on tone, emotions, and areas for improvement. Respond ONLY in JSON when possible."

  const userMessage = `Analysez ce pitch et fournissez un feedback détaillé:

"${transcription}"

Répondez en JSON avec la structure suivante:
{
  "tone": "description du ton",
  "emotions": ["émotion1", "émotion2"],
  "confidence": 0.85,
  "strengths": ["force1", "force2"],
  "improvements": ["amélioration1", "amélioration2"]
}
${softPrompt ? `Contexte soft prompt (embeddings sérialisés): ${softPrompt.slice(0, 500)}...` : ""}`

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: agentConfig?.configuration?.hyperparameters?.temperature ?? 0.7,
      max_tokens: agentConfig?.configuration?.hyperparameters?.max_tokens ?? 512,
      response_format: { type: "json_object" },
    }),
  })
  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status} ${resp.statusText} ${await resp.text().catch(()=>"")}`)
  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content ?? "{}"
  let parsed: any
  try { parsed = JSON.parse(content) } catch { parsed = safeJsonExtractObject(content) }

  const analysis: AnalysisResult = {
    tone: parsed.tone ?? "Neutre",
    emotions: Array.isArray(parsed.emotions) ? parsed.emotions : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
  }
  const tokensUsed = Number(data?.usage?.total_tokens ?? 0)
  return { analysis, tokensUsed }
}

async function generateFeedback(analysis: AnalysisResult, agentConfig: any): Promise<FeedbackResult> {
  const systemPrompt = agentConfig?.configuration?.system_prompt ?? "You are Spot, a supportive and encouraging coach."
  const userMessage = `Basé sur cette analyse de pitch:
- Ton: ${analysis.tone}
- Émotions: ${analysis.emotions.join(", ")}
- Forces: ${analysis.strengths.join(", ")}
- Améliorations: ${analysis.improvements.join(", ")}

Générez un feedback encourageant et constructif en JSON:
{
  "message": "message principal",
  "suggestions": ["suggestion1", "suggestion2"],
  "encouragement": "phrase d'encouragement"
}`

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  })
  if (!resp.ok) {
    console.warn("OpenAI feedback error:", await resp.text().catch(()=>""))
    return { message: "Merci pour votre pitch!", suggestions: ["Continuez à pratiquer", "Enregistrez-vous régulièrement"], encouragement: "Vous progressez bien!" }
  }
  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content ?? "{}"
  let parsed: any
  try { parsed = JSON.parse(content) } catch { parsed = safeJsonExtractObject(content) }
  return {
    message: String(parsed.message ?? "Excellent pitch!"),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    encouragement: String(parsed.encouragement ?? "Continuez comme ça!"),
  }
}

async function logExecution(request: AnalyzePitchRequest, result: AnalyzePitchResponse): Promise<void> {
  const { error } = await supabase
    .from("agent_execution_logs")
    .insert({
      input_data: { duration: request.duration, persona_id: request.personaId ?? null },
      output_data: { analysis: result.analysis, feedback: result.feedback },
      performance_feedback: { tokens_used: result.tokens_used, latency_ms: result.latency_ms, confidence: result.analysis.confidence },
      agent_config_id: result.config_id,
    })
  if (error) console.warn("Erreur lors du logging:", error.message)
}

console.info("analyze-pitch-recording started")
Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

    let body: AnalyzePitchRequest
    try { body = await req.json() } catch { return badRequest("Body JSON invalide") }

    if (!body?.audio || typeof body.duration !== "number") return badRequest("Champs requis: audio (base64), duration (nombre)")

    const start = Date.now()
    const transcription = await transcribeAudio(body.audio)
    const softPrompt = await loadSoftPrompt()
    const agentConfig = await loadAgentConfig()
    const { analysis, tokensUsed } = await analyzePitch(transcription.text, softPrompt, agentConfig)
    const feedback = await generateFeedback(analysis, agentConfig)
    const latency = Date.now() - start

    const response: AnalyzePitchResponse = {
      transcription: transcription.text,
      analysis,
      feedback,
      tokens_used: tokensUsed,
      latency_ms: latency,
      config_id: agentConfig?.id ?? null,
    }

    EdgeRuntime.waitUntil(logExecution(body, response))

    return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json", "Connection": "keep-alive" }, status: 200 })
  } catch (e) {
    console.error("Erreur analyze-pitch-recording:", e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }), { headers: { "Content-Type": "application/json" }, status: 500 })
  }
})
