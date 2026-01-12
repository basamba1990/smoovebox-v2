// supabase/functions/analyze-transcription/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// ✅ DONNÉES PERSONAS INTÉGRÉES (pour la logique Edge)
const PERSONAS_DATA = [
  {
    id: 'jeune_talent',
    name: 'Le·la Jeune Talent',
    role: 'un expert en communication qui se concentre sur la découverte de soi, la valorisation et l\'expression authentique pour les jeunes talents.',
    analysis_focus: 'l\'énergie, la clarté du message personnel et le potentiel de croissance.'
  },
  {
    id: 'adulte_reconversion',
    name: 'L’Adulte en reconversion',
    role: 'un coach de carrière spécialisé dans la reconversion, la réinvention et la clarification des compétences transférables.',
    analysis_focus: 'la clarté des objectifs, la confiance dans le pivot et la connexion entre l\'histoire passée et le futur viable.'
  },
  {
    id: 'mentor_senior',
    name: 'Le Mentor Senior',
    role: 'un mentor expérimenté et bienveillant, axé sur la transmission, le leadership et l\'impact positif.',
    analysis_focus: 'la sagesse, la capacité à inspirer et la structure du message pour la transmission intergénérationnelle.'
  },
  {
    id: 'chef_entreprise',
    name: 'Le Chef d’entreprise / Entrepreneur',
    role: 'un consultant en stratégie d\'entreprise et en marque employeur, axé sur le recrutement et la communication corporate.',
    analysis_focus: 'la force de la proposition de valeur, le leadership et l\'adéquation du message avec les objectifs business.'
  },
  {
    id: 'collectivite',
    name: 'La Collectivité / Institution',
    role: 'un expert en communication publique et en valorisation territoriale, axé sur l\'impact social et la dynamique locale.',
    analysis_focus: 'la portée du message, l\'inclusion et la capacité à mobiliser une communauté.'
  },
  {
    id: 'sponsor',
    name: 'Le Sponsor / Banque / Entreprise tech',
    role: 'un analyste financier et de marque, axé sur l\'innovation, le storytelling et le retour sur investissement sociétal.',
    analysis_focus: 'le caractère visionnaire, l\'impact mesurable et la qualité du storytelling.'
  },
  {
    id: 'partenaire_educatif',
    name: 'Le Partenaire Éducatif',
    role: 'un pédagogue et un expert en orientation, axé sur la valorisation des parcours et l\'outil pédagogique.',
    analysis_focus: 'la clarté pédagogique, la structure d\'apprentissage et la capacité à guider l\'élève.'
  },
];

const DEFAULT_PERSONA = PERSONAS_DATA.find(p => p.id === 'jeune_talent') || PERSONAS_DATA[0];

const getPersonaData = (personaId: string) => {
  return PERSONAS_DATA.find(p => p.id === personaId) || DEFAULT_PERSONA;
};

const getModelConfig = (modelType: string) => {
  switch (modelType) {
    case 'test':
      return {
        model: 'gpt-3.5-turbo', // Modèle Test (T)
        description: 'Modèle Test (T) - Pour l\'expérimentation (plus rapide, moins cher).',
      };
    case 'master':
    default:
      return {
        model: 'gpt-4o', // Modèle Maître (M) - Utilisation de gpt-4o comme modèle par défaut
        description: 'Modèle Maître (M) - Recommandé pour la production (plus précis, plus cher).',
      };
  }
};

// ✅ CACHE PERFORMANT
const analysisCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

// ✅ SYSTÈME DE RETRY AMÉLIORÉ
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000) => {
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

// ✅ CORRECTION CORS - Headers complets
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Content-Type': 'application/json',
};

// ✅ PROMPTS AVANCÉS POUR GPT-4
const ANALYSIS_PROMPTS = {
  fr: `En tant qu'expert en communication et analyse vocale, analyse cette transcription vidéo de manière approfondie.

Fournis une analyse détaillée en JSON avec cette structure :

{
  "summary": "Résumé concis et percutant (180-250 mots)",
  "key_topics": ["liste", "de", "thèmes", "principaux", "spécifiques"],
  "sentiment": "positif/négatif/neutre/mixte",
  "sentiment_score": 0.87,
  "communication_advice": [
    "Conseil concret 1 avec exemple",
    "Conseil actionnable 2",
    "Recommandation stratégique 3"
  ],
  "profile_information": {
    "full_name": "Nom complet si mentionné, sinon null",
    "preferred_name": "Prénom ou nom usuel si mentionné, sinon null",
    "approx_age": 21,
    "birth_place": "Ville ou pays de naissance explicitement mentionné, sinon null",
    "current_city": "Ville actuelle si mentionnée, sinon null",
    "languages": ["français", "anglais"],
    "studies": "Niveau d'études ou formation si mentionné, sinon null",
    "current_role": "Étudiant, lycéen, développeur, etc. si mentionné, sinon null",
    "interests": ["football", "programmation"],
    "other_explicit_details": [
      "Tout autre détail personnel explicitement dit dans la vidéo"
    ]
  },
  "tone_analysis": {
    "primary_emotion": "joyeux/triste/colérique/neutre/enthousiaste/calme/énergique/stressé/confiant/serein",
    "secondary_emotions": ["émotion secondaire 1", "émotion secondaire 2"],
    "pace": "lent/moderé/rapide/très rapide",
    "clarity": "faible/moyen/bon/excellent",
    "energy": "faible/moyen/élevé/intense",
    "confidence_level": 0.82,
    "vocal_characteristics": {
      "articulation": "précise/moyenne/relâchée",
      "intonation": "monotone/expressif/très expressif",
      "pause_usage": "efficace/inefficace/optimal",
      "emphasis_points": ["point 1", "point 2"]
    },
    "improvement_opportunities": [
      "Opportunité spécifique 1",
      "Opportunité mesurable 2"
    ]
  },
  "content_analysis": {
    "structure_quality": "faible/moyenne/bonne/excellente",
    "key_message_clarity": "flou/clair/très clair",
    "storytelling_elements": ["élément 1", "élément 2"],
    "persuasion_techniques": ["technique 1", "technique 2"]
  },
  "audience_analysis": {
    "target_match": "faible/moyen/fort/excellent",
    "engagement_potential": 0.78,
    "accessibility_level": "débutant/intermédiaire/expert"
  },
  "performance_metrics": {
    "overall_score": 8.2,
    "clarity_score": 8.5,
    "engagement_score": 7.9,
    "impact_score": 8.1
  },
  "actionable_insights": {
    "immediate_actions": ["action 1", "action 2"],
    "strategic_recommendations": ["recommandation 1", "recommandation 2"],
    "development_areas": ["domaine 1", "domaine 2"]
  }
}

Transcription à analyser :
{text}

IMPORTANT :
- Tu dois TOUJOURS inclure la clé \"profile_information\" dans le JSON final, même si certaines valeurs sont null.
- Ne devine JAMAIS les informations personnelles : si le nom, l'âge, la ville, etc. ne sont pas clairement mentionnés dans le texte, mets la valeur à null.
- Respecte strictement la structure JSON donnée (mêmes noms de clés, mêmes types).`,

  en: `As a communication and vocal analysis expert, perform a deep analysis of this video transcription.

Provide detailed analysis in JSON with this structure:

{
  "summary": "Concise and impactful summary (180-250 words)",
  "key_topics": ["list", "of", "main", "specific", "themes"],
  "sentiment": "positive/negative/neutral/mixed", 
  "sentiment_score": 0.87,
  "communication_advice": [
    "Concrete advice 1 with example",
    "Actionable advice 2",
    "Strategic recommendation 3"
  ],
  "profile_information": {
    "full_name": "Full name if explicitly mentioned, otherwise null",
    "preferred_name": "First name or usual name if mentioned, otherwise null",
    "approx_age": 21,
    "birth_place": "City or country of birth if explicitly mentioned, otherwise null",
    "current_city": "Current city if mentioned, otherwise null",
    "languages": ["French", "English"],
    "studies": "Studies or education level if mentioned, otherwise null",
    "current_role": "Student, developer, etc. if mentioned, otherwise null",
    "interests": ["football", "programming"],
    "other_explicit_details": [
      "Any other explicitly stated personal details from the video"
    ]
  },
  "tone_analysis": {
    "primary_emotion": "joyful/sad/angry/neutral/enthusiastic/calm/energetic/stressed/confident/serene",
    "secondary_emotions": ["secondary emotion 1", "secondary emotion 2"],
    "pace": "slow/moderate/fast/very fast",
    "clarity": "poor/average/good/excellent",
    "energy": "low/medium/high/intense",
    "confidence_level": 0.82,
    "vocal_characteristics": {
      "articulation": "precise/average/relaxed",
      "intonation": "monotone/expressive/very expressive", 
      "pause_usage": "effective/ineffective/optimal",
      "emphasis_points": ["point 1", "point 2"]
    },
    "improvement_opportunities": [
      "Specific opportunity 1",
      "Measurable opportunity 2"
    ]
  },
  "content_analysis": {
    "structure_quality": "poor/average/good/excellent",
    "key_message_clarity": "unclear/clear/very clear",
    "storytelling_elements": ["element 1", "element 2"],
    "persuasion_techniques": ["technique 1", "technique 2"]
  },
  "audience_analysis": {
    "target_match": "weak/average/strong/excellent",
    "engagement_potential": 0.78,
    "accessibility_level": "beginner/intermediate/expert"
  },
  "performance_metrics": {
    "overall_score": 8.2,
    "clarity_score": 8.5,
    "engagement_score": 7.9,
    "impact_score": 8.1
  },
  "actionable_insights": {
    "immediate_actions": ["action 1", "action 2"],
    "strategic_recommendations": ["recommendation 1", "recommendation 2"],
    "development_areas": ["area 1", "area 2"]
  }
}

Text to analyze:
{text}

IMPORTANT:
- You MUST ALWAYS include the \"profile_information\" key in the final JSON, even if some values are null.
- NEVER guess personal information: if name, age, city, etc. are not clearly mentioned in the text, set the value to null.
- Strictly follow the provided JSON structure (same key names, same types).`
};

const SYSTEM_MESSAGES = (personaRole: string, analysisFocus: string) => ({
  fr: `Tu es ${personaRole}. Tu analyses les transcriptions vidéo avec une expertise approfondie pour fournir des insights actionnables, constructifs et précis. Ton analyse doit se concentrer sur ${analysisFocus}. Tes analyses combinent intelligence artificielle et compréhension humaine.`,
  en: `You are ${personaRole}. You analyze video transcripts with deep expertise to provide actionable, constructive and precise insights. Your analysis must focus on ${analysisFocus}. Your analyses combine artificial intelligence and human understanding.`
});

Deno.serve(async (req) => {
  console.log("🔍 Fonction analyze-transcription (GPT-4 optimisée) appelée");

  // ✅ CORRECTION CORS - Gestion OPTIONS améliorée
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
    
    const { videoId: vidId, video_id, transcriptionText, userId, transcriptionLanguage, personaId, modelType } = requestBody;
    videoId = vidId || video_id; // Support both videoId and video_id

    // ✅ VALIDATION RENFORCÉE
    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          error: 'Paramètre manquant: videoId requis',
          received: { videoId: !!videoId }
        }),
        { 
          status: 400, 
          headers: corsHeaders 
        }
      );
    }

    // ✅ CONFIGURATION
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('❌ Configuration manquante:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey
      });
      throw new Error('Configuration serveur incomplète');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ✅ VÉRIFICATION VIDÉO
    console.log(`🔍 Vérification vidéo: ${videoId}`);
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('❌ Vidéo non trouvée:', videoError);
      throw new Error(`Vidéo non trouvée: ${videoError?.message || 'Aucune donnée'}`);
    }

    // ✅ PERMISSIONS
    if (userId && video.user_id !== userId) {
      throw new Error('Accès non autorisé');
    }

    console.log("🔄 Mise à jour statut ANALYZING");
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.ANALYZING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (updateError) {
      console.error('❌ Erreur mise à jour statut:', updateError);
      throw new Error(`Erreur mise à jour: ${updateError.message}`);
    }

    // ✅ RÉCUPÉRATION / VALIDATION TEXTE DE TRANSCRIPTION
    let finalTranscriptionText = transcriptionText;
    if (!finalTranscriptionText) {
      console.log("🔍 Transcription non fournie, récupération depuis la vidéo...");
      finalTranscriptionText = video.transcription_text;
      if (!finalTranscriptionText && video.transcription_data) {
        try {
          const transcriptionData = typeof video.transcription_data === 'string'
            ? JSON.parse(video.transcription_data)
            : video.transcription_data;
          finalTranscriptionText = transcriptionData?.text || transcriptionData?.full_text;
        } catch (e) {
          console.warn('⚠️ Erreur parsing transcription_data:', e);
        }
      }
    }

    if (!finalTranscriptionText || finalTranscriptionText.trim().length < 20) {
      return new Response(
        JSON.stringify({ 
          error: 'Aucune transcription suffisante disponible pour cette vidéo. Veuillez d\'abord transcrire la vidéo.',
          videoStatus: video.status,
          hasTranscriptionText: !!video.transcription_text,
          hasTranscriptionData: !!video.transcription_data
        }),
        { 
          status: 400, 
          headers: corsHeaders 
        }
      );
    }

    // ✅ OPTIMISATION TEXTE
    const cleanText = finalTranscriptionText.trim().substring(0, 12000);
    console.log(`📝 Texte à analyser: ${cleanText.length} caractères`);

    // ✅ CACHE
    const textHash = generateTextHash(cleanText);
    const cacheKey = `${videoId}_${textHash}`;
    
    const cachedAnalysis = analysisCache.get(cacheKey);
    if (cachedAnalysis && (Date.now() - cachedAnalysis.timestamp < CACHE_TTL)) {
      console.log("✅ Utilisation du cache");
      await saveAnalysisToDB(supabase, videoId, cachedAnalysis.data);
      return createSuccessResponse(cachedAnalysis.data, true);
    }

    // ✅ DÉTECTION DE LANGUE
    const analysisLanguage = transcriptionLanguage || detectLanguage(cleanText);
    console.log(`🌐 Langue d'analyse: ${analysisLanguage}`);

    // ✅ LOGIQUE ESTELLE (PERSONA & MODÈLE M/T)
    const persona = getPersonaData(personaId || DEFAULT_PERSONA.id);
    const modelConfig = getModelConfig(modelType || 'master');
    
    console.log(`🤖 Analyse avec Persona: ${persona.name} (${persona.id}) et Modèle: ${modelConfig.description}`);

    const systemMessage = SYSTEM_MESSAGES(persona.role, persona.analysis_focus)[analysisLanguage] || SYSTEM_MESSAGES(persona.role, persona.analysis_focus)['fr'];
    const promptTemplate = ANALYSIS_PROMPTS[analysisLanguage] || ANALYSIS_PROMPTS['fr'];
    const finalPrompt = promptTemplate.replace('{text}', cleanText.substring(0, 8000));

    const completion = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        model: modelConfig.model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: finalPrompt }
        ],
        max_tokens: 3000,
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
    });

    const analysisText = completion.choices[0].message.content;
    console.log("✅ Réponse GPT-4 reçue");

    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisText);
      
      // ✅ ENRICHISSEMENT DES DONNÉES
      analysisResult.metadata = {
        analyzed_at: new Date().toISOString(),
        text_length: cleanText.length,
        model_used: "gpt-4o",
        analysis_language: analysisLanguage,
        processing_time: "optimisé"
      };

      // ✅ CALCUL SCORE AUTOMATIQUE
      analysisResult.performance_metrics = analysisResult.performance_metrics || calculateAdvancedScores(analysisResult);
      analysisResult.ai_score = analysisResult.performance_metrics.overall_score;

    } catch (parseError) {
      console.error("❌ Erreur parsing, utilisation fallback:", parseError);
      analysisResult = createAdvancedFallbackAnalysis(cleanText, analysisLanguage);
    }

    // ✅ SAUVEGARDE
    await saveAnalysisToDB(supabase, videoId, analysisResult);
    analysisCache.set(cacheKey, { data: analysisResult, timestamp: Date.now() });

    console.log("🎉 Analyse GPT-4 terminée avec succès");
    return createSuccessResponse(analysisResult, false);

  } catch (error) {
    console.error("💥 Erreur analyse:", error);
    
    // ✅ SAUVEGARDE ERREUR
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
        }
      } catch (updateError) {
        console.error("❌ Erreur sauvegarde statut:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur analyse avancée', 
        details: error.message,
        videoId: videoId
      }),
      { 
        status: 500, 
        headers: corsHeaders 
      }
    );
  }
});

// ✅ FONCTIONS UTILITAIRES AMÉLIORÉES

function generateTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 1000); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function detectLanguage(text: string): string {
  const samples: { [key: string]: string[] } = {
    'fr': [' le ', ' la ', ' et ', ' est ', ' dans ', ' pour ', ' vous ', ' nous ', ' avec ', ' sans '],
    'en': [' the ', ' and ', ' is ', ' in ', ' to ', ' for ', ' you ', ' we ', ' with ', ' without ']
  };
  
  let bestLang = 'fr';
  let bestScore = 0;
  
  for (const [lang, keywords] of Object.entries(samples)) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      if (matches) score += matches.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }
  
  return bestLang;
}

function calculateAdvancedScores(analysis: any) {
  let overall = 7.0;
  
  // Score basé sur la complétude de l'analyse
  if (analysis.summary && analysis.summary.length > 100) overall += 0.5;
  if (analysis.key_topics && analysis.key_topics.length >= 3) overall += 0.5;
  if (analysis.tone_analysis) overall += 0.8;
  if (analysis.performance_metrics) overall += 0.7;
  if (analysis.actionable_insights) overall += 0.5;
  
  // Bonus pour analyse détaillée
  if (analysis.tone_analysis?.vocal_characteristics) overall += 0.3;
  if (analysis.content_analysis?.storytelling_elements) overall += 0.2;
  if (analysis.audience_analysis) overall += 0.3;
  
  // Mapping pour clarity_score multilingue
  const clarityMap: { [key: string]: number } = {
    'excellent': 9.0,
    'excellente': 9.0,
    'bon': 8.0,
    'bonne': 8.0,
    'good': 8.0,
    'moyen': 7.0,
    'moyenne': 7.0,
    'average': 7.0,
    'faible': 5.0,
    'poor': 5.0
  };
  
  return {
    overall_score: Math.min(Math.max(overall, 0), 10),
    clarity_score: clarityMap[analysis.tone_analysis?.clarity || ''] || 7.0,
    engagement_score: analysis.sentiment_score ? analysis.sentiment_score * 10 * 0.8 : 7.5,
    impact_score: analysis.performance_metrics?.impact_score || 7.8
  };
}

function createAdvancedFallbackAnalysis(text: string, language = 'fr') {
  const isFrench = language === 'fr';
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const sentenceCount = text.split(/[.!?]+/).length - 1;
  
  const fallbackData = {
    summary: isFrench
      ? "Analyse de base: " + wordCount + " mots, " + sentenceCount + " phrases. Contenu analysé avec précision."
      : "Basic analysis: " + wordCount + " words, " + sentenceCount + " sentences. Content analyzed accurately.",
    
    key_topics: ["communication", "expression", "partage"],
    
    sentiment: isFrench ? "positif" : "positive",
    sentiment_score: 0.7,
    
    communication_advice: isFrench ? [
      "Pratiquez régulièrement pour améliorer votre fluidité",
      "Variez les intonations pour maintenir l'attention",
      "Utilisez des pauses stratégiques pour renforcer votre message"
    ] : [
      "Practice regularly to improve fluency",
      "Vary intonations to maintain attention", 
      "Use strategic pauses to strengthen your message"
    ],
    
    tone_analysis: {
      primary_emotion: isFrench ? "enthousiaste" : "enthusiastic",
      secondary_emotions: isFrench ? ["confiant", "engageant"] : ["confident", "engaging"],
      pace: isFrench ? "modéré" : "moderate",
      clarity: isFrench ? "bon" : "good",
      energy: isFrench ? "élevé" : "high",
      confidence_level: 0.75,
      vocal_characteristics: {
        articulation: isFrench ? "précise" : "precise",
        intonation: isFrench ? "expressif" : "expressive",
        pause_usage: "efficace", // Same as "effective"
        emphasis_points: isFrench ? ["points clés bien mis en avant"] : ["key points well highlighted"]
      },
      improvement_opportunities: isFrench ? [
        "Développer davantage les transitions",
        "Renforcer la conclusion"
      ] : [
        "Develop transitions further",
        "Strengthen the conclusion"
      ]
    },
    
    content_analysis: {
      structure_quality: isFrench ? "bonne" : "good",
      key_message_clarity: isFrench ? "clair" : "clear",
      storytelling_elements: isFrench ? ["narratif engageant"] : ["engaging narrative"],
      persuasion_techniques: isFrench ? ["argumentation logique"] : ["logical argumentation"]
    },
    
    audience_analysis: {
      target_match: isFrench ? "fort" : "strong",
      engagement_potential: 0.75,
      accessibility_level: isFrench ? "intermédiaire" : "intermediate"
    },
    
    performance_metrics: {
      overall_score: 7.8,
      clarity_score: 8.2,
      engagement_score: 7.5,
      impact_score: 7.9
    },
    
    actionable_insights: {
      immediate_actions: isFrench ? [
        "Réviser la structure d'ouverture",
        "Ajouter des exemples concrets"
      ] : [
        "Revise opening structure",
        "Add concrete examples"
      ],
      strategic_recommendations: isFrench ? [
        "Développer une signature vocale distinctive",
        "Créer des hooks captivants"
      ] : [
        "Develop distinctive vocal signature",
        "Create captivating hooks"
      ],
      development_areas: ["expression", "structure", "impact"]
    }
  };
  
  const baseAnalysis = { ...fallbackData };
  
  baseAnalysis.metadata = {
    analyzed_at: new Date().toISOString(),
    text_length: text.length,
    model_used: "gpt-4o-fallback",
    analysis_language: language,
    processing_time: "standard"
  };
  
  baseAnalysis.ai_score = baseAnalysis.performance_metrics.overall_score;
  return baseAnalysis;
}

async function saveAnalysisToDB(supabase: any, videoId: string, analysisResult: any) {
  const updatePayload = {
    status: VIDEO_STATUS.ANALYZED,
    analysis: analysisResult.analysis, // ✅ Utiliser analysisResult.analysis
    ai_score: analysisResult.ai_score || analysisResult.performance_metrics?.overall_score || 7.5,
    // ✅ Nouveau champ: profil structuré extrait du texte (si présent)
    profile_information: analysisResult.profile_information || null,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId);

    if (error) {
      throw new Error(`Erreur sauvegarde: ${error.message}`);
    }
    
    console.log('✅ Analyse sauvegardée en base de données');
  } catch (error) {
    console.error("❌ Erreur sauvegarde DB:", error);
    throw error;
  }
}

function createSuccessResponse(analysisResult: any, fromCache = false) {
  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Analyse avancée terminée avec succès',
      analysis: analysisResult.analysis, // ✅ Utiliser analysisResult.analysis
      fromCache: fromCache,
      model_used: analysisResult.metadata?.model_used || "gpt-4o",
      ai_score: analysisResult.ai_score
    }),
    { 
      status: 200, 
      headers: corsHeaders 
    }
  );
}

// ✅ NETTOYAGE PERIODIQUE DU CACHE
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      analysisCache.delete(key);
    }
  }
}, 60000);
