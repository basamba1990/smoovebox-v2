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
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Fonction analyze-transcription appelée");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey
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

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    let videoId: string | null = null;

    // Tenter d'obtenir videoId du corps de la requête (pour les requêtes POST)
    try {
      const requestData = await req.json();
      if (requestData.videoId) {
        videoId = requestData.videoId;
        console.log(`videoId du corps de la requête: ${videoId}`);
      }
    } catch (e) {
      console.log('Pas de videoId dans le corps de la requête ou le corps n\'est pas JSON. Essai des paramètres d\'URL.');
    }

    // Si non trouvé dans le corps, essayer les paramètres d'URL (pour les requêtes GET ou en dernier recours)
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

    // Mettre à jour le statut de la vidéo à ANALYZING
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({ status: VIDEO_STATUS.ANALYZING, updated_at: new Date().toISOString() })
      .eq('id', videoId);

    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId} à ANALYZING:`, updateError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la mise à jour du statut de la vidéo', details: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.ANALYZING}'.`);

    // Récupérer la transcription de la vidéo
    const { data: transcriptionData, error: transcriptionError } = await serviceClient
      .from('transcriptions')
      .select('full_text')
      .eq('video_id', videoId)
      .single();

    if (transcriptionError || !transcriptionData) {
      console.error(`Erreur lors de la récupération de la transcription pour la vidéo ${videoId}:`, transcriptionError);
      await serviceClient
        .from('videos')
        .update({ status: VIDEO_STATUS.FAILED, error_message: `Transcription non trouvée: ${transcriptionError?.message}`, updated_at: new Date().toISOString() })
        .eq('id', videoId);
      return new Response(
        JSON.stringify({ error: 'Transcription non trouvée', details: transcriptionError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const fullText = transcriptionData.full_text;
    console.log(`Transcription récupérée pour la vidéo ${videoId}. Début de l'analyse...`);

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Logique d'analyse avancée - Combiner les deux appels en un seul
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

Transcription: ${fullText}

Assurez-vous que la sortie est un objet JSON valide.`;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Vous êtes un assistant IA expert spécialisé dans l'analyse des transcriptions vidéo et l'extraction d'informations structurées. Votre sortie doit toujours être un objet JSON valide." },
        { role: "user", content: analysisPrompt }
      ],
      response_format: { type: "json_object" }, // Spécifie le format de réponse JSON
    });

    let analysisResult;
    try {
      analysisResult = JSON.parse(chatCompletion.choices[0].message.content || '{}');
    } catch (parseError) {
      console.error('Erreur lors de l\'analyse du JSON de la réponse OpenAI:', parseError);
      analysisResult = { error: 'Échec de l\'analyse de la réponse OpenAI', raw_content: chatCompletion.choices[0].message.content };
    }

    console.log(`Analyse terminée pour la vidéo ${videoId}.`);

    // Enregistrer les résultats de l'analyse dans la table 'videos'
    const { error: analysisSaveError } = await serviceClient
      .from('videos')
      .update({
        analysis_result: analysisResult, // Assurez-vous que votre table 'videos' a une colonne 'analysis_result' de type JSONB
        status: VIDEO_STATUS.ANALYZED,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (analysisSaveError) {
      console.error(`Erreur lors de l'enregistrement des résultats d'analyse pour la vidéo ${videoId}:`, analysisSaveError);
      await serviceClient
        .from('videos')
        .update({ status: VIDEO_STATUS.FAILED, error_message: `Échec de l'enregistrement de l'analyse: ${analysisSaveError.message}`, updated_at: new Date().toISOString() })
        .eq('id', videoId);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'enregistrement des résultats d\'analyse', details: analysisSaveError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Après l'analyse, mettre à jour aussi la table transcriptions
    const { error: transcriptionUpdateError } = await serviceClient
      .from('transcriptions')
      .update({
        analysis_result: analysisResult, // ← Stocker le résultat dans transcriptions
        keywords: analysisResult.keywords || [], // ← Extraire les keywords de l'analyse
        updated_at: new Date().toISOString()
      })
      .eq('video_id', videoId);

    if (transcriptionUpdateError) {
      console.error('Erreur lors de la mise à jour de la transcription avec les résultats d\'analyse:', transcriptionUpdateError);
    }

    console.log(`Vidéo ${videoId} analysée et statut mis à jour à '${VIDEO_STATUS.ANALYZED}'.`);

    return new Response(JSON.stringify({ message: 'Analyse terminée avec succès', videoId, analysisResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Erreur générale non gérée dans analyze-transcription:", error);
    // En cas d'erreur non gérée, mettre à jour le statut de la vidéo à FAILED
    let videoIdFromError: string | undefined;
    try {
      const requestData = await req.json();
      videoIdFromError = requestData.videoId;
    } catch (e) {
      const url = new URL(req.url);
      videoIdFromError = url.searchParams.get('videoId') || undefined;
    }

    if (videoIdFromError) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
        await serviceClient
          .from('videos')
          .update({ status: VIDEO_STATUS.FAILED, error_message: `Erreur interne lors de l'analyse: ${error.message}`, updated_at: new Date().toISOString() })
          .eq('id', videoIdFromError);
      }
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
