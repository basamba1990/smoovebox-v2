// transcribe-video.ts - Version complète avec transcription OpenAI et analyse IA
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fonction pour journaliser les erreurs avec plus de détails
function logError(message, error, additionalInfo = {}) {
  console.error(`ERROR: ${message}`, {
    error: error?.message || error,
    stack: error?.stack,
    ...additionalInfo
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Fonction transcribe-video appelée");
    
    // Initialiser les clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      logError("Variables d'environnement manquantes", null, {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        openaiApiKey: !!openaiApiKey
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Configuration incomplète", 
          details: "Variables d'environnement manquantes" 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }
    
    console.log("Variables d'environnement vérifiées");
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Récupérer les données de la requête
    let requestData;
    try {
      requestData = await req.json();
      console.log("Données de requête reçues:", { videoId: requestData.videoId });
    } catch (parseError) {
      logError("Erreur lors de l'analyse du JSON de la requête", parseError);
      return new Response(
        JSON.stringify({ error: "Format de requête invalide", details: parseError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    const { videoId } = requestData;
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log(`Récupération des informations pour la vidéo ${videoId}`);
    
    // Vérifier si la vidéo existe et récupérer son URL
    let video;
    try {
      const { data, error: videoError } = await supabaseClient
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (videoError) {
        logError(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError);
        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors de la récupération de la vidéo', 
            details: videoError.message,
            code: videoError.code
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: videoError.code === 'PGRST116' ? 404 : 500
          }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Vidéo non trouvée' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        );
      }
      
      video = data;
      console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title || 'Sans titre'}`);
      
      // Vérifier que la vidéo a une URL
      if (!video.url) {
        return new Response(
          JSON.stringify({ error: 'URL de la vidéo non disponible' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
      
    } catch (error) {
      logError("Erreur non gérée lors de la vérification de la vidéo", error);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors du traitement de la requête', 
          details: error.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }
    
    // Assurer que les structures de base de données nécessaires existent
    await ensureDatabaseStructures(supabaseClient);
    
    // Mettre à jour le statut de la vidéo pour indiquer que la transcription est en cours
    try {
      await supabaseClient
        .from('videos')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      console.log(`Statut de la vidéo mis à jour: processing`);
    } catch (updateError) {
      logError("Erreur lors de la mise à jour du statut de la vidéo", updateError);
      // Continuer malgré l'erreur
    }
    
    try {
      // Récupérer l'URL de la vidéo depuis Storage si nécessaire
      let videoUrl = video.url;
      
      if (videoUrl.startsWith('/') || !videoUrl.startsWith('http')) {
        // C'est un chemin relatif, obtenir l'URL signée
        const { data: signedUrlData, error: signedUrlError } = await supabaseClient
          .storage
          .from('videos')
          .createSignedUrl(videoUrl.replace(/^\/storage\/videos\//, ''), 60 * 60); // 1 heure
        
        if (signedUrlError) {
          throw new Error(`Erreur lors de la création de l'URL signée: ${signedUrlError.message}`);
        }
        
        videoUrl = signedUrlData.signedUrl;
      }
      
      console.log("URL de la vidéo obtenue pour la transcription");
      
      // Transcription avec OpenAI Whisper
      console.log("Début de la transcription avec OpenAI Whisper");
      
      // Télécharger la vidéo
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      const videoBlob = await videoResponse.blob();
      const videoFile = new File([videoBlob], "video.mp4", { type: "video/mp4" });
      
      // Transcription avec OpenAI
      const transcription = await openai.audio.transcriptions.create({
        file: videoFile,
        model: "whisper-1",
        response_format: "verbose_json",
        language: "fr"
      });
      
      console.log("Transcription terminée avec succès");
      
      // Formater les données de transcription
      const transcriptionData = {
        text: transcription.text,
        segments: transcription.segments.map(segment => ({
          id: segment.id,
          start: segment.start,
          end: segment.end,
          text: segment.text,
          confidence: segment.confidence
        })),
        language: transcription.language
      };
      
      // Mettre à jour la vidéo avec les données de transcription
      const { error: updateError } = await supabaseClient
        .from('videos')
        .update({
          transcription: transcriptionData.text,
          transcription_data: transcriptionData,
          status: 'transcribed',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour de la vidéo avec les données de transcription: ${updateError.message}`);
      }
      
      console.log("Vidéo mise à jour avec les données de transcription");
      
      // Créer un enregistrement dans la table transcriptions
      try {
        await supabaseClient
          .from('transcriptions')
          .insert({
            video_id: videoId,
            status: 'completed',
            text: transcriptionData.text,
            segments: transcriptionData.segments,
            language: transcriptionData.language,
            confidence_score: transcriptionData.segments.reduce((acc, segment) => acc + segment.confidence, 0) / transcriptionData.segments.length,
            processed_at: new Date().toISOString()
          });
        
        console.log("Enregistrement de transcription créé avec succès");
      } catch (transcriptionError) {
        logError("Erreur lors de la création de l'enregistrement de transcription", transcriptionError);
        // Continuer malgré l'erreur
      }
      
      // Générer l'analyse IA de la transcription
      console.log("Début de l'analyse IA de la transcription");
      
      try {
        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Tu es un expert en analyse de discours. Analyse la transcription suivante et fournit:
              1. Un résumé concis (5-7 phrases)
              2. 5-7 points clés
              3. Une évaluation de la clarté et de la structure (note de 1 à 10)
              4. 3-5 suggestions d'amélioration
              5. 3-5 points forts
              
              Réponds au format JSON avec les clés suivantes:
              {
                "resume": "string",
                "points_cles": ["string", "string", ...],
                "evaluation": {
                  "clarte": number,
                  "structure": number
                },
                "suggestions": ["string", "string", ...],
                "strengths": ["string", "string", ...]
              }`
            },
            {
              role: "user",
              content: transcriptionData.text
            }
          ],
          response_format: { type: "json_object" }
        });
        
        const analysis = JSON.parse(analysisResponse.choices[0].message.content);
        console.log("Analyse IA générée avec succès");
        
        // Mettre à jour la vidéo avec l'analyse
        await supabaseClient
          .from('videos')
          .update({
            analysis: analysis,
            status: 'analyzed',
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
        
        console.log("Vidéo mise à jour avec l'analyse IA");
        
      } catch (analysisError) {
        logError("Erreur lors de l'analyse IA", analysisError);
        // Mettre à jour le statut même en cas d'erreur d'analyse
        await supabaseClient
          .from('videos')
          .update({
            status: 'transcribed', // Seulement transcrit, pas analysé
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Transcription et analyse terminées avec succès',
          videoId
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
      
    } catch (error) {
      logError("Erreur lors de la transcription ou de l'analyse", error);
      
      // Mettre à jour le statut de la vidéo pour indiquer l'échec
      try {
        await supabaseClient
          .from('videos')
          .update({
            status: 'error',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      } catch (updateError) {
        logError("Erreur lors de la mise à jour du statut d'erreur", updateError);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la transcription ou de l\'analyse', 
          details: error.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

  } catch (error) {
    logError("Erreur générale non gérée", error);
    
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
});

// Fonction pour s'assurer que toutes les structures de base de données nécessaires existent
async function ensureDatabaseStructures(supabaseClient) {
  console.log("Vérification des structures de base de données");
  
  try {
    // Créer la fonction exec_sql_with_return si elle n'existe pas
    try {
      await supabaseClient.rpc('exec_sql_with_return', { sql: 'SELECT 1' });
      console.log("La fonction exec_sql_with_return existe déjà");
    } catch (funcError) {
      console.log("Création de la fonction exec_sql_with_return");
      
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION exec_sql_with_return(sql text, params text[] DEFAULT NULL)
        RETURNS SETOF json
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
          IF params IS NULL THEN
            RETURN QUERY EXECUTE sql;
          ELSE
            RETURN QUERY EXECUTE sql USING params;
          END IF;
        END;
        $$;
      `;
      
      await supabaseClient.sql(createFunctionSQL);
      console.log("Fonction exec_sql_with_return créée avec succès");
    }
    
    // Vérifier si la colonne transcription_data existe dans la table videos
    const { data: columnExists } = await supabaseClient
      .rpc('exec_sql_with_return', { 
        sql: `
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'videos'
            AND column_name = 'transcription_data'
          ) as exists;
        `
      });
    
    const transcriptionDataExists = columnExists?.[0]?.exists || false;
    
    if (!transcriptionDataExists) {
      console.log("Ajout de la colonne transcription_data à la table videos");
      
      await supabaseClient.sql(`
        ALTER TABLE public.videos 
        ADD COLUMN IF NOT EXISTS transcription_data JSONB;
      `);
      
      console.log("Colonne transcription_data ajoutée avec succès");
    }
    
    // Vérifier si la colonne analysis existe dans la table videos
    const { data: analysisColumnExists } = await supabaseClient
      .rpc('exec_sql_with_return', { 
        sql: `
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'videos'
            AND column_name = 'analysis'
          ) as exists;
        `
      });
    
    const analysisExists = analysisColumnExists?.[0]?.exists || false;
    
    if (!analysisExists) {
      console.log("Ajout de la colonne analysis à la table videos");
      
      await supabaseClient.sql(`
        ALTER TABLE public.videos 
        ADD COLUMN IF NOT EXISTS analysis JSONB;
      `);
      
      console.log("Colonne analysis ajoutée avec succès");
    }
    
    // Vérifier si la colonne error_message existe dans la table videos
    const { data: errorColumnExists } = await supabaseClient
      .rpc('exec_sql_with_return', { 
        sql: `
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'videos'
            AND column_name = 'error_message'
          ) as exists;
        `
      });
    
    const errorMessageExists = errorColumnExists?.[0]?.exists || false;
    
    if (!errorMessageExists) {
      console.log("Ajout de la colonne error_message à la table videos");
      
      await supabaseClient.sql(`
        ALTER TABLE public.videos 
        ADD COLUMN IF NOT EXISTS error_message TEXT;
      `);
      
      console.log("Colonne error_message ajoutée avec succès");
    }
    
    // Vérifier si la table transcriptions existe
    const { data: tableExists } = await supabaseClient
      .rpc('exec_sql_with_return', { 
        sql: `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'transcriptions'
          ) as exists;
        `
      });
    
    const transcriptionsExists = tableExists?.[0]?.exists || false;
    
    if (!transcriptionsExists) {
      console.log("Création de la table transcriptions");
      
      await supabaseClient.sql(`
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
      `);
      
      console.log("Table transcriptions créée avec succès");
    }
    
    console.log("Vérification des structures de base de données terminée avec succès");
    
  } catch (error) {
    logError("Erreur lors de la vérification des structures de base de données", error);
    throw error;
  }
}
