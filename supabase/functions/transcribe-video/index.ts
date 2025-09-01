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
} as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;

  try {
    console.log('Fonction transcribe-video appelée')
    
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète', details: "Variables d'environnement manquantes" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { fetch: (input, init) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        return fetch(input, { ...init, signal: controller.signal })
          .finally(() => clearTimeout(timeoutId));
      }}
    })

    const url = new URL(req.url)
    videoId = url.searchParams.get('videoId')
    
    if (!videoId) {
      try {
        const requestBody = await req.text()
        if (requestBody.trim()) {
          const requestData = JSON.parse(requestBody)
          videoId = requestData.videoId
        }
      } catch (parseError) {
        console.error("Erreur lors de l'analyse du JSON:", parseError)
      }
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId)

    let audioBlob: Blob | null = null;

    if (video.storage_path) {
      try {
        let bucketName = 'videos';
        let filePath = video.storage_path;
        if (filePath.startsWith('videos/')) {
          filePath = filePath.replace('videos/', '');
        }
        
        const { data: fileData, error: downloadError } = await serviceClient.storage
          .from(bucketName)
          .download(filePath);

        if (downloadError) throw downloadError;
        audioBlob = fileData;
      } catch (storageError) {
        console.error('Échec du téléchargement direct:', storageError);
      }
    }

    if (!audioBlob && video.url) {
      try {
        const response = await fetch(video.url, {
          method: 'GET',
          headers: { 'User-Agent': 'Supabase-Edge-Function/1.0' }
        });
        
        if (!response.ok) throw new Error(`Échec du téléchargement: ${response.status}`);
        audioBlob = await response.blob();
      } catch (fetchError) {
        console.error('Échec du téléchargement via URL:', fetchError);
      }
    }

    if (!audioBlob) {
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: 'Impossible de télécharger le fichier vidéo',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      return new Response(
        JSON.stringify({ error: 'Erreur de téléchargement' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })
    const audioFile = new File([audioBlob], 'audio.mp4', { type: audioBlob.type || 'audio/mp4' })
    
    let transcriptionResult: any;
    try {
      transcriptionResult = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      })
    } catch (transcriptionError) {
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec de la transcription: ${transcriptionError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ error: 'Échec de la transcription', details: transcriptionError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // CORRECTION PRINCIPALE : Formatage correct des données pour la mise à jour
    const updatePayload = {
      transcription_text: transcriptionResult.text || '',
      transcription_data: transcriptionResult, // Stockage dans une colonne JSONB
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString()
    };

    // CORRECTION : Vérification que nous n'écrivons pas dans la colonne tags
    console.log('Données à mettre à jour:', JSON.stringify(updatePayload, null, 2));

    const { error: transcriptionUpdateError } = await serviceClient
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId)

    if (transcriptionUpdateError) {
      console.error('Erreur lors de la mise à jour:', transcriptionUpdateError);
      
      // Fallback simple sans données complexes
      const { error: simpleError } = await serviceClient
        .from('videos')
        .update({
          transcription_text: transcriptionResult.text || '',
          status: VIDEO_STATUS.TRANSCRIBED,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)
      
      if (simpleError) {
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: `Erreur d'enregistrement: ${simpleError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)

        return new Response(
          JSON.stringify({ error: 'Erreur d\'enregistrement', details: simpleError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Transcription terminée avec succès', 
        videoId,
        transcription_length: transcriptionResult.text.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Erreur générale:', error)
    
    if (videoId && serviceClient) {
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur interne: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
    }
    
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
