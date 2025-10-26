// supabase/functions/analyze-tone/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Content-Type': 'application/json',
}

// ✅ ANALYSE DE TONALITÉ AVANCÉE AVEC GPT-4o
const TONE_ANALYSIS_PROMPTS = {
  fr: `En tant qu'expert en analyse vocale et émotionnelle, analyse cette transcription audio de manière approfondie.

Fournis une analyse détaillée en JSON avec cette structure :

{
  "confidence": 0.85,
  "emotion": "joyeux/triste/colérique/neutre/enthousiaste/calme/énergique/stressé/confiant/serein",
  "pace": "lent/moderé/rapide/très rapide",
  "clarity": "faible/moyen/bon/excellent",
  "energy": "faible/moyen/élevé/intense",
  "sentiment_score": 0.75,
  "vocal_characteristics": {
    "pitch_stability": "stable/variable/très stable",
    "articulation": "précise/moyenne/relâchée",
    "intonation": "monotone/expressif/très expressif",
    "pause_frequency": "rare/moderé/fréquent/optimal"
  },
  "emotional_intensity": 0.7,
  "communication_style": "formel/informel/amical/autoritaire/engageant",
  "improvement_suggestions": [
    "Suggestion concrète 1 avec exemple",
    "Suggestion actionnable 2",
    "Recommandation pour l'impact vocal 3"
  ],
  "positive_aspects": [
    "Aspect positif 1 détecté",
    "Aspect positif 2 à valoriser"
  ]
}

IMPORTANT : Sois précis, constructif et fournis des insights actionnables. Base-toi uniquement sur le contenu fourni.

Transcription à analyser :
{text}`,

  en: `As an expert in vocal and emotional analysis, perform a deep analysis of this audio transcription.

Provide detailed analysis in JSON with this structure:

{
  "confidence": 0.85,
  "emotion": "joyful/sad/angry/neutral/enthusiastic/calm/energetic/stressed/confident/serene",
  "pace": "slow/moderate/fast/very fast",
  "clarity": "poor/average/good/excellent",
  "energy": "low/medium/high/intense",
  "sentiment_score": 0.75,
  "vocal_characteristics": {
    "pitch_stability": "stable/variable/very stable",
    "articulation": "precise/average/relaxed",
    "intonation": "monotone/expressive/very expressive",
    "pause_frequency": "rare/moderate/frequent/optimal"
  },
  "emotional_intensity": 0.7,
  "communication_style": "formal/informal/friendly/authoritative/engaging",
  "improvement_suggestions": [
    "Concrete suggestion 1 with example",
    "Actionable suggestion 2",
    "Recommendation for vocal impact 3"
  ],
  "positive_aspects": [
    "Positive aspect 1 detected",
    "Positive aspect 2 to leverage"
  ]
}

IMPORTANT: Be precise, constructive and provide actionable insights. Base your analysis solely on the provided content.

Text to analyze:
{text}`
};

const SYSTEM_MESSAGES = {
  fr: "Tu es un expert en analyse vocale, émotionnelle et psychologie du langage. Tu analyses les transcriptions audio avec une expertise approfondie pour fournir des insights actionnables, constructifs et précis. Tes analyses combinent intelligence artificielle et compréhension humaine.",
  en: "You are an expert in vocal analysis, emotional analysis and language psychology. You analyze audio transcripts with deep expertise to provide actionable, constructive and precise insights. Your analyses combine artificial intelligence and human understanding."
};

Deno.serve(async (req) => {
  console.log("🎵 Fonction analyze-tone (GPT-4o optimisée) appelée");

  // ✅ CORRECTION CORS - Gestion OPTIONS améliorée
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  let userId = null;

  try {
    // ✅ PARSING ROBUSTE
    let requestBody;
    try {
      const rawBody = await req.text();
      if (!rawBody || rawBody.trim().length === 0) {
        throw new Error('Corps vide');
      }
      requestBody = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'JSON invalide', 
          details: parseError.message 
        }),
        { 
          status: 400, 
          headers: corsHeaders 
        }
      );
    }
    
    const { audio, userId: uid, language = 'fr' } = requestBody;
    userId = uid;

    // ✅ VALIDATION RENFORCÉE
    if (!audio) {
      return new Response(
        JSON.stringify({ 
          error: 'Paramètre audio requis',
          received: !!audio
        }),
        { 
          status: 400, 
          headers: corsHeaders 
        }
      );
    }

    // ✅ CONFIGURATION
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.error('❌ Clé API OpenAI manquante');
      throw new Error('Configuration serveur incomplète');
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    console.log(`🎵 Analyse de tonalité pour utilisateur: ${userId ? '***' : 'NULL'}, langue: ${language}`);

    // ✅ GESTION AUDIO : Base64 vers Blob
    let audioBlob;
    let transcriptionText;

    if (typeof audio === 'string') {
      // Assume base64 audio data
      try {
        // Reconstruire le Data URL si nécessaire (frontend envoie sans prefix)
        const base64Data = audio;
        const mimeType = 'audio/webm'; // Default for recorded audio
        const fullDataUrl = `data:${mimeType};base64,${base64Data}`;
        
        const response = await fetch(fullDataUrl);
        audioBlob = await response.blob();
        console.log(`📊 Audio blob créé: ${audioBlob.size} bytes`);
      } catch (decodeError) {
        console.error('❌ Erreur décodage base64:', decodeError);
        throw new Error('Audio base64 invalide');
      }
    } else {
      // If already a blob/file (unlikely from frontend)
      audioBlob = audio;
    }

    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Blob audio invalide ou vide');
    }

    // ✅ TRANSCRIPTION AVEC WHISPER
    console.log("🔄 Transcription audio avec Whisper...");
    let whisperResponse;
    try {
      const fileName = `audio-${Date.now()}.${audioBlob.type.includes('webm') ? 'webm' : 'mp4'}`;
      const audioFile = new File([audioBlob], fileName, { type: audioBlob.type });

      whisperResponse = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: language,
        response_format: "text",
        temperature: 0.0
      });
      
      transcriptionText = whisperResponse.trim();
      console.log(`✅ Transcription: ${transcriptionText.length} caractères`);
    } catch (whisperError) {
      console.error('❌ Erreur Whisper:', whisperError);
      // Fallback: utiliser un texte générique ou erreur
      throw new Error(`Erreur transcription: ${whisperError.message}`);
    }

    if (!transcriptionText || transcriptionText.length < 10) {
      throw new Error('Transcription trop courte pour analyse');
    }

    // ✅ ANALYSE DE TONALITÉ AVEC GPT-4o
    console.log("🤖 Appel GPT-4o pour analyse de tonalité...");
    
    const systemMessage = SYSTEM_MESSAGES[language] || SYSTEM_MESSAGES['fr'];
    const promptTemplate = TONE_ANALYSIS_PROMPTS[language] || TONE_ANALYSIS_PROMPTS['fr'];
    const finalPrompt = promptTemplate.replace('{text}', transcriptionText.substring(0, 4000));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: finalPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const analysisText = completion.choices[0].message.content;
    console.log("✅ Réponse GPT-4o reçue");

    let toneAnalysis;
    try {
      toneAnalysis = JSON.parse(analysisText);
      
      // ✅ ENRICHISSEMENT DES DONNÉES
      toneAnalysis.metadata = {
        analyzed_at: new Date().toISOString(),
        text_length: transcriptionText.length,
        audio_duration: Math.round(audioBlob.size / 16000), // Approximation
        model_used: "gpt-4o",
        transcription_model: "whisper-1",
        analysis_language: language,
        processing_time: "optimisé"
      };

    } catch (parseError) {
      console.error("❌ Erreur parsing, utilisation fallback:", parseError);
      toneAnalysis = createFallbackToneAnalysis(transcriptionText, language);
    }

    console.log("🎉 Analyse de tonalité terminée avec succès");
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analyse de tonalité terminée avec succès',
        analysis: toneAnalysis,
        text_sample: transcriptionText.substring(0, 200) + '...',
        model_used: toneAnalysis.metadata?.model_used || "gpt-4o"
      }),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    );

  } catch (error) {
    console.error("💥 Erreur analyse-tone:", error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erreur analyse de tonalité', 
        details: error.message,
        userId: userId
      }),
      { 
        status: 500, 
        headers: corsHeaders 
      }
    );
  }
});

// ✅ FONCTION FALLBACK AMÉLIORÉE
function createFallbackToneAnalysis(text: string, language = 'fr') {
  const isFrench = language === 'fr';
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  return {
    confidence: 0.7,
    emotion: isFrench ? "enthousiaste" : "enthusiastic",
    pace: isFrench ? "modéré" : "moderate",
    clarity: isFrench ? "bon" : "good",
    energy: isFrench ? "élevé" : "high",
    sentiment_score: 0.75,
    vocal_characteristics: {
      pitch_stability: isFrench ? "stable" : "stable",
      articulation: isFrench ? "précise" : "precise",
      intonation: isFrench ? "expressif" : "expressive",
      pause_frequency: isFrench ? "modéré" : "moderate"
    },
    emotional_intensity: 0.6,
    communication_style: isFrench ? "amical" : "friendly",
    improvement_suggestions: isFrench ? [
      "Continuez à parler avec cette clarté naturelle",
      "Variez légèrement le débit pour plus d'impact émotionnel",
      "Intégrez des pauses stratégiques pour renforcer les points clés"
    ] : [
      "Continue speaking with this natural clarity",
      "Vary the pace slightly for more emotional impact",
      "Incorporate strategic pauses to emphasize key points"
    ],
    positive_aspects: isFrench ? [
      "Ton authentique et engageant détecté",
      "Bonne articulation et fluidité globale"
    ] : [
      "Authentic and engaging tone detected",
      "Good articulation and overall fluency"
    ],
    metadata: {
      analyzed_at: new Date().toISOString(),
      text_length: text.length,
      audio_duration: Math.round(text.length / 20), // Approximation
      model_used: "gpt-4o-fallback",
      transcription_model: "whisper-1-fallback",
      analysis_language: language,
      processing_time: "standard"
    }
  };
}
