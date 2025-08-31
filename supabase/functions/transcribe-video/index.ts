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
  let serviceClient: any = null;

  try {
    console.log('Fonction transcribe-video appelée')
    
    // Initialiser les variables d'environnement avec les nouveaux noms
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY')
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

    // Vérifier que la clé de service n'est pas un placeholder
    if (supabaseServiceKey.includes('MY_SUPABASE_SERVICE_ROLE_KEY') || supabaseServiceKey.length < 50) {
      console.error('Clé de service Supabase invalide ou placeholder détecté')
      return new Response(
        JSON.stringify({
          error: 'Configuration invalide',
          details: "La clé de service Supabase n'est pas configurée correctement"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    console.log('Variables d\'environnement validées avec succès')

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

    // Helper pour confirmer la mise à jour de la base de données
    async function confirmDatabaseUpdate(
      client: ReturnType<typeof createClient>,
      videoId: string,
      attempts = 0,
      maxAttempts = 3
    ): Promise<boolean> {
      if (attempts >= maxAttempts) {
        console.error(`Échec de confirmation de la mise à jour après ${maxAttempts} tentatives`)
        return false
      }

      try {
        // Attendre 2 secondes avant de vérifier
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Vérifier simplement si la transcription existe
        const { data: transcription, error: transcriptionError } = await client
          .from('transcriptions')
          .select('id')
          .eq('video_id', videoId)
          .single()

        if (transcriptionError) {
          console.log('Transcription pas encore disponible, nouvelle tentative...')
          return await confirmDatabaseUpdate(client, videoId, attempts + 1, maxAttempts)
        }

        console.log(`Transcription confirmée pour la vidéo ${videoId}`)
        return true
      } catch (err) {
        console.error('Erreur lors de la confirmation de mise à jour:', err)
        return await confirmDatabaseUpdate(client, videoId, attempts + 1, maxAttempts)
      }
    }

    // Helper pour mettre à jour le statut de la vidéo de manière sécurisée
    async function updateVideoStatus(
      client: ReturnType<typeof createClient>,
      videoId: string,
      status: string,
      additionalData: Record<string, any> = {},
      method: string = 'direct'
    ): Promise<boolean> {
      try {
        console.log(`🔄 Tentative de mise à jour du statut de la vidéo ${videoId} vers '${status}' (méthode: ${method})`)
        
        // Construction sécurisée de l'objet de mise à jour
        const updateData: any = {
          status,
          updated_at: new Date().toISOString()
        }

        // Ajouter seulement les champs valides et bien formatés
        if (additionalData.transcription_text !== undefined) {
          updateData.transcription_text = additionalData.transcription_text;
        }

        if (additionalData.transcription_data !== undefined) {
          // Validation du JSON pour transcription_data
          try {
            if (typeof additionalData.transcription_data === 'object') {
              updateData.transcription_data = additionalData.transcription_data;
            } else if (typeof additionalData.transcription_data === 'string') {
              // Tenter de parser si c'est une chaîne JSON
              updateData.transcription_data = JSON.parse(additionalData.transcription_data);
            } else {
              console.warn('Format de transcription_data non valide, ignoré');
            }
          } catch (e) {
            console.error('Erreur de validation de transcription_data:', e);
            // Ne pas ajouter transcription_data si invalide
          }
        }

        if (additionalData.error_message !== undefined) {
          updateData.error_message = additionalData.error_message;
        }

        if (additionalData.transcription_attempts !== undefined) {
          updateData.transcription_attempts = additionalData.transcription_attempts;
        }

        const { error: updateError } = await client
          .from('videos')
          .update(updateData)
          .eq('id', videoId)

        if (updateError) {
          console.error(`❌ Échec de la mise à jour du statut de la vidéo ${videoId}:`, updateError)
          
          // Log détaillé de l'erreur pour le debugging
          console.error('Détails de l\'erreur de mise à jour:', {
            videoId,
            targetStatus: status,
            method,
            error: updateError,
            timestamp: new Date().toISOString(),
            updateData: JSON.stringify(updateData)
          })
          
          return false
        }

        console.log(`✅ Statut de la vidéo ${videoId} mis à jour avec succès vers '${status}'`)
        return true
      } catch (err) {
        console.error(`❌ Exception lors de la mise à jour du statut de la vidéo ${videoId}:`, err)
        return false
      }
    }

    // [Le reste du code reste inchangé jusqu'à la partie transcription...]

    // 8. ENREGISTRER LA TRANSCRIPTION DANS LA BASE DE DONNÉES
    console.log('Enregistrement de la transcription dans la base de données...')
    
    const transcriptionData = {
      text: transcription.text,
      segments: transcription.segments || [],
      language: transcription.language || 'unknown',
      duration: transcription.duration || 0
    }

    // Enregistrer dans la table transcriptions
    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId,
        user_id: userId,
        language: transcription.language || 'unknown',
        full_text: transcription.text,
        segments: transcription.segments || [],
        transcription_text: transcription.text,
        transcription_data: transcriptionData,
        status: 'completed',
        confidence_score: 0.95, // Score par défaut
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'video_id' });

    if (transcriptionTableError) {
      console.error('Erreur lors de l\'enregistrement de la transcription:', transcriptionTableError)
      
      // Mettre à jour le statut de la vidéo à FAILED en cas d'échec
      await updateVideoStatus(
        serviceClient,
        videoId as string,
        VIDEO_STATUS.FAILED,
        {
          error_message: `Échec de l'enregistrement de la transcription: ${transcriptionTableError.message}`
        },
        'database_error'
      )

      return new Response(
        JSON.stringify({ error: 'Erreur de base de données', details: transcriptionTableError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Mettre à jour également la table videos avec les données de transcription
    const videoUpdateSuccess = await updateVideoStatus(
      serviceClient,
      videoId as string,
      VIDEO_STATUS.TRANSCRIBED,
      {
        transcription_text: transcription.text,
        transcription_data: transcriptionData
      },
      'transcription_complete'
    )

    if (!videoUpdateSuccess) {
      console.warn(`⚠️ La transcription de la vidéo ${videoId} a été enregistrée avec succès, mais la mise à jour du statut a échoué. Investigation requise.`)
    }

    console.log('Transcription enregistrée avec succès.')

    // 9. DÉCLENCHER LA FONCTION D'ANALYSE AVEC AUTHENTIFICATION CORRECTE
    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      
      // Vérifier que la clé de service est valide avant de l'utiliser
      if (!supabaseServiceKey || supabaseServiceKey.includes('MY_SUPABASE_SERVICE_ROLE_KEY')) {
        throw new Error('Clé de service Supabase invalide pour l\'appel à analyze-transcription');
      }
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      };
      
      console.log(`🔄 Appel de la fonction analyze-transcription via fetch à ${analyzeEndpoint}`);
      console.log('En-têtes d\'authentification configurés avec la clé de service');
      
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ videoId })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erreur de la fonction d'analyse (${response.status}): ${errorText}`);
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Analyse démarrée avec succès:', responseData);
    } catch (invokeError) {
      console.error("⚠️ Erreur lors de l'invocation de la fonction d'analyse:", invokeError)
      // Ne pas échouer complètement, juste logger l'erreur
    }

    // 10. CONFIRMER LA MISE À JOUR DE LA BASE DE DONNÉES
    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId as string)
    if (!confirmed) {
      console.warn(
        `La mise à jour de la base de données pour la vidéo ${videoId} n'a pas pu être confirmée.`
      )
    }

    return new Response(
      JSON.stringify({ 
        message: 'Transcription terminée avec succès', 
        videoId,
        transcription_length: transcription.text.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error: any) {
    console.error('❌ Erreur générale dans la fonction transcribe-video:', error)
    
    // Tentative de mise à jour du statut d'erreur si videoId est disponible
    if (videoId && serviceClient) {
      try {
        await updateVideoStatus(
          serviceClient,
          videoId as string,
          VIDEO_STATUS.FAILED,
          {
            error_message: `Erreur interne: ${error.message}`
          },
          'general_error'
        )
      } catch (updateError) {
        console.error('❌ Erreur lors de la mise à jour du statut d\'erreur:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({
        error: 'Erreur interne du serveur',
        details: error.message || 'Une erreur inattendue est survenue.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
