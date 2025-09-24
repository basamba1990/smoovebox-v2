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

// Timeout global pour l'exécution de la fonction
const EXECUTION_TIMEOUT = 300000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let videoId: string | null = null
  let serviceClient: ReturnType<typeof createClient> | null = null

  try {
    console.log('Fonction transcribe-video appelée')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    console.log('Clé de service Supabase:', supabaseServiceKey ? 'Définie' : 'Non définie');

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

    // Création du client Supabase Service Role
    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
        }
      }
    })

    // Fonction pour confirmer la mise à jour dans la base de données
    async function confirmDatabaseUpdate(client: ReturnType<typeof createClient>, videoId: string, attempts = 0, maxAttempts = 5): Promise<boolean> {
      if (attempts >= maxAttempts) {
        console.error(`Échec de confirmation de la mise à jour après ${maxAttempts} tentatives`)
        return false
      }
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const { data: video, error: videoError } = await client.from('videos').select('transcription_text, status').eq('id', videoId).single()
        if (videoError) {
          console.log('Erreur lors de la vérification de la transcription:', videoError)
          return await confirmDatabaseUpdate(client, videoId, attempts + 1, maxAttempts)
        }
        if (!video?.transcription_text || video.status !== VIDEO_STATUS.TRANSCRIBED) {
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

    // Gestion de l'identification de l'utilisateur
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
      if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.replace('Bearer ', '')
      else if (req.headers.get('apikey')) token = req.headers.get('apikey')
      else {
        const cookieHeader = req.headers.get('Cookie')
        if (cookieHeader) {
          const supabaseCookie = cookieHeader.split(';').find(c => c.trim().startsWith('sb-access-token=') || c.trim().startsWith('supabase-auth-token='))
          if (supabaseCookie) {
            token = supabaseCookie.split('=')[1].trim()
            if (token.startsWith('\"') && token.endsWith('\"')) token = token.slice(1, -1)
          }
        }
      }

      if (token) {
        try {
          const { data } = await serviceClient.auth.getUser(token)
          if (data.user) userId = data.user.id
        } catch {}
      }

      if (!userId) {
        try {
          const url = new URL(req.url)
          const sbParam = url.searchParams.get('sb')
          const supabaseData = sbParam ? JSON.parse(decodeURIComponent(sbParam)) : null
          if (supabaseData?.auth_user) userId = supabaseData.auth_user
        } catch {}
      }

      if (!userId) {
        try {
          const clonedRequest = req.clone()
          const requestBody = await clonedRequest.text();
          if (requestBody.trim()) {
            const requestData = JSON.parse(requestBody);
            if (requestData.user_id) userId = requestData.user_id
          }
        } catch {}
      }

      if (!userId && !isWhatsApp && req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Authentification requise', details: "Impossible d'identifier l'utilisateur." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
      }
    }

    // Récupération des paramètres vidéo
    let videoUrl: string | null = null
    const url = new URL(req.url)
    videoId = url.searchParams.get('videoId')
    if (videoId) videoUrl = url.searchParams.get('videoUrl')

    if (!videoId && req.method !== 'GET' && !isWhatsApp) {
      try {
        const requestBody = await req.text()
        if (requestBody.trim()) {
          const requestData = JSON.parse(requestBody)
          if (requestData.videoId) videoId = requestData.videoId
          if (requestData.videoUrl) videoUrl = requestData.videoUrl
        }
      } catch {}
    }

    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId est requis', details: 'Veuillez fournir videoId' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const { data: video, error: videoError } = await serviceClient.from('videos').select('*').eq('id', videoId as string).single()
    if (videoError) {
      return new Response(JSON.stringify({ error: 'Erreur lors de la récupération de la vidéo', details: videoError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    await serviceClient.from('videos').update({
      status: VIDEO_STATUS.PROCESSING,
      updated_at: new Date().toISOString(),
      transcription_attempts: (video.transcription_attempts || 0) + 1
    }).eq('id', videoId as string)

    // -----------------------------
    // TÉLÉCHARGEMENT DIRECT SÉCURISÉ
    // -----------------------------
    let audioBlob: Blob | null = null
    if ((video as any).storage_path) {
      try {
        const storagePath = (video as any).storage_path as string
        const bucketName = 'videos'
        let filePath = storagePath.startsWith('videos/') ? storagePath.slice('videos/'.length) : storagePath
        console.log(`Téléchargement du fichier: bucket=${bucketName}, path=${filePath}`)

        const { data: fileData, error: downloadError } = await serviceClient.storage.from(bucketName).download(filePath)
        if (downloadError) throw downloadError
        if (!fileData || fileData.size === 0) throw new Error('Le fichier téléchargé est vide ou introuvable')
        audioBlob = fileData
      } catch (storageError: any) {
        console.error('Échec du téléchargement direct:', storageError.message)
      }
    }

    // fallback via publicUrl si download direct échoue
    if (!audioBlob) {
      if (!videoUrl) videoUrl = (video as any).url
      if (videoUrl) {
        try {
          let isValidUrl = false
          try { new URL(videoUrl); isValidUrl = true } catch {}
          if (!isValidUrl) {
            const storagePath = (video as any).storage_path as string
            const bucketName = 'videos'
            const filePath = storagePath.startsWith('videos/') ? storagePath.slice('videos/'.length) : storagePath
            videoUrl = serviceClient.storage.from(bucketName).getPublicUrl(filePath).data.publicUrl
            console.log(`Fallback publicUrl utilisé: ${videoUrl}`)
          }
          const response = await fetch(videoUrl, { method: 'GET', headers: { 'User-Agent': 'Supabase-Edge-Function/1.0' } })
          if (!response.ok) throw new Error(`Échec du téléchargement via URL. Statut: ${response.status}`)
          audioBlob = await response.blob()
          if (audioBlob.size === 0) throw new Error('Le fichier téléchargé via URL est vide')
        } catch (fetchError: any) {
          console.error('Échec du téléchargement via URL:', fetchError.message)
        }
      }
    }

    if (!audioBlob) {
      const errorMessage = `Impossible de télécharger la vidéo. Storage path: ${(video as any).storage_path || 'non défini'}, URL: ${videoUrl || 'non définie'}`
      await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: errorMessage, updated_at: new Date().toISOString() }).eq('id', videoId as string)
      return new Response(JSON.stringify({ error: 'Téléchargement impossible', details: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    // -----------------------------
    // TRANSCRIPTION OPENAI WHISPER
    // -----------------------------
    const openai = new OpenAI({ apiKey: openaiApiKey })
    let transcriptionResult: any
    try {
      const file = new File([audioBlob], 'audio.mp4', { type: audioBlob.type || 'video/mp4' })
      transcriptionResult = await openai.audio.transcriptions.create({ file, model: 'whisper-1', language: 'fr', response_format: 'verbose_json', timestamp_granularities: ['word', 'segment'] })
    } catch (transcriptionError: any) {
      const errorMessage = `Erreur de transcription OpenAI: ${transcriptionError.message}`
      await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: errorMessage, updated_at: new Date().toISOString() }).eq('id', videoId as string)
      return new Response(JSON.stringify({ error: 'Erreur de transcription', details: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    if (!transcriptionResult || !transcriptionResult.text?.trim()) {
      const errorMessage = 'La transcription est vide ou invalide'
      await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: errorMessage, updated_at: new Date().toISOString() }).eq('id', videoId as string)
      return new Response(JSON.stringify({ error: 'Transcription vide', details: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    // -----------------------------
    // ENREGISTREMENT DANS LA TABLE VIDEOS
    // -----------------------------
    let transcriptionData: any = transcriptionResult.segments ? {
      text: transcriptionResult.text,
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
      segments: transcriptionResult.segments.map((s: any) => ({
        id: s.id,
        seek: s.seek,
        start: s.start,
        end: s.end,
        text: s.text,
        tokens: s.tokens,
        temperature: s.temperature,
        avg_logprob: s.avg_logprob,
        compression_ratio: s.compression_ratio,
        no_speech_prob: s.no_speech_prob,
        words: s.words || []
      }))
    } : {
      text: transcriptionResult.text,
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
      segments: []
    }

    const updatePayload: any = { transcription_text: transcriptionData?.text || '', status: VIDEO_STATUS.TRANSCRIBED, updated_at: new Date().toISOString() }
    if (transcriptionData !== null && typeof transcriptionData === 'object' && !Array.isArray(transcriptionData)) updatePayload.transcription_data = transcriptionData

    const { error: transcriptionUpdateError } = await serviceClient.from('videos').update(updatePayload).eq('id', videoId as string)
    if (transcriptionUpdateError) {
      const simplifiedPayload = { transcription_text: transcriptionData?.text || '', status: VIDEO_STATUS.TRANSCRIBED, updated_at: new Date().toISOString() }
      const { error: retryError } = await serviceClient.from('videos').update(simplifiedPayload).eq('id', videoId as string)
      if (retryError) {
        await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: `Erreur lors de l'enregistrement de la transcription: ${retryError.message}`, updated_at: new Date().toISOString() }).eq('id', videoId as string)
        return new Response(JSON.stringify({ error: 'Erreur d\'enregistrement de la transcription', details: retryError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
      }
    }

    const confirmed = await confirmDatabaseUpdate(serviceClient, videoId as string)
    if (!confirmed) await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: `La transcription a été enregistrée mais la confirmation de la base de données a échoué.`, updated_at: new Date().toISOString() }).eq('id', videoId as string)

    // -----------------------------
    // DÉCLENCHEMENT DE L'ANALYSE
    // -----------------------------
    if (confirmed) {
      try {
        const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` }
        const response = await fetch(analyzeEndpoint, { method: 'POST', headers, body: JSON.stringify({ videoId }) })
        if (!response.ok) {
          const errorText = await response.text()
          await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: `Échec de l'appel à la fonction d'analyse: ${errorText}`, updated_at: new Date().toISOString() }).eq('id', videoId as string)
        }
      } catch (invokeError: any) {
        await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: `Erreur lors de l'invocation de la fonction d'analyse: ${invokeError.message}`, updated_at: new Date().toISOString() }).eq('id', videoId as string)
      }
    }

    return new Response(JSON.stringify({ message: 'Transcription terminée avec succès', videoId, transcription_length: transcriptionResult.text.length, transcription_confirmed: confirmed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    if (videoId && serviceClient) await serviceClient.from('videos').update({ status: VIDEO_STATUS.FAILED, error_message: `Erreur interne: ${error.message}`, updated_at: new Date().toISOString() }).eq('id', videoId as string)
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur', details: error.message || 'Une erreur inattendue est survenue.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
