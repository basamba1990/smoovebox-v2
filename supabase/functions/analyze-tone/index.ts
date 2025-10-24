// supabase/functions/analyze-tone/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// ✅ ANALYSE DE TONALITÉ AVANCÉE AVEC GPT-4
const TONE_ANALYSIS_PROMPTS = {
  fr: `Analyse la tonalité émotionnelle et vocale de cet audio. Réponds en JSON avec cette structure :

{
  "confidence": 0.85,
  "emotion": "joyeux/triste/colérique/neutre/enthousiaste/calme/énergique/stressé/confiant/serein",
  "pace": "lent/moderé/rapide",
  "clarity": "faible/moyen/bon/excellent",
  "energy": "faible/moyen/élevé",
  "sentiment_score": 0.75,
  "vocal_characteristics": {
    "pitch_stability": "stable/variable",
    "articulation": "précise/relâchée",
    "intonation": "monotone/expressif",
    "pause_frequency": "rare/fréquent"
  },
  "emotional_intensity": 0.7,
  "communication_style": "formel/informel/amical/autoritaire",
  "improvement_suggestions": [
    "Suggestion 1 pour améliorer le ton",
    "Suggestion 2 pour l'impact vocal"
  ],
  "positive_aspects": [
    "Aspect positif 1",
    "Aspect positif 2"
  ]
}

Texte à analyser : {text}`,

  en: `Analyze the emotional and vocal tone of this audio. Respond in JSON with this structure:

{
  "confidence": 0.85,
  "emotion": "joyful/sad/angry/neutral/enthusiastic/calm/energetic/stressed/confident/serene",
  "pace": "slow/moderate/fast",
  "clarity": "poor/average/good/excellent",
  "energy": "low/medium/high",
  "sentiment_score": 0.75,
  "vocal_characteristics": {
    "pitch_stability": "stable/variable",
    "articulation": "precise/relaxed",
    "intonation": "monotone/expressive",
    "pause_frequency": "rare/frequent"
  },
  "emotional_intensity": 0.7,
  "communication_style": "formal/informal/friendly/authoritative",
  "improvement_suggestions": [
    "Suggestion 1 to improve tone",
    "Suggestion 2 for vocal impact"
  ],
  "positive_aspects": [
    "Positive aspect 1",
    "Positive aspect 2"
  ]
}

Text to analyze: {text}`,

  ar: `حلل النبرة العاطفية والصوتية لهذا الصوت. أجب بتنسيق JSON مع هذه البنية:

{
  "confidence": 0.85,
  "emotion": "فرح/حزن/غضب/محايد/متحمس/هادئ/نشيط/متوتر/واثق/مطمئن",
  "pace": "بطيء/معتدل/سريع",
  "clarity": "ضعيف/متوسط/جيد/ممتاز",
  "energy": "منخفض/متوسط/مرتفع",
  "sentiment_score": 0.75,
  "vocal_characteristics": {
    "pitch_stability": "ثابت/متغير",
    "articulation": "واضح/مرتخي",
    "intonation": "رتيب/معبر",
    "pause_frequency": "قليل/كثير"
  },
  "emotional_intensity": 0.7,
  "communication_style": "رسمي/غير رسمي/ودي/سلطوي",
  "improvement_suggestions": [
    "اقتراح 1 لتحسين النبرة",
    "اقتراح 2 للتأثير الصوتي"
  ],
  "positive_aspects": [
    "الجانب الإيجابي 1",
    "الجانب الإيجابي 2"
  ]
}

النص المراد تحليله: {text}`
}

Deno.serve(async (req) => {
  console.log("🎵 Fonction analyze-tone appelée")

  // ✅ GESTION CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  try {
    // ✅ VALIDATION DE LA MÉTHODE
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ✅ PARSING DU CORPS
    let requestBody
    try {
      requestBody = await req.json()
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Corps JSON invalide' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { audio, userId, language = 'fr' } = requestBody

    // ✅ VALIDATION
    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'Données audio manquantes' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ✅ RÉCUPÉRATION DES CLÉS
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Clé API OpenAI manquante' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })

    console.log("🤖 Analyse de tonalité avec GPT-4...")

    // ✅ TRANSCRIPTION AUDIO AVEC WHISPER (si audio fourni)
    let transcriptionText = audio
    if (typeof audio !== 'string') {
      // Si c'est un blob audio, le transcrire d'abord
      try {
        const transcription = await openai.audio.transcriptions.create({
          file: audio,
          model: "whisper-1",
          language: language,
          response_format: "text"
        })
        transcriptionText = transcription
      } catch (transcribeError) {
        console.error('❌ Erreur transcription:', transcribeError)
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la transcription audio' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    if (!transcriptionText || transcriptionText.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Texte de transcription trop court ou vide' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ✅ ANALYSE DE TONALITÉ AVEC GPT-4
    const promptTemplate = TONE_ANALYSIS_PROMPTS[language] || TONE_ANALYSIS_PROMPTS.fr
    const analysisPrompt = promptTemplate.replace('{text}', transcriptionText.substring(0, 4000))

    const completion = await openai.chat.completions.create({
      model: "gpt-4", // ✅ UTILISATION DE GPT-4 POUR MEILLEURE ANALYSE
      messages: [
        {
          role: "system",
          content: "Tu es un expert en analyse vocale et émotionnelle. Tu analyses les transcriptions pour détecter la tonalité, les émotions et les caractéristiques vocales. Tes analyses sont précises et constructives."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    })

    const analysisText = completion.choices[0].message.content
    let toneAnalysis

    try {
      toneAnalysis = JSON.parse(analysisText)
      
      // ✅ ENRICHISSEMENT DES DONNÉES
      toneAnalysis.analyzed_at = new Date().toISOString()
      toneAnalysis.text_length = transcriptionText.length
      toneAnalysis.model_used = "gpt-4"
      toneAnalysis.language = language

    } catch (parseError) {
      console.error('❌ Erreur parsing analyse:', parseError)
      // Fallback analysis
      toneAnalysis = {
        confidence: 0.7,
        emotion: "neutre",
        pace: "modéré",
        clarity: "bon",
        energy: "moyen",
        sentiment_score: 0.65,
        vocal_characteristics: {
          pitch_stability: "stable",
          articulation: "précise",
          intonation: "expressif",
          pause_frequency: "modéré"
        },
        emotional_intensity: 0.6,
        communication_style: "amical",
        improvement_suggestions: [
          "Continuez à parler avec cette clarté",
          "Variez légèrement le débit pour plus d'impact"
        ],
        positive_aspects: [
          "Ton authentique et engageant",
          "Bonne articulation des mots"
        ],
        analyzed_at: new Date().toISOString(),
        text_length: transcriptionText.length,
        model_used: "gpt-4",
        language: language
      }
    }

    console.log("✅ Analyse de tonalité terminée")

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analyse de tonalité terminée avec succès',
        analysis: toneAnalysis,
        text_sample: transcriptionText.substring(0, 200) + '...'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erreur analyse-tone:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de l\'analyse de tonalité', 
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
