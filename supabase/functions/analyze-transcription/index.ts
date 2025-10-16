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

Deno.serve(async (req) => {
  console.log("🔍 Fonction analyze-transcription appelée");

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
        userId: requestBody.userId 
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

    const { videoId: vidId, transcriptionText, userId } = requestBody;
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
        .select('transcription_text')
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

    const analysisPrompt = `
En tant qu'expert en communication, analysez cette transcription vidéo en français.

Transcription: ${textToAnalyze.substring(0, 8000)}

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
`;

    console.log("🤖 Appel OpenAI...");
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Vous êtes un expert en analyse de communication. Répondez UNIQUEMENT en JSON valide, sans texte supplémentaire."
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
      analysisResult = createBasicAnalysis(textToAnalyze);
    }

    // Calculer le score IA
    const aiScore = calculateAIScore(analysisResult);
    console.log(`📊 Score IA calculé: ${aiScore}`);

    // Extraire les insights de matching
    console.log("🔍 Extraction des insights de matching...");
    const matchingInsights = await extractMatchingInsights(analysisResult, textToAnalyze);
    console.log("✅ Insights de matching extraits:", matchingInsights);

    // VÉRIFIER SI LA COLONNE EXISTE AVANT DE METTRE À JOUR
    console.log("🔍 Vérification de l'existence des colonnes...");
    
    // D'abord, essayer avec matching_insights
    let updatePayload = {
      status: VIDEO_STATUS.ANALYZED,
      analysis: analysisResult,
      ai_score: aiScore,
      updated_at: new Date().toISOString()
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

    console.log("🎉 Analyse terminée avec succès");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analyse terminée avec succès',
        videoId: videoId,
        aiScore: aiScore,
        matchingInsights: matchingInsights
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
        error: 'Erreur lors de l\'analyse', 
        details: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// FONCTION POUR EXTRAIRE LES INSIGHTS DE MATCHING
async function extractMatchingInsights(analysis, transcription) {
  return {
    communication_style: analysis.tone_analysis?.emotion || 'neutre',
    expertise_areas: analysis.key_topics || [],
    sentiment_profile: analysis.sentiment,
    key_strengths: analysis.communication_advice || [],
    potential_mentor_topics: extractMentorTopics(analysis, transcription),
    learning_preferences: extractLearningStyle(analysis)
  };
}

function extractMentorTopics(analysis, transcription) {
  const topics = analysis.key_topics || [];
  return topics.filter(topic => 
    transcription.toLowerCase().includes(topic.toLowerCase()) &&
    topic.length > 5
  ).slice(0, 3);
}

function extractLearningStyle(analysis) {
  const style = analysis.tone_analysis?.pace;
  if (style === 'rapide') return 'pratique';
  if (style === 'lent') return 'réflexif';
  return 'équilibré';
}

function createBasicAnalysis(text) {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const sentenceCount = text.split(/[.!?]+/).length - 1;
  const paragraphCount = text.split(/\n\s*\n/).length;
  
  return {
    summary: `Analyse basique: ${wordCount} mots, ${sentenceCount} phrases, ${paragraphCount} paragraphes.`,
    key_topics: ["communication", "partage", "expression"],
    sentiment: "neutre",
    sentiment_score: 0.5,
    communication_advice: [
      "Continuez à pratiquer régulièrement",
      "Variez le débit pour maintenir l'attention"
    ],
    tone_analysis: {
      emotion: "neutre",
      pace: "modéré",
      clarity: "bonne"
    }
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
