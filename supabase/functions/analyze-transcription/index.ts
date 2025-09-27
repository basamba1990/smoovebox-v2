import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.104.0';

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
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Timeout pour l'analyse
const ANALYSIS_TIMEOUT = 240000; // 4 minutes

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;

  try {
    console.log("Fonction analyze-transcription appelée");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    // CORRECTION : Vérifier si la clé de service est un placeholder
    if (supabaseServiceKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
      console.error('Clé de service Supabase non configurée correctement (placeholder détecté)');
      return new Response(
        JSON.stringify({
          error: 'Configuration incomplète',
          details: "Clé de service Supabase manquante ou placeholder"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    console.log('Clé de service Supabase:', supabaseServiceKey ? 'Définie (tronquée pour sécurité)' : 'Non définie');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        hasOpenAiKey: !!openaiApiKey
      });
      return new Response(
        JSON.stringify({
          error: 'Configuration incomplète',
          details: "Variables d'environnement manquantes"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          return fetch(input, {
            ...init,
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId));
        }
      }
    });

    try {
      const requestData = await req.json();
      if (requestData.videoId) {
        videoId = requestData.videoId;
        console.log(`videoId du corps de la requête: ${videoId}`);
      }
    } catch (e) {
      console.log('Pas de videoId dans le corps de la requête ou le corps n\'est pas JSON. Essai des paramètres d\'URL.');
    }

    if (!videoId) {
      const url = new URL(req.url);
      videoId = url.searchParams.get('videoId');
      console.log(`videoId des paramètres d\'URL: ${videoId}`);
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('id, status, transcription_text, transcription_data')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}:`, videoError);
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée', details: videoError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (video.status !== VIDEO_STATUS.TRANSCRIBED) {
      console.error(`Mauvais statut de vidéo: ${video.status}, attendu: ${VIDEO_STATUS.TRANSCRIBED}`);
      return new Response(
        JSON.stringify({ error: 'Vidéo non transcrite', details: `Le statut de la vidéo doit être 'transcribed'` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { error: updateError } = await serviceClient
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.ANALYZING, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', videoId);

    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId} à ANALYZING:`, updateError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la mise à jour du statut', details: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.ANALYZING}'.`);

    let fullText = '';
    if (video.transcription_data && typeof video.transcription_data === 'object' && video.transcription_data.text) {
      fullText = video.transcription_data.text;
    } else if (video.transcription_text) {
      fullText = video.transcription_text;
    } else {
      const { data: transcriptionData, error: transcriptionError } = await serviceClient
        .from('transcriptions')
        .select('full_text, transcription_data')
        .eq('video_id', videoId)
        .single();

      if (transcriptionError || !transcriptionData) {
        console.error(`Erreur lors de la récupération de la transcription pour la vidéo ${videoId}:`, transcriptionError);
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: `Transcription non trouvée: ${transcriptionError?.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
        return new Response(
          JSON.stringify({ error: 'Transcription non trouvée', details: transcriptionError?.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      if (transcriptionData.transcription_data && typeof transcriptionData.transcription_data === 'object' && transcriptionData.transcription_data.text) {
        fullText = transcriptionData.transcription_data.text;
      } else if (transcriptionData.full_text) {
        fullText = transcriptionData.full_text;
      }
    }

    if (!fullText || fullText.trim().length === 0) {
      console.error(`Texte de transcription vide pour la vidéo ${videoId}`);
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: 'Texte de transcription vide',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      return new Response(
        JSON.stringify({ error: 'Texte de transcription vide' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Transcription récupérée pour la vidéo ${videoId} (${fullText.length} caractères). Début de l'analyse...`);

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const analysisPrompt = `Analysez la transcription vidéo suivante et fournissez une analyse complète et structurée au format JSON. L'analyse doit inclure :
- Un 'summary' concis (max 3-4 phrases).
- Une liste de 'key_topics' (3-5 thèmes/mots-clés principaux).
- Une liste de 'important_entities' (personnes, organisations, lieux mentionnés).
- Un 'sentiment' général (positif, neutre, négatif).
- Une liste de 'action_items' ou prochaines étapes suggérées par le contenu (le cas échéant, max 3).
- Des 'insights_supplementaires' incluant:
  - 'public_cible': [string, string, ...]
  - 'niveau_expertise': 'débutant'|'intermédiaire'|'avancé'
  - 'engagement_emotionnel': { 'type': string, 'niveau': number }
  - 'formats_visuels_suggeres': [string, string, ...]

Transcription: ${fullText.substring(0, 12000)}

Assurez-vous que la sortie est un objet JSON valide.`;

    let chatCompletion;
    try {
      chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "Vous êtes un assistant IA expert spécialisé dans l'analyse des transcriptions vidéo et l'extraction d'informations structurées. Votre sortie doit toujours être un objet JSON valide." 
          },
          { role: "user", content: analysisPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });
    } catch (openaiError: any) {
      console.error('Erreur OpenAI lors de l\'analyse:', openaiError);
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur OpenAI: ${openaiError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de l\'analyse OpenAI', 
          details: openaiError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let analysisResult;
    try {
      analysisResult = JSON.parse(chatCompletion.choices[0].message.content || '{}');
      
      if (!analysisResult.summary || !analysisResult.key_topics) {
        throw new Error('Réponse OpenAI incomplète ou mal formatée');
      }

      // Validation stricte pour analysis_result
      if (typeof analysisResult === 'object' && !Array.isArray(analysisResult)) {
        try {
          JSON.stringify(analysisResult);
        } catch (e) {
          throw new Error(`Les données d'analyse ne sont pas un JSON valide: ${e.message}`);
        }
      } else {
        throw new Error('analysis_result n\'est pas un objet JSON valide');
      }
    } catch (parseError: any) {
      console.error('Erreur lors de l\'analyse du JSON de la réponse OpenAI:', parseError);
      
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec de l'analyse de la réponse OpenAI: ${parseError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return new Response(
        JSON.stringify({ 
          error: 'Erreur de format de réponse', 
          details: 'La réponse de l\'IA n\'est pas un JSON valide'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Analyse terminée pour la vidéo ${videoId}.`);

    // CORRECTION : Supprimer ai_score car non présent dans le schéma de la table videos
    const updatePayload = {
      analysis: analysisResult,
      status: VIDEO_STATUS.ANALYZED,
      updated_at: new Date().toISOString()
      // ai_score supprimé : colonne absente dans le schéma
    };

    console.log('Payload de mise à jour pour la table videos:', JSON.stringify(updatePayload, null, 2));

    const { error: analysisSaveError } = await serviceClient
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId);

    if (analysisSaveError) {
      console.error(`Erreur lors de l'enregistrement des résultats d'analyse pour la vidéo ${videoId}:`, analysisSaveError);
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec de l'enregistrement de l'analyse: ${analysisSaveError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de l\'enregistrement des résultats d\'analyse', 
          details: analysisSaveError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Mettre à jour la table transcriptions (aligné avec le schéma : analysis_result jsonb)
    const transcriptionUpdatePayload = {
      analysis_result: analysisResult,
      updated_at: new Date().toISOString()
    };

    console.log('Payload de mise à jour pour la table transcriptions:', JSON.stringify(transcriptionUpdatePayload, null, 2));

    const { error: transcriptionUpdateError } = await serviceClient
      .from('transcriptions')
      .update(transcriptionUpdatePayload)
      .eq('video_id', videoId);

    if (transcriptionUpdateError) {
      console.error('Erreur lors de la mise à jour de la transcription avec les résultats d\'analyse:', transcriptionUpdateError);
      // Log seulement, ne pas échouer la requête (non-bloquant)
    } else {
      console.log('Table transcriptions mise à jour avec succès');
    }

    console.log(`Vidéo ${videoId} analysée et statut mis à jour à '${VIDEO_STATUS.ANALYZED}'.`);

    return new Response(
      JSON.stringify({ 
        message: 'Analyse terminée avec succès', 
        videoId, 
        analysisResult 
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error("Erreur générale non gérée dans analyze-transcription:", error);
    
    if (videoId && serviceClient) {
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur interne lors de l'analyse: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
    }

    return new Response(
      JSON.stringify({
        error: 'Erreur interne du serveur',
        details: error.message || 'Une erreur inattendue est survenue.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Fonction helper pour calculer un score IA basé sur l'analyse (CORRECTION : Gardée pour usage futur, mais non utilisée dans update car colonne absente)
function calculateAIScore(analysisResult: any): number {
  let score = 7.0;
  
  if (analysisResult.summary && analysisResult.summary.length > 50) score += 0.5;
  if (analysisResult.key_topics && analysisResult.key_topics.length >= 3) score += 0.5;
  if (analysisResult.important_entities && analysisResult.important_entities.length > 0) score += 0.5;
  if (analysisResult.action_items && analysisResult.action_items.length > 0) score += 0.5;
  if (analysisResult.insights_supplementaires) score += 0.5;
  
  return Math.min(score, 10.0);
}
