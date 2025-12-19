import { createClient } from "npm:@supabase/supabase-js"

// =========================
// Types
// =========================
interface GenerateRecommendationsRequest {
  selectedPassions: string[]
  softPromptId?: string | null
  configId?: string | null
}

interface CareerRecommendation {
  name: string
  description: string
  passions: string[]
  skills: string[]
  futureOutlook: string
  salaryRange: string
}

interface GenerateRecommendationsResponse {
  careers: CareerRecommendation[]
  tokens_used: number
  latency_ms: number
  relevance_score: number
}

// =========================
// Env & Clients
// =========================
const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// =========================
// Helpers
// =========================
function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }
}

function jsonResponse(body: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  })
}

function badRequest(msg: string, origin?: string) {
  return jsonResponse({ error: msg }, 400, origin)
}

function getPassionNames(passionIds: string[]): string[] {
  const passionMap: Record<string, string> = {
    dance: "Danse",
    music: "Musique",
    "video-editing": "Création Vidéo",
    photography: "Photographie",
    "graphic-design": "Design Graphique",
    writing: "Écriture",
    biology: "Biologie",
    chemistry: "Chimie",
    physics: "Physique",
    programming: "Programmation",
    "ai-ml": "IA & Machine Learning",
    robotics: "Robotique",
    marketing: "Marketing",
    sales: "Vente",
    finance: "Finance",
    entrepreneurship: "Entrepreneuriat",
    leadership: "Leadership",
    strategy: "Stratégie",
    education: "Éducation",
    healthcare: "Santé",
    environment: "Environnement",
    "social-justice": "Justice Sociale",
    community: "Développement Communautaire",
    coaching: "Coaching & Mentorat",
    football: "Football",
    fitness: "Fitness",
    nutrition: "Nutrition",
    psychology: "Psychologie du Sport",
    "sports-management": "Gestion Sportive",
    wellness: "Bien-être",
  }
  return passionIds.map((id) => passionMap[id] ?? id)
}

async function loadAgentConfig(configId: string | null): Promise<any | null> {
  if (!configId) return null
  const { data, error } = await supabase
    .from("agent_configurations")
    .select("configuration")
    .eq("id", configId)
    .maybeSingle()
  if (error) return null
  return data
}

function safeJsonExtractArray(text: string): any[] {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    return JSON.parse(match[0])
  } catch {
    return []
  }
}

// =========================
// LLM
// =========================
async function generateRecommendationsViaLLM(
  passionNames: string[],
  agentConfig: any
): Promise<{ careers: CareerRecommendation[]; tokensUsed: number }> {
  const systemPrompt =
    agentConfig?.configuration?.system_prompt ??
    "You are Spot, an expert career advisor specializing in hybrid careers and multipotentiality. Respond in French and output pure JSON only."

  const userMessage = `L'utilisateur a sélectionné: ${passionNames.join(", ")}

Génère 3–5 métiers HYBRIDES combinant ces passions.
Contraintes:
- Combiner ≥ 2 passions
- Réalistes, innovants, métiers du futur
- Réponse JSON uniquement (tableau).`

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
      temperature: agentConfig?.configuration?.hyperparameters?.temperature ?? 0.8,
      max_tokens: agentConfig?.configuration?.hyperparameters?.max_tokens ?? 1500,
    }),
  })

  if (!resp.ok) {
    const t = await resp.text().catch(() => "")
    throw new Error(`OpenAI error ${resp.status}: ${t}`)
  }

  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content ?? "[]"

  let careers: CareerRecommendation[] = []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) careers = parsed
    else if (Array.isArray(parsed?.careers)) careers = parsed.careers
  } catch {
    careers = safeJsonExtractArray(content) as CareerRecommendation[]
  }

  const tokensUsed = Number(data?.usage?.total_tokens ?? 0)
  return { careers, tokensUsed }
}

// =========================
// Logging
// =========================
async function logExecution(
  request: GenerateRecommendationsRequest,
  result: GenerateRecommendationsResponse
): Promise<void> {
  await supabase.from("agent_execution_logs").insert({
    input_data: {
      selected_passions: request.selectedPassions,
      config_id: request.configId ?? null,
    },
    output_data: {
      recommendations: result.careers,
      count: result.careers.length,
    },
    performance_feedback: {
      tokens_used: result.tokens_used,
      latency_ms: result.latency_ms,
      relevance_score: result.relevance_score,
    },
    agent_config_id: request.configId ?? null,
  })
}

// =========================
// Server
// =========================
console.info("generate-hybrid-career-recommendations public start")

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || undefined

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method === "GET") {
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain", ...corsHeaders(origin) },
    })
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders(origin),
    })
  }

  try {
    let body: GenerateRecommendationsRequest
    try {
      body = await req.json()
    } catch {
      return badRequest("Invalid JSON body", origin)
    }

    if (!Array.isArray(body.selectedPassions) || body.selectedPassions.length === 0) {
      return badRequest("selectedPassions must be a non-empty array", origin)
    }

    const start = Date.now()
    const passionNames = getPassionNames(body.selectedPassions)
    const agentConfig = await loadAgentConfig(body.configId ?? null)

    const { careers, tokensUsed } = await generateRecommendationsViaLLM(
      passionNames,
      agentConfig
    )

    const latency = Date.now() - start
    const relevanceScore = Math.min(careers.length / 5, 1)

    const response: GenerateRecommendationsResponse = {
      careers,
      tokens_used: tokensUsed,
      latency_ms: latency,
      relevance_score: relevanceScore,
    }

    EdgeRuntime.waitUntil(logExecution(body, response))

    return jsonResponse(response, 200, origin)
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Internal server error" },
      500,
      origin
    )
  }
})
