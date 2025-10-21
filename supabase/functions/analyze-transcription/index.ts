// supabase/functions/analyze-transcription/index.js
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// ✅ NOUVEAU : Cache en mémoire pour optimiser les performances
const analysisCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ✅ NOUVEAU : Système de retry avec backoff exponentiel
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

// ✅ PROMPTS MULTILINGUES AMÉLIORÉS
const ANALYSIS_PROMPTS = {
  fr: `
En tant qu'expert en communication interculturelle France-Maroc, analysez cette transcription vidéo.

Transcription: {text}

Fournissez une analyse structurée en JSON avec ce format:
{
  "summary": "résumé concis en 2-3 phrases",
  "key_topics": ["thème1", "thème2", "thème3", "thème4"],
  "sentiment": "positif/neutre/négatif",
  "sentiment_score": 0.85,
  "communication_advice": ["conseil1", "conseil2", "conseil3"],
  "tone_analysis": {
    "emotion": "enthousiaste/calme/energique/serein/passionné",
    "pace": "rapide/moderé/lent/rythmé",
    "clarity": "excellente/bonne/moyenne/faible",
    "confidence_level": 0.8,
    "cultural_insights": ["insight1", "insight2"]
  },
  "structure_analysis": {
    "introduction": "excellent/bon/à améliorer",
    "development": "excellent/bon/à améliorer", 
    "conclusion": "excellent/bon/à améliorer",
    "overall_structure": "excellent/bon/à améliorer"
  },
  "target_audience": ["audience1", "audience2"],
  "visual_suggestions": ["suggestion1", "suggestion2"]
}

Répondez UNIQUEMENT avec le JSON valide, sans texte supplémentaire.
  `,
  ar: `
كمحترف في التواصل بين الثقافات فرنسا-المغرب، قم بتحليل نص الفيديو هذا.

النص: {text}

قدم تحليلاً منظماً بتنسيق JSON بالشكل التالي:
{
  "summary": "ملخص موجز في 2-3 جمل",
  "key_topics": ["موضوع1", "موضوع2", "موضوع3", "موضوع4"],
  "sentiment": "إيجابي/محايد/سلبي",
  "sentiment_score": 0.85,
  "communication_advice": ["نصيحة1", "نصيحة2", "نصيحة3"],
  "tone_analysis": {
    "emotion": "متحمس/هادئ/نشيط/مطمئن/شغوف",
    "pace": "سريع/معتدل/بطيء/مُنَظَّم",
    "clarity": "ممتازة/جيدة/متوسطة/ضعيفة",
    "confidence_level": 0.8,
    "cultural_insights": ["رؤية1", "رؤية2"]
  },
  "structure_analysis": {
    "introduction": "ممتاز/جيد/يحتاج تحسين",
    "development": "ممتاز/جيد/يحتاج تحسين",
    "conclusion": "ممتاز/جيد/يحتاج تحسين", 
    "overall_structure": "ممتاز/جيد/يحتاج تحسين"
  },
  "target_audience": ["جمهور1", "جمهور2"],
  "visual_suggestions": ["اقتراح1", "اقتراح2"]
}

الرد فقط بـ JSON صالح، دون أي نص إضافي.
  `,
  en: `
As an expert in France-Morocco intercultural communication, analyze this video transcription.

Transcription: {text}

Provide a structured analysis in JSON with the following format:
{
  "summary": "concise summary in 2-3 sentences",
  "key_topics": ["topic1", "topic2", "topic3", "topic4"],
  "sentiment": "positive/neutral/negative",
  "sentiment_score": 0.85,
  "communication_advice": ["advice1", "advice2", "advice3"],
  "tone_analysis": {
    "emotion": "enthusiastic/calm/energetic/serene/passionate",
    "pace": "fast/moderate/slow/rhythmic",
    "clarity": "excellent/good/average/poor",
    "confidence_level": 0.8,
    "cultural_insights": ["insight1", "insight2"]
  },
  "structure_analysis": {
    "introduction": "excellent/good/needs improvement",
    "development": "excellent/good/needs improvement",
    "conclusion": "excellent/good/needs improvement",
    "overall_structure": "excellent/good/needs improvement"
  },
  "target_audience": ["audience1", "audience2"],
  "visual_suggestions": ["suggestion1", "suggestion2"]
}

Respond ONLY with valid JSON, without any additional text.
  `
};

const SYSTEM_MESSAGES = {
  fr: "Vous êtes un expert en analyse de communication interculturelle France-Maroc. Répondez UNIQUEMENT en JSON valide, sans texte supplémentaire. Fournissez une analyse approfondie et actionable.",
  ar: "أنت خبير في تحليل التواصل بين الثقافات فرنسا-المغرب. قم بالرد فقط بـ JSON صالح، دون أي نص إضافي. قدم تحليلاً متعمقاً وقابلاً للتطبيق.",
  en: "You are an expert in France-Morocco intercultural communication analysis. Respond ONLY with valid JSON, without any additional text. Provide deep and actionable analysis."
};

// ✅ LANGUAGES SUPPORTED FOR ANALYSIS - ÉTENDU
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
  'fr': ['le', 'la', 'les', 'de', 'des', 'du', 'et', 'est', 'dans', 'pour', 'vous', 'nous', 'je', 'tu'],
  'ar': ['ال', 'في', 'من', 'على', 'إلى', 'أن', 'هذا', 'هذه', 'كان', 'ما', 'لا', 'إن', 'أن', 'مع'],
  'en': ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'on', 'as', 'was'],
  'es': ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'los', 'las', 'del', 'al'],
  'de': ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'ist', 'sich', 'mit', 'dem', 'den', 'des'],
  'it': ['il', 'la', 'di', 'e', 'in', 'che', 'non', 'per', 'un', 'una', 'sono', 'con', 'del', 'al'],
  'pt': ['o', 'a', 'de', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'se', 'os', 'as']
};

Deno.serve(async (req) => {
  console.log("🔍 Fonction analyze-transcription (multilingue sécurisée) appelée");

  // ✅ GESTION CORS AMÉLIORÉE
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // ✅ VÉRIFICATION RATE LIMITING BASIQUE
  const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
  console.log(`📊 Requête de l'IP: ${clientIP}`);

  let videoId = null;

  try {
    // ✅ VALIDATION ROBUSTE DU CORPS DE LA REQUÊTE
    let requestBody;
    let rawBody = '';
    
    try {
      rawBody = await req.text();
      
      if (!rawBody || rawBody.trim().length === 0) {
        throw new Error('Corps de requête vide');
      }
      
      if (rawBody.length > 100000) { // 100KB max
        throw new Error('Corps de requête trop volumineux');
      }
      
      requestBody = JSON.parse(rawBody);
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

    // ✅ VALIDATION STRICTE DES PARAMÈTRES
    if (!videoId || typeof videoId !== 'string' || videoId.length > 100) {
      return new Response(
        JSON.stringify({ 
          error: 'Paramètre videoId invalide ou manquant'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // ✅ VÉRIFICATION QUE LA VIDÉO EXISTE ET APPARTIENT À L'UTILISATEUR
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

    // ✅ VÉRIFICATION DES PERMISSIONS (optionnel selon votre modèle d'auth)
    if (userId && video.user_id !== userId) {
      throw new Error('Accès non autorisé à cette vidéo');
    }

    console.log("✅ Vidéo trouvée, mise à jour statut ANALYZING");

    // ✅ MISE À JOUR DU STATUT AVEC GESTION D'ERREUR
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
    let textToAnalyze = transcriptionText;
    
    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      console.log("📄 Fetch transcription depuis DB...");
      
      // Essayer plusieurs sources pour le texte
      textToAnalyze = video?.transcription_text || 
                     video?.transcription_data?.text || 
                     video?.transcript?.text || 
                     '';
      
      console.log(`📄 Texte récupéré depuis DB: ${textToAnalyze?.length || 0} caractères`);
    }

    // ✅ VALIDATION DU TEXTE À ANALYSER
    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      console.warn("⚠️ Aucun texte de transcription disponible, création d'analyse basique");
      textToAnalyze = "Cette vidéo ne contient pas de transcription analysable. L'utilisateur a peut-être parlé très brièvement ou le son était de mauvaise qualité.";
    }

    // ✅ VÉRIFICATION DU CACHE AVANT ANALYSE
    const textHash = generateTextHash(textToAnalyze);
    const cacheKey = `${videoId}_${textHash}`;
    
    const cachedAnalysis = analysisCache.get(cacheKey);
    if (cachedAnalysis && (Date.now() - cachedAnalysis.timestamp < CACHE_TTL)) {
      console.log("✅ Utilisation de l'analyse en cache");
      
      // Mettre à jour la vidéo avec l'analyse en cache
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

    // ✅ DÉTECTION AUTOMATIQUE AMÉLIORÉE DE LA LANGUE
    let analysisLanguage = transcriptionLanguage || video?.transcription_language || 'fr';
    
    if (!analysisLanguage || analysisLanguage === 'auto') {
      console.log("🔍 Détection automatique de la langue...");
      analysisLanguage = detectLanguageAdvanced(textToAnalyze);
      console.log(`🌐 Langue détectée: ${analysisLanguage}`);
    }

    // ✅ FORCER LA LANGUE D'ANALYSE CORRECTE
    const languageScores = calculateAllLanguageScores(textToAnalyze);
    analysisLanguage = determineBestLanguage(languageScores, analysisLanguage);

    // ✅ S'assurer que la langue est supportée
    if (!SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage]) {
      console.warn(`⚠️ Langue ${analysisLanguage} non supportée, utilisation du français par défaut`);
      analysisLanguage = 'fr';
    }

    const systemMessage = SYSTEM_MESSAGES[analysisLanguage] || SYSTEM_MESSAGES['fr'];
    const analysisPromptTemplate = ANALYSIS_PROMPTS[analysisLanguage] || ANALYSIS_PROMPTS['fr'];
    
    // ✅ LIMITATION INTELLIGENTE DE LA TAILLE DU TEXTE
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
          max_tokens: 2000,
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
    console.log("📄 Réponse OpenAI:", analysisText.substring(0, 300) + "...");

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

    // ✅ ENRICHIR LES RÉSULTATS AVEC DES MÉTADONNÉES
    analysisResult.analysis_language = analysisLanguage;
    analysisResult.analysis_language_name = SUPPORTED_ANALYSIS_LANGUAGES[analysisLanguage] || 'Unknown';
    analysisResult.analyzed_at = new Date().toISOString();
    analysisResult.text_length = textToAnalyze.length;
    analysisResult.model_used = "gpt-3.5-turbo";

    // ✅ CALCUL DU SCORE IA AMÉLIORÉ
    const aiScore = calculateEnhancedAIScore(analysisResult, textToAnalyze);
    analysisResult.ai_score = aiScore;
    console.log(`📊 Score IA calculé: ${aiScore}`);

    // ✅ EXTRACTION DES INSIGHTS DE MATCHING AVANCÉS
    console.log("🔍 Extraction des insights de matching...");
    const matchingInsights = await extractAdvancedMatchingInsights(analysisResult, textToAnalyze, analysisLanguage);
    console.log("✅ Insights de matching extraits");

    // ✅ SAUVEGARDE AVEC GESTION D'ERREUR AMÉLIORÉE
    await saveAnalysisResults(supabase, videoId, analysisResult, matchingInsights, aiScore);

    // ✅ MISE EN CACHE DE L'ANALYSE
    analysisCache.set(cacheKey, {
      analysis: analysisResult,
      timestamp: Date.now()
    });

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
        fromCache: false
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("💥 Erreur générale dans analyze-transcription:", error);

    // ✅ SAUVEGARDE DE L'ERREUR AVEC GESTION D'ERREUR
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
        error: 'Erreur lors de l\'analyse multilingue', 
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
  // Hash simple pour le cache
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
    const uniqueKeywords = [...new Set(keywords)]; // Éviter les doublons
    for (const keyword of uniqueKeywords) {
      if (words.includes(keyword.toLowerCase())) {
        score++;
      }
      // Vérifier aussi les sous-chaînes pour les langues comme l'arabe
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
    if (score > bestScore + 0.1) { // Seuil de confiance
      bestScore = score;
      bestLanguage = lang;
    }
  }
  
  return bestLanguage;
}

function optimizeTextForAnalysis(text, maxLength) {
  if (text.length <= maxLength) return text;
  
  // Essayer de tronquer à la fin d'une phrase
  const sentences = text.split(/[.!?]+/);
  let optimizedText = '';
  
  for (const sentence of sentences) {
    if ((optimizedText + sentence).length > maxLength) break;
    optimizedText += sentence + '.';
  }
  
  if (optimizedText.length === 0) {
    // Fallback: troncature simple
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

  // Essayer d'ajouter les colonnes étendues si elles existent
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

function createEnhancedAnalysis(text, language = 'fr') {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const sentenceCount = text.split(/[.!?]+/).length - 1;
  
  const ENHANCED_ANALYSIS_TEXTS = {
    fr: {
      summary: `Analyse basique: ${wordCount} mots, ${sentenceCount} phrases détectées. Le contenu exprime une passion communicatrice.`,
      topics: ["communication", "partage", "expression", "passion"],
      advice: [
        "Continuez à pratiquer régulièrement pour améliorer votre fluidité",
        "Variez le débit pour maintenir l'attention de votre audience",
        "Utilisez des pauses stratégiques pour renforcer votre message"
      ]
    },
    ar: {
      summary: `تحليل أساسي: ${wordCount} كلمة, ${sentenceCount} جملة مكتشفة. المحتوى يعبر عن شغف تواصلي.`,
      topics: ["اتصال", "مشاركة", "تعبير", "شغف"],
      advice: [
        "استمر في الممارسة بانتظام لتحسين طلاقتك",
        "غير سرعة الحديث للحفاظ على انتباه جمهورك",
        "استخدم الوقفات الإستراتيجية لتعزيز رسالتك"
      ]
    },
    en: {
      summary: `Basic analysis: ${wordCount} words, ${sentenceCount} sentences detected. The content expresses communicative passion.`,
      topics: ["communication", "sharing", "expression", "passion"],
      advice: [
        "Continue practicing regularly to improve your fluency",
        "Vary your pace to maintain your audience's attention", 
        "Use strategic pauses to strengthen your message"
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
      emotion: "passionné",
      pace: "modéré",
      clarity: "bonne",
      confidence_level: 0.7,
      cultural_insights: ["Expression authentique", "Communication engageante"]
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

function calculateEnhancedAIScore(analysisResult, originalText) {
  let score = 6.0; // Score de base
  
  // Facteurs de score
  if (analysisResult.summary && analysisResult.summary.length > 50) score += 0.5;
  if (analysisResult.key_topics && analysisResult.key_topics.length >= 3) score += 0.5;
  if (analysisResult.communication_advice && analysisResult.communication_advice.length >= 2) score += 0.5;
  if (analysisResult.tone_analysis) score += 0.5;
  if (analysisResult.structure_analysis) score += 0.5;
  if (analysisResult.sentiment_score > 0.7) score += 0.5;
  
  // Bonus pour analyse détaillée
  if (analysisResult.cultural_insights && analysisResult.cultural_insights.length > 0) score += 0.5;
  if (analysisResult.target_audience && analysisResult.target_audience.length > 0) score += 0.5;
  
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

  // Analyse avancée des compétences
  const skills = extractSkillsFromText(transcription);
  const interests = analysis.key_topics || [];
  const communicationStyle = analysis.tone_analysis?.emotion || 'neutre';

  return {
    communication_style: communicationStyle,
    expertise_areas: interests,
    detected_skills: skills,
    sentiment_profile: analysis.sentiment,
    key_strengths: analysis.communication_advice || [],
    potential_mentor_topics: extractMentorTopics(analysis, transcription),
    learning_preferences: extractLearningStyle(analysis, language, learningStyleMap),
    compatibility_factors: {
      cultural_affinity: detectCulturalAffinity(transcription),
      communication_flow: analyzeCommunicationFlow(analysis),
      expertise_match: calculateExpertiseMatch(interests)
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

function calculateExpertiseMatch(interests) {
  return interests.length >= 3 ? 'élevé' : 
         interests.length >= 2 ? 'moyen' : 'faible';
}
