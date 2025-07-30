import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import OpenAI from 'npm:openai@4.28.0'

// Initialiser le client OpenAI
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

Deno.serve(async (req) => {
  try {
    // Vérifier la méthode
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Récupérer et valider le token d'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Initialiser le client Supabase avec le token de l'utilisateur
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // Client avec le token de l'utilisateur pour respecter RLS
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Client avec le rôle de service pour contourner RLS si nécessaire
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Récupérer les données de la requête
    const { videoId, videoUrl } = await req.json()
    
    if (!videoId || !videoUrl) {
      return new Response(JSON.stringify({ error: 'ID de vidéo et URL requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Récupérer les informations de l'utilisateur
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non authentifié' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Vérifier que la vidéo appartient à l'utilisateur
    const { data: videoData, error: videoError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()
    
    if (videoError || !videoData) {
      return new Response(JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Mettre à jour le statut de la vidéo
    await supabaseClient
      .from('videos')
      .update({ status: 'processing' })
      .eq('id', videoId)

    // Simuler la transcription (dans un cas réel, utilisez Whisper API)
    console.log('Transcription de la vidéo:', videoUrl)
    
    // Utiliser OpenAI pour générer une transcription fictive
    const transcription = {
      text: "Ceci est une transcription simulée de la vidéo. Dans un environnement de production, utilisez l'API Whisper d'OpenAI pour une vraie transcription.",
      segments: [
        { start: 0, end: 10, text: "Première partie de la transcription." },
        { start: 10, end: 20, text: "Deuxième partie de la transcription." }
      ]
    }

    // Utiliser OpenAI pour analyser la vidéo
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Tu es un assistant spécialisé dans l'analyse de contenu vidéo. Génère une analyse basée sur la transcription fournie."
        },
        {
          role: "user",
          content: `Analyse cette transcription de vidéo et fournis un résumé, des mots-clés et des suggestions d'amélioration: ${transcription.text}`
        }
      ]
    })

    // Extraire l'analyse
    const analysisText = completion.choices[0].message.content
    
    // Formater l'analyse
    const analysis = {
      summary: "Résumé de la vidéo basé sur la transcription.",
      keywords: ["mot-clé1", "mot-clé2", "mot-clé3"],
      suggestions: [
        "Suggestion d'amélioration 1",
        "Suggestion d'amélioration 2"
      ]
    }

    // Mettre à jour la vidéo avec la transcription et l'analyse
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({
        status: 'published',
        transcription: transcription,
        analysis: analysis,
        processed_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (updateError) {
      console.error('Erreur lors de la mise à jour de la vidéo:', updateError)
      return new Response(JSON.stringify({ error: 'Erreur lors de la mise à jour de la vidéo' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Vidéo traitée avec succès',
      videoId: videoId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Erreur:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
