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
  return new Response(JSON.stringify({ error: msg }), {
    status: status,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
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

async function loadSoftPrompt(taskName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("llm_soft_prompts")
    .select("prompt_text")
    .eq("task_name", taskName)
    .eq("is_active", true)
    .maybeSingle()
  if (error) { 
    console.warn(`Soft prompt non trouvé pour ${taskName}:`, error.message); 
    return null 
  }
  return data?.prompt_text ?? null 
}

async function loadAgentConfig(agentName: string): Promise<{ id: string; configuration: any } | null> {
  const { data, error } = await supabase
    .from("agent_configurations")
    .select("id, configuration")
    .eq("agent_name", agentName)
    .eq("is_active", true)
    .maybeSingle()
  if (error) { 
    console.warn(`Configuration agent non trouvée pour ${agentName}:`, error.message); 
    return null 
  }
  return data ?? null
}

function safeJsonExtractObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try { return JSON.parse(match[0]) } catch { return {} }
}

async function analyzePitch(
  transcription: string,
  softPromptText: string | null,
  agentConfig: any,
  personaId: string
): Promise<{ analysis: AnalysisResult; tokensUsed: number }> {
  
  let systemPrompt =
    agentConfig?.configuration?.system_prompt ??
    "You are Spot, an expert coach analyzing a young talent's pitch. Provide constructive feedback on tone, emotions, and areas for improvement. Respond ONLY in JSON when possible."

  if (personaId === 'young-talent') {
      systemPrompt += `\n\nInstructions de ton: Utiliser un langage simple, être encourageant et éviter tout jugement.`
  }

  if (softPromptText) {
      systemPrompt += `\n\nContexte pédagogique supplémentaire: ${softPromptText}`
  }

  const userMessage = `Analysez ce pitch et fournissez un feedback détaillé:

"${transcription}"

Répondez en JSON avec la structure suivante:
{
  "tone": "description du ton",
  "emotions": ["émotion1", "émotion2"],
  "confidence": 0.85,
  "strengths": ["force1", "force2"],
  "improvements": ["amélioration1", "amélioration2"]
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
    return { 
      message: "Merci pour votre pitch!", 
      suggestions: ["Continuez à pratiquer", "Enregistrez-vous régulièrement"], 
      encouragement: "Vous progressez bien!" 
    }
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
      input_data: { 
        duration: request.duration, 
        persona_id: request.personaId, 
        soft_prompt_task: request.softPromptTask 
      },
      output_data: { 
        analysis: result.analysis, 
        feedback: result.feedback 
      },
      performance_feedback: { 
        tokens_used: result.tokens_used, 
        latency_ms: result.latency_ms, 
        confidence: result.analysis.confidence 
      },
      agent_config_id: result.config_id,
    })
  if (error) console.warn("Erreur lors du logging:", error.message)
}

console.info("analyze-pitch-recording started")
Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      })
    }
    
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405)
    }

    let body: AnalyzePitchRequest
    try { 
      body = await req.json() 
    } catch { 
      return errorResponse("Body JSON invalide", 400) 
    }

    if (!body?.audio || typeof body.duration !== "number" || !body.personaId || !body.softPromptTask || !body.agentName) {
      return errorResponse("Champs requis manquants: audio (base64), duration (nombre), personaId, softPromptTask, agentName", 400)
    }

    const start = Date.now()
    
    const transcription = await transcribeAudio(body.audio)
    
    const softPromptText = await loadSoftPrompt(body.softPromptTask)
    const agentConfig = await loadAgentConfig(body.agentName)

    if (!agentConfig) {
      return errorResponse(`Configuration d'agent non trouvée pour: ${body.agentName}`, 404)
    }

    const { analysis, tokensUsed } = await analyzePitch(transcription.text, softPromptText, agentConfig, body.personaId)
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

    EdgeRuntime.waitUntil(logExecution(body, response))

    return new Response(JSON.stringify(response), { 
      headers: { 
        "Content-Type": "application/json", 
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }, 
      status: 200 
    })
  } catch (e) {
    console.error("Erreur analyze-pitch-recording:", e)
    return errorResponse(e instanceof Error ? e.message : "Internal server error", 500)
  }
})
