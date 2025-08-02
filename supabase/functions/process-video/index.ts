import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  let video_id;
  try {
    const { video_id: id } = await req.json();
    video_id = id;

    if (!video_id) {
      return new Response(JSON.stringify({ error: 'video_id est requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Récupérer la transcription et le titre de la vidéo
    const { data: videoData, error: fetchError } = await adminSupabase
      .from('videos')
      .select('title, transcription, analysis')
      .eq('id', video_id)
      .single();

    if (fetchError || !videoData) {
      throw new Error(`Vidéo ou transcription introuvable: ${fetchError?.message || 'Aucune donnée'}`);
    }

    const { title, transcription } = videoData;

    if (!transcription) {
      throw new Error('Transcription non disponible pour cette vidéo.');
    }

    // 2. Générer l'analyse AI
    const analysisResult = await generateAnalysis(transcription, title);

    // 3. Mettre à jour la vidéo avec le résultat de l'analyse
    const { error: updateError } = await adminSupabase
      .from('videos')
      .update({ analysis: analysisResult, status: 'processed' })
      .eq('id', video_id);

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour de l'analyse: ${updateError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      video_id,
      message: 'Analyse AI terminée avec succès',
      analysis_result: analysisResult,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Erreur lors du traitement de la vidéo:', error);

    if (video_id) {
      try {
        const errorSupabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await errorSupabase
          .from('videos')
          .update({ status: 'failed', analysis_error: error.message?.substring(0, 1000) || 'Erreur inconnue' })
          .eq('id', video_id);
      } catch (dbError) {
        console.error('Erreur lors de la mise à jour du statut d\'erreur:', dbError);
      }
    }

    return new Response(JSON.stringify({
      error: error.message || 'Erreur inconnue',
      video_id: video_id || 'inconnu',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

async function generateAnalysis(transcriptionText, videoTitle) {
  if (!transcriptionText || transcriptionText.trim().length < 10) {
    return null;
  }
  
  const prompt = `
    Analyse la transcription suivante d'une vidéo intitulée "${videoTitle || 'Sans titre'}".
    
    TRANSCRIPTION:
    ${transcriptionText.substring(0, 4000)} ${transcriptionText.length > 4000 ? '...(tronqué)' : ''}
    
    Fournis une analyse structurée au format JSON avec les éléments suivants:
    1. Un résumé concis (max 200 mots)
    2. Les points clés (5 maximum)
    3. Une évaluation de la clarté du discours (sur 10)
    4. Une évaluation de la structure (sur 10)
    5. Des suggestions d'amélioration (3 maximum)
    
    Format JSON attendu:
    {
      "resume": "...",
      "points_cles": ["...", "..."],
      "evaluation": {
        "clarte": 7,
        "structure": 8
      },
      "suggestions": ["...", "..."]
    }
    
    Réponds uniquement avec le JSON, sans texte supplémentaire.
  `;
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API OpenAI: ${response.status}`);
    }
    
    const result = await response.json();
    const analysisText = result.choices[0]?.message?.content;
    
    if (!analysisText) {
      throw new Error("Réponse OpenAI vide");
    }
    
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Format JSON non trouvé");
      
      return JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Erreur de parsing JSON:", parseError);
      return {
        resume: "Analyse non disponible - erreur de format",
        error: true,
        raw_response: analysisText.substring(0, 500)
      };
    }
  } catch (error) {
    console.error("Erreur lors de l'analyse OpenAI:", error);
    return null;
  } 
}
