import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBING: 'transcribing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  FAILED: 'failed'
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

// Fonction utilitaire pour les retries avec backoff exponentiel
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let attempt = 0;
  let lastError: Error;
  
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      lastError = error;
      
      if (attempt >= maxAttempts) break;
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Tentative ${attempt} échouée, nouvelle tentative dans ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let videoId: string | null = null;
  let serviceClient: any = null;

  try {
    console.log('Fonction transcribe-video appelée');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes');
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète', details: "Variables d'environnement manquantes" }),
        { headers: corsHeaders, status: 500 }
      );
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { 
        fetch: (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          return fetch(input, { ...init, signal: controller.signal })
            .finally(() => clearTimeout(timeoutId));
        }
      }
    });

    // Extraction simplifiée de l'userId
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const { data } = await serviceClient.auth.getUser(token);
        if (data?.user) {
          userId = data.user.id;
          console.log(`Utilisateur authentifié: ${userId}`);
        }
      } catch (authError) {
        console.error("Erreur d'authentification:", authError);
      }
    }

    // Extraction du videoId
    const url = new URL(req.url);
    videoId = url.searchParams.get('videoId');
    
    if (!videoId) {
      try {
        const requestData = await req.json();
        videoId = requestData.videoId;
      } catch (parseError) {
        console.error("Erreur lors de l'extraction du videoId:", parseError);
      }
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          error: 'videoId est requis',
          details: 'Veuillez fournir videoId soit dans les paramètres d\'URL, soit dans le corps de la requête'
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    console.log(`Traitement de la vidéo: ${videoId}`);

    // Récupération de la vidéo avec retry
    const video = await withRetry(async () => {
      const { data, error } = await serviceClient
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();
      
      if (error) throw error;
      if (!data) throw new Error('Vidéo non trouvée');
      
      return data;
    });

    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}, chemin: ${video.storage_path}`);
    console.log(`Statut actuel de la vidéo: ${video.status}`);

    // Mise à jour du statut
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.TRANSCRIBING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId);

    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut: ${updateError.message}`);
      throw updateError;
    }

    console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.TRANSCRIBING}'`);

    if (!video.storage_path) {
      throw new Error('Chemin de stockage manquant pour la vidéo');
    }

    // Génération de l'URL signée
    console.log(`Génération d'une URL signée pour ${video.storage_path}`);
    
    let bucket = 'videos';
    let filePath = video.storage_path;
    
    // Nettoyage du chemin de fichier
    if (filePath.includes('/')) {
      const parts = filePath.split('/');
      if (parts.length > 1) {
        const possibleBucket = parts[0];
        const { data: buckets } = await serviceClient.storage.listBuckets();
        const bucketExists = (buckets || []).some((b: any) => b.name === possibleBucket);
        
        if (bucketExists) {
          bucket = possibleBucket;
          filePath = parts.slice(1).join('/');
        }
      }
    }

    if (filePath.startsWith(`${bucket}/`)) {
      filePath = filePath.substring(bucket.length + 1);
    }

    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60);

    if (signedUrlError) {
      console.error('Erreur lors de la création de l\'URL signée:', signedUrlError);
      throw new Error(`Impossible de générer l'URL signée: ${signedUrlError.message}`);
    }

    const videoUrl = signedUrlData.signedUrl;
    console.log(`URL signée générée avec succès: ${videoUrl.substring(0, 50)}...`);

    // Téléchargement de la vidéo
    console.log('Téléchargement de la vidéo...');
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.status} ${response.statusText}`);
    }
    
    const videoBlob = await response.blob();
    console.log(`Vidéo téléchargée (${videoBlob.size} bytes)`);

    // Utilisation directe du blob vidéo sans conversion
    console.log('Envoi à Whisper pour transcription...');
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const transcription = await withRetry(async () => {
      return await openai.audio.transcriptions.create({
        file: new File(
          [videoBlob], 
          `video.${videoBlob.type.split('/')[1] || 'mp4'}`, 
          { type: videoBlob.type }
        ),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json'
      });
    });

    console.log('Transcription terminée avec succès');

    // Calcul du score de confiance
    const confidenceScore = transcription.segments && transcription.segments.length > 0 
      ? transcription.segments.reduce((sum: number, segment: any) => sum + (segment.confidence || 0), 0) / transcription.segments.length
      : null;

    // Nettoyage des segments
    const cleanSegments = Array.isArray(transcription.segments) 
      ? transcription.segments.map((segment: any) => ({
          id: segment.id || null,
          start: segment.start || 0,
          end: segment.end || 0,
          text: segment.text || '',
          confidence: segment.confidence || 0,
          tokens: segment.tokens || []
        }))
      : [];

    const transcriptionData = {
      text: transcription.text || '',
      segments: cleanSegments,
      language: transcription.language || 'fr',
      duration: transcription.duration || 0
    };

    console.log('Enregistrement de la transcription dans Supabase...');

    // CORRECTION: Suppression de l'objet Authorization dans les données de transcription
    // Enregistrement dans la table transcriptions
    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId,
        user_id: userId,
        full_text: transcription.text,
        transcription_text: transcription.text,
        transcription_data: transcriptionData, // Données propres sans en-têtes
        segments: cleanSegments,
        confidence_score: confidenceScore,
        status: 'transcribed',
        updated_at: new Date().toISOString()
      }, { onConflict: 'video_id' });

    if (transcriptionTableError) {
      console.error('Erreur lors de l\'enregistrement de la transcription:', transcriptionTableError);
      throw new Error(`Échec de l'enregistrement: ${transcriptionTableError.message}`);
    }

    // CORRECTION: Mise à jour de la table videos avec des données propres
    const { error: videoUpdateError } = await serviceClient
      .from('videos')
      .update({
        transcription_text: transcription.text,
        transcription_data: transcriptionData, // Données propres sans en-têtes
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (videoUpdateError) {
      console.error('Erreur lors de la mise à jour de la vidéo:', videoUpdateError);
      throw new Error(`Échec de la mise à jour vidéo: ${videoUpdateError.message}`);
    }

    console.log('Transcription enregistrée avec succès.');

    // Déclencher l'analyse de la transcription
    console.log('Déclenchement de l\'analyse de la transcription...');
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
        const errorText = await response.text();
        console.error(`Erreur de la fonction d'analyse (${response.status}): ${errorText}`);
      } else {
        console.log('Analyse de la transcription déclenchée avec succès');
      }
    } catch (invokeError) {
      console.error("Erreur lors de l'invocation de la fonction d'analyse:", invokeError);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Transcription terminée avec succès', 
        videoId,
        transcription_length: transcription.text.length,
        confidence_score: confidenceScore
      }), 
      { headers: corsHeaders, status: 200 }
    );

  } catch (error: any) {
    console.error('Erreur générale dans transcribe-video:', error);
    
    try {
      if (videoId && serviceClient) {
        await serviceClient
          .from('videos')
          .update({ 
            status: VIDEO_STATUS.FAILED, 
            error_message: `Erreur: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      }
    } catch (updateError) {
      console.error('Erreur lors de la mise à jour du statut d\'erreur:', updateError);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Erreur interne du serveur',
        details: error.message || 'Une erreur inattendue est survenue.'
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
