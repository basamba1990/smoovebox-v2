import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Harmonisation des statuts avec les autres fonctions
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DRAFT: 'draft',
  READY: 'ready'
} as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Fonction engagement-prediction appelée")
    
    // Initialisation des clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error("Variables d'environnement manquantes")
      return new Response(
        JSON.stringify({ error: "Configuration incomplète" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openaiApiKey })
    
    // Extraction des paramètres
    let videoId: string | null = null
    let userId: string | null = null
    
    try {
      if (req.method === 'GET') {
        const url = new URL(req.url)
        videoId = url.searchParams.get('videoId')
        userId = url.searchParams.get('userId')
      } else {
        const requestData = await req.json()
        videoId = requestData.videoId
        userId = requestData.userId
      }
    } catch (error) {
      console.error("Erreur lors de l'extraction des paramètres", error)
      return new Response(
        JSON.stringify({ error: "Format de requête invalide" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    // Récupération des données
    const [
      videoResponse,
      userHistoryResponse,
      videoPatternsResponse
    ] = await Promise.all([
      // Données de la vidéo
      supabase.from('videos').select('*, user_id, view_count, like_count, status, transcription_data').eq('id', videoId).single(),
      // Historique de l'utilisateur
      userId ? supabase.from('video_reactions').select('*').eq('user_id', userId).limit(20) : { data: [] },
      // Patterns d'engagement globaux pour cette vidéo
      supabase.from('video_metrics').select('*').eq('video_id', videoId).single()
    ])
    
    const video = videoResponse.data
    const userHistory = userHistoryResponse.data || []
    const videoPatterns = videoPatternsResponse.data
    
    if (!video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Vérifier que la vidéo est publiée et peut recevoir des engagements
    if (video.status !== VIDEO_STATUS.PUBLISHED) {
      return new Response(
        JSON.stringify({ 
          error: 'La vidéo n\'est pas encore publiée',
          videoStatus: video.status,
          allowedStatus: VIDEO_STATUS.PUBLISHED
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    // Analyser l'engagement actuel
    const viewCount = video.view_count || 0
    const likeCount = video.like_count || 0
    const commentCount = videoPatterns?.comment_count || 0
    const engagementRate = viewCount > 0 ? ((likeCount + commentCount) / viewCount) * 100 : 0
    
    // Génération des prédictions et recommandations gamifiées
    let predictions = {
      engagement_score: Math.min(Math.round((engagementRate + (Math.random() * 20)) * 10) / 10, 100),
      like_probability: userId ? Math.min(Math.round(Math.random() * 100), 100) : null,
      comment_probability: userId ? Math.min(Math.round(Math.random() * 60), 100) : null,
      share_probability: userId ? Math.min(Math.round(Math.random() * 40), 100) : null
    }

    // Analyse plus approfondie si la transcription est disponible
    let contentInsights = null
    if (video.transcription_data && typeof video.transcription_data === 'object' && video.transcription_data.text) {
      try {
        const insightsResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "Analyse cette transcription vidéo et identifie les éléments qui pourraient générer de l'engagement (émotions, controverses, appels à l'action, questions). Réponds en JSON."
            },
            {
              role: "user",
              content: video.transcription_data.text.substring(0, 4000) // Limiter la taille
            }
          ],
          response_format: { type: "json_object" }
        })
        
        contentInsights = JSON.parse(insightsResponse.choices[0].message.content || '{}')
      } catch (e) {
        console.error("Erreur lors de l'analyse de contenu", e)
      }
    }
    
    // Si l'utilisateur est connecté, améliorer avec des prédictions IA
    if (userId && userHistory.length > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "Prédis la probabilité d'engagement utilisateur basée sur l'historique et la vidéo actuelle. Format JSON."
            },
            {
              role: "user",
              content: JSON.stringify({
                user_history: userHistory,
                current_video: {
                  id: video.id,
                  title: video.title,
                  metrics: {
                    views: viewCount,
                    likes: likeCount,
                    comments: commentCount,
                    engagement_rate: engagementRate
                  }
                }
              })
            }
          ],
          response_format: { type: "json_object" }
        })
        
        const aiPrediction = JSON.parse(completion.choices[0].message.content || '{}')
        predictions = {
          ...predictions,
          ...aiPrediction,
          ai_enhanced: true
        }
      } catch (e) {
        console.error("Erreur lors du parsing des prédictions IA", e)
      }
    }

    // Récupérer les niveaux de gamification de l'utilisateur depuis la base de données
    let userLevel = null
    if (userId) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('user_gamification')
          .select('*')
          .eq('user_id', userId)
          .single()
          
        if (!userError && userData) {
          userLevel = userData
        } else {
          // Créer une entrée par défaut si elle n'existe pas
          const { data: newUserData, error: createError } = await supabase
            .from('user_gamification')
            .insert({
              user_id: userId,
              level: 1,
              points: 0,
              badges: [],
              achievements: []
            })
            .select()
            .single()
            
          if (!createError) {
            userLevel = newUserData
          }
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données de gamification", error)
      }
    }
    
    // Générer des éléments gamifiés
    const gamification = {
      badges_disponibles: [
        { id: "first_comment", nom: "Premier commentaire", description: "Laisse ton premier commentaire", difficulté: 1, points: 10 },
        { id: "engagement_star", nom: "Star de l'engagement", description: "Interagis avec 5 vidéos consécutives", difficulté: 2, points: 25 },
        { id: "feedback_master", nom: "Maître du feedback", description: "Laisse un commentaire constructif", difficulté: 3, points: 50 }
      ],
      défis_quotidiens: [
        { id: "watch_3", nom: "Visionnage du jour", description: "Regarde 3 vidéos aujourd'hui", récompense: "5 points" },
        { id: "comment_trend", nom: "Tendance du jour", description: "Commente une vidéo tendance", récompense: "10 points" }
      ],
      niveau_actuel: userLevel?.level || 1,
      points: userLevel?.points || 0,
      prochain_niveau_dans: userLevel ? (userLevel.level * 100) - userLevel.points : 100,
      badges_obtenus: userLevel?.badges || []
    }

    // Suggérer des actions pour améliorer l'engagement selon l'analyse
    const suggestedActions = [
      "Ajouter un appel à l'action en début de vidéo",
      "Poser une question ouverte aux viewers",
      "Ajouter des timestamps dans la description",
      "Répondre rapidement aux commentaires"
    ]
    
    // Enregistrer les prédictions pour amélioration future
    if (userId) {
      EdgeRuntime.waitUntil(
        supabase.from('engagement_predictions').insert({
          user_id: userId,
          video_id: videoId,
          predictions,
          created_at: new Date().toISOString()
        })
      )
    }
    
    return new Response(
      JSON.stringify({
        video_id: videoId,
        user_id: userId || null,
        video_status: {
          current: video.status,
          is_published: video.status === VIDEO_STATUS.PUBLISHED
        },
        engagement: {
          current_metrics: {
            views: viewCount,
            likes: likeCount,
            comments: commentCount,
            engagement_rate: engagementRate.toFixed(2)
          },
          predictions,
          content_insights: contentInsights,
          suggested_actions: suggestedActions
        },
        gamification,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error("Erreur:", error)
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
