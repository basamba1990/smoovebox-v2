// transcribe-video.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { OpenAI } from 'npm:openai@4.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constantes pour les statuts de transcription
const TRANSCRIPTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Récupérer les données de la requête
    const { videoId } = await req.json()
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Récupérer les informations de la vidéo
    const { data: video, error: videoError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}:`, videoError)
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    // Vérifier si la table transcriptions existe, sinon la créer
    try {
      const { data, error } = await supabaseClient
        .from('transcriptions')
        .select('id')
        .limit(1);
      
      if (error && error.code === '42P01') { // Relation n'existe pas
        // Créer la table transcriptions
        const createTranscriptionsTableSQL = `
          CREATE TABLE IF NOT EXISTS public.transcriptions (
            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            video_id BIGINT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'pending',
            text TEXT,
            segments JSONB,
            confidence_score FLOAT,
            language TEXT,
            processed_at TIMESTAMP WITH TIME ZONE,
            error_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Activer Row Level Security
          ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

          -- Créer une politique pour permettre aux utilisateurs de voir leurs propres transcriptions
          CREATE POLICY "Les utilisateurs peuvent voir leurs propres transcriptions"
            ON public.transcriptions FOR SELECT
            USING (EXISTS (
              SELECT 1 FROM public.videos
              WHERE videos.id = transcriptions.video_id
              AND videos.user_id = auth.uid()
            ));

          -- Créer un index sur video_id pour améliorer les performances
          CREATE INDEX IF NOT EXISTS transcriptions_video_id_idx ON public.transcriptions(video_id);
          
          -- Créer un trigger pour mettre à jour le champ updated_at
          CREATE OR REPLACE FUNCTION update_transcriptions_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;

          DROP TRIGGER IF EXISTS update_transcriptions_updated_at ON public.transcriptions;
          CREATE TRIGGER update_transcriptions_updated_at
          BEFORE UPDATE ON public.transcriptions
          FOR EACH ROW
          EXECUTE FUNCTION update_transcriptions_updated_at_column();
        `;
        
        await supabaseClient.sql(createTranscriptionsTableSQL);
      }
    } catch (tableError) {
      console.error('Erreur lors de la vérification/création de la table transcriptions:', tableError);
    }

    // Créer un enregistrement de transcription pour cette vidéo
    const { data: transcription, error: insertError } = await supabaseClient
      .from('transcriptions')
      .insert({
        video_id: videoId,
        status: TRANSCRIPTION_STATUS.PROCESSING
      })
      .select()
      .single();

    if (insertError) {
      console.error(`Erreur lors de la création de l'enregistrement de transcription:`, insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de la transcription', details: insertError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log(`Vidéo ${videoId} - Début de la transcription`);

    try {
      // Vérifier si l'URL existe
      if (!video.url && !video.storage_path) {
        throw new Error('URL de la vidéo manquante ou invalide');
      }
      
      let videoUrl = video.url;

      // Si nous avons un chemin de stockage mais pas d'URL, générer une URL signée
      if (!videoUrl && video.storage_path) {
        const storagePath = video.storage_path.replace('videos/', '');
        const { data: signedUrl, error: signedUrlError } = await supabaseClient
          .storage
          .from('videos')
          .createSignedUrl(storagePath, 3600);

        if (signedUrlError || !signedUrl?.signedUrl) {
          throw new Error(`Impossible de générer l'URL signée: ${signedUrlError?.message || 'URL non générée'}`);
        }

        videoUrl = signedUrl.signedUrl;
      }

      // Vérifier que l'URL est valide
      if (!videoUrl) {
        throw new Error('URL de la vidéo non disponible');
      }

      // Télécharger la vidéo
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) {
        throw new Error(`Erreur téléchargement vidéo: ${videoRes.status} ${videoRes.statusText}`);
      }

      // Convertir la réponse en fichier
      const videoBlob = await videoRes.blob();
      const videoFile = new File(
        [videoBlob],
        "video.mp4",
        { type: "video/mp4" }
      );

      // Initialiser OpenAI
      const openai = new OpenAI({ 
        apiKey: Deno.env.get('OPENAI_API_KEY') || '' 
      });

      // Transcription de la vidéo avec Whisper
      console.log(`Vidéo ${videoId} - Envoi à l'API Whisper`);
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: videoFile,
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json'
      });

      // Extraire les données de la transcription
      const transcriptionText = transcriptionResult.text;
      const segments = transcriptionResult.segments || [];
      const language = transcriptionResult.language;

      // Mettre à jour l'enregistrement de transcription
      const { error: updateError } = await supabaseClient
        .from('transcriptions')
        .update({
          status: TRANSCRIPTION_STATUS.COMPLETED,
          text: transcriptionText,
          segments: segments,
          language: language,
          confidence_score: segments.length > 0 ? 
            segments.reduce((sum, segment) => sum + (segment.confidence || 0), 0) / segments.length : 
            null,
          processed_at: new Date().toISOString()
        })
        .eq('id', transcription.id);

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour de la transcription: ${updateError.message}`);
      }

      // Mettre à jour la vidéo avec les données de transcription
      await supabaseClient
        .from('videos')
        .update({
          transcription_data: {
            text: transcriptionText,
            segments: segments,
            language: language
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      console.log(`Vidéo ${videoId} - Transcription terminée avec succès`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Transcription terminée',
          videoId,
          transcriptionId: transcription.id,
          status: TRANSCRIPTION_STATUS.COMPLETED
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } catch (error) {
      console.error(`Erreur lors du traitement de la vidéo ${videoId}:`, error);
      
      // Mettre à jour le statut de la transcription à "failed"
      await supabaseClient
        .from('transcriptions')
        .update({ 
          status: TRANSCRIPTION_STATUS.FAILED,
          error_message: `Erreur de traitement: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', transcription.id);

      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors du traitement de la vidéo',
          details: error.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

  } catch (error) {
    console.error('Erreur générale:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
})
