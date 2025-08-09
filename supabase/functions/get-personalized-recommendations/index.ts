import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Fonction get-personalized-recommendations appelée");
    
    // Initialiser les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error("Variables d'environnement manquantes");
      return new Response(
        JSON.stringify({ 
          error: "Configuration incomplète", 
          details: "Variables d'environnement manquantes" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Créer un client Supabase avec la clé de service
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // AUTHENTIFICATION ET RÉCUPÉRATION DE L'UTILISATEUR
    let userId = null;
    let token = null;
    
    // Méthode 1: Bearer token dans l'en-tête Authorization
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
      console.log("Token d'authentification trouvé dans l'en-tête Authorization");
    } 
    // Méthode 2: Token dans l'en-tête 'apikey'
    else if (req.headers.get('apikey')) {
      token = req.headers.get('apikey');
      console.log("Token d'authentification trouvé dans l'en-tête apikey");
    }
    // Méthode 3: Extraire le JWT des cookies
    else {
      const cookieHeader = req.headers.get('Cookie');
      if (cookieHeader) {
        const supabaseCookie = cookieHeader.split(';').find(c => 
          c.trim().startsWith('sb-access-token=') || 
          c.trim().startsWith('supabase-auth-token=')
        );
        
        if (supabaseCookie) {
          token = supabaseCookie.split('=')[1].trim();
          if (token.startsWith('"') && token.endsWith('"')) {
            token = token.slice(1, -1); // Enlever les guillemets
          }
          console.log("Token d'authentification trouvé dans les cookies");
        }
      }
    }
    
    // Vérifier l'authentification et récupérer l'ID utilisateur
    if (token) {
      try {
        const { data, error } = await serviceClient.auth.getUser(token);
        
        if (error) {
          console.error("Erreur de décodage du JWT:", error);
        } else if (data.user) {
          userId = data.user.id;
          console.log(`Utilisateur authentifié: ${userId}`);
        }
      } catch (authError) {
        console.error("Exception lors de l'authentification:", authError);
      }
    }

    // Si aucune méthode d'authentification n'a fonctionné, vérifier si l'utilisateur est fourni dans la requête
    if (!userId) {
      try {
        // Pour les requêtes GET, récupérer depuis les paramètres d'URL
        if (req.method === 'GET') {
          const url = new URL(req.url);
          userId = url.searchParams.get('userId');
        }
        // Pour les autres méthodes (POST), récupérer depuis le body
        else {
          const requestData = await req.json();
          userId = requestData.userId;
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données de la requête:", error);
      }
    }
    
    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentification requise', 
          details: "Impossible d'identifier l'utilisateur. Veuillez vous connecter ou fournir un userId." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // RÉCUPÉRATION DES DONNÉES UTILISATEUR
    // 1. Récupérer le profil utilisateur pour comprendre ses préférences
    const { data: userProfile, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Erreur lors de la récupération du profil:", profileError);
      // On continue malgré l'erreur
    }

    // 2. Récupérer l'historique de visionnage récent
    const { data: viewHistory, error: viewHistoryError } = await serviceClient
      .from('video_views')
      .select('*, videos(*)')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(10);

    if (viewHistoryError) {
      console.error("Erreur lors de la récupération de l'historique de visionnage:", viewHistoryError);
      // On continue malgré l'erreur
    }
    
    // 3. Récupérer les likes/interactions
    const { data: userLikes, error: likesError } = await serviceClient
      .from('video_reactions')
      .select('*, videos(*)')
      .eq('user_id', userId)
      .eq('reaction_type', 'like')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (likesError) {
      console.error("Erreur lors de la récupération des likes:", likesError);
      // On continue malgré l'erreur
    }
    
    // 4. Récupérer les abonnements de l'utilisateur
    const { data: subscriptions, error: subscriptionsError } = await serviceClient
      .from('subscriptions')
      .select('*, creator:profiles(*)')
      .eq('subscriber_id', userId);
      
    if (subscriptionsError) {
      console.error("Erreur lors de la récupération des abonnements:", subscriptionsError);
      // On continue malgré l'erreur
    }
    
    // GÉNÉRATION DES RECOMMANDATIONS
    // 1. Recommandations basées sur l'historique récent
    let historyBasedRecommendations = [];
    if (viewHistory && viewHistory.length > 0) {
      // Extraire les tags et sujets des vidéos visionnées
      const viewedTags = new Set();
      const viewedVideoIds = new Set();
      const creatorsWatched = new Set();
      
      viewHistory.forEach(view => {
        if (view.videos) {
          // Ajouter l'ID de la vidéo pour éviter de la recommander à nouveau
          viewedVideoIds.add(view.videos.id);
          
          // Ajouter le créateur à la liste des créateurs visionnés
          if (view.videos.user_id) {
            creatorsWatched.add(view.videos.user_id);
          }
          
          // Extraire les tags des analyses IA si disponibles
          if (view.videos.analysis && view.videos.analysis.insights && view.videos.analysis.insights.sujets) {
            view.videos.analysis.insights.sujets.forEach(tag => viewedTags.add(tag));
          }
          
          // Extraire les tags explicites
          if (view.videos.tags && Array.isArray(view.videos.tags)) {
            view.videos.tags.forEach(tag => viewedTags.add(tag));
          }
        }
      });
      
      // Utiliser les tags pour trouver des vidéos similaires
      if (viewedTags.size > 0) {
        const tagArray = Array.from(viewedTags);
        console.log("Tags extraits de l'historique:", tagArray);
        
        // Rechercher des vidéos avec des tags similaires
        const { data: similarVideos, error: similarError } = await serviceClient.rpc(
          'search_videos_by_tags',
          { 
            search_tags: tagArray,
            excluded_ids: Array.from(viewedVideoIds),
            limit_count: 5
          }
        );
        
        if (similarError) {
          console.error("Erreur lors de la recherche de vidéos similaires:", similarError);
          
          // Méthode alternative avec une requête directe
          const { data: altSimilarVideos, error: altError } = await serviceClient
            .from('videos')
            .select('*')
            .not('id', 'in', `(${Array.from(viewedVideoIds).join(',')})`)
            .limit(5);
            
          if (!altError) {
            historyBasedRecommendations = altSimilarVideos || [];
          }
        } else {
          historyBasedRecommendations = similarVideos || [];
        }
      }
      
      // Si pas assez de recommandations basées sur les tags, ajouter des vidéos des mêmes créateurs
      if (historyBasedRecommendations.length < 3 && creatorsWatched.size > 0) {
        const { data: creatorVideos, error: creatorError } = await serviceClient
          .from('videos')
          .select('*')
          .in('user_id', Array.from(creatorsWatched))
          .not('id', 'in', `(${Array.from(viewedVideoIds).join(',')})`)
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (!creatorError && creatorVideos) {
          historyBasedRecommendations = [
            ...historyBasedRecommendations,
            ...creatorVideos.filter(v => !historyBasedRecommendations.some(h => h.id === v.id))
          ].slice(0, 5);
        }
      }
    }
    
    // 2. Recommandations basées sur les tendances
    const { data: trendingVideos, error: trendingError } = await serviceClient.rpc(
      'get_trending_videos',
      { days_limit: 7, count_limit: 5 }
    );
    
    let trendingRecommendations = [];
    if (trendingError) {
      console.error("Erreur lors de la récupération des vidéos tendance:", trendingError);
      
      // Méthode alternative avec une requête directe
      const { data: altTrendingVideos, error: altError } = await serviceClient
        .from('videos')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(5);
        
      if (!altError) {
        trendingRecommendations = altTrendingVideos || [];
      }
    } else {
      trendingRecommendations = trendingVideos || [];
    }
    
    // 3. Recommandations depuis les abonnements
    let subscriptionRecommendations = [];
    if (subscriptions && subscriptions.length > 0) {
      const creatorIds = subscriptions.map(sub => sub.creator_id);
      
      const { data: creatorContent, error: contentError } = await serviceClient
        .from('videos')
        .select('*')
        .in('user_id', creatorIds)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (!contentError) {
        subscriptionRecommendations = creatorContent || [];
      }
    }
    
    // 4. Utiliser OpenAI pour générer des recommandations personnalisées plus avancées
    const openai = new OpenAI({ apiKey: openaiApiKey });
    let enhancedRecommendations = {};
    
    try {
      // Préparer les données pour l'IA
      const userContext = {
        profile: userProfile || {},
        recentViews: viewHistory ? viewHistory.map(v => ({
          title: v.videos?.title || 'Titre inconnu',
          tags: v.videos?.tags || [],
          insights: v.videos?.analysis?.insights || {}
        })) : [],
        likes: userLikes ? userLikes.map(l => ({
          title: l.videos?.title || 'Titre inconnu',
          tags: l.videos?.tags || [],
          insights: l.videos?.analysis?.insights || {}
        })) : []
      };
      
      // N'envoyer à l'IA que si nous avons suffisamment de données
      if ((userContext.recentViews.length > 0 || userContext.likes.length > 0) && 
          (historyBasedRecommendations.length > 0 || trendingRecommendations.length > 0)) {
        
        const aiResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Tu es un expert en recommandation personnalisée de contenu vidéo.
              Analyze le profil utilisateur et son historique de visionnage pour générer des recommandations personnalisées.
              Les recommandations doivent inclure:
              1. Une explication concise de pourquoi chaque contenu est recommandé
              2. Des suggestions d'objectifs d'apprentissage personnalisés
              3. Des thèmes d'intérêt détectés dans le comportement de l'utilisateur
              
              Réponds au format JSON strict avec cette structure:
              {
                "interets_detectes": ["string", "string", ...],
                "objectifs_suggeres": ["string", "string", ...],
                "recommandations": [
                  {
                    "id": "id-de-la-video",
                    "raison": "string"
                  },
                  ...
                ]
              }`
            },
            {
              role: "user",
              content: JSON.stringify({
                profil_utilisateur: userContext,
                videos_disponibles: {
                  basees_sur_historique: historyBasedRecommendations.map(v => ({
                    id: v.id,
                    titre: v.title,
                    tags: v.tags,
                    analysis: v.analysis
                  })),
                  tendances: trendingRecommendations.map(v => ({
                    id: v.id,
                    titre: v.title,
                    tags: v.tags,
                    analysis: v.analysis
                  }))
                }
              })
            }
          ],
          response_format: { type: "json_object" }
        });
        
        enhancedRecommendations = JSON.parse(aiResponse.choices[0].message.content);
        console.log("Recommandations améliorées par l'IA générées");
      }
    } catch (aiError) {
      console.error("Erreur lors de la génération des recommandations par l'IA:", aiError);
      // Continuer sans les recommandations IA
    }
    
    // Amélioration des recommandations avec des détails supplémentaires
    const enhanceVideoDetails = async (videoList) => {
      if (!videoList || videoList.length === 0) return [];
      
      const videoIds = videoList.map(v => v.id);
      
      // Récupérer les créateurs de ces vidéos
      const { data: creators, error: creatorsError } = await serviceClient
        .from('profiles')
        .select('id, username, avatar_url, display_name')
        .in('id', videoList.map(v => v.user_id).filter(Boolean));
        
      if (creatorsError) {
        console.error("Erreur lors de la récupération des données des créateurs:", creatorsError);
      }
      
      // Récupérer les métriques d'engagement
      const { data: metrics, error: metricsError } = await serviceClient
        .from('video_metrics')
        .select('video_id, view_count, like_count, comment_count')
        .in('video_id', videoIds);
        
      if (metricsError) {
        console.error("Erreur lors de la récupération des métriques:", metricsError);
      }
      
      // Enrichir les vidéos avec ces informations supplémentaires
      return videoList.map(video => {
        const creator = creators?.find(c => c.id === video.user_id) || {};
        const videoMetrics = metrics?.find(m => m.video_id === video.id) || {};
        
        // Vérifier si la vidéo est recommandée par l'IA
        const aiRecommendation = enhancedRecommendations.recommandations?.find(r => r.id === video.id);
        
        return {
          ...video,
          creator: {
            id: creator.id,
            username: creator.username || 'utilisateur',
            display_name: creator.display_name || creator.username || 'Utilisateur',
            avatar_url: creator.avatar_url
          },
          metrics: {
            view_count: videoMetrics.view_count || video.view_count || 0,
            like_count: videoMetrics.like_count || video.like_count || 0,
            comment_count: videoMetrics.comment_count || video.comment_count || 0
          },
          ai_recommendation: aiRecommendation ? {
            reason: aiRecommendation.raison
          } : null
        };
      });
    };
    
    // Enrichir chaque groupe de recommandations
    const enhancedHistoryRecommendations = await enhanceVideoDetails(historyBasedRecommendations);
    const enhancedTrendingRecommendations = await enhanceVideoDetails(trendingRecommendations);
    const enhancedSubscriptionRecommendations = await enhanceVideoDetails(subscriptionRecommendations);
    
    // Enregistrer cette session de recommandation pour apprentissage futur
    try {
      await serviceClient
        .from('recommendation_sessions')
        .insert({
          user_id: userId,
          recommendations: {
            history_based: enhancedHistoryRecommendations.map(v => v.id),
            trending: enhancedTrendingRecommendations.map(v => v.id),
            subscription: enhancedSubscriptionRecommendations.map(v => v.id)
          },
          ai_enhancements: enhancedRecommendations,
          created_at: new Date().toISOString()
        });
        
      console.log("Session de recommandation enregistrée");
    } catch (sessionError) {
      console.error("Erreur lors de l'enregistrement de la session de recommandation:", sessionError);
      // Continuer sans l'enregistrement
    }
    
    // Construire la réponse finale
    const response = {
      user_id: userId,
      recommendations: {
        personalized: enhancedHistoryRecommendations,
        trending: enhancedTrendingRecommendations,
        subscriptions: enhancedSubscriptionRecommendations
      },
      insights: {
        detected_interests: enhancedRecommendations.interets_detectes || [],
        suggested_goals: enhancedRecommendations.objectifs_suggeres || []
      },
      generated_at: new Date().toISOString()
    };
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Erreur non gérée:", error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
