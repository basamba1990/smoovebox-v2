import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0"

/**
 * Edge Function : generate-hybrid-career-recommendations
 * 
 * Génère des recommandations de carrière hybride basées sur les passions multiples
 * Intègre :
 * - Chargement du Soft Prompt optimisé (Prompt Tuning)
 * - Chargement de la configuration agent (Artemis)
 * - Génération via LLM avec contexte personnalisé
 * - Logging pour l'optimisation continue
 */

interface GenerateRecommendationsRequest {
  selectedPassions: string[]
  softPromptId: string | null
  configId: string | null
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

// Initialiser le client Supabase
const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
  throw new Error("Variables d'environnement manquantes")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

/**
 * Mappe les IDs de passions à leurs noms français
 */
function getPassionNames(passionIds: string[]): string[] {
  const passionMap: Record<string, string> = {
    // Créativité & Arts
    dance: "Danse",
    music: "Musique",
    "video-editing": "Création Vidéo",
    photography: "Photographie",
    "graphic-design": "Design Graphique",
    writing: "Écriture",
    // Sciences & Technologie
    biology: "Biologie",
    chemistry: "Chimie",
    physics: "Physique",
    programming: "Programmation",
    "ai-ml": "IA & Machine Learning",
    robotics: "Robotique",
    // Entrepreneuriat & Business
    marketing: "Marketing",
    sales: "Vente",
    finance: "Finance",
    entrepreneurship: "Entrepreneuriat",
    leadership: "Leadership",
    strategy: "Stratégie",
    // Social & Humanitaire
    education: "Éducation",
    healthcare: "Santé",
    environment: "Environnement",
    "social-justice": "Justice Sociale",
    community: "Développement Communautaire",
    coaching: "Coaching & Mentorat",
    // Sports & Bien-être
    football: "Football",
    fitness: "Fitness",
    nutrition: "Nutrition",
    psychology: "Psychologie du Sport",
    "sports-management": "Gestion Sportive",
    wellness: "Bien-être"
  }

  return passionIds.map((id) => passionMap[id] || id)
}

/**
 * Charge la configuration agent pour adapter le prompt
 */
async function loadAgentConfig(configId: string | null): Promise<any> {
  if (!configId) return null

  try {
    const { data, error } = await supabase
      .from("agent_configurations")
      .select("configuration")
      .eq("id", configId)
      .single()

    if (error) {
      console.warn("Configuration agent non trouvée:", error.message)
      return null
    }

    return data
  } catch (error) {
    console.error("Erreur lors du chargement de la configuration agent:", error)
    return null
  }
}

/**
 * Génère les recommandations via LLM
 */
async function generateRecommendationsViaLLM(
  passionNames: string[],
  agentConfig: any
): Promise<{ careers: CareerRecommendation[]; tokensUsed: number }> {
  try {
    // Construire le system prompt (utiliser la configuration agent si disponible)
    const systemPrompt = agentConfig?.configuration?.system_prompt ||
      `You are Spot, an expert career advisor specializing in hybrid careers and multipotentiality.
Your role is to help young talents discover unique career paths by combining their multiple passions.
Respond in French and provide creative, realistic, and inspiring career recommendations.`

    // Construire le message utilisateur
    const userMessage = `L'utilisateur a sélectionné les passions suivantes: ${passionNames.join(", ")}

Générez 3-5 recommandations de carrière HYBRIDE qui combinent ces passions de manière créative et réaliste.
Ces carrières doivent être :
- Innovantes et uniques (pas des carrières standard)
- Combinant au moins 2 des passions sélectionnées
- Viables et avec un potentiel de croissance
- Alignées avec les métiers de demain (2050)

Répondez en JSON avec la structure suivante (tableau):
[
  {
    "name": "Nom du métier",
    "description": "Description détaillée du rôle",
    "passions": ["passion1", "passion2"],
    "skills": ["compétence1", "compétence2"],
    "futureOutlook": "Perspective d'avenir et croissance",
    "salaryRange": "Fourchette salariale estimée"
  }
]`

    // Appeler OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: agentConfig?.configuration?.hyperparameters?.temperature || 0.8,
        max_tokens: agentConfig?.configuration?.hyperparameters?.max_tokens || 1500
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parser la réponse JSON
    const careersText = content.match(/\[[\s\S]*\]/)?.[0] || "[]"
    const careers = JSON.parse(careersText) as CareerRecommendation[]

    return {
      careers,
      tokensUsed: data.usage.total_tokens
    }
  } catch (error) {
    console.error("Erreur lors de la génération des recommandations:", error)
    throw error
  }
}

/**
 * Enregistre l'exécution pour l'optimisation d'agents
 */
async function logExecution(
  request: GenerateRecommendationsRequest,
  result: GenerateRecommendationsResponse
): Promise<void> {
  try {
    const { error } = await supabase
      .from("agent_execution_logs")
      .insert({
        input_data: {
          selected_passions: request.selectedPassions
        },
        output_data: {
          recommendations: result.careers,
          count: result.careers.length
        },
        performance_feedback: {
          tokens_used: result.tokens_used,
          latency_ms: result.latency_ms,
          relevance_score: result.relevance_score
        },
        agent_config_id: request.configId
      })

    if (error) {
      console.warn("Erreur lors du logging:", error.message)
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'exécution:", error)
  }
}

/**
 * Handler principal
 */
serve(async (req: Request) => {
  try {
    // Vérifier la méthode
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    // Parser le body
    const body = await req.json() as GenerateRecommendationsRequest

    if (!body.selectedPassions || body.selectedPassions.length === 0) {
      return new Response("Missing required fields: selectedPassions", { status: 400 })
    }

    const startTime = Date.now()

    // 1. Mapper les IDs de passions à leurs noms
    const passionNames = getPassionNames(body.selectedPassions)

    // 2. Charger la configuration agent
    console.log("Chargement de la configuration agent...")
    const agentConfig = await loadAgentConfig(body.configId || null)

    // 3. Générer les recommandations via LLM
    console.log("Génération des recommandations...")
    const { careers, tokensUsed } = await generateRecommendationsViaLLM(
      passionNames,
      agentConfig
    )

    const latency = Date.now() - startTime

    // Calculer un score de pertinence (nombre de recommandations générées)
    const relevanceScore = Math.min(careers.length / 5, 1.0)

    // Préparer la réponse
    const response: GenerateRecommendationsResponse = {
      careers,
      tokens_used: tokensUsed,
      latency_ms: latency,
      relevance_score: relevanceScore
    }

    // 4. Logger l'exécution (asynchrone, ne pas attendre)
    logExecution(body, response).catch((err) =>
      console.error("Erreur lors du logging:", err)
    )

    // Retourner la réponse
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  } catch (error) {
    console.error("Erreur:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
