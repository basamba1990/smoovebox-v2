// Edge Function pour la transcription vidéo
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

// Configuration pour OpenAI Whisper API
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  try {
    // Vérifier la méthode HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Extraire le token d'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé: Token manquant' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const token = authHeader.split(' ')[1]

    // Créer un client Supabase avec le token de l'utilisateur pour respecter RLS
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    // Créer un client admin pour les opérations privilégiées
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Vérifier l'utilisateur
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé: Utilisateur non authentifié' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer les données de la requête
    const { videoId, videoUrl } = await req.json()
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'ID de vidéo manquant' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier que la vidéo existe et appartient à l'utilisateur
    const { data: video, error: videoError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Mettre à jour le statut de la vidéo
    const { error: updateError } = await supabaseAdmin
      .from('videos')
      .update({ status: 'processing' })
      .eq('id', videoId)

    if (updateError) {
      console.error('Erreur lors de la mise à jour du statut:', updateError)
    }

    // Obtenir l'URL de la vidéo si non fournie
    let finalVideoUrl = videoUrl
    if (!finalVideoUrl && video.storage_path) {
      const { data: urlData } = await supabaseAdmin.storage
        .from('videos')
        .createSignedUrl(video.storage_path, 3600)
      
      finalVideoUrl = urlData?.signedUrl
    }

    if (!finalVideoUrl) {
      // Mettre à jour le statut en cas d'échec
      await supabaseAdmin
        .from('videos')
        .update({ 
          status: 'failed',
          error: 'URL de la vidéo introuvable'
        })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ error: 'URL de la vidéo introuvable' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Appeler l'API OpenAI Whisper pour la transcription
    console.log(`Début de la transcription pour la vidéo ${videoId}`)
    
    try {
      // Démarrer la transcription en arrière-plan
      const transcriptionPromise = startTranscription(finalVideoUrl, videoId, supabaseAdmin)
      
      // Utiliser EdgeRuntime.waitUntil pour permettre à la fonction de continuer en arrière-plan
      EdgeRuntime.waitUntil(transcriptionPromise)
      
      return new Response(
        JSON.stringify({ 
          message: 'Transcription démarrée avec succès',
          videoId: videoId
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Erreur lors du démarrage de la transcription:', error)
      
      // Mettre à jour le statut en cas d'échec
      await supabaseAdmin
        .from('videos')
        .update({ 
          status: 'failed',
          error: `Erreur de transcription: ${error.message}`
        })
        .eq('id', videoId)
        
      return new Response(
        JSON.stringify({ error: `Erreur de transcription: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Erreur générale:', error)
    return new Response(
      JSON.stringify({ error: `Erreur interne: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// Fonction pour gérer la transcription en arrière-plan
async function startTranscription(videoUrl, videoId, supabaseAdmin) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('Clé API OpenAI non configurée')
    }

    // Appeler l'API OpenAI pour la transcription
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: createTranscriptionFormData(videoUrl),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Erreur API OpenAI: ${errorData.error?.message || response.statusText}`)
    }

    const transcriptionResult = await response.json()
    
    // Enregistrer la transcription dans la base de données
    const { error: transcriptionError } = await supabaseAdmin
      .from('videos')
      .update({
        transcription: transcriptionResult.text,
        status: 'published',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (transcriptionError) {
      throw new Error(`Erreur lors de l'enregistrement de la transcription: ${transcriptionError.message}`)
    }

    console.log(`Transcription terminée avec succès pour la vidéo ${videoId}`)
    return { success: true, videoId }
  } catch (error) {
    console.error(`Erreur lors de la transcription de la vidéo ${videoId}:`, error)
    
    // Mettre à jour le statut en cas d'échec
    await supabaseAdmin
      .from('videos')
      .update({ 
        status: 'failed',
        error: `Erreur de transcription: ${error.message}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)
      
    throw error
  }
}

// Fonction pour créer le FormData pour l'API OpenAI
function createTranscriptionFormData(videoUrl) {
  const formData = new FormData()
  
  // Ajouter l'URL de la vidéo comme fichier
  formData.append('file', videoUrl)
  
  // Ajouter les paramètres de transcription
  formData.append('model', 'whisper-1')
  formData.append('language', 'fr')
  formData.append('response_format', 'json')
  
  return formData
}
