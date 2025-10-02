import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Alignement avec les statuts définis dans constants/videoStatus.js
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DRAFT: 'draft',
  READY: 'ready'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Timeout pour l'analyse
const ANALYSIS_TIMEOUT = 240000; // 4 minutes

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Fonction analyze-transcription appelée");

    const { videoId, transcriptionText, userId } = await req.json();
    
    if (!videoId || !transcriptionText) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants: videoId et transcriptionText requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      throw new Error('Configuration manquante');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Mettre à jour le statut
    await supabase
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.ANALYZING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    console.log(`Début analyse pour video ${videoId}, longueur texte: ${transcriptionText.length}`);

    // Préparer le prompt pour l'analyse avancée
    const analysisPrompt = `
En tant qu'expert en communication et analyse de discours, analysez cette transcription vidéo en français.

Fournissez une analyse complète incluant:
1. Un résumé concis (3-4 phrases maximum)
2. Les thèmes principaux (3-5 mots-clés)
3. Les entités importantes mentionnées
4. Le sentiment général (positif, neutre, négatif)
5. Des suggestions d'amélioration pour la communication
6. Une analyse de la structure du discours
7. Le public cible potentiel
8. Le niveau d'expertise perçu
9. L'engagement émotionnel

Transcription: ${transcriptionText.substring(0, 12000)}

Format de réponse requis (JSON uniquement):
{
  "summary": "résumé concis",
  "key_topics": ["thème1", "thème2"],
  "important_entities": ["entité1", "entité2"],
  "sentiment": "positif/neutre/négatif",
  "sentiment_score": 0.85,
  "structure_analysis": {
    "introduction": "qualité",
    "development": "qualité", 
    "conclusion": "qualité",
    "overall_structure": "excellent/bon/moyen/faible"
  },
  "communication_advice": [
    "conseil1",
    "conseil2"
  ],
  "tone_analysis": {
    "emotion": "enthousiaste/calme/energique",
    "pace": "rapide/moderé/lent",
    "clarity": "excellente/bonne/moyenne/faible",
    "confidence_level": 0.8
  },
  "target_audience": ["public1", "public2"],
  "expertise_level": "débutant/intermédiaire/avancé",
  "emotional_engagement": {
    "type": "inspirant/informatif/divertissant",
    "level": 0.75
  },
  "visual_suggestions": ["suggestion1", "suggestion2"]
}

Assurez-vous que la réponse est un JSON valide.`;

    // Appel à l'API OpenAI pour l'analyse
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Vous êtes un expert en analyse de communication et de discours. Répondez uniquement en JSON valide."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const analysisText = completion.choices[0].message.content;
    let analysisResult;

    try {
      analysisResult = JSON.parse(analysisText);
    } catch (parseError) {
      console.error("Erreur parsing JSON:", parseError);
      // Fallback: créer une analyse basique
      analysisResult = createBasicAnalysis(transcriptionText);
    }

    // Calculer le score IA
    const aiScore = calculateAIScore(analysisResult);

    // Mettre à jour la vidéo avec les résultats d'analyse
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        status: VIDEO_STATUS.ANALYZED,
        analysis_result: analysisResult,
        ai_score: aiScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (updateError) {
      throw new Error(`Erreur mise à jour analyse: ${updateError.message}`);
    }

    console.log("Analyse terminée avec succès pour video:", videoId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analyse terminée avec succès',
        videoId: videoId,
        aiScore: aiScore
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("Erreur générale dans analyze-transcription:", error);

    // Mettre à jour le statut d'erreur
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
          .eq('id', videoId)
          .catch(e => console.error('Erreur mise à jour statut erreur:', e));
      }
    } catch (updateError) {
      console.error("Erreur lors de la mise à jour du statut d'erreur:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de l\'analyse', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Fonction de fallback pour créer une analyse basique
function createBasicAnalysis(text) {
  const wordCount = text.split(' ').length;
  const sentenceCount = text.split(/[.!?]+/).length - 1;
  
  return {
    summary: "Analyse basique effectuée. Texte de " + wordCount + " mots.",
    key_topics: ["communication", "échange"],
    important_entities: [],
    sentiment: "neutre",
    sentiment_score: 0.5,
    structure_analysis: {
      introduction: "basique",
      development: "basique",
      conclusion: "basique",
      overall_structure: "moyen"
    },
    communication_advice: [
      "Développez davantage vos points principaux",
      "Variez le rythme de votre discours"
    ],
    tone_analysis: {
      emotion: "neutre",
      pace: "modéré",
      clarity: "bonne",
      confidence_level: 0.6
    },
    target_audience: ["général"],
    expertise_level: "intermédiaire",
    emotional_engagement: {
      type: "informatif",
      level: 0.5
    },
    visual_suggestions: ["Utilisez des supports visuels", "Maintenez un contact visuel"]
  };
}

// Fonction helper pour calculer un score IA basé sur l'analyse
function calculateAIScore(analysisResult) {
  let score = 7.0; // Score de base

  // Augmenter le score en fonction de la qualité de l'analyse
  if (analysisResult.summary && analysisResult.summary.length > 50) score += 0.5;
  if (analysisResult.key_topics && analysisResult.key_topics.length >= 3) score += 0.5;
  if (analysisResult.important_entities && analysisResult.important_entities.length > 0) score += 0.5;
  if (analysisResult.communication_advice && analysisResult.communication_advice.length > 0) score += 0.5;
  if (analysisResult.tone_analysis) score += 0.5;
  if (analysisResult.sentiment_score > 0.7) score += 0.5;
  if (analysisResult.structure_analysis && analysisResult.structure_analysis.overall_structure === "excellent") score += 1.0;

  // Limiter à 10.0
  return Math.min(score, 10.0);
}
