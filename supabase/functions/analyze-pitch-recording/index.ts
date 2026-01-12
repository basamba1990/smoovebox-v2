import { createClient } from "npm:@supabase/supabase-js@2.45.4"

interface AnalyzePitchRequest {
  audio: string
  duration: number
  personaId: string
  softPromptTask: string
  agentName: string
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

function errorResponse(msg: string, status: number = 400) {
  return new Response(JSON.stringify({ error: msg, success: false }), {
    status: status,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  })
}

function base64ToUint8Array(base64: string): Uint8Array {
  try {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  } catch (err) {
    throw new Error("Invalid base64 audio data")
  }
}

async function transcribeAudio(audioBase64: string): Promise<TranscriptionResult> {
  if (audioBase64.length > 20_000_000) {
    throw new Error("Audio trop volumineux (max 20MB)")
  }
  
  const bytes = base64ToUint8Array(audioBase64)
  const audioBlob = new Blob([bytes], { type: "audio/webm" })

  const formData = new FormData()
  formData.append("file", audioBlob, "audio.webm")
  formData.append("model", "whisper-1")
  formData.append("language", "fr")

  // Timeout configuration
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000) // 45s timeout

  try {
    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: formData,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (!resp.ok) {
      const errorText = await resp.text()
      console.error(`Whisper API error ${resp.status}: ${errorText}`)
      throw new Error(`Transcription failed: ${resp.status} ${resp.statusText}`)
    }
    
    const data = await resp.json()
    return { 
      text: String(data.text ?? "").trim(), 
      confidence: 0.95, 
      language: "fr" 
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === "AbortError") {
      throw new Error("Transcription timeout (45s)")
    }
    throw err
  }
}

async function loadSoftPrompt(taskName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("llm_soft_prompts")
      .select("prompt_text")
      .eq("task_name", taskName)
      .eq("is_active", true)
      .maybeSingle()
    
    if (error || !data) { 
      console.warn(`Soft prompt not found for ${taskName}:`, error?.message || "No data")
      return null 
    }
    
    return data.prompt_text
  } catch (err) {
    console.warn(`Error loading soft prompt:`, err)
    return null
  }
}

async function loadAgentConfig(agentName: string): Promise<{ id: string; configuration: any } | null> {
  try {
    const { data, error } = await supabase
      .from("agent_configurations")
      .select("id, configuration")
      .eq("agent_name", agentName)
      .eq("is_active", true)
      .maybeSingle()
    
    if (error || !data) { 
      console.warn(`Agent config not found for ${agentName}:`, error?.message || "No data")
      return null 
    }
    
    return data
  } catch (err) {
    console.warn(`Error loading agent config:`, err)
    return null
  }
}

function safeJsonExtractObject(text: string): any {
  if (!text || typeof text !== "string") return {}
  
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}
  
  try { 
    return JSON.parse(match[0]) 
  } catch (err) { 
    console.warn("Failed to parse JSON from text:", err)
    return {} 
  }
}

async function analyzePitch(
  transcription: string,
  softPromptText: string | null,
  agentConfig: any,
  personaId: string
): Promise<{ analysis: AnalysisResult; tokensUsed: number }> {
  
  let systemPrompt = agentConfig?.configuration?.system_prompt ??
    "You are Spot, an expert coach analyzing a young talent's pitch. Provide constructive feedback on tone, emotions, and areas for improvement. Respond ONLY in JSON when possible."

  if (personaId === 'young-talent') {
    systemPrompt += `\n\nInstructions de ton: Utiliser un langage simple, être encourageant et éviter tout jugement.`
  }

  if (softPromptText) {
    systemPrompt += `\n\nContexte pédagogique supplémentaire: ${softPromptText}`
  }

  const userMessage = `Analysez ce pitch et fournissez un feedback détaillé:

"${transcription.substring(0, 2000)}"${transcription.length > 2000 ? "..." : ""}

Répondez en JSON avec la structure suivante:
{
  "tone": "description du ton",
  "emotions": ["émotion1", "émotion2"],
  "confidence": 0.85,
  "strengths": ["force1", "force2"],
  "improvements": ["amélioration1", "amélioration2"]
}`

  // Timeout configuration
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${openaiApiKey}` 
      },
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
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (!resp.ok) {
      const errorText = await resp.text()
      console.error(`OpenAI API error ${resp.status}: ${errorText}`)
      throw new Error(`Analysis failed: ${resp.status}`)
    }
    
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content ?? "{}"
    
    let parsed: any
    try { 
      parsed = JSON.parse(content) 
    } catch { 
      parsed = safeJsonExtractObject(content) 
    }

    const analysis: AnalysisResult = {
      tone: String(parsed.tone ?? "Neutre"),
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions.map(String).slice(0, 5) : [],
      confidence: typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.8,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 5) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String).slice(0, 5) : [],
    }
    
    const tokensUsed = Number(data?.usage?.total_tokens ?? 0)
    return { analysis, tokensUsed }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === "AbortError") {
      throw new Error("Analysis timeout (30s)")
    }
    throw err
  }
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

  // Timeout configuration
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${openaiApiKey}` 
      },
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
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (!resp.ok) {
      const errorText = await resp.text()
      console.warn(`OpenAI feedback error ${resp.status}: ${errorText}`)
      
      // Robust fallback
      return {
        message: analysis.strengths.length > 0 
          ? `Bon pitch ! Vos points forts : ${analysis.strengths.slice(0, 2).join(", ")}`
          : "Merci pour votre pitch !",
        suggestions: analysis.improvements.length > 0
          ? analysis.improvements.slice(0, 3)
          : ["Pratiquez devant un miroir", "Enregistrez-vous régulièrement", "Respirez profondément avant de commencer"],
        encouragement: "Continuez à vous entraîner ! Chaque pitch est un pas vers le succès."
      }
    }
    
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content ?? "{}"
    
    let parsed: any
    try { 
      parsed = JSON.parse(content) 
    } catch { 
      parsed = safeJsonExtractObject(content) 
    }
    
    return {
      message: String(parsed.message ?? "Excellent pitch !"),
      suggestions: Array.isArray(parsed.suggestions) 
        ? parsed.suggestions.map(String).slice(0, 5)
        : ["Continuez à pratiquer", "Enregistrez-vous régulièrement"],
      encouragement: String(parsed.encouragement ?? "Continuez comme ça !"),
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === "AbortError") {
      console.warn("Feedback generation timeout")
    }
    
    // Fallback minimal
    return {
      message: "Merci pour votre pitch !",
      suggestions: ["Pratiquez régulièrement", "Soyez vous-même"],
      encouragement: "Vous progressez bien !"
    }
  }
}

async function logExecution(request: AnalyzePitchRequest, result: AnalyzePitchResponse): Promise<void> {
  try {
    const { error } = await supabase
      .from("agent_execution_logs")
      .insert({
        input_data: { 
          duration: request.duration, 
          persona_id: request.personaId, 
          soft_prompt_task: request.softPromptTask,
          agent_name: request.agentName
        },
        output_data: { 
          analysis: result.analysis, 
          feedback: result.feedback,
          transcription: result.transcription.substring(0, 1000)
        },
        performance_feedback: { 
          tokens_used: result.tokens_used, 
          latency_ms: result.latency_ms, 
          confidence: result.analysis.confidence 
        },
        agent_config_id: result.config_id,
      })
    
    if (error) {
      console.warn("Error logging execution:", error.message)
    }
  } catch (err) {
    console.error("Failed to log execution:", err)
  }
}

console.info("analyze-pitch-recording started")
Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204, // ✅ Changé de 200 à 204 pour la conformité CORS
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Max-Age": "86400",
        },
      })
    }
    
    // Validate method
    if (req.method !== "POST") {
      return errorResponse("Method not allowed. Use POST.", 405)
    }
    
    // Validate Content-Type
    const contentType = req.headers.get("content-type")
    if (!contentType?.includes("application/json")) {
      return errorResponse("Content-Type must be application/json", 415)
    }
    
    // Parse and validate body
    let body: AnalyzePitchRequest
    try { 
      body = await req.json() 
    } catch (err) { 
      return errorResponse("Invalid JSON body", 400) 
    }
    
    // Validate required fields
    if (!body?.audio || typeof body.duration !== "number" || !body.personaId || !body.softPromptTask || !body.agentName) {
      return errorResponse("Missing required fields: audio (base64), duration (number), personaId, softPromptTask, agentName", 400)
    }
    
    // Validate audio data
    if (typeof body.audio !== "string" || !body.audio.match(/^[A-Za-z0-9+/]+={0,2}$/)) {
      return errorResponse("Audio must be a valid base64 string", 400)
    }
    
    if (body.audio.length > 20_000_000) {
      return errorResponse("Audio too large (max 20MB)", 413)
    }
    
    if (body.duration <= 0 || body.duration > 300) {
      return errorResponse("Duration must be between 1 and 300 seconds", 400)
    }

    const start = Date.now()
    
    // Process pipeline
    const transcription = await transcribeAudio(body.audio)
    
    const softPromptText = await loadSoftPrompt(body.softPromptTask)
    const agentConfig = await loadAgentConfig(body.agentName)

    if (!agentConfig) {
      return errorResponse(`Agent configuration not found: ${body.agentName}`, 404)
    }

    const { analysis, tokensUsed } = await analyzePitch(
      transcription.text, 
      softPromptText, 
      agentConfig, 
      body.personaId
    )
    
    const feedback = await generateFeedback(analysis, agentConfig)
    const latency = Date.now() - start

    const response: AnalyzePitchResponse = {
      transcription: transcription.text,
      analysis,
      feedback,
      tokens_used: tokensUsed,
      latency_ms: latency,
      config_id: agentConfig.id,
    }

    // Log execution (fire and forget)
    logExecution(body, response).catch(err => 
      console.error("Failed to log execution:", err)
    )

    return new Response(JSON.stringify({
      ...response,
      success: true
    }), { 
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }, 
      status: 200 
    })
  } catch (err) {
    console.error("analyze-pitch-recording error:", err)
    
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error", 
      500
    )
  }
})
