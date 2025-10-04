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
}

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 
  'Access-Control-Allow-Methods': 'POST, OPTIONS' 
}

Deno.serve(async (req) => {
  console.log("🎤 transcribe-video appelée");

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId = null;

  try {
    console.log("📨 Headers:", Object.fromEntries(req.headers));
    
    const { videoId: vidId, userId, videoUrl } = await req.json();
    videoId = vidId;

    console.log("📦 Paramètres reçus:", { 
      videoId, 
      userId, 
      videoUrl: videoUrl ? videoUrl.substring(0, 100) + "..." : "NULL" 
    });

    // ✅ CORRIGÉ : Validation améliorée de l'URL
    if (!videoId || !userId || !videoUrl) {
      throw new Error('Paramètres manquants: videoId, userId, videoUrl requis');
    }

    try {
      new URL(videoUrl);
    } catch (urlError) {
      throw new Error(`URL vidéo invalide: ${videoUrl}. Erreur: ${urlError.message}`);
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

    // Mettre à jour le statut de la vidéo
    console.log("🔄 Mise à jour statut PROCESSING");
    const { error: statusError } = await supabase
      .from('videos')
      .update({ 
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (statusError) {
      throw new Error(`Erreur mise à jour statut: ${statusError.message}`);
    }

    console.log('🎙️ Début transcription pour la vidéo:', videoId);
    console.log("📹 URL vidéo à traiter:", videoUrl);

    // ✅ CORRIGÉ : Téléchargement avec gestion d'erreur améliorée
    console.log("📥 Téléchargement vidéo...");
    const videoResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'SpotBulle-Transcription/1.0'
      }
    });
    
    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      throw new Error(`Erreur téléchargement vidéo: ${videoResponse.status} ${videoResponse.statusText}. Détails: ${errorText}`);
    }

    const videoBlob = await videoResponse.blob();
    console.log(`📊 Taille vidéo téléchargée: ${videoBlob.size} bytes`);

    if (videoBlob.size === 0) {
      throw new Error('Fichier vidéo vide ou inaccessible');
    }

    // Transcrire l'audio avec OpenAI Whisper
    console.log("🤖 Appel Whisper...");
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: new File([videoBlob], `video-${videoId}.webm`, { 
        type: 'video/webm' 
      }),
      model: 'whisper-1',
      language: 'fr',
      response_format: 'verbose_json'
    });

    const transcriptionText = transcriptionResponse.text;
    const transcriptionData = {
      text: transcriptionText,
      language: transcriptionResponse.language,
      duration: transcriptionResponse.duration,
      words: transcriptionResponse.words || []
    };

    console.log('✅ Transcription réussie, longueur:', transcriptionText.length);

    // Mettre à jour la vidéo avec la transcription
    console.log("💾 Sauvegarde transcription...");
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        status: VIDEO_STATUS.TRANSCRIBED,
        transcription_text: transcriptionText,
        transcription_data: transcriptionData,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (updateError) {
      throw new Error(`Erreur mise à jour transcription: ${updateError.message}`);
    }

    // Déclencher l'analyse de la transcription
    console.log("🚀 Déclenchement analyse...");
    try {
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          transcriptionText,
          userId
        })
      });

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text();
        console.warn('⚠️ Erreur déclenchement analyse:', errorText);
      } else {
        console.log('✅ Analyse déclenchée avec succès');
      }
    } catch (analyzeError) {
      console.warn('⚠️ Erreur lors du déclenchement de l\'analyse:', analyzeError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription terminée avec succès',
        transcriptionLength: transcriptionText.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erreur transcription:', error);

    // Mettre à jour le statut d'erreur si videoId est disponible
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
            .eq('id', videoId)
        }
      } catch (updateError) {
        console.error('❌ Erreur mise à jour statut erreur:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de la transcription', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
