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
        headers: { "Content-Type": "application/json" }
      });
    }
    video_id = requestVideoId;
    
    // 2. Création du client Supabase avec le token d'authentification
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: { Authorization: authHeader || '' }
        }
      }
    );
    
    // 3. Récupération de la vidéo avec user_id
    const { data: videoData, error: fetchError } = await supabase
      .from('videos')
      .select('file_path, storage_path, user_id')
      .eq('id', video_id)
      .single();
      
    if (fetchError || !videoData) {
      throw new Error(`Vidéo introuvable: ${fetchError?.message || 'Aucune donnée'}`);
    }
    
    // 4. Construction de l'URL publique (utilise storage_path s'il existe, sinon file_path)
    const storagePath = videoData.storage_path || videoData.file_path;
    if (!storagePath) {
      throw new Error('Chemin de stockage non défini pour cette vidéo');
    }
    
    // Création d'une URL signée pour accéder au fichier
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('videos')
      .createSignedUrl(storagePath, 3600);
      
    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(`Erreur URL signée: ${signedUrlError?.message || 'URL non générée'}`);
    }
    
    // 5. Mise à jour du statut en "processing"
    await supabase.from('videos').update({
      status: 'processing',
      transcription_attempts: supabase.rpc('increment', {
        row_id: video_id,
        table_name: 'videos',
        column_name: 'transcription_attempts'
      })
    }).eq('id', video_id);
    
    // 6. Téléchargement de la vidéo
    const videoResponse = await fetch(signedUrlData.signedUrl);
    if (!videoResponse.ok) {
      throw new Error(`Échec du téléchargement vidéo: ${videoResponse.status}`);
    }
    const videoBlob = await videoResponse.blob();
    
    // 7. Transcription avec Whisper
    const formData = new FormData();
    formData.append('file', videoBlob, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    
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
    
    // 8. Mise à jour de la vidéo avec la transcription
    const { error: dbError } = await supabase.from('videos').update({
      transcription: transcriptionResult,
      processed_at: new Date().toISOString(),
      status: 'published'
    }).eq('id', video_id);
    
    if (dbError) {
      throw new Error(`Erreur DB: ${dbError.message}`);
    }
    
    // 9. Création d'une entrée dans la table transcriptions
    try {
      await supabase.from('transcriptions').insert({
        video_id: video_id,
        language: transcriptionResult.language || 'fr',
        full_text: transcriptionResult.text,
        segments: transcriptionResult.segments || null,
        user_id: videoData.user_id
      });
    } catch (transcriptionError) {
      console.error("Erreur lors de la création de l'entrée transcription:", transcriptionError);
    }
    
    return new Response(JSON.stringify({
      success: true,
      video_id,
      message: "Transcription terminée avec succès"
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Erreur de transcription:", error);
    
    // 10. Gestion des erreurs
    if (video_id) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        
        await supabase.from('videos').update({
          status: 'failed',
          transcription_error: error.message?.substring(0, 1000) || 'Erreur inconnue'
        }).eq('id', video_id);
      } catch (dbError) {
        console.error("Erreur lors de la mise à jour du statut d'erreur:", dbError);
      }
    }
    
    return new Response(JSON.stringify({
      error: error.message || 'Erreur inconnue',
      video_id: video_id || 'inconnu'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
