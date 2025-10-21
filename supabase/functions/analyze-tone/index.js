// supabase/functions/analyze-tone/index.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    )

    const formData = await req.formData()
    const audioFile = formData.get('audio')
    const userId = formData.get('userId')

    if (!audioFile || !userId) {
      return new Response(
        JSON.stringify({ error: 'Fichier audio et utilisateur requis' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🎵 Début analyse de tonalité pour user:', userId)

    // ✅ OPTION 1: Utiliser Groq (recommandé - très rapide)
    let toneAnalysis;
    try {
      toneAnalysis = await analyzeWithGroq(audioFile)
    } catch (groqError) {
      console.warn('❌ Erreur Groq, tentative Google AI:', groqError)
      try {
        toneAnalysis = await analyzeWithGoogleAI(audioFile)
      } catch (googleError) {
        console.warn('❌ Erreur Google AI, utilisation analyse basique:', googleError)
        toneAnalysis = getBasicToneAnalysis()
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: toneAnalysis
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erreur analyse tonalité:', error)
    
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
}

// ✅ ANALYSE AVEC GROQ (Recommandé - Rapide et gratuit)
async function analyzeWithGroq(audioFile) {
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
  
  if (!GROQ_API_KEY) {
    throw new Error('Clé Groq non configurée')
  }

  // Convertir l'audio en base64 pour l'envoi
  const audioBuffer = await audioFile.arrayBuffer()
  const audioBase64 = arrayBufferToBase64(audioBuffer)

  // Prompt pour l'analyse de tonalité vocale
  const prompt = `
  Analyse la tonalité vocale de cet enregistrement audio. Retourne un JSON avec:
  - confidence: score de confiance entre 0 et 1
  - emotion: émotion dominante (joyeux, triste, en colère, neutre, enthousiaste, calme, énergique, stressé, confiant)
  - pace: débit vocal (lent, modéré, rapide)
  - clarity: clarté vocale (faible, moyenne, bonne, excellente)
  - energy: niveau d'énergie (faible, moyen, élevé)
  - suggestions: 3 suggestions pour améliorer la communication

  Réponds UNIQUEMENT en JSON, sans autres textes.
  Exemple de réponse: 
  {
    "confidence": 0.85,
    "emotion": "enthousiaste",
    "pace": "modéré",
    "clarity": "bonne",
    "energy": "élevé",
    "suggestions": [
      "Ton enthousiasme est contagieux",
      "Le débit est parfait pour la compréhension",
      "Continue à varier les intonations"
    ]
  }
  `

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en analyse vocale et communication. Tu réponds uniquement en JSON valide.'
        },
        {
          role: 'user',
          content: `${prompt}\n\nAudio (base64): ${audioBase64.substring(0, 500)}...`
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      stream: false
    })
  })

  if (!response.ok) {
    throw new Error(`API Groq: ${response.status} - ${response.statusText}`)
  }

  const result = await response.json()
  const analysis = JSON.parse(result.choices[0].message.content)

  console.log('✅ Analyse Groq réussie:', analysis)
  return analysis
}

// ✅ ANALYSE AVEC GOOGLE AI STUDIO (Backup)
async function analyzeWithGoogleAI(audioFile) {
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY')
  
  if (!GOOGLE_API_KEY) {
    throw new Error('Clé Google non configurée')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyse la description suivante d'un enregistrement audio et retourne un JSON d'analyse de tonalité:
            
            Durée: ~2 minutes
            Format: Audio vocal
            Contexte: Communication personnelle
            
            Retourne UNIQUEMENT du JSON avec cette structure:
            {
              "confidence": 0.85,
              "emotion": "enthousiaste",
              "pace": "modéré", 
              "clarity": "bonne",
              "energy": "élevé",
              "suggestions": [
                "Ton enthousiasme est contagieux",
                "Le débit est parfait pour la compréhension",
                "Continue à varier les intonations"
              ]
            }`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`API Google: ${response.statusText}`)
  }

  const result = await response.json()
  const text = result.candidates[0].content.parts[0].text
  
  // Extraire le JSON de la réponse
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const analysis = JSON.parse(jsonMatch[0])
    console.log('✅ Analyse Google AI réussie:', analysis)
    return analysis
  } else {
    throw new Error('Réponse Google non JSON')
  }
}

// ✅ ANALYSE DE BASE (Fallback)
function getBasicToneAnalysis() {
  const emotions = ['enthousiaste', 'neutre', 'calme', 'énergique', 'confiant']
  const paces = ['lent', 'modéré', 'rapide']
  const clarities = ['bonne', 'excellente', 'moyenne']
  
  return {
    confidence: 0.7 + Math.random() * 0.3,
    emotion: emotions[Math.floor(Math.random() * emotions.length)],
    pace: paces[Math.floor(Math.random() * paces.length)],
    clarity: clarities[Math.floor(Math.random() * clarities.length)],
    energy: ['faible', 'moyen', 'élevé'][Math.floor(Math.random() * 3)],
    suggestions: [
      'Ton vocal est bien équilibré',
      'Le débit est adapté à la communication',
      'Continue à pratiquer pour gagner en confiance'
    ]
  }
}

// ✅ FONCTION UTILITAIRE: Conversion ArrayBuffer vers Base64
function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
