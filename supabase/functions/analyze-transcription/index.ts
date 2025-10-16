// supabase/functions/analyze-transcription/index.js
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ✅ PROMPTS MULTILINGUES POUR L'ANALYSE
const ANALYSIS_PROMPTS = {
  fr: `
En tant qu'expert en communication, analysez cette transcription vidéo en français.

Transcription: {text}

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

Répondez UNIQUEMENT avec le JSON, sans texte supplémentaire.
  `,
  en: `
As a communication expert, analyze this video transcription in English.

Transcription: {text}

Provide a structured analysis in JSON with the following format:
{
  "summary": "summary in 2-3 sentences",
  "key_topics": ["topic1", "topic2", "topic3"],
  "sentiment": "positive/neutral/negative",
  "sentiment_score": 0.8,
  "communication_advice": ["advice1", "advice2"],
  "tone_analysis": {
    "emotion": "enthusiastic/calm/energetic",
    "pace": "fast/moderate/slow",
    "clarity": "excellent/good/average/poor"
  }
}

Respond ONLY with the JSON, without any additional text.
  `,
  es: `
Como experto en comunicación, analiza esta transcripción de video en español.

Transcripción: {text}

Proporciona un análisis estructurado en JSON con el siguiente formato:
{
  "summary": "resumen en 2-3 frases",
  "key_topics": ["tema1", "tema2", "tema3"],
  "sentiment": "positivo/neutral/negativo",
  "sentiment_score": 0.8,
  "communication_advice": ["consejo1", "consejo2"],
  "tone_analysis": {
    "emotion": "entusiasta/calmo/energético",
    "pace": "rápido/moderado/lento",
    "clarity": "excelente/buena/promedio/mala"
  }
}

Responde ÚNICAMENTE con el JSON, sin texto adicional.
  `,
  de: `
Als Kommunikationsexperte analysieren Sie diese Video-Transkription auf Deutsch.

Transkript: {text}

Geben Sie eine strukturierte Analyse im JSON-Format mit folgendem Format an:
{
  "summary": "Zusammenfassung in 2-3 Sätzen",
  "key_topics": ["Thema1", "Thema2", "Thema3"],
  "sentiment": "positiv/neutral/negativ",
  "sentiment_score": 0.8,
  "communication_advice": ["Ratschlag1", "Ratschlag2"],
  "tone_analysis": {
    "emotion": "begeistert/ruhig/energisch",
    "pace": "schnell/moderat/langsam",
    "clarity": "ausgezeichnet/gut/durchschnittlich/schlecht"
  }
}

Antworten Sie NUR mit dem JSON, ohne zusätzlichen Text.
  `,
  it: `
Come esperto di comunicazione, analizza questa trascrizione video in italiano.

Trascrizione: {text}

Fornisci un'analisi strutturata in JSON con il seguente formato:
{
  "summary": "riassunto in 2-3 frasi",
  "key_topics": ["tema1", "tema2", "tema3"],
  "sentiment": "positivo/neutro/negativo",
  "sentiment_score": 0.8,
  "communication_advice": ["consiglio1", "consiglio2"],
  "tone_analysis": {
    "emotion": "entusiasta/calmo/energico",
    "pace": "veloce/moderato/lento",
    "clarity": "eccellente/buona/media/scarsa"
  }
}

Rispondi SOLO con il JSON, senza testo aggiuntivo.
  `,
  pt: `
Como especialista em comunicação, analise esta transcrição de vídeo em português.

Transcrição: {text}

Forneça uma análise estruturada em JSON com o seguinte formato:
{
  "summary": "resumo em 2-3 frases",
  "key_topics": ["tema1", "tema2", "tema3"],
  "sentiment": "positivo/neutro/negativo",
  "sentiment_score": 0.8,
  "communication_advice": ["conselho1", "conselho2"],
  "tone_analysis": {
    "emotion": "entusiástico/calmo/energético",
    "pace": "rápido/moderado/lento",
    "clarity": "excelente/boa/média/fraca"
  }
}

Responda APENAS com o JSON, sem texto adicional.
  `,
  ru: `
Как эксперт по коммуникациям, проанализируйте эту расшифровку видео на русском языке.

Транскрипция: {text}

Предоставьте структурированный анализ в формате JSON:
{
  "summary": "резюме в 2-3 предложениях",
  "key_topics": ["тема1", "тема2", "тема3"],
  "sentiment": "позитивный/нейтральный/негативный",
  "sentiment_score": 0.8,
  "communication_advice": ["совет1", "совет2"],
  "tone_analysis": {
    "emotion": "восторженный/спокойный/энергичный",
    "pace": "быстрый/умеренный/медленный",
    "clarity": "отличная/хорошая/средняя/плохая"
  }
}

Отвечайте ТОЛЬКО JSON, без дополнительного текста.
  `,
  zh: `
作为沟通专家，请用中文分析此视频转录。

转录：{text}

以JSON格式提供结构化分析：
{
  "summary": "2-3句话总结",
  "key_topics": ["主题1", "主题2", "主题3"],
  "sentiment": "积极/中性/消极",
  "sentiment_score": 0.8,
  "communication_advice": ["建议1", "建议2"],
  "tone_analysis": {
    "emotion": "热情/冷静/精力充沛",
    "pace": "快/中/慢",
    "clarity": "优秀/好/一般/差"
  }
}

仅用JSON回答，不要添加任何其他文本。
  `,
  ja: `
コミュニケーションの専門家として、このビデオの文字起こしを日本語で分析してください。

文字起こし: {text}

以下の形式で構造化された分析をJSONで提供してください：
{
  "summary": "2〜3文の要約",
  "key_topics": ["トピック1", "トピック2", "トピック3"],
  "sentiment": "ポジティブ/ニュートラル/ネガティブ",
  "sentiment_score": 0.8,
  "communication_advice": ["アドバイス1", "アドバイス2"],
  "tone_analysis": {
    "emotion": "熱狂的/落ち着いた/エネルギッシュ",
    "pace": "速い/中程度/遅い",
    "clarity": "優秀/良い/平均/悪い"
  }
}

JSONのみで応答し、追加のテキストは含めないでください。
  `,
  ko: `
커뮤니케이션 전문가로서 이 비디오 트랜스크립션을 한국어로 분석하세요.

트랜스크립션: {text}

다음 형식으로 구조화된 분석을 JSON으로 제공하세요:
{
  "summary": "2-3문장 요약",
  "key_topics": ["주제1", "주제2", "주제3"],
  "sentiment": "긍정적/중립적/부정적",
  "sentiment_score": 0.8,
  "communication_advice": ["조언1", "조언2"],
  "tone_analysis": {
    "emotion": "열정적/차분한/에너제틱",
    "pace": "빠름/보통/느림",
    "clarity": "우수함/좋음/보통/나쁨"
  }
}

JSON으로만 응답하고 추가 텍스트를 포함하지 마세요.
  `
};

const SYSTEM_MESSAGES = {
  fr: "Vous êtes un expert en analyse de communication. Répondez UNIQUEMENT en JSON valide, sans texte supplémentaire.",
  en: "You are a communication analysis expert. Respond ONLY with valid JSON, without any additional text.",
  es: "Eres un experto en análisis de comunicación. Responde ÚNICAMENTE en JSON válido, sin texto adicional.",
  de: "Sie sind ein Experte für Kommunikationsanalyse. Antworten Sie NUR mit gültigem JSON, ohne zusätzlichen Text.",
  it: "Sei un esperto di analisi della comunicazione. Rispondi SOLO con JSON valido, senza testo aggiuntivo.",
  pt: "Você é um especialista em análise de comunicação. Responda APENAS com JSON válido, sem texto adicional.",
  ru: "Вы эксперт по анализу коммуникации. Отвечайте ТОЛЬКО действительным JSON, без дополнительного текста.",
  zh: "您是沟通分析专家。仅用有效的JSON回答，不要添加任何其他文本。",
  ja: "あなたはコミュニケーション分析の専門家です。有効なJSONのみで応答し、追加のテキストは含めないでください。",
  ko: "당신은 커뮤니케이션 분석 전문가입니다. 유효한 JSON으로만 응답하고 추가 텍스트를 포함하지 마세요."
};

// ✅ LANGUAGES SUPPORTED FOR ANALYSIS
const SUPPORTED_ANALYSIS_LANGUAGES = {
  'fr': 'French',
  'en': 'English', 
  'es': 'Spanish',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean'
};

Deno.serve(async (req) => {
  console.log("🔍 Fonction analyze-transcription (multilingue) appelée");

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let videoId = null;

  try {
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("📦 Corps reçu:", { 
        videoId: requestBody.videoId,
        transcriptionLength: requestBody.transcriptionText?.length,
        userId: requestBody.userId,
        transcriptionLanguage: requestBody.transcriptionLanguage
      });
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Corps de requête JSON invalide',
          details: parseError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { videoId: vidId, transcriptionText, userId, transcriptionLanguage } = requestBody;
    videoId = vidId;

    if (!videoId) {
      console.error("❌ videoId manquant");
      return new Response(
        JSON.stringify({ error: 'Paramètre videoId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let textToAnalyze = transcriptionText;
    if (!textToAnalyze) {
      console.log("📄 Fetch transcription depuis DB...");
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: video } = await supabase
        .from('videos')
        .select('transcription_text, transcription_language')
        .eq('id', videoId)
        .single();
      textToAnalyze = video?.transcription_text;
    }

    if (!textToAnalyze?.trim()) {
      console.error("❌ transcriptionText manquant");
      return new Response(
        JSON.stringify({ error: 'Paramètre transcriptionText requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuration Supabase manquante');
    }

    if (!openaiApiKey) {
      throw new Error('Clé API OpenAI manquante');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Vérification que la vidéo existe
    console.log(`🔍 Recherche vidéo: ${videoId}`);
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError) {
      console.error("❌ Erreur recherche vidéo:", videoError);
      throw new Error(`Vidéo non trouvée: ${videoError.message}`);
    }

    console.log("✅ Vidéo trouvée, mise à jour statut ANALYZING");

    // Mettre à jour le statut
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.ANALYZING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (updateError) {
      console.error("❌ Erreur mise à jour statut:", updateError);
      throw new Error(`Erreur mise à jour statut: ${updateError.message}`);
    }

    console.log(`🔍 Début analyse pour video ${videoId}, longueur texte: ${textToAnalyze.length}`);

    // ✅ ANALYSE MULTILINGUE
    const analysisLanguage = transcriptionLanguage || video?.transcription_language || 'fr';
    const systemMessage = SYSTEM_MESSAGES[analysisLanguage] || SYSTEM_MESSAGES['en'];
    const analysisPromptTemplate = ANALYSIS_PROMPTS[analysisLanguage] || ANALYSIS_PROMPTS['en'];
    
    const analysisPrompt = analysisPromptTemplate.replace('{text}', textToAnalyze.substring(0, 8000));

    console.log(`🤖 Appel OpenAI en ${analysisLanguage} (${SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown'})...`);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    console.log("✅ Réponse OpenAI reçue");

    const analysisText = completion.choices[0].message.content;
    console.log("📄 Réponse OpenAI:", analysisText.substring(0, 200) + "...");

    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisText);
      console.log("✅ Analyse JSON parsée avec succès");
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON, utilisation fallback:", parseError);
      analysisResult = createBasicAnalysis(textToAnalyze, analysisLanguage);
    }

    // Ajouter la langue d'analyse aux résultats
    analysisResult.analysis_language = analysisLanguage;
    analysisResult.analysis_language_name = SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown';

    // Calculer le score IA
    const aiScore = calculateAIScore(analysisResult);
    console.log(`📊 Score IA calculé: ${aiScore}`);

    // Extraire les insights de matching
    console.log("🔍 Extraction des insights de matching...");
    const matchingInsights = await extractMatchingInsights(analysisResult, textToAnalyze, analysisLanguage);
    console.log("✅ Insights de matching extraits:", matchingInsights);

    // VÉRIFIER SI LA COLONNE EXISTE AVANT DE METTRE À JOUR
    console.log("🔍 Vérification de l'existence des colonnes...");
    
    // D'abord, essayer avec matching_insights
    let updatePayload = {
      status: VIDEO_STATUS.ANALYZED,
      analysis: analysisResult,
      ai_score: aiScore,
      updated_at: new Date().toISOString(),
      analysis_language: analysisLanguage
    };

    try {
      // Tenter d'ajouter matching_insights seulement si la colonne existe
      const testUpdate = await supabase
        .from('videos')
        .update({ ...updatePayload, matching_insights: matchingInsights })
        .eq('id', videoId);

      if (testUpdate.error) {
        console.log("⚠️ Colonne matching_insights non disponible, mise à jour sans cette colonne");
        // Réessayer sans matching_insights
        const { error: finalUpdateError } = await supabase
          .from('videos')
          .update(updatePayload)
          .eq('id', videoId);

        if (finalUpdateError) throw finalUpdateError;
      }
    } catch (updateError) {
      console.error("❌ Erreur sauvegarde analyse:", updateError);
      // Continuer même si matching_insights échoue
      const { error: basicUpdateError } = await supabase
        .from('videos')
        .update(updatePayload)
        .eq('id', videoId);
      
      if (basicUpdateError) throw basicUpdateError;
    }

    console.log("🎉 Analyse multilingue terminée avec succès");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analyse multilingue terminée avec succès',
        videoId: videoId,
        aiScore: aiScore,
        matchingInsights: matchingInsights,
        analysisLanguage: analysisLanguage,
        analysisLanguageName: SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("💥 Erreur générale dans analyze-transcription:", error);

    if (videoId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          await supabase
            .from('videos')
            .update({ 
              status: VIDEO_STATUS.FAILED,
              error_message: error.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
          console.log("📝 Statut erreur sauvegardé");
        }
      } catch (updateError) {
        console.error("❌ Erreur sauvegarde statut erreur:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de l\'analyse multilingue', 
        details: error.message,
        stack: error.stack,
        supportedLanguages: Object.keys(SUPPORTED_ANALYSIS_LANGUAGES)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// FONCTION POUR EXTRAIRE LES INSIGHTS DE MATCHING (MULTILINGUE)
async function extractMatchingInsights(analysis, transcription, language = 'fr') {
  
  // ✅ DICTIONNAIRE MULTILINGUE POUR LES STYLES D'APPRENTISSAGE
  const LEARNING_STYLES = {
    fr: {
      pratique: 'pratique',
      réflexif: 'réflexif',
      équilibré: 'équilibré'
    },
    en: {
      pratique: 'practical',
      réflexif: 'reflective', 
      équilibré: 'balanced'
    },
    es: {
      pratique: 'práctico',
      réflexif: 'reflexivo',
      équilibré: 'equilibrado'
    },
    de: {
      pratique: 'praktisch',
      réflexif: 'reflektierend',
      équilibré: 'ausgeglichen'
    }
  };

  const learningStyleMap = LEARNING_STYLES[language] || LEARNING_STYLES.fr;

  return {
    communication_style: analysis.tone_analysis?.emotion || 'neutre',
    expertise_areas: analysis.key_topics || [],
    sentiment_profile: analysis.sentiment,
    key_strengths: analysis.communication_advice || [],
    potential_mentor_topics: extractMentorTopics(analysis, transcription),
    learning_preferences: extractLearningStyle(analysis, language, learningStyleMap),
    analysis_language: language
  };
}

function extractMentorTopics(analysis, transcription) {
  const topics = analysis.key_topics || [];
  return topics.filter(topic => 
    transcription.toLowerCase().includes(topic.toLowerCase()) &&
    topic.length > 5
  ).slice(0, 3);
}

function extractLearningStyle(analysis, language = 'fr', styleMap = null) {
  const style = analysis.tone_analysis?.pace;
  
  if (!styleMap) {
    styleMap = {
      pratique: 'pratique',
      réflexif: 'réflexif', 
      équilibré: 'équilibré'
    };
  }

  if (style === 'rapide' || style === 'fast' || style === 'rápido' || style === 'schnell') {
    return styleMap.pratique;
  }
  if (style === 'lent' || style === 'slow' || style === 'lento' || style === 'langsam') {
    return styleMap.réflexif;
  }
  return styleMap.équilibré;
}

function createBasicAnalysis(text, language = 'fr') {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const sentenceCount = text.split(/[.!?]+/).length - 1;
  
  // ✅ MESSAGES D'ANALYSE BASIQUE MULTILINGUES
  const BASIC_ANALYSIS_TEXTS = {
    fr: {
      summary: `Analyse basique: ${wordCount} mots, ${sentenceCount} phrases.`,
      topics: ["communication", "partage", "expression"],
      advice: [
        "Continuez à pratiquer régulièrement",
        "Variez le débit pour maintenir l'attention"
      ]
    },
    en: {
      summary: `Basic analysis: ${wordCount} words, ${sentenceCount} sentences.`,
      topics: ["communication", "sharing", "expression"],
      advice: [
        "Continue practicing regularly",
        "Vary your pace to maintain attention"
      ]
    },
    es: {
      summary: `Análisis básico: ${wordCount} palabras, ${sentenceCount} frases.`,
      topics: ["comunicación", "compartir", "expresión"],
      advice: [
        "Continúa practicando regularmente",
        "Varía tu ritmo para mantener la atención"
      ]
    },
    de: {
      summary: `Grundlegende Analyse: ${wordCount} Wörter, ${sentenceCount} Sätze.`,
      topics: ["Kommunikation", "Teilen", "Ausdruck"],
      advice: [
        "Üben Sie regelmäßig weiter",
        "Variieren Sie Ihr Tempo, um die Aufmerksamkeit aufrechtzuerhalten"
      ]
    }
  };

  const texts = BASIC_ANALYSIS_TEXTS[language] || BASIC_ANALYSIS_TEXTS.fr;

  return {
    summary: texts.summary,
    key_topics: texts.topics,
    sentiment: "neutre",
    sentiment_score: 0.5,
    communication_advice: texts.advice,
    tone_analysis: {
      emotion: "neutre",
      pace: "modéré",
      clarity: "bonne"
    },
    analysis_language: language
  };
}

function calculateAIScore(analysisResult) {
  let score = 7.0;
  if (analysisResult.summary && analysisResult.summary.length > 30) score += 0.5;
  if (analysisResult.key_topics && analysisResult.key_topics.length >= 2) score += 0.5;
  if (analysisResult.communication_advice && analysisResult.communication_advice.length > 0) score += 0.5;
  if (analysisResult.tone_analysis) score += 0.5;
  if (analysisResult.sentiment_score > 0.6) score += 0.5;
  return Math.min(Math.max(score, 0), 10.0);
}
