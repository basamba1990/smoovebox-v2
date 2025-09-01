import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Valeurs exactes autorisées pour le statut dans la base de données
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
} as const

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;

  try {
    console.log('Fonction transcribe-video appelée')
    
    // Initialiser les variables d'environnement
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes')
      return new Response(
        JSON.stringify({
          error: 'Configuration incomplète',
          details: "Variables d'environnement manquantes"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Créer un client Supabase avec timeout configuré
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
    })

    // Récupérer le videoId de la requête
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
        console.error("Erreur lors de l'analyse du JSON de la requête:", parseError)
      }
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          error: 'videoId est requis',
          details: 'Veuillez fournir videoId comme paramètre d\'URL (?videoId=...) ou dans le corps JSON de la requête'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Vérifier l'accès à la vidéo
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError)
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log(`Vidéo trouvée: ${video.id}, statut: ${video.status}`)

    // Mise à jour du statut => processing
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId)

    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId}`, updateError)
    }

    // Téléchargement du fichier
    let audioBlob: Blob | null = null;

    // PRIORITÉ 1: Téléchargement direct via storage_path
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
        if (!fileData) throw new Error('Aucune donnée de fichier retournée');

        audioBlob = fileData;
        console.log(`Téléchargement direct réussi, taille: ${audioBlob.size} octets`);
        
      } catch (storageError: any) {
        console.error('Échec du téléchargement direct:', storageError.message);
      }
    }

    // PRIORITÉ 2: Fallback URL
    if (!audioBlob && video.url) {
      try {
        const response = await fetch(video.url, {
          method: 'GET',
          headers: { 'User-Agent': 'Supabase-Edge-Function/1.0' }
        });
        
        if (!response.ok) throw new Error(`Échec du téléchargement. Statut: ${response.status}`);
        audioBlob = await response.blob();
        console.log(`Téléchargement via URL réussi, taille: ${audioBlob.size} octets`);
      } catch (fetchError: any) {
        console.error('Échec du téléchargement via URL:', fetchError.message);
      }
    }

    if (!audioBlob) {
      const errorMessage = 'Impossible de télécharger le fichier vidéo';
      console.error(errorMessage);
      
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      return new Response(
        JSON.stringify({ error: 'Erreur de téléchargement', details: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Transcription avec OpenAI Whisper
    console.log('Début de la transcription avec OpenAI Whisper...')
    
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
      
      console.log('Transcription réussie, longueur du texte:', transcriptionResult.text?.length || 0)
    } catch (transcriptionError: any) {
      console.error('Erreur lors de la transcription:', transcriptionError)
      
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

    // CORRECTION PRINCIPALE: Éviter d'écrire des objets dans des colonnes de type ARRAY
    // Préparer les données pour la mise à jour
    const updatePayload: any = {
      transcription_text: transcriptionResult.text || '',
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString()
    };

    // CORRECTION: Stocker les données de transcription dans la colonne jsonb appropriée
    // plutôt que dans la colonne tags qui est de type ARRAY
    if (transcriptionResult) {
      updatePayload.transcription_data = transcriptionResult;
    }

    console.log('Mise à jour de la base de données avec les données de transcription...')
    
    // CORRECTION: Utiliser une méthode de mise à jour simple et directe
    const { error: transcriptionUpdateError } = await serviceClient
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId)

    if (transcriptionUpdateError) {
      console.error('Erreur lors de la mise à jour de la transcription:', transcriptionUpdateError)
      
      // CORRECTION: En cas d'erreur, essayer une mise à jour minimaliste
      const { error: simpleUpdateError } = await serviceClient
        .from('videos')
        .update({
          transcription_text: transcriptionResult.text || '',
          status: VIDEO_STATUS.TRANSCRIBED,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)
      
      if (simpleUpdateError) {
        console.error('Échec de la mise à jour minimaliste:', simpleUpdateError)
        
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: `Erreur lors de l'enregistrement: ${simpleUpdateError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)

        return new Response(
          JSON.stringify({ error: 'Erreur d\'enregistrement', details: simpleUpdateError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    console.log('Transcription enregistrée avec succès')

    // Déclencher la fonction d'analyse
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ videoId })
      });
      
      if (!response.ok) {
        console.error(`Erreur de la fonction d'analyse: ${response.status}`)
      } else {
        console.log('Analyse démarrée avec succès')
      }
    } catch (invokeError) {
      console.error("Erreur lors de l'invocation de la fonction d'analyse:", invokeError)
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
    console.error('Erreur générale dans la fonction transcribe-video:', error)
    
    try {
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
    } catch (updateError) {
      console.error('Erreur lors de la mise à jour du statut d\'erreur:', updateError)
    }
    
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
