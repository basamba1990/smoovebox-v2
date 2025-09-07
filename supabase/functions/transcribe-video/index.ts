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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null
  let serviceClient: any = null

  try {
    console.log('Fonction transcribe-video appelée')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error('Variables d\'environnement manquantes')
      return new Response(
        JSON.stringify({ error: 'Configuration incomplète', details: "Variables d'environnement manquantes" }),
        { headers: corsHeaders, status: 500 }
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

    async function confirmDatabaseUpdate(client: ReturnType<typeof createClient>, videoId: string, attempts = 0, maxAttempts = 3): Promise<boolean> {
      if (attempts >= maxAttempts) {
        console.error(`Échec de confirmation de la mise à jour après ${maxAttempts} tentatives`)
        return false
      }

      try {
        await new Promise((resolve) => setTimeout(resolve, 2000))
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

    let userId: string | null = null
    let token: string | null = null
    const userAgent = req.headers.get('user-agent') || ''
    const isWhatsApp = userAgent.includes('WhatsApp')

    if (isWhatsApp || req.method === 'GET') {
      const url = new URL(req.url)
      userId = url.searchParams.get('userId') || 'whatsapp-user'
      console.log(`Utilisateur WhatsApp/GET détecté: ${userId}`)
    } else {
      const authHeader = req.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '')
        console.log("Token d'authentification trouvé dans l'en-tête Authorization")
      } else if (req.headers.get('apikey')) {
        token = req.headers.get('apikey')
        console.log("Token d'authentification trouvé dans l'en-tête apikey")
      } else {
        const cookieHeader = req.headers.get('Cookie')
        if (cookieHeader) {
          const supabaseCookie = cookieHeader
            .split(';')
            .find((c) => c.trim().startsWith('sb-access-token=') || c.trim().startsWith('supabase-auth-token='))
          if (supabaseCookie) {
            token = supabaseCookie.split('=')[1].trim()
            if (token.startsWith('"') && token.endsWith('"')) {
              token = token.slice(1, -1)
            }
            console.log("Token d'authentification trouvé dans les cookies")
          }
        }
      }

      if (token) {
        try {
          const { data, error } = await serviceClient.auth.getUser(token)
          if (error) {
            console.error('Erreur de décodage du JWT:', error)
          } else if (data.user) {
            userId = data.user.id
            console.log(`Utilisateur authentifié: ${userId}`)
          }
        } catch (authError) {
          console.error("Exception lors de l'authentification:", authError)
        }
      }

      if (!userId) {
        try {
          const url = new URL(req.url)
          const sbParam = url.searchParams.get('sb')
          const supabaseData = sbParam ? JSON.parse(decodeURIComponent(sbParam)) : null
          if (supabaseData?.auth_user) {
            userId = supabaseData.auth_user
            console.log(`Utilisateur trouvé dans les métadonnées Supabase: ${userId}`)
          } else if (supabaseData?.jwt?.authorization?.payload) {
            const payload = supabaseData.jwt.authorization.payload
            if (payload.sub) {
              userId = payload.sub
              console.log(`Utilisateur trouvé dans le payload JWT: ${userId}`)
            } else if ((payload as any).subject) {
              userId = (payload as any).subject
              console.log(`Utilisateur trouvé dans le payload JWT: ${userId}`)
            }
          }
        } catch (sbDataError) {
          console.error("Erreur lors de l'extraction des métadonnées Supabase:", sbDataError)
        }
      }

      if (!userId) {
        try {
          const clonedRequest = req.clone()
          const requestData = await clonedRequest.json()
          if (requestData.user_id) {
            userId = requestData.user_id
            console.log(`Utilisateur trouvé dans les données de la requête: ${userId}`)
          }
        } catch (parseError) {
          console.error("Erreur lors de l'analyse du JSON de la requête:", parseError)
        }
      }

      if (!userId && !isWhatsApp && req.method !== 'GET') {
        return new Response(
          JSON.stringify({
            error: 'Authentification requise',
            details: "Impossible d'identifier l'utilisateur. Assurez-vous d'être connecté et d'envoyer le token d'authentification."
          }),
          { headers: corsHeaders, status: 401 }
        )
      }
    }

    const url = new URL(req.url)
    videoId = url.searchParams.get('videoId')
    
    if (videoId) {
      console.log(`VideoId récupéré des paramètres d'URL: ${videoId}`)
    }

    if (!videoId && req.method !== 'GET' && !isWhatsApp) {
      try {
        const requestBody = await req.text()
        console.log('Corps de la requête reçu:', requestBody)
        if (requestBody.trim()) {
          const requestData = JSON.parse(requestBody)
          console.log('Données de requête parsées:', requestData)
          if (requestData.videoId) {
            videoId = requestData.videoId
            console.log(`VideoId récupéré du corps de la requête: ${videoId}`)
          }
        }
      } catch (parseError) {
        console.error("Erreur lors de l'analyse du JSON de la requête:", parseError)
      }
    }

    if (!videoId) {
      console.error('VideoId non trouvé dans les paramètres d\'URL ni dans le corps de la requête')
      return new Response(
        JSON.stringify({ 
          error: 'videoId est requis dans le corps de la requête ou en paramètre',
          details: 'Veuillez fournir videoId soit dans le corps JSON de la requête, soit comme paramètre d\'URL (?videoId=...)'
        }),
        { headers: corsHeaders, status: 400 }
      )
    }

    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId as string)
      .single()

    if (videoError) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération de la vidéo', details: videoError.message }),
        { headers: corsHeaders, status: (videoError as any).code === 'PGRST116' ? 404 : 500 }
      )
    }

    if (!video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { headers: corsHeaders, status: 404 }
      )
    }

    console.log(`Vidéo trouvée: ${video.id}, titre: ${video.title}, chemin: ${video.storage_path}`)
    console.log(`Statut actuel de la vidéo: ${video.status}`)

    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString(),
        transcription_attempts: (video.transcription_attempts || 0) + 1
      })
      .eq('id', videoId as string)

    if (updateError) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId}`, updateError)
    } else {
      console.log(`Statut de la vidéo ${videoId} mis à jour à '${VIDEO_STATUS.PROCESSING}'`)
    }

    if (!video.storage_path) {
      return new Response(
        JSON.stringify({
          error: 'Chemin de stockage manquant',
          details: 'La vidéo ne possède pas de chemin de stockage (storage_path).'
        }),
        { headers: corsHeaders, status: 500 }
      )
    }

    console.log(`Génération d'une URL signée pour ${video.storage_path}`)
    let bucket = 'videos'
    let filePath = video.storage_path as string

    if (filePath.includes('/')) {
      const parts = filePath.split('/')
      if (parts.length > 1) {
        const possibleBucket = parts[0]
        try {
          const { data: buckets } = await serviceClient.storage.listBuckets()
          console.log('Buckets disponibles:', buckets?.map((b: any) => b.name) || [])
          const bucketExists = (buckets || []).some((b: any) => b.name === possibleBucket)
          if (bucketExists) {
            bucket = possibleBucket
            filePath = parts.slice(1).join('/')
            console.log(`Bucket identifié: ${bucket}, chemin ajusté: ${filePath}`)
          } else {
            console.log(`Le segment "${possibleBucket}" n'est pas un bucket valide, utilisation du bucket par défaut: ${bucket}`)
            filePath = video.storage_path;
          }
        } catch (bucketError) {
          console.error('Erreur lors de la vérification des buckets:', bucketError)
          filePath = video.storage_path;
        }
      }
    }

    if (filePath.startsWith(`${bucket}/`)) {
      filePath = filePath.substring(bucket.length + 1)
      console.log(`Préfixe de bucket détecté et supprimé. Nouveau chemin: ${filePath}`)
    }

    console.log(`Création d'URL signée pour bucket: ${bucket}, chemin: ${filePath}`)
    let videoUrl: string;
    try {
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60)
      if (signedUrlError) throw signedUrlError
      videoUrl = signedUrlData.signedUrl
      console.log(`URL signée générée avec succès: ${videoUrl.substring(0, 50)}...`)
    } catch (storageError: any) {
      console.error('Erreur lors de la création de l\'URL signée:', storageError)
      return new Response(
        JSON.stringify({
          error: 'Erreur de stockage',
          details: `Impossible de générer l'URL signée pour la vidéo: ${storageError.message}`
        }),
        { headers: corsHeaders, status: 500 }
      )
    }

    console.log('Téléchargement et conversion de la vidéo en audio...')
    let audioBlob: Blob;
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Échec du téléchargement: ${response.status} ${response.statusText}`);
      }
      audioBlob = await response.blob();
    } catch (fetchError) {
      console.error('Erreur lors du téléchargement de la vidéo:', fetchError);
      return new Response(
        JSON.stringify({
          error: 'Erreur de téléchargement',
          details: `Impossible de télécharger la vidéo: ${fetchError.message}`
        }),
        { headers: corsHeaders, status: 500 }
      );
    }

    console.log('Préparation de la transcription avec OpenAI Whisper...')
    const openai = new OpenAI({ apiKey: openaiApiKey })
    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: new File([audioBlob], 'audio.mp3', { type: 'audio/mp3' }),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json'
      });
    } catch (openaiError) {
      console.error('Erreur OpenAI lors de la transcription:', openaiError);
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Erreur OpenAI: ${openaiError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string);
      return new Response(
        JSON.stringify({
          error: 'Erreur de transcription OpenAI',
          details: openaiError.message
        }),
        { headers: corsHeaders, status: 500 }
      );
    }

    console.log('Transcription terminée.')
    const confidenceScore = transcription.segments && transcription.segments.length > 0 
      ? transcription.segments.reduce((sum: number, segment: any) => sum + (segment.confidence || 0), 0) / transcription.segments.length
      : null;

    console.log('Enregistrement de la transcription dans Supabase...')
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

    // CORRECTION CRITIQUE: Ne PAS utiliser JSON.stringify() pour les colonnes JSONB
    const { error: transcriptionTableError } = await serviceClient
      .from('transcriptions')
      .upsert({
        video_id: videoId,
        user_id: userId,
        full_text: transcription.text,
        transcription_text: transcription.text,
        transcription_data: transcriptionData, // Objet direct, pas de JSON.stringify!
        segments: cleanSegments, // Objet direct, pas de JSON.stringify!
        confidence_score: confidenceScore,
        status: 'transcribed',
        updated_at: new Date().toISOString()
      }, { onConflict: 'video_id' });

    if (transcriptionTableError) {
      console.error('Erreur lors de l\'enregistrement de la transcription:', transcriptionTableError)
      await serviceClient
        .from('videos')
        .update({ 
          status: VIDEO_STATUS.FAILED, 
          error_message: `Échec de l'enregistrement de la transcription: ${transcriptionTableError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId as string)
      return new Response(
        JSON.stringify({ error: 'Erreur de base de données', details: transcriptionTableError.message }),
        { headers: corsHeaders, status: 500 }
      )
    }

    // CORRECTION CRITIQUE: Ne PAS utiliser JSON.stringify() pour les colonnes JSONB
    const { error: videoUpdateError } = await serviceClient
      .from('videos')
      .update({
        transcription_text: transcription.text,
        transcription_data: transcriptionData, // Objet direct, pas de JSON.stringify!
        status: VIDEO_STATUS.TRANSCRIBED,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId as string);

    if (videoUpdateError) {
      console.error('Erreur lors de la mise à jour de la vidéo avec la transcription:', videoUpdateError);
    }

    console.log('Transcription enregistrée avec succès.')

    // Attendre que la base de données soit à jour avant d'appeler l'analyse
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      console.log(`Appel de la fonction analyze-transcription...`);
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
      }
    } catch (invokeError) {
      console.error("Erreur lors de l'invocation de la fonction d'analyse:", invokeError)
    }

    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId as string)
    if (!confirmed) {
      console.warn(`La mise à jour de la base de données pour la vidéo ${videoId} n'a pas pu être confirmée.`)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Transcription terminée avec succès', 
        videoId,
        transcription_length: transcription.text.length
      }), 
      { headers: corsHeaders, status: 200 }
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
          .eq('id', videoId as string);
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
    )
  }
})
