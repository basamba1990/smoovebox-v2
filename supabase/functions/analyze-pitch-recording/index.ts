import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0"

/**
 * Edge Function : analyze-pitch-recording
 * 
 * Analyse un enregistrement audio/pitch et retourne :
 * - Transcription du speech
 * - Analyse du ton et des émotions (via Prompt Tuning)
 * - Feedback personnalisé basé sur la configuration agent optimisée
 * 
 * Intègre :
 * - Transcription via OpenAI Whisper API
 * - Analyse via LLM avec Soft Prompt optimisé (Prompt Tuning)
 * - Configuration agent dynamique (Artemis)
 * - Logging pour l'optimisation continue
 */

// Types
interface AnalyzePitchRequest {
  audio: string // base64 encoded audio
  duration: number // durée en secondes
  personaId: string // ID du persona sélectionné
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

// Initialiser le client Supabase
const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
  throw new Error("Variables d'environnement manquantes")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

/**
 * Transcrit l'audio via OpenAI Whisper API
 */
async function transcribeAudio(audioBase64: string): Promise<TranscriptionResult> {
  try {
    // Convertir base64 en Blob
    const binaryString = atob(audioBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const audioBlob = new Blob([bytes], { type: "audio/webm" })

    // Créer FormData pour Whisper API
    const formData = new FormData()
    formData.append("file", audioBlob, "audio.webm")
    formData.append("model", "whisper-1")
    formData.append("language", "fr")

    // Appeler Whisper API
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      text: data.text,
      confidence: 0.95, // Whisper ne retourne pas de confiance directe
      language: "fr"
    }
  } catch (error) {
    console.error("Erreur de transcription:", error)
    throw error
  }
}

/**
 * Charge le Soft Prompt optimisé pour l'analyse de pitch
 */
async function loadSoftPrompt(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("llm_soft_prompts")
      .select("embeddings")
      .eq("task_name", "pitch_analysis")
      .eq("is_active", true)
      .single()

    if (error) {
      console.warn("Soft prompt non trouvé:", error.message)
      return null
    }

    // Retourner le soft prompt (en production, ce serait un tenseur d'embeddings)
    return data?.embeddings ? JSON.stringify(data.embeddings) : null
  } catch (error) {
    console.error("Erreur lors du chargement du soft prompt:", error)
    return null
  }
}

/**
 * Charge la configuration agent active pour l'analyse de pitch
 */
async function loadAgentConfig(): Promise<any> {
  try {
    const { data, error } = await supabase
      .from("agent_configurations")
      .select("id, configuration")
      .eq("agent_name", "pitch_analysis_agent")
      .eq("is_active", true)
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
 * Analyse le pitch via LLM avec Soft Prompt optimisé
 */
async function analyzePitch(
  transcription: string,
  softPrompt: string | null,
  agentConfig: any
): Promise<{ analysis: AnalysisResult; tokensUsed: number }> {
  try {
    // Construire le system prompt (utiliser la configuration agent si disponible)
    const systemPrompt = agentConfig?.configuration?.system_prompt || 
      "You are Spot, an expert coach analyzing a young talent's pitch. Provide constructive feedback on tone, emotions, and areas for improvement."

    // Construire le message utilisateur
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
        temperature: agentConfig?.configuration?.hyperparameters?.temperature || 0.7,
        max_tokens: agentConfig?.configuration?.hyperparameters?.max_tokens || 512
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parser la réponse JSON
    const analysisText = content.match(/\{[\s\S]*\}/)?.[0] || "{}"
    const analysis = JSON.parse(analysisText)

    return {
      analysis: {
        tone: analysis.tone || "Neutre",
        emotions: analysis.emotions || [],
        confidence: analysis.confidence || 0.8,
        strengths: analysis.strengths || [],
        improvements: analysis.improvements || []
      },
      tokensUsed: data.usage.total_tokens
    }
  } catch (error) {
    console.error("Erreur lors de l'analyse:", error)
    throw error
  }
}

/**
 * Génère un feedback personnalisé basé sur l'analyse
 */
async function generateFeedback(
  analysis: AnalysisResult,
  agentConfig: any
): Promise<FeedbackResult> {
  try {
    // Construire le system prompt
    const systemPrompt = agentConfig?.configuration?.system_prompt || 
      "You are Spot, a supportive and encouraging coach."

    // Construire le message utilisateur
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
        temperature: 0.8,
        max_tokens: 300
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parser la réponse JSON
    const feedbackText = content.match(/\{[\s\S]*\}/)?.[0] || "{}"
    const feedback = JSON.parse(feedbackText)

    return {
      message: feedback.message || "Excellent pitch!",
      suggestions: feedback.suggestions || [],
      encouragement: feedback.encouragement || "Continuez comme ça!"
    }
  } catch (error) {
    console.error("Erreur lors de la génération du feedback:", error)
    // Retourner un feedback par défaut en cas d'erreur
    return {
      message: "Merci pour votre pitch!",
      suggestions: ["Continuez à pratiquer", "Enregistrez-vous régulièrement"],
      encouragement: "Vous progressez bien!"
    }
  }
}

/**
 * Enregistre l'exécution pour l'optimisation d'agents
 */
async function logExecution(
  request: AnalyzePitchRequest,
  result: AnalyzePitchResponse
): Promise<void> {
  try {
    const { error } = await supabase
      .from("agent_execution_logs")
      .insert({
        input_data: {
          duration: request.duration,
          persona_id: request.personaId
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
        agent_config_id: result.config_id
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
    const body = await req.json() as AnalyzePitchRequest

    if (!body.audio || body.duration === undefined) {
      return new Response("Missing required fields: audio, duration", { status: 400 })
    }

    const startTime = Date.now()

    // 1. Transcrire l'audio
    console.log("Transcription en cours...")
    const transcriptionResult = await transcribeAudio(body.audio)

    // 2. Charger le Soft Prompt optimisé
    console.log("Chargement du soft prompt...")
    const softPrompt = await loadSoftPrompt()

    // 3. Charger la configuration agent
    console.log("Chargement de la configuration agent...")
    const agentConfig = await loadAgentConfig()

    // 4. Analyser le pitch
    console.log("Analyse du pitch...")
    const { analysis, tokensUsed: analysisTokens } = await analyzePitch(
      transcriptionResult.text,
      softPrompt,
      agentConfig
    )

    // 5. Générer un feedback personnalisé
    console.log("Génération du feedback...")
    const feedback = await generateFeedback(analysis, agentConfig)

    const latency = Date.now() - startTime

    // Préparer la réponse
    const response: AnalyzePitchResponse = {
      transcription: transcriptionResult.text,
      analysis,
      feedback,
      tokens_used: analysisTokens,
      latency_ms: latency,
      config_id: agentConfig?.id || null
    }

    // 6. Logger l'exécution (asynchrone, ne pas attendre)
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
