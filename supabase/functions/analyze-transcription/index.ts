import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;

  try {
    console.log("Fonction analyze-transcription appelée");

    // CORRECTION : Log des en-têtes pour débogage
    console.log("En-têtes reçus:", {
      authorization: req.headers.get('authorization') ? 'présent' : 'absent',
      serviceRole: req.headers.get('x-supabase-service-role') ? 'présent' : 'absent',
      contentType: req.headers.get('content-type')
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes');
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

    // CORRECTION : Vérification d'authentification plus permissive
    const authHeader = req.headers.get('authorization');
    const serviceRoleHeader = req.headers.get('x-supabase-service-role');
    
    // Si aucun en-tête d'authentification n'est présent
    if (!authHeader && !serviceRoleHeader) {
      console.error('Aucun en-tête d\'authentification trouvé');
      return new Response(
        JSON.stringify({ 
          error: 'Authentification requise',
          details: 'Utilisez x-supabase-service-role ou Authorization header'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // CORRECTION : Test de connexion à Supabase
    try {
      const { error: authError } = await serviceClient.auth.getSession();
      if (authError) {
        console.error('Erreur d\'authentification Supabase:', authError);
      } else {
        console.log('Connexion Supabase OK');
      }
    } catch (authTestError) {
      console.error('Test d\'authentification Supabase échoué:', authTestError);
    }

    // Récupération du videoId
    try {
      const requestData = await req.json();
      videoId = requestData.videoId;
      console.log(`videoId du corps: ${videoId}`);
    } catch (e) {
      const url = new URL(req.url);
      videoId = url.searchParams.get('videoId');
      console.log(`videoId des paramètres: ${videoId}`);
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Récupération de la vidéo
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
        JSON.stringify({ 
          error: 'Vidéo non transcrite', 
          details: `Statut actuel: ${video.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Mise à jour du statut
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.ANALYZING, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', videoId);

    if (updateError) {
      console.error(`Erreur mise à jour statut:`, updateError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la mise à jour du statut', details: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Statut mis à jour à '${VIDEO_STATUS.ANALYZING}'`);

    // Récupération du texte
    let fullText = '';
    if (video.transcription_data && typeof video.transcription_data === 'object' && video.transcription_data.text) {
      fullText = video.transcription_data.text;
    } else if (video.transcription_text) {
      fullText = video.transcription_text;
    } else {
      const { data: transcriptionData } = await serviceClient
        .from('transcriptions')
        .select('full_text, transcription_data')
        .eq('video_id', videoId)
        .single();

      if (transcriptionData) {
        if (transcriptionData.transcription_data && typeof transcriptionData.transcription_data === 'object' && transcriptionData.transcription_data.text) {
          fullText = transcriptionData.transcription_data.text;
        } else if (transcriptionData.full_text) {
          fullText = transcriptionData.full_text;
        }
      }
    }

    if (!fullText || fullText.trim().length === 0) {
      console.error(`Texte de transcription vide pour ${videoId}`);
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

    console.log(`Texte récupéré (${fullText.length} caractères), début analyse...`);

    // Analyse OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const analysisPrompt = `Analysez la transcription vidéo suivante et fournissez une analyse structurée au format JSON avec summary, key_topics, important_entities, sentiment, action_items, insights_supplementaires. Transcription: ${fullText.substring(0, 12000)}`;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "Fournissez une analyse JSON structurée" 
        },
        { role: "user", content: analysisPrompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000
    });

    const analysisResult = JSON.parse(chatCompletion.choices[0].message.content || '{}');

    // Validation du résultat
    if (!analysisResult.summary) {
      throw new Error('Réponse OpenAI incomplète');
    }

    // Sauvegarde
    const updatePayload = {
      analysis: analysisResult,
      status: VIDEO_STATUS.ANALYZED,
      updated_at: new Date().toISOString()
    };

    const { error: analysisSaveError } = await serviceClient
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId);

    if (analysisSaveError) {
      console.error('Erreur sauvegarde analyse:', analysisSaveError);
      throw new Error(`Échec sauvegarde: ${analysisSaveError.message}`);
    }

    // Mise à jour de la transcription
    await serviceClient
      .from('transcriptions')
      .update({ analysis_result: analysisResult })
      .eq('video_id', videoId);

    console.log(`Analyse terminée pour ${videoId}`);

    return new Response(
      JSON.stringify({ 
        message: 'Analyse terminée avec succès', 
        videoId
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error("Erreur dans analyze-transcription:", error);
    
    if (videoId && serviceClient) {
      try {
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: error.message.substring(0, 500),
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      } catch (updateError) {
        console.error('Erreur mise à jour statut d\'erreur:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Erreur interne',
        details: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
