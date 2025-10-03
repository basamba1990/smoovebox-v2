// supabase/functions/analyze-transcription/index.js

import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Statuts des vidéos
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
}

// En-têtes CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Fonction principale Deno
Deno.serve(async (req) => {
  console.log("🔍 Fonction analyze-transcription appelée")

  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId = null
  let userId = null

  try {
    console.log("📨 Headers reçus:", Object.fromEntries(req.headers))

    // Vérifier la méthode HTTP
    if (req.method !== 'POST') {
      throw new Error('Méthode non autorisée. Utilisez POST.')
    }

    // Parser le corps de la requête
    const { videoId: reqVideoId, transcriptionText, userId: reqUserId } = await req.json()

    // Validation des paramètres obligatoires
    if (!reqVideoId) {
      throw new Error('Paramètre videoId manquant')
    }
    if (!transcriptionText) {
      throw new Error('Paramètre transcriptionText manquant')
    }

    videoId = reqVideoId
    userId = reqUserId

    console.log("🎯 Analyse demandée pour videoId:", videoId)
    console.log("📝 Longueur transcription:", transcriptionText.length, "caractères")

    // Initialiser le client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier que la clé API OpenAI est configurée
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY non configurée')
    }

    // Initialiser le client OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // Mettre à jour le statut de la vidéo en "analyzing"
    console.log("🔄 Mise à jour statut vidéo en 'analyzing'")
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.ANALYZING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (updateError) {
      console.error("❌ Erreur mise à jour statut:", updateError)
      throw new Error(`Erreur base de données: ${updateError.message}`)
    }

    // Préparer le texte pour l'analyse (limiter la taille)
    const textToAnalyze = transcriptionText.substring(0, 8000)
    console.log("📊 Texte préparé pour analyse:", textToAnalyze.length, "caractères")

    // Appeler l'API OpenAI pour l'analyse
    console.log("🤖 Appel à l'API OpenAI...")
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `En tant qu'expert en communication, analysez cette transcription vidéo en français.

Fournissez une analyse structurée en JSON avec le format suivant:
{
  "summary": "résumé en 2-3 phrases",
  "key_topics": ["thème1", "thème2", "thème3"],
  "sentiment": "positif/neutre/négatif",
  "sentiment_score": 0.8,
  "communication_advice": ["conseil1", "conseil2"],
  "tone_analysis": {
    "emotion": "enthousiaste/calme/energique",
    "pace": "rapide/moderé/lent",
    "clarity": "excellente/bonne/moyenne/faible"
  }
}

Répondez UNIQUEMENT avec le JSON, sans texte supplémentaire.`
        },
        {
          role: "user",
          content: `Transcription: ${textToAnalyze}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500
    })

    console.log("✅ Réponse OpenAI reçue")

    // Parser la réponse JSON
    let analysisResult
    try {
      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('Réponse OpenAI vide')
      }
      analysisResult = JSON.parse(content)
      console.log("📊 Analyse parsée avec succès")
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON OpenAI:", parseError)
      // Utiliser l'analyse basique en fallback
      analysisResult = createBasicAnalysis(textToAnalyze)
    }

    // Calculer le score IA
    const aiScore = calculateAIScore(analysisResult)
    console.log("📈 Score IA calculé:", aiScore)

    // Préparer les données pour la sauvegarde
    const analysisData = {
      analysis: analysisResult,
      ai_score: aiScore,
      raw_openai_response: completion.choices[0]?.message?.content,
      analyzed_at: new Date().toISOString()
    }

    // Sauvegarder l'analyse dans la base de données
    console.log("💾 Sauvegarde dans la base de données...")
    const { error: saveError } = await supabaseClient
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.ANALYZED,
        analysis_data: analysisData,
        ai_result: analysisResult,
        ai_score: aiScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (saveError) {
      console.error("❌ Erreur sauvegarde analyse:", saveError)
      throw new Error(`Erreur sauvegarde: ${saveError.message}`)
    }

    console.log("✅ Analyse sauvegardée avec succès")

    // Retourner la réponse réussie
    return new Response(
      JSON.stringify({
        success: true,
        videoId: videoId,
        analysis: analysisResult,
        aiScore: aiScore,
        message: "Analyse terminée avec succès"
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error("💥 Erreur générale dans analyze-transcription:", error)

    // Mettre à jour le statut en "failed" si on a le videoId
    if (videoId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabaseClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
      } catch (dbError) {
        console.error("❌ Impossible de mettre à jour le statut d'échec:", dbError)
      }
    }

    // Retourner l'erreur
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        videoId: videoId,
        message: "Échec de l'analyse IA"
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})

// Fonction de fallback pour créer une analyse basique
function createBasicAnalysis(text) {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
  const sentenceCount = text.split(/[.!?]+/).length - 1
  const paragraphCount = text.split(/\n\s*\n/).length

  return {
    summary: `Analyse basique: ${wordCount} mots, ${sentenceCount} phrases, ${paragraphCount} paragraphes.`,
    key_topics: ["communication", "partage", "expression"],
    important_entities: [],
    sentiment: "neutre",
    sentiment_score: 0.5,
    structure_analysis: {
      introduction: wordCount > 100 ? "détectée" : "courte",
      development: wordCount > 200 ? "présent" : "limité",
      conclusion: wordCount > 150 ? "détectée" : "courte",
      overall_structure: wordCount > 300 ? "complet" : "basique"
    },
    communication_advice: [
      "Continuez à pratiquer régulièrement",
      "Variez le débit pour maintenir l'attention",
      "Structurez votre discours avec des pauses stratégiques"
    ],
    tone_analysis: {
      emotion: "neutre",
      pace: "modéré",
      clarity: "bonne",
      confidence_level: 0.6
    },
    target_audience: ["communauté SpotBulle"],
    expertise_level: "intermédiaire",
    emotional_engagement: {
      type: "informatif",
      level: 0.5
    },
    visual_suggestions: [
      "Éclairage naturel recommandé",
      "Fond neutre préférable",
      "Contact visuel avec la caméra"
    ]
  }
}

// Fonction helper pour calculer un score IA basé sur l'analyse
function calculateAIScore(analysisResult) {
  let score = 7.0 // Score de base

  if (analysisResult.summary && analysisResult.summary.length > 30) score += 0.5
  if (analysisResult.key_topics && analysisResult.key_topics.length >= 2) score += 0.5
  if (analysisResult.communication_advice && analysisResult.communication_advice.length > 0) score += 0.5
  if (analysisResult.tone_analysis) score += 0.5
  if (analysisResult.sentiment_score > 0.6) score += 0.5
  if (analysisResult.structure_analysis) score += 0.5

  return Math.min(Math.max(score, 0), 10.0) // Limiter entre 0 et 10
}
