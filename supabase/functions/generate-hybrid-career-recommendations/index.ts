import { createClient } from "npm:@supabase/supabase-js"

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

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
  throw new Error("Variables d'environnement manquantes: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const ALLOWED_ORIGINS = new Set([
  "https://spotbulle.vercel.app",
])

function corsHeaders(origin?: string) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://spotbulle.vercel.app"
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }
}

function badRequest(msg: string, origin?: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { 
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  })
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

async function loadAgentConfig(configId: string | null): Promise<any> {
  if (!configId) return null
  const { data, error } = await supabase
    .from("agent_configurations")
    .select("configuration")
    .eq("id", configId)
    .maybeSingle()
  if (error) {
    console.warn("Configuration agent non trouvée:", error.message)
    return null
  }
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

async function generateRecommendationsViaLLM(
  passionNames: string[],
  agentConfig: any
): Promise<{ careers: CareerRecommendation[]; tokensUsed: number }> {
  const systemPrompt =
    agentConfig?.configuration?.system_prompt ??
    `You are Spot, an expert career advisor specializing in hybrid careers and multipotentiality.
Respond in French and provide creative, realistic, and inspiring career recommendations as pure JSON.`

  const userMessage = `L'utilisateur a sélectionné les passions suivantes: ${passionNames.join(", ")}

Générez 3-5 recommandations de carrière HYBRIDE combinant ces passions de manière créative et réaliste.
Exigences:
- Innovantes et uniques
- Combinant au moins 2 passions
- Viables avec potentiel de croissance
- Alignées avec les métiers de demain (2050)

Répondez en JSON uniquement, structure tableau:
[
  {
    "name": "Nom du métier",
    "description": "Description détaillée du rôle",
    "passions": ["passion1", "passion2"],
    "skills": ["compétence1", "compétence2"],
    "futureOutlook": "Perspective d'avenir",
    "salaryRange": "Fourchette salariale"
  }
]`

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
      response_format: { type: "json_object" },
    }),
  })

  if (!resp.ok) {
    const t = await resp.text().catch(() => "")
    throw new Error(`OpenAI API error: ${resp.status} ${resp.statusText} ${t}`)
  }

  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content ?? "[]"

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    parsed = {}
  }

  let careers: CareerRecommendation[] = []
  if (Array.isArray(parsed)) {
    careers = parsed
  } else if (Array.isArray(parsed?.careers)) {
    careers = parsed.careers
  } else {
    careers = safeJsonExtractArray(content) as CareerRecommendation[]
  }

  const tokensUsed = Number(data?.usage?.total_tokens ?? 0)
  return { careers, tokensUsed }
}

async function logExecution(
  request: GenerateRecommendationsRequest,
  result: GenerateRecommendationsResponse
): Promise<void> {
  const { error } = await supabase
    .from("agent_execution_logs")
    .insert({
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

  if (error) console.warn("Erreur lors du logging:", error.message)
}

async function requireAuthenticatedUser(req: Request): Promise<{ userId: string } | Response> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authorization Bearer requis" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin") || undefined) },
    })
  }
  const jwt = auth.slice("Bearer ".length)
  // Vérifie le JWT côté Edge via auth.getUser
  const serverClient = createClient(supabaseUrl!, jwt)
  const { data, error } = await serverClient.auth.getUser()
  if (error || !data.user) {
    return new Response(JSON.stringify({ error: "Token invalide ou expiré" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin") || undefined) },
    })
  }
  return { userId: data.user.id }
}

console.info("generate-hybrid-career-recommendations secured start")
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || undefined
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: { ...corsHeaders(origin) }, status: 204 })
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: { ...corsHeaders(origin) } })
    }

    // Auth obligatoire
    const authResult = await requireAuthenticatedUser(req)
    if (authResult instanceof Response) return authResult

    let body: GenerateRecommendationsRequest
    try {
      body = await req.json()
    } catch {
      return badRequest("Body JSON invalide", origin)
    }

    if (!Array.isArray(body.selectedPassions) || body.selectedPassions.length === 0) {
      return badRequest("Champs requis: selectedPassions (array non vide)", origin)
    }

    const start = Date.now()
    const passionNames = getPassionNames(body.selectedPassions)
    const agentConfig = await loadAgentConfig(body.configId ?? null)
    const { careers, tokensUsed } = await generateRecommendationsViaLLM(passionNames, agentConfig)

    const latency = Date.now() - start
    const relevanceScore = Math.min(careers.length / 5, 1.0)

    const response: GenerateRecommendationsResponse = {
      careers,
      tokens_used: tokensUsed,
      latency_ms: latency,
      relevance_score: relevanceScore,
    }

    EdgeRuntime.waitUntil(logExecution(body, response))

    return new Response(JSON.stringify(response), {
      headers: { 
        "Content-Type": "application/json",
        Connection: "keep-alive",
        ...corsHeaders(origin),
      },
      status: 200,
    })
  } catch (e) {
    console.error("Erreur generate-hybrid-career-recommendations:", e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin") || undefined) },
      status: 500,
    })
  }
})
