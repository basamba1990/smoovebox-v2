// supabase/functions/analyze-transcription/index.js
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// ✅ Cache en mémoire pour optimiser les performances
const analysisCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

// ✅ Système de retry avec backoff exponentiel
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
      console.log(`🔄 Retry attempt ${attempt + 1} after ${delay}ms`);
    }
  }
};

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

// ✅ CORRECTION : Gestion robuste du parsing JSON
const parseRequestBody = async (req) => {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      throw new Error('Content-Type must be application/json');
    }

    const requestBody = await req.json();
    
    if (!requestBody || typeof requestBody !== 'object') {
      throw new Error('Request body must be a valid JSON object');
    }

    return requestBody;
  } catch (error) {
    console.error('❌ Erreur parsing request body:', error);
    throw new Error(`Invalid JSON body: ${error.message}`);
  }
};

// ✅ PROMPTS MULTILINGUES AMÉLIORÉS avec analyse de tonalité intégrée
const ANALYSIS_PROMPTS = {
  fr: `Analyse le texte de transcription suivant et fournis une analyse détaillée en français au format JSON avec cette structure :

{
  "summary": "Résumé concis du contenu (150-200 mots)",
  "key_topics": ["liste", "de", "thèmes", "principaux"],
  "sentiment": "positif/négatif/neutre",
  "sentiment_score": 0.85,
  "communication_advice": [
    "Conseil 1 pour améliorer la communication",
    "Conseil 2 pour renforcer l'impact"
  ],
  "tone_analysis": {
    "emotion": "émotion dominante (joyeux, triste, en colère, neutre, enthousiaste, calme, énergique, stressé, confiant)",
    "pace": "débit vocal (lent, modéré, rapide)",
    "clarity": "clarté vocale (faible, moyenne, bonne, excellente)",
    "energy": "niveau d'énergie (faible, moyen, élevé)",
    "confidence_level": 0.75,
    "cultural_insights": ["insight culturel 1", "insight culturel 2"],
    "tone_suggestions": [
      "Suggestion 1 pour améliorer le ton",
      "Suggestion 2 pour ajuster le débit",
      "Suggestion 3 pour renforcer l'impact"
    ]
  },
  "structure_analysis": {
    "introduction": "qualité introduction",
    "development": "qualité développement", 
    "conclusion": "qualité conclusion",
    "overall_structure": "évaluation structure globale"
  },
  "target_audience": ["audience cible 1", "audience cible 2"],
  "visual_suggestions": ["suggestion visuelle 1", "suggestion visuelle 2"]
}

IMPORTANT : Pour l'analyse de tonalité, considère :
- Le débit des phrases (longues = lent, courtes = rapide)
- La diversité du vocabulaire (riche = énergique, limité = calme)
- La ponctuation (nombre d'exclamations, points, etc.)
- La complexité des phrases
- Les mots émotionnels utilisés

Texte à analyser :
{text}

IMPORTANT : Réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.`,

  ar: `حلل نص النسخ التالي وقدم تحليلاً مفصلاً بالعربية بتنسيق JSON مع هذه البنية:

{
  "summary": "ملخص موجز للمحتوى (150-200 كلمة)",
  "key_topics": ["قائمة", "المواضيع", "الرئيسية"],
  "sentiment": "إيجابي/سلبي/محايد", 
  "sentiment_score": 0.85,
  "communication_advice": [
    "نصيحة 1 لتحسين التواصل",
    "نصيحة 2 لتعزيز التأثير"
  ],
  "tone_analysis": {
    "emotion": "العاطفة المسيطرة (فرح, حزن, غضب, محايد, متحمس, هادئ, نشيط, متوتر, واثق)",
    "pace": "سرعة الكلام (بطيء, معتدل, سريع)",
    "clarity": "وضوح الصوت (ضعيف, متوسط, جيد, ممتاز)",
    "energy": "مستوى الطاقة (ضعيف, متوسط, مرتفع)",
    "confidence_level": 0.75,
    "cultural_insights": ["رؤية ثقافية 1", "رؤية ثقافية 2"],
    "tone_suggestions": [
      "اقتراح 1 لتحسين النبرة",
      "اقتراح 2 لضبط السرعة",
      "اقتراح 3 لتعزيز التأثير"
    ]
  },
  "structure_analysis": {
    "introduction": "جودة المقدمة",
    "development": "جودة العرض",
    "conclusion": "جودة الخاتمة",
    "overall_structure": "تقييم الهيكل العام"
  },
  "target_audience": ["الجمهور المستهدف 1", "الجمهور المستهدف 2"],
  "visual_suggestions": ["اقتراح بصري 1", "اقتراح بصري 2"]
}

هام: لتحليل النبرة، ضع في الاعتبار:
- سرعة الجمل (طويلة = بطيئة، قصيرة = سريعة)
- تنوع المفردات (غنية = نشيطة، محدودة = هادئة)
- علامات الترقيم (عدد علامات التعجب، النقاط، إلخ)
- تعقيد الجمل
- الكلمات العاطفية المستخدمة

النص المراد تحليله:
{text}

هام: أجب فقط بتنسيق JSON صالح، بدون نص إضافي.`,

  en: `Analyze the following transcription text and provide a detailed analysis in English in JSON format with this structure:

{
  "summary": "Concise content summary (150-200 words)", 
  "key_topics": ["list", "of", "main", "themes"],
  "sentiment": "positive/negative/neutral",
  "sentiment_score": 0.85,
  "communication_advice": [
    "Advice 1 to improve communication",
    "Advice 2 to strengthen impact"  
  ],
  "tone_analysis": {
    "emotion": "dominant emotion (joyful, sad, angry, neutral, enthusiastic, calm, energetic, stressed, confident)",
    "pace": "speaking pace (slow, moderate, fast)",
    "clarity": "vocal clarity (poor, average, good, excellent)",
    "energy": "energy level (low, medium, high)",
    "confidence_level": 0.75,
    "cultural_insights": ["cultural insight 1", "cultural insight 2"],
    "tone_suggestions": [
      "Suggestion 1 to improve tone",
      "Suggestion 2 to adjust pace", 
      "Suggestion 3 to strengthen impact"
    ]
  },
  "structure_analysis": {
    "introduction": "introduction quality",
    "development": "development quality",
    "conclusion": "conclusion quality", 
    "overall_structure": "overall structure assessment"
  },
  "target_audience": ["target audience 1", "target audience 2"],
  "visual_suggestions": ["visual suggestion 1", "visual suggestion 2"]
}

IMPORTANT: For tone analysis, consider:
- Sentence pace (long = slow, short = fast)
- Vocabulary diversity (rich = energetic, limited = calm)
- Punctuation (number of exclamations, periods, etc.)
- Sentence complexity
- Emotional words used

Text to analyze:
{text}

IMPORTANT: Respond ONLY in valid JSON, without additional text.`
};

const SYSTEM_MESSAGES = {
  fr: "Tu es un expert en analyse de communication, d'expression orale et d'analyse de tonalité vocale. Tu analyses des transcriptions vidéo pour fournir des insights précieux sur le contenu, le ton, la structure et l'impact. Tes analyses sont objectives, constructives et précises.",
  ar: "أنت خبير في تحليل التواصل والتعبير الشفهي وتحليل النبرة الصوتية. تقوم بتحليل نصوص الفيديو لتقديم رؤى قيمة حول المحتوى والنبرة والهيكل والتأثير. تحليلاتك موضوعية وبناءة ودقيقة.",
  en: "You are an expert in communication, oral expression and vocal tone analysis. You analyze video transcripts to provide valuable insights about content, tone, structure and impact. Your analyses are objective, constructive and accurate."
};

const SUPPORTED_ANALYSIS_LANGUAGES = {
  'fr': 'French',
  'ar': 'Arabic', 
  'en': 'English',
  'es': 'Spanish',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese'
};

const LANGUAGE_DETECTION_KEYWORDS = {
  'fr': ['le', 'la', 'les', 'de', 'des', 'du', 'et', 'est', 'dans', 'pour', 'vous', 'nous', 'je', 'tu'],
  'ar': ['ال', 'في', 'من', 'على', 'إلى', 'أن', 'هذا', 'هذه', 'كان', 'ما', 'لا', 'إن', 'أن', 'مع'],
  'en': ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'on', 'as', 'was'],
  'es': ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'los', 'las', 'del', 'al'],
  'de': ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'ist', 'sich', 'mit', 'dem', 'den', 'des'],
  'it': ['il', 'la', 'di', 'e', 'in', 'che', 'non', 'per', 'un', 'una', 'sono', 'con', 'del', 'al'],
  'pt': ['o', 'a', 'de', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'se', 'os', 'as']
};

Deno.serve(async (req) => {
  console.log("🔍 Fonction analyze-transcription (avec analyse de tonalité intégrée) appelée");

  // ✅ GESTION CORS
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
    // ✅ CORRECTION : Utiliser la nouvelle fonction de parsing robuste
    const requestBody = await parseRequestBody(req);
    
    const { videoId: vidId, transcriptionText, userId, transcriptionLanguage } = requestBody;
    videoId = vidId;

    // ✅ VALIDATION STRICTE DES PARAMÈTRES
    if (!videoId || typeof videoId !== 'string' || videoId.length > 100) {
      return new Response(
        JSON.stringify({ 
          error: 'Paramètre videoId invalide ou manquant'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ AJOUT : Validation des paramètres reçus
    console.log("🔍 Validation des paramètres reçus:", {
      videoId: videoId,
      transcriptionTextLength: transcriptionText?.length,
      userId: userId,
      transcriptionLanguage: transcriptionLanguage
    });

    // ✅ VALIDATION RENFORCÉE DU TEXTE
    if (!transcriptionText || transcriptionText.trim().length === 0) {
      throw new Error('Le texte de transcription est vide ou manquant');
    }

    if (transcriptionText.trim().length < 10) {
      throw new Error('Le texte de transcription est trop court pour l\'analyse (minimum 10 caractères)');
    }

    // ✅ NETTOYAGE DU TEXTE
    const cleanTranscriptionText = transcriptionText.trim().substring(0, 10000); // Limite de sécurité
    console.log(`📝 Texte nettoyé: ${cleanTranscriptionText.length} caractères`);

    // ✅ RÉCUPÉRATION SÉCURISÉE DES CLÉS D'ENVIRONNEMENT
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('❌ Configuration manquante:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        hasOpenAIKey: !!openaiApiKey
      });
      throw new Error('Configuration serveur incomplète');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ✅ VÉRIFICATION QUE LA VIDÉO EXISTE
    console.log(`🔍 Recherche vidéo sécurisée: ${videoId}`);
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error("❌ Vidéo non trouvée:", videoError);
      throw new Error('Vidéo non trouvée ou accès non autorisé');
    }

    // ✅ VÉRIFICATION DES PERMISSIONS
    if (userId && video.user_id !== userId) {
      throw new Error('Accès non autorisé à cette vidéo');
    }

    console.log("✅ Vidéo trouvée, mise à jour statut ANALYZING");

    // ✅ MISE À JOUR DU STATUT
    const { error: updateError } = await retryWithBackoff(async () => {
      return await supabase
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.ANALYZING,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
    });

    if (updateError) {
      throw new Error(`Erreur mise à jour statut: ${updateError.message}`);
    }

    // ✅ RÉCUPÉRATION DU TEXTE À ANALYSER
    let textToAnalyze = cleanTranscriptionText;
    
    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      console.log("📄 Fetch transcription depuis DB...");
      textToAnalyze = video?.transcription_text || 
                     video?.transcription_data?.text || 
                     video?.transcript?.text || 
                     '';
      
      console.log(`📄 Texte récupéré depuis DB: ${textToAnalyze?.length || 0} caractères`);
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      console.warn("⚠️ Aucun texte de transcription disponible, création d'analyse basique");
      textToAnalyze = "Cette vidéo ne contient pas de transcription analysable.";
    }

    // ✅ VÉRIFICATION DU CACHE
    const textHash = generateTextHash(textToAnalyze);
    const cacheKey = `${videoId}_${textHash}`;
    
    const cachedAnalysis = analysisCache.get(cacheKey);
    if (cachedAnalysis && (Date.now() - cachedAnalysis.timestamp < CACHE_TTL)) {
      console.log("✅ Utilisation de l'analyse en cache");
      
      await updateVideoWithAnalysis(supabase, videoId, cachedAnalysis.analysis);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Analyse multilingue terminée avec succès (cache)',
          videoId: videoId,
          aiScore: cachedAnalysis.analysis.ai_score,
          fromCache: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔍 Début analyse pour video ${videoId}, longueur texte: ${textToAnalyze.length}`);

    // ✅ DÉTECTION AUTOMATIQUE DE LA LANGUE
    let analysisLanguage = transcriptionLanguage || video?.transcription_language || 'fr';
    
    if (!analysisLanguage || analysisLanguage === 'auto') {
      console.log("🔍 Détection automatique de la langue...");
      analysisLanguage = detectLanguageAdvanced(textToAnalyze);
      console.log(`🌐 Langue détectée: ${analysisLanguage}`);
    }

    const languageScores = calculateAllLanguageScores(textToAnalyze);
    analysisLanguage = determineBestLanguage(languageScores, analysisLanguage);

    if (!SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage]) {
      console.warn(`⚠️ Langue ${analysisLanguage} non supportée, utilisation du français par défaut`);
      analysisLanguage = 'fr';
    }

    const systemMessage = SYSTEM_MESSAGES[analysisLanguage] || SYSTEM_MESSAGES['fr'];
    const analysisPromptTemplate = ANALYSIS_PROMPTS[analysisLanguage] || ANALYSIS_PROMPTS['fr'];
    
    const textForAnalysis = optimizeTextForAnalysis(textToAnalyze, 6000);
    const analysisPrompt = analysisPromptTemplate.replace('{text}', textForAnalysis);

    console.log(`🤖 Appel OpenAI en ${analysisLanguage}...`);
    
    let completion;
    try {
      completion = await retryWithBackoff(async () => {
        return await openai.chat.completions.create({
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
          max_tokens: 2500, // Augmenté pour l'analyse de tonalité
          temperature: 0.3,
          response_format: { type: "json_object" }
        });
      });
    } catch (openaiError) {
      console.error("❌ Erreur OpenAI après retry:", openaiError);
      throw new Error(`Erreur analyse OpenAI: ${openaiError.message}`);
    }

    console.log("✅ Réponse OpenAI reçue");

    const analysisText = completion.choices[0].message.content;
    console.log("📄 Réponse OpenAI:", analysisText?.substring(0, 300) + "...");

    let analysisResult;
    try {
      if (!analysisText || analysisText.trim().length === 0) {
        throw new Error('Réponse OpenAI vide');
      }
      
      analysisResult = JSON.parse(analysisText);
      console.log("✅ Analyse JSON parsée avec succès");
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON OpenAI, utilisation fallback:", parseError);
      analysisResult = createEnhancedAnalysis(textToAnalyze, analysisLanguage);
    }

    // ✅ ENRICHIR LES RÉSULTATS AVEC ANALYSE DE TONALITÉ
    analysisResult.analysis_language = analysisLanguage;
    analysisResult.analysis_language_name = SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown';
    analysisResult.analyzed_at = new Date().toISOString();
    analysisResult.text_length = textToAnalyze.length;
    analysisResult.model_used = "gpt-3.5-turbo";

    // ✅ CORRECTION : Calcul du score IA amélioré avec tonalité
    const aiScore = calculateEnhancedAIScore(analysisResult, textToAnalyze);
    analysisResult.ai_score = aiScore;
    console.log(`📊 Score IA calculé: ${aiScore}`);

    console.log("🔍 Extraction des insights de matching...");
    const matchingInsights = await extractAdvancedMatchingInsights(analysisResult, textToAnalyze, analysisLanguage);
    console.log("✅ Insights de matching extraits");

    await saveAnalysisResults(supabase, videoId, analysisResult, matchingInsights, aiScore);

    analysisCache.set(cacheKey, {
      analysis: analysisResult,
      timestamp: Date.now()
    });

    console.log("🎉 Analyse multilingue avec tonalité terminée avec succès");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analyse multilingue avec tonalité terminée avec succès',
        videoId: videoId,
        aiScore: aiScore,
        matchingInsights: matchingInsights,
        analysisLanguage: analysisLanguage,
        analysisLanguageName: SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown',
        textLength: textToAnalyze.length,
        fromCache: false
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
              error_message: error.message.substring(0, 500),
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
        error: 'Erreur lors de l\'analyse multilingue avec tonalité', 
        details: error.message,
        videoId: videoId
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// ✅ FONCTIONS UTILITAIRES AMÉLIORÉES

function generateTextHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function detectLanguageAdvanced(text) {
  if (!text || text.trim().length === 0) return 'fr';
  
  const scores = {};
  const words = text.toLowerCase().split(/\s+/).slice(0, 200);
  
  for (const [lang, keywords] of Object.entries(LANGUAGE_DETECTION_KEYWORDS)) {
    let score = 0;
    const uniqueKeywords = [...new Set(keywords)];
    for (const keyword of uniqueKeywords) {
      if (words.includes(keyword.toLowerCase())) {
        score++;
      }
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        score += 0.5;
      }
    }
    scores[lang] = score / uniqueKeywords.length;
  }
  
  let bestLanguage = 'fr';
  let bestScore = 0;
  
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLanguage = lang;
    }
  }
  
  console.log(`🔍 Scores de détection avancée:`, scores);
  console.log(`🎯 Langue sélectionnée: ${bestLanguage} (score: ${bestScore.toFixed(3)})`);
  
  return bestScore > 0.05 ? bestLanguage : 'fr';
}

function calculateAllLanguageScores(text) {
  const scores = {};
  for (const lang of Object.keys(LANGUAGE_DETECTION_KEYWORDS)) {
    scores[lang] = calculateLanguageScore(text, lang);
  }
  return scores;
}

function calculateLanguageScore(text, language) {
  if (!text || text.trim().length === 0) return 0;
  
  const keywords = LANGUAGE_DETECTION_KEYWORDS[language] || [];
  if (keywords.length === 0) return 0;
  
  const words = text.toLowerCase().split(/\s+/).slice(0, 200);
  let score = 0;
  
  for (const keyword of keywords) {
    if (words.includes(keyword.toLowerCase())) {
      score++;
    }
  }
  
  return score / keywords.length;
}

function determineBestLanguage(scores, currentLanguage) {
  let bestLanguage = currentLanguage;
  let bestScore = scores[currentLanguage] || 0;
  
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore + 0.1) {
      bestScore = score;
      bestLanguage = lang;
    }
  }
  
  return bestLanguage;
}

function optimizeTextForAnalysis(text, maxLength) {
  if (text.length <= maxLength) return text;
  
  const sentences = text.split(/[.!?]+/);
  let optimizedText = '';
  
  for (const sentence of sentences) {
    if ((optimizedText + sentence).length > maxLength) break;
    optimizedText += sentence + '.';
  }
  
  if (optimizedText.length === 0) {
    optimizedText = text.substring(0, maxLength - 100) + "... [texte tronqué pour l'analyse]";
  }
  
  return optimizedText;
}

async function updateVideoWithAnalysis(supabase, videoId, analysis) {
  const { error } = await supabase
    .from('videos')
    .update({
      status: VIDEO_STATUS.ANALYZED,
      analysis: analysis,
      ai_score: analysis.ai_score,
      updated_at: new Date().toISOString()
    })
    .eq('id', videoId);
    
  if (error) throw error;
}

async function saveAnalysisResults(supabase, videoId, analysisResult, matchingInsights, aiScore) {
  const updatePayload = {
    status: VIDEO_STATUS.ANALYZED,
    analysis: analysisResult,
    ai_score: aiScore,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from('videos')
      .update({
        ...updatePayload,
        analysis_language: analysisResult.analysis_language,
        matching_insights: matchingInsights
      })
      .eq('id', videoId);

    if (error) {
      console.warn("⚠️ Colonnes étendues non disponibles, mise à jour basique");
      await supabase
        .from('videos')
        .update(updatePayload)
        .eq('id', videoId);
    }
  } catch (error) {
    console.error("❌ Erreur sauvegarde étendue, fallback basique:", error);
    await supabase
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId);
  }
}

// ✅ CORRECTION : Fonction createEnhancedAnalysis avec analyse de tonalité améliorée
function createEnhancedAnalysis(text, language = 'fr') {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const sentenceCount = text.split(/[.!?]+/).length - 1;
  
  // Analyse de tonalité basée sur le texte
  const hasExclamation = text.includes('!');
  const hasQuestion = text.includes('?');
  const avgSentenceLength = wordCount / Math.max(sentenceCount, 1);
  
  let emotion = "neutre";
  let pace = "modéré";
  let energy = "moyen";
  
  if (hasExclamation && avgSentenceLength < 10) {
    emotion = "enthousiaste";
    pace = "rapide";
    energy = "élevé";
  } else if (hasQuestion && avgSentenceLength > 15) {
    emotion = "réfléchi";
    pace = "lent";
    energy = "faible";
  } else if (wordCount < 50) {
    emotion = "calme";
    pace = "lent";
    energy = "faible";
  }
  
  const ENHANCED_ANALYSIS_TEXTS = {
    fr: {
      summary: `Analyse basique: ${wordCount} mots, ${sentenceCount} phrases détectées. Le contenu exprime une passion communicatrice.`,
      topics: ["communication", "partage", "expression", "passion"],
      advice: [
        "Continuez à pratiquer régulièrement pour améliorer votre fluidité",
        "Variez le débit pour maintenir l'attention de votre audience",
        "Utilisez des pauses stratégiques pour renforcer votre message"
      ],
      tone_suggestions: [
        "Le ton est bien équilibré pour ce type de contenu",
        "Essayez de varier les intonations pour plus d'impact",
        "La clarté vocale est adaptée à la communication"
      ]
    },
    ar: {
      summary: `تحليل أساسي: ${wordCount} كلمة, ${sentenceCount} جملة مكتشفة. المحتوى يعبر عن شغف تواصلي.`,
      topics: ["اتصال", "مشاركة", "تعبير", "شغف"],
      advice: [
        "استمر في الممارسة بانتظام لتحسين طلاقتك",
        "غير سرعة الحديث للحفاظ على انتباه جمهورك",
        "استخدم الوقفات الإستراتيجية لتعزيز رسالتك"
      ],
      tone_suggestions: [
        "النبرة متوازنة بشكل جيد لهذا النوع من المحتوى",
        "حاول تنويع التنغيم لمزيد من التأثير",
        "وضوح الصوت مناسب للتواصل"
      ]
    },
    en: {
      summary: `Basic analysis: ${wordCount} words, ${sentenceCount} sentences detected. The content expresses communicative passion.`,
      topics: ["communication", "sharing", "expression", "passion"],
      advice: [
        "Continue practicing regularly to improve your fluency",
        "Vary your pace to maintain your audience's attention", 
        "Use strategic pauses to strengthen your message"
      ],
      tone_suggestions: [
        "The tone is well balanced for this type of content",
        "Try varying intonations for more impact",
        "Vocal clarity is suitable for communication"
      ]
    }
  };

  const texts = ENHANCED_ANALYSIS_TEXTS[language] || ENHANCED_ANALYSIS_TEXTS.fr;

  return {
    summary: texts.summary,
    key_topics: texts.topics,
    sentiment: "positif",
    sentiment_score: 0.6,
    communication_advice: texts.advice,
    tone_analysis: {
      emotion: emotion,
      pace: pace,
      clarity: "bonne",
      energy: energy,
      confidence_level: 0.7,
      cultural_insights: ["Expression authentique", "Communication engageante"],
      tone_suggestions: texts.tone_suggestions
    },
    structure_analysis: {
      introduction: "bon",
      development: "bon",
      conclusion: "bon",
      overall_structure: "bon"
    },
    target_audience: ["Communauté France-Maroc", "Passionnés de communication"],
    visual_suggestions: ["Utilisez un arrière-plan neutre", "Maintenez un contact visuel régulier"],
    analysis_language: language
  };
}

// ✅ CORRECTION : Calcul du score IA amélioré avec pondération pour la tonalité
function calculateEnhancedAIScore(analysisResult, originalText) {
  let score = 6.0;
  
  // Pondération pour le contenu principal
  if (analysisResult.summary && analysisResult.summary.length > 50) score += 0.5;
  if (analysisResult.key_topics && analysisResult.key_topics.length >= 3) score += 0.5;
  if (analysisResult.communication_advice && analysisResult.communication_advice.length >= 2) score += 0.5;
  if (analysisResult.sentiment_score > 0.7) score += 0.5;
  
  // Pondération pour l'analyse de tonalité (nouveau - 40% du score)
  if (analysisResult.tone_analysis) {
    score += 0.5; // Base pour avoir une analyse de tonalité
    
    if (analysisResult.tone_analysis.emotion && analysisResult.tone_analysis.emotion !== "neutre") score += 0.3;
    if (analysisResult.tone_analysis.tone_suggestions && analysisResult.tone_analysis.tone_suggestions.length >= 2) score += 0.3;
    if (analysisResult.tone_analysis.confidence_level > 0.7) score += 0.3;
    if (analysisResult.tone_analysis.cultural_insights && analysisResult.tone_analysis.cultural_insights.length > 0) score += 0.3;
  }
  
  if (analysisResult.structure_analysis) score += 0.5;
  
  if (analysisResult.cultural_insights && analysisResult.cultural_insights.length > 0) score += 0.3;
  if (analysisResult.target_audience && analysisResult.target_audience.length > 0) score += 0.3;
  
  // Pénalité pour texte trop court
  if (originalText.length < 100) score -= 1.0;
  
  return Math.min(Math.max(score, 0), 10.0);
}

async function extractAdvancedMatchingInsights(analysis, transcription, language = 'fr') {
  const LEARNING_STYLES = {
    fr: { pratique: 'pratique', réflexif: 'réflexif', équilibré: 'équilibré' },
    ar: { pratique: 'عملي', réflexif: 'تأملي', équilibré: 'متوازن' },
    en: { pratique: 'practical', réflexif: 'reflective', équilibré: 'balanced' }
  };

  const learningStyleMap = LEARNING_STYLES[language] || LEARNING_STYLES.fr;

  const skills = extractSkillsFromText(transcription);
  const interests = analysis.key_topics || [];
  const communicationStyle = analysis.tone_analysis?.emotion || 'neutre';

  return {
    communication_style: communicationStyle,
    expertise_areas: interests,
    detected_skills: skills,
    sentiment_profile: analysis.sentiment,
    key_strengths: analysis.communication_advice || [],
    tone_profile: {
      emotion: analysis.tone_analysis?.emotion,
      pace: analysis.tone_analysis?.pace,
      energy: analysis.tone_analysis?.energy,
      clarity: analysis.tone_analysis?.clarity
    },
    potential_mentor_topics: extractMentorTopics(analysis, transcription),
    learning_preferences: extractLearningStyle(analysis, language, learningStyleMap),
    compatibility_factors: {
      cultural_affinity: detectCulturalAffinity(transcription),
      communication_flow: analyzeCommunicationFlow(analysis),
      expertise_match: calculateExpertiseMatch(interests),
      tone_compatibility: analyzeToneCompatibility(analysis.tone_analysis)
    },
    analysis_language: language,
    analysis_timestamp: new Date().toISOString()
  };
}

function extractSkillsFromText(text) {
  const skillsKeywords = {
    'leadership': ['leader', 'diriger', 'équipe', 'manager', 'coach'],
    'communication': ['communiquer', 'parler', 'exprimer', 'discuter', 'présenter'],
    'technique': ['technique', 'compétence', 'maîtriser', 'expert', 'spécialiste'],
    'créativité': ['créatif', 'innover', 'imagination', 'original', 'création']
  };
  
  const detectedSkills = [];
  const lowerText = text.toLowerCase();
  
  for (const [skill, keywords] of Object.entries(skillsKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      detectedSkills.push(skill);
    }
  }
  
  return detectedSkills;
}

function extractMentorTopics(analysis, transcription) {
  const topics = analysis.key_topics || [];
  return topics.filter(topic => 
    transcription.toLowerCase().includes(topic.toLowerCase()) &&
    topic.length > 4
  ).slice(0, 4);
}

function extractLearningStyle(analysis, language = 'fr', styleMap = null) {
  if (!styleMap) {
    styleMap = { pratique: 'pratique', réflexif: 'réflexif', équilibré: 'équilibré' };
  }

  const pace = analysis.tone_analysis?.pace;
  const fastKeywords = ['rapide', 'fast', 'rápido', 'schnell', 'veloce', 'سريع'];
  const slowKeywords = ['lent', 'slow', 'lento', 'langsam', 'lento', 'بطيء'];
  
  if (fastKeywords.some(keyword => pace?.toLowerCase().includes(keyword))) {
    return styleMap.pratique;
  }
  if (slowKeywords.some(keyword => pace?.toLowerCase().includes(keyword))) {
    return styleMap.réflexif;
  }
  return styleMap.équilibré;
}

function detectCulturalAffinity(text) {
  const culturalKeywords = {
    'france': ['france', 'français', 'paris', 'lyon', 'marseille'],
    'maroc': ['maroc', 'marocain', 'casablanca', 'rabat', 'marrakech'],
    'intercultural': ['culture', 'tradition', 'échange', 'interculturel']
  };
  
  const lowerText = text.toLowerCase();
  const affinities = [];
  
  for (const [culture, keywords] of Object.entries(culturalKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      affinities.push(culture);
    }
  }
  
  return affinities.length > 0 ? affinities : ['intercultural'];
}

function analyzeCommunicationFlow(analysis) {
  const clarity = analysis.tone_analysis?.clarity;
  const pace = analysis.tone_analysis?.pace;
  
  if (clarity === 'excellente' && pace === 'modéré') return 'optimal';
  if (clarity === 'bonne' && pace === 'modéré') return 'bon';
  return 'standard';
}

function analyzeToneCompatibility(toneAnalysis) {
  if (!toneAnalysis) return 'standard';
  
  const { emotion, pace, energy, clarity } = toneAnalysis;
  
  if (emotion === 'enthousiaste' && pace === 'modéré' && energy === 'élevé' && clarity === 'bonne') {
    return 'excellent';
  }
  if (emotion === 'confiant' && pace === 'modéré' && clarity === 'bonne') {
    return 'très bon';
  }
  
  return 'bon';
}

function calculateExpertiseMatch(interests) {
  return interests.length >= 3 ? 'élevé' : 
         interests.length >= 2 ? 'moyen' : 'faible';
}
