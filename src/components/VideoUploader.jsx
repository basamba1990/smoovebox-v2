import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  let video_id;
  try {
    // 1. Récupération et validation des données
    const { video_id: requestVideoId } = await req.json();
    if (!requestVideoId) {
      return new Response(JSON.stringify({
        error: 'video_id requis'
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    video_id = requestVideoId;

    // 2. Création du client Supabase avec authentification
    // Utiliser le token d'authentification de la requête pour respecter les RLS
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Authentification requise'
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Client avec rôle de service pour les opérations nécessitant des privilèges élevés
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3. Récupération des informations de la vidéo
    const { data: videoData, error: fetchError } = await supabase
      .from('videos')
      .select('id, file_path, storage_path, user_id, title')
      .eq('id', video_id)
      .single();

    if (fetchError || !videoData) {
      throw new Error(`Vidéo introuvable: ${fetchError?.message || 'Aucune donnée'}`);
    }

    // 4. Construction du chemin de stockage correct
    const storagePath = videoData.storage_path || videoData.file_path;
    if (!storagePath) {
      throw new Error('Chemin de stockage non défini pour cette vidéo');
    }

    // 5. Mise à jour du statut en "processing"
    await adminSupabase.from('videos')
      .update({
        status: 'processing',
        transcription_attempts: adminSupabase.rpc('increment', {
          row_id: video_id,
          table_name: 'videos',
          column_name: 'transcription_attempts'
        })
      })
      .eq('id', video_id);

    // 6. Récupération de l'URL signée pour accéder au fichier
    const { data: signedUrlData, error: signedUrlError } = await adminSupabase
      .storage
      .from(storagePath.split('/')[0]) // Bucket name
      .createSignedUrl(storagePath.split('/').slice(1).join('/'), 60); // Path inside bucket, 60 seconds expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(`Impossible d'obtenir l'URL signée: ${signedUrlError?.message || 'URL non générée'}`);
    }

    // 7. Téléchargement de la vidéo
    const videoResponse = await fetch(signedUrlData.signedUrl);
    if (!videoResponse.ok) {
      throw new Error(`Échec du téléchargement vidéo: ${videoResponse.status}`);
    }
    const videoBlob = await videoResponse.blob();

    // 8. Transcription avec Whisper
    const formData = new FormData();
    formData.append('file', videoBlob, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr'); // Spécifier la langue pour de meilleurs résultats
    formData.append('response_format', 'verbose_json'); // Format détaillé avec segments

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: formData
    });

    if (!whisperResponse.ok) {
      const error = await whisperResponse.json();
      throw new Error(`Erreur OpenAI: ${error.error?.message || JSON.stringify(error) || 'Erreur inconnue'}`);
    }

    const transcriptionResult = await whisperResponse.json();

    // 9. Mise à jour de la vidéo avec la transcription
    const { error: updateError } = await adminSupabase
      .from('videos')
      .update({
        transcription: transcriptionResult,
        processed_at: new Date().toISOString(),
        status: 'published'
      })
      .eq('id', video_id);

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour de la vidéo: ${updateError.message}`);
    }

    // 10. Création d'une entrée dans la table transcriptions
    const { error: transcriptionError } = await adminSupabase
      .from('transcriptions')
      .insert({
        video_id: video_id,
        language: transcriptionResult.language || 'fr',
        full_text: transcriptionResult.text,
        segments: transcriptionResult.segments || null,
        user_id: videoData.user_id,
        confidence_score: transcriptionResult.segments ? 
          calculateAverageConfidence(transcriptionResult.segments) : null,
        transcription_text: transcriptionResult.text
      });

    if (transcriptionError) {
      console.error("Erreur lors de la création de l'entrée transcription:", transcriptionError);
      // On continue même si cette étape échoue
    }

    // 11. Générer une analyse AI de la transcription
    let analysisResult = null;
    try {
      analysisResult = await generateAnalysis(transcriptionResult.text, videoData.title);
      
      // Enregistrer l'analyse dans la vidéo
      await adminSupabase
        .from('videos')
        .update({
          analysis: analysisResult
        })
        .eq('id', video_id);
        
    } catch (analysisError) {
      console.error("Erreur lors de l'analyse AI:", analysisError);
      // On continue même si l'analyse échoue
    }

    return new Response(JSON.stringify({
      success: true,
      video_id,
      message: "Transcription terminée avec succès",
      has_analysis: !!analysisResult
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Erreur de transcription:", error);
    
    // 12. Gestion des erreurs avec mise à jour du statut
    if (video_id) {
      try {
        const errorSupabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await errorSupabase
          .from('videos')
          .update({
            status: 'failed',
            transcription_error: error.message?.substring(0, 1000) || 'Erreur inconnue'
          })
          .eq('id', video_id);
      } catch (dbError) {
        console.error("Erreur lors de la mise à jour du statut d'erreur:", dbError);
      }
    }
    
    return new Response(JSON.stringify({
      error: error.message || 'Erreur inconnue',
      video_id: video_id || 'inconnu'
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});

// Fonction utilitaire pour calculer le score de confiance moyen
function calculateAverageConfidence(segments) {
  if (!segments || segments.length === 0) return null;
  
  const confidenceSum = segments.reduce((sum, segment) => {
    return sum + (segment.confidence || 0);
  }, 0);
  
  return (confidenceSum / segments.length) * 100; // Convertir en pourcentage
}

// Fonction pour générer une analyse AI de la transcription
async function generateAnalysis(transcriptionText, videoTitle) {
  if (!transcriptionText || transcriptionText.trim().length < 10) {
    return null;
  }
  
  const prompt = `
    Analyse la transcription suivante d'une vidéo intitulée "${videoTitle}".
    
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
    
    // Extraire le JSON de la réponse
    try {
      // Nettoyer la chaîne pour s'assurer qu'elle ne contient que du JSON
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Format JSON non trouvé");
      
      return JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Erreur de parsing JSON:", parseError);
      // Retourner un objet structuré même en cas d'erreur
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
