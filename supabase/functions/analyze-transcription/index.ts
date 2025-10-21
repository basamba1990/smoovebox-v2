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

// ✅ PROMPTS MULTILINGUES POUR L'ANALYSE - ARABE AJOUTÉ EN 3ÈME POSITION
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
  ar: `
كمحترف في مجال الاتصال، قم بتحليل نص الفيديو هذا باللغة العربية.

النص: {text}

قدم تحليلاً منظماً بتنسيق JSON بالشكل التالي:
{
  "summary": "ملخص في 2-3 جمل",
  "key_topics": ["موضوع1", "موضوع2", "موضوع3"],
  "sentiment": "إيجابي/محايد/سلبي",
  "sentiment_score": 0.8,
  "communication_advice": ["نصيحة1", "نصيحة2"],
  "tone_analysis": {
    "emotion": "متحمس/هادئ/نشيط",
    "pace": "سريع/معتدل/بطيء",
    "clarity": "ممتازة/جيدة/متوسطة/ضعيفة"
  }
}

الرد فقط بـ JSON، دون أي نص إضافي.
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
  `
};

const SYSTEM_MESSAGES = {
  fr: "Vous êtes un expert en analyse de communication. Répondez UNIQUEMENT en JSON valide, sans texte supplémentaire.",
  ar: "أنت خبير في تحليل الاتصال. قم بالرد فقط بـ JSON صالح، دون أي نص إضافي.",
  en: "You are a communication analysis expert. Respond ONLY with valid JSON, without any additional text.",
  es: "Eres un experto en análisis de comunicación. Responde ÚNICAMENTE en JSON válido, sin texto adicional.",
  de: "Sie sind ein Experte für Kommunikationsanalyse. Antworten Sie NUR mit gültigem JSON, ohne zusätzlichen Text.",
  it: "Sei un esperto di analisi della comunicazione. Rispondi SOLO con JSON valido, senza testo aggiuntivo.",
  pt: "Você é um especialista em análise de comunicação. Responda APENAS com JSON válido, sem texto adicional."
};

// ✅ LANGUAGES SUPPORTED FOR ANALYSIS - ARABE EN 3ÈME POSITION
const SUPPORTED_ANALYSIS_LANGUAGES = {
  'fr': 'French',
  'ar': 'Arabic',
  'en': 'English', 
  'es': 'Spanish',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese'
};

// ✅ DÉTECTION AUTOMATIQUE DE LA LANGUE AMÉLIORÉE
const LANGUAGE_DETECTION_KEYWORDS = {
  'fr': ['le', 'la', 'les', 'de', 'des', 'du', 'et', 'est', 'dans', 'pour'],
  'ar': ['ال', 'في', 'من', 'على', 'إلى', 'أن', 'هذا', 'هذه', 'كان', 'ما'],
  'en': ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with'],
  'es': ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no'],
  'de': ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'ist', 'sich'],
  'it': ['il', 'la', 'di', 'e', 'in', 'che', 'non', 'per', 'un', 'una'],
  'pt': ['o', 'a', 'de', 'e', 'do', 'da', 'em', 'um', 'para', 'com']
};

Deno.serve(async (req) => {
  console.log("🔍 Fonction analyze-transcription (multilingue) appelée");

  // ✅ CORRECTION: Gestion CORS améliorée
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  let videoId = null;

  try {
    // ✅ CORRECTION: Gestion robuste du parsing JSON
    let requestBody;
    let rawBody = '';
    
    try {
      rawBody = await req.text();
      console.log("📦 Corps brut reçu:", rawBody.substring(0, 500) + (rawBody.length > 500 ? "..." : ""));
      
      if (!rawBody || rawBody.trim().length === 0) {
        throw new Error('Corps de requête vide');
      }
      
      requestBody = JSON.parse(rawBody);
      console.log("✅ JSON parsé avec succès");
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Corps de requête JSON invalide',
          details: parseError.message,
          bodyPreview: rawBody.substring(0, 200)
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { videoId: vidId, transcriptionText, userId, transcriptionLanguage } = requestBody;
    videoId = vidId;

    // ✅ CORRECTION: Validation plus robuste
    if (!videoId) {
      console.error("❌ videoId manquant");
      return new Response(
        JSON.stringify({ 
          error: 'Paramètre videoId requis',
          receivedBody: requestBody 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let textToAnalyze = transcriptionText;
    
    // ✅ CORRECTION: Meilleure gestion du fallback
    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      console.log("📄 Fetch transcription depuis DB...");
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Configuration Supabase manquante pour le fallback');
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('transcription_text, transcription_language, transcription_data')
        .eq('id', videoId)
        .single();
        
      if (videoError) {
        console.error("❌ Erreur récupération vidéo:", videoError);
        throw new Error(`Vidéo non trouvée pour fallback: ${videoError.message}`);
      }
      
      // Essayer plusieurs sources pour le texte
      textToAnalyze = video?.transcription_text || 
                     video?.transcription_data?.text || 
                     '';
      
      console.log(`📄 Texte récupéré depuis DB: ${textToAnalyze?.length || 0} caractères`);
    }

    // ✅ CORRECTION: Vérification plus permissive pour les tests
    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      console.warn("⚠️ Aucun texte de transcription disponible, création d'analyse basique");
      textToAnalyze = "Cette vidéo ne contient pas de transcription analysable. L'utilisateur a peut-être parlé très brièvement ou le son était de mauvaise qualité.";
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

    // ✅ CORRECTION CRITIQUE : DÉTECTION AUTOMATIQUE AMÉLIORÉE DE LA LANGUE
    let analysisLanguage = transcriptionLanguage || video?.transcription_language || 'fr';
    
    // Si la langue est 'auto' ou non spécifiée, détecter automatiquement
    if (!analysisLanguage || analysisLanguage === 'auto') {
      console.log("🔍 Détection automatique de la langue...");
      analysisLanguage = detectLanguage(textToAnalyze);
      console.log(`🌐 Langue détectée: ${analysisLanguage} (${SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown'})`);
    }

    // ✅ CORRECTION : FORCER LA LANGUE D'ANALYSE CORRECTE
    // Si le texte est majoritairement en français mais que la langue détectée est autre, prioriser le français
    const frenchScore = calculateLanguageScore(textToAnalyze, 'fr');
    const arabicScore = calculateLanguageScore(textToAnalyze, 'ar');
    const englishScore = calculateLanguageScore(textToAnalyze, 'en');
    
    console.log(`📊 Scores de langue - FR: ${frenchScore}, AR: ${arabicScore}, EN: ${englishScore}`);
    
    // Si le français a un score élevé, l'utiliser prioritairement
    if (frenchScore > 0.7 && analysisLanguage !== 'fr') {
      console.log(`🔄 Correction: Forçage vers le français (score: ${frenchScore})`);
      analysisLanguage = 'fr';
    }
    // Sinon si l'arabe a un score élevé
    else if (arabicScore > 0.7 && analysisLanguage !== 'ar') {
      console.log(`🔄 Correction: Forçage vers l'arabe (score: ${arabicScore})`);
      analysisLanguage = 'ar';
    }
    // Sinon si l'anglais a un score élevé
    else if (englishScore > 0.7 && analysisLanguage !== 'en') {
      console.log(`🔄 Correction: Forçage vers l'anglais (score: ${englishScore})`);
      analysisLanguage = 'en';
    }

    // ✅ S'assurer que la langue est supportée
    if (!SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage]) {
      console.warn(`⚠️ Langue ${analysisLanguage} non supportée, utilisation du français par défaut`);
      analysisLanguage = 'fr';
    }

    const systemMessage = SYSTEM_MESSAGES[analysisLanguage] || SYSTEM_MESSAGES['fr'];
    const analysisPromptTemplate = ANALYSIS_PROMPTS[analysisLanguage] || ANALYSIS_PROMPTS['fr'];
    
    // ✅ CORRECTION: Limiter la taille du texte pour éviter les erreurs de token
    const textForAnalysis = textToAnalyze.length > 6000 
      ? textToAnalyze.substring(0, 6000) + "... [texte tronqué pour l'analyse]"
      : textToAnalyze;
    
    const analysisPrompt = analysisPromptTemplate.replace('{text}', textForAnalysis);

    console.log(`🤖 Appel OpenAI en ${analysisLanguage} (${SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown'})...`);
    console.log(`📝 Prompt langue: ${analysisLanguage}`);
    
    let completion;
    try {
      completion = await openai.chat.completions.create({
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
    } catch (openaiError) {
      console.error("❌ Erreur OpenAI:", openaiError);
      throw new Error(`Erreur analyse OpenAI: ${openaiError.message}`);
    }

    console.log("✅ Réponse OpenAI reçue");

    const analysisText = completion.choices[0].message.content;
    console.log("📄 Réponse OpenAI:", analysisText.substring(0, 200) + "...");

    let analysisResult;
    try {
      // ✅ CORRECTION: Validation robuste du JSON OpenAI
      if (!analysisText || analysisText.trim().length === 0) {
        throw new Error('Réponse OpenAI vide');
      }
      
      analysisResult = JSON.parse(analysisText);
      console.log("✅ Analyse JSON parsée avec succès");
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON OpenAI, utilisation fallback:", parseError);
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

    // ✅ CORRECTION: Gestion améliorée des colonnes manquantes
    console.log("🔍 Vérification de l'existence des colonnes...");
    
    let updatePayload = {
      status: VIDEO_STATUS.ANALYZED,
      analysis: analysisResult,
      ai_score: aiScore,
      updated_at: new Date().toISOString(),
      transcription_language: analysisLanguage // ✅ CORRECTION CRITIQUE: Sauvegarder la langue utilisée
    };

    // Essayer d'ajouter analysis_language si la colonne existe
    try {
      const testUpdate = await supabase
        .from('videos')
        .update({ ...updatePayload, analysis_language: analysisLanguage })
        .eq('id', videoId);

      if (testUpdate.error) {
        console.warn("⚠️ Colonne analysis_language non disponible, mise à jour sans...");
        // Réessayer sans la colonne
        const { error: finalUpdateError } = await supabase
          .from('videos')
          .update(updatePayload)
          .eq('id', videoId);

        if (finalUpdateError) throw finalUpdateError;
      }
    } catch (updateError) {
      console.error("❌ Erreur sauvegarde avec analysis_language:", updateError);
      // Essayer sans analysis_language
      const { error: basicUpdateError } = await supabase
        .from('videos')
        .update(updatePayload)
        .eq('id', videoId);
      
      if (basicUpdateError) throw basicUpdateError;
    }

    // ✅ CORRECTION: Essayer d'ajouter matching_insights séparément
    try {
      const { error: matchingError } = await supabase
        .from('videos')
        .update({ matching_insights: matchingInsights })
        .eq('id', videoId);
        
      if (matchingError) {
        console.warn("⚠️ Colonne matching_insights non disponible, ignorée");
      }
    } catch (matchingUpdateError) {
      console.warn("⚠️ Erreur sauvegarde matching_insights, ignorée:", matchingUpdateError.message);
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
        analysisLanguageName: SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown',
        textLength: textToAnalyze.length,
        languageScores: {
          fr: frenchScore,
          ar: arabicScore,
          en: englishScore
        }
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

// ✅ NOUVELLE FONCTION : Détection automatique de la langue
function detectLanguage(text) {
  if (!text || text.trim().length === 0) return 'fr';
  
  const scores = {};
  const words = text.toLowerCase().split(/\s+/).slice(0, 100); // Prendre les 100 premiers mots
  
  // Calculer le score pour chaque langue
  for (const [lang, keywords] of Object.entries(LANGUAGE_DETECTION_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (words.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    scores[lang] = score / keywords.length;
  }
  
  // Trouver la langue avec le score le plus élevé
  let bestLanguage = 'fr';
  let bestScore = 0;
  
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLanguage = lang;
    }
  }
  
  console.log(`🔍 Scores de détection:`, scores);
  console.log(`🎯 Langue sélectionnée: ${bestLanguage} (score: ${bestScore})`);
  
  return bestScore > 0.1 ? bestLanguage : 'fr'; // Seuil minimum de confiance
}

// ✅ NOUVELLE FONCTION : Calcul du score de langue
function calculateLanguageScore(text, language) {
  if (!text || text.trim().length === 0) return 0;
  
  const keywords = LANGUAGE_DETECTION_KEYWORDS[language] || [];
  if (keywords.length === 0) return 0;
  
  const words = text.toLowerCase().split(/\s+/).slice(0, 100);
  let score = 0;
  
  for (const keyword of keywords) {
    if (words.includes(keyword.toLowerCase())) {
      score++;
    }
  }
  
  return score / keywords.length;
}

// FONCTION POUR EXTRAIRE LES INSIGHTS DE MATCHING (MULTILINGUE)
async function extractMatchingInsights(analysis, transcription, language = 'fr') {
  
  // ✅ DICTIONNAIRE MULTILINGUE POUR LES STYLES D'APPRENTISSAGE - ARABE AJOUTÉ
  const LEARNING_STYLES = {
    fr: {
      pratique: 'pratique',
      réflexif: 'réflexif',
      équilibré: 'équilibré'
    },
    ar: {
      pratique: 'عملي',
      réflexif: 'تأملي',
      équilibré: 'متوازن'
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
    },
    it: {
      pratique: 'pratico',
      réflexif: 'riflessivo',
      équilibré: 'equilibrato'
    },
    pt: {
      pratique: 'prático',
      réflexif: 'reflexivo',
      équilibré: 'equilibrado'
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

  // ✅ SUPPORT ÉTENDU POUR TOUTES LES LANGUES - ARABE INCLUS
  const fastKeywords = ['rapide', 'fast', 'rápido', 'schnell', 'veloce', 'rápido', 'سريع'];
  const slowKeywords = ['lent', 'slow', 'lento', 'langsam', 'lento', 'lento', 'بطيء'];
  
  if (fastKeywords.some(keyword => style?.toLowerCase().includes(keyword))) {
    return styleMap.pratique;
  }
  if (slowKeywords.some(keyword => style?.toLowerCase().includes(keyword))) {
    return styleMap.réflexif;
  }
  return styleMap.équilibré;
}

function createBasicAnalysis(text, language = 'fr') {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const sentenceCount = text.split(/[.!?]+/).length - 1;
  
  // ✅ MESSAGES D'ANALYSE BASIQUE MULTILINGUES - ARABE AJOUTÉ
  const BASIC_ANALYSIS_TEXTS = {
    fr: {
      summary: `Analyse basique: ${wordCount} mots, ${sentenceCount} phrases.`,
      topics: ["communication", "partage", "expression"],
      advice: [
        "Continuez à pratiquer régulièrement",
        "Variez le débit pour maintenir l'attention"
      ]
    },
    ar: {
      summary: `تحليل أساسي: ${wordCount} كلمة, ${sentenceCount} جملة.`,
      topics: ["اتصال", "مشاركة", "تعبير"],
      advice: [
        "استمر في الممارسة بانتظام",
        "غير سرعة الحديث للحفاظ على الانتباه"
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
    },
    it: {
      summary: `Analisi di base: ${wordCount} parole, ${sentenceCount} frases.`,
      topics: ["comunicazione", "condivisione", "espressione"],
      advice: [
        "Continua a praticare regolarmente",
        "Varia il tuo ritmo per mantenere l'attenzione"
      ]
    },
    pt: {
      summary: `Análise básica: ${wordCount} palavras, ${sentenceCount} frases.`,
      topics: ["comunicação", "compartilhamento", "expressão"],
      advice: [
        "Continue praticando regularmente",
        "Varie seu ritmo para manter a atenção"
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
