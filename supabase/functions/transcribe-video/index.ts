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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200
    })
  }

  let videoId: string | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;

  try {
    console.log('Fonction transcribe-video appelée')

    // Initialiser les variables d'environnement avec les noms corrects
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey
      })
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
      auth: { persistSession: false }
    })

    // RÉCUPÉRATION DES DONNÉES DE LA REQUÊTE
    let videoUrl: string | null = null
    
    // Essayer d'abord les paramètres d'URL
    const url = new URL(req.url)
    videoId = url.searchParams.get('videoId')

    // Si pas trouvé dans l'URL et que c'est une requête POST, essayer le corps
    if (!videoId && req.method === 'POST') {
      try {
        const requestBody = await req.text()
        if (requestBody) {
          const data = JSON.parse(requestBody)
          videoId = data.videoId
          videoUrl = data.videoUrl
        }
      } catch (e) {
        console.error('Erreur lors de l\'analyse du corps JSON:', e)
      }
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          error: 'videoId est requis',
          details: 'Veuillez fournir videoId soit dans les paramètres d\'URL (?videoId=...), soit dans le corps de la requête POST' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    // VÉRIFIER L'ACCÈS À LA VIDÉO
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId as string)
      .single()

    if (videoError || !video) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError)
      return new Response(
        JSON.stringify({ 
          error: 'Vidéo non trouvée ou accès non autorisé' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 404 
        }
      )
    }

    // MISE À JOUR DU STATUT
    await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId as string)

    // TÉLÉCHARGEMENT ET TRANSCRIPTION
    let audioBlob: Blob | null = null;

    if ((video as any).storage_path) {
      try {
        const storagePath = (video as any).storage_path as string;
        const pathParts = storagePath.split('/');
        let bucketName: string;
        let filePath: string;

        if (pathParts.length > 1 && pathParts[0] === 'videos') {
          bucketName = pathParts[0];
          filePath = pathParts.slice(1).join('/');
        } else {
          bucketName = 'videos';
          filePath = storagePath;
        }

        const { data: fileData, error: downloadError } = await serviceClient.storage
          .from(bucketName)
          .download(filePath);

        if (downloadError) throw downloadError;
        if (!fileData || fileData.size === 0) throw new Error('Fichier vide');

        audioBlob = fileData;
      } catch (storageError) {
        console.error('Échec du téléchargement direct:', storageError);
      }
    }

    if (!audioBlob) {
      videoUrl = (video as any).url;
      if (videoUrl) {
        try {
          const response = await fetch(videoUrl);
          if (!response.ok) throw new Error('Échec du téléchargement');
          audioBlob = await response.blob();
        } catch (fetchError) {
          console.error('Échec du téléchargement via URL:', fetchError);
        }
      }
    }

    if (!audioBlob) {
      const errorMessage = 'Impossible de télécharger la vidéo';
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({ error: 'Téléchargement impossible', details: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // TRANSCRIPTION AVEC OPENAI
    const openai = new OpenAI({ apiKey: openaiApiKey });
    let transcriptionResult: any;

    try {
      const file = new File([audioBlob], 'audio.mp4', { type: audioBlob.type || 'video/mp4' });
      transcriptionResult = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      });
    } catch (transcriptionError) {
      const errorMessage = `Erreur de transcription: ${transcriptionError.message}`;
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({ error: 'Erreur de transcription', details: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // SOLUTION POUR LE FORMAT DE DONNÉES PROBLÉMATIQUE
    // 1. Stockez simplement le texte brut de la transcription pour éviter les problèmes de format
    const transcriptionText = transcriptionResult.text || '';
    
    // 2. Vérifier le schéma de la table pour déterminer le format correct à utiliser
    // Remplacement de l'appel RPC par une requête directe sur information_schema
    let columnType = null;
    try {
      const { data: columns, error: schemaError } = await serviceClient
        .from('information_schema.columns')
        .select('data_type')
        .eq('table_name', 'videos')
        .eq('column_name', 'transcription_data')
        .single();
      
      if (!schemaError && columns) {
        columnType = columns.data_type;
      }
    } catch (err) {
      console.error("Erreur lors de la vérification du schéma:", err);
    }
    
    console.log("Type de colonne transcription_data:", columnType);
    
    // 3. Préparer la mise à jour avec seulement les données essentielles
    const updatePayload: any = {
      transcription_text: transcriptionText,
      status: VIDEO_STATUS.TRANSCRIBED,
      updated_at: new Date().toISOString()
    };

    // 4. N'ajouter transcription_data que si on peut déterminer son type
    if (columnType) {
      if (columnType === 'jsonb' || columnType === 'json') {
        // Si c'est JSONB/JSON, stocker un objet
        updatePayload.transcription_data = {
          text: transcriptionResult.text,
          language: transcriptionResult.language,
          duration: transcriptionResult.duration
        };
      } else if (columnType.includes('[]') || columnType === 'ARRAY') {
        // Si c'est un ARRAY, stocker un tableau de chaînes
        updatePayload.transcription_data = [transcriptionResult.text];
      } 
      // Sinon ne pas inclure ce champ du tout
    }

    // ENREGISTRER LA TRANSCRIPTION
    const { error: transcriptionUpdateError } = await serviceClient
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId as string);

    if (transcriptionUpdateError) {
      console.error('Erreur lors de la mise à jour:', transcriptionUpdateError);
      
      // Tentative de sauvegarde simplifiée en cas d'échec
      const simplifiedPayload = {
        transcription_text: transcriptionText,
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString(),
        error_message: `Erreur complète: ${transcriptionUpdateError.message}`
      };
      
      await serviceClient
        .from('videos')
        .update(simplifiedPayload)
        .eq('id', videoId as string);

      return new Response(
        JSON.stringify({ 
          error: 'Erreur d\'enregistrement partiel', 
          details: 'Transcription terminée mais erreur lors de l\'enregistrement des données détaillées',
          transcription_text: transcriptionText
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // DÉCLENCHER L'ANALYSE - UTILISATION DIRECTE DE SUPABASE AU LIEU DE RPC
    try {
      // Mise à jour directe du statut pour déclencher l'analyse
      const { error: analysisError } = await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.ANALYZING,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      if (analysisError) {
        console.error('Erreur lors du déclenchement de l\'analyse:', analysisError);
        throw new Error(`Échec du déclenchement de l'analyse: ${analysisError.message}`);
      }

      console.log('Analyse démarrée avec succès via mise à jour directe');

    } catch (invokeError) {
      console.error("Erreur lors de l'invocation de l'analyse:", invokeError);
      
      // Mettre à jour le statut en cas d'erreur
      await serviceClient
        .from('videos')
        .update({
          status: VIDEO_STATUS.FAILED,
          error_message: `Erreur lors du déclenchement de l'analyse: ${invokeError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
    }

    return new Response(
      JSON.stringify({
        message: 'Transcription terminée avec succès',
        videoId,
        transcription_length: transcriptionText.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Erreur générale:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur', 
        details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
