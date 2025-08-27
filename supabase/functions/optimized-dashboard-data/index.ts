// Edge Function optimisée pour récupérer les données du dashboard
// Fichier: supabase/functions/optimized-dashboard-data/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface DashboardData {
  totalVideos: number;
  totalViews: number;
  avgEngagement: number;
  totalDuration: number;
  videosByStatus: Record<string, number>;
  recentVideos: Array<{
    id: string;
    title: string;
    created_at: string;
    views: number;
    engagement_score: number;
    status: string;
  }>;
  performanceData: Array<{
    date: string;
    videos: number;
    avgEngagement: number;
    totalViews: number;
  }>;
  progressStats: {
    completed: number;
    inProgress: number;
    totalTime: number;
  };
  isEmpty: boolean;
}

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Vérifier que c'est une requête GET
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialiser le client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer le token d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token d\'authentification requis' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Vérifier l'utilisateur authentifié
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Erreur d\'authentification:', authError);
      return new Response(
        JSON.stringify({ error: 'Utilisateur non authentifié' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Essayer d'utiliser la vue matérialisée d'abord (plus rapide)
    let useOptimizedQuery = true;
    let userStats = null;

    try {
      const { data: statsData, error: statsError } = await supabaseClient
        .from('user_video_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (statsError) {
        console.warn('Vue matérialisée non disponible, utilisation de requêtes directes');
        useOptimizedQuery = false;
      } else {
        userStats = statsData;
      }
    } catch (error) {
      console.warn('Erreur avec la vue matérialisée:', error);
      useOptimizedQuery = false;
    }

    let dashboardData: DashboardData;

    if (useOptimizedQuery && userStats) {
      // Utiliser les données pré-calculées de la vue matérialisée
      console.log('Utilisation des données optimisées');

      // Récupérer les vidéos récentes (limitées)
      const { data: recentVideos, error: recentError } = await supabaseClient
        .from('videos')
        .select('id, title, created_at, views, engagement_score, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        throw new Error(`Erreur lors de la récupération des vidéos récentes: ${recentError.message}`);
      }

      // Récupérer les données de performance des 30 derniers jours
      const { data: performanceData, error: perfError } = await supabaseClient
        .from('videos')
        .select('created_at, views, engagement_score')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (perfError) {
        console.warn('Erreur lors de la récupération des données de performance:', perfError);
      }

      // Agréger les données de performance par jour
      const performanceByDay = (performanceData || []).reduce((acc: Record<string, any>, video) => {
        const date = new Date(video.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { videos: 0, totalViews: 0, totalEngagement: 0, count: 0 };
        }
        acc[date].videos += 1;
        acc[date].totalViews += video.views || 0;
        if (video.engagement_score !== null) {
          acc[date].totalEngagement += video.engagement_score;
          acc[date].count += 1;
        }
        return acc;
      }, {});

      const performanceArray = Object.entries(performanceByDay).map(([date, data]: [string, any]) => ({
        date,
        videos: data.videos,
        avgEngagement: data.count > 0 ? data.totalEngagement / data.count : 0,
        totalViews: data.totalViews
      }));

      // Calculer les statuts des vidéos
      const videosByStatus = {
        ready: userStats.ready_videos || 0,
        processing: userStats.processing_videos || 0,
        failed: userStats.failed_videos || 0
      };

      dashboardData = {
        totalVideos: userStats.total_videos || 0,
        totalViews: userStats.total_views || 0,
        avgEngagement: userStats.avg_engagement || 0,
        totalDuration: userStats.total_duration || 0,
        videosByStatus,
        recentVideos: (recentVideos || []).map(video => ({
          id: video.id,
          title: video.title || `Video ${video.id}`,
          created_at: video.created_at,
          views: video.views || 0,
          engagement_score: video.engagement_score || 0,
          status: video.status || 'unknown'
        })),
        performanceData: performanceArray,
        progressStats: {
          completed: userStats.ready_videos || 0,
          inProgress: userStats.processing_videos || 0,
          totalTime: userStats.total_duration || 0
        },
        isEmpty: (userStats.total_videos || 0) === 0
      };

    } else {
      // Fallback vers les requêtes directes optimisées
      console.log('Utilisation des requêtes directes optimisées');

      // Requête principale optimisée avec index
      const { data: videos, error: videosError } = await supabaseClient
        .from('videos')
        .select('id, title, created_at, views, engagement_score, status, duration_seconds')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (videosError) {
        throw new Error(`Erreur lors de la récupération des vidéos: ${videosError.message}`);
      }

      if (!videos || videos.length === 0) {
        dashboardData = {
          totalVideos: 0,
          totalViews: 0,
          avgEngagement: 0,
          totalDuration: 0,
          videosByStatus: { ready: 0, processing: 0, failed: 0 },
          recentVideos: [],
          performanceData: [],
          progressStats: { completed: 0, inProgress: 0, totalTime: 0 },
          isEmpty: true
        };
      } else {
        // Calculer les statistiques
        const totalVideos = videos.length;
        const totalViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);
        const validEngagementScores = videos.filter(video => video.engagement_score !== null);
        const avgEngagement = validEngagementScores.length > 0
          ? validEngagementScores.reduce((sum, video) => sum + video.engagement_score, 0) / validEngagementScores.length
          : 0;
        const totalDuration = videos.reduce((sum, video) => sum + (video.duration_seconds || 0), 0);

        // Calculer les statuts
        const videosByStatus = videos.reduce((acc, video) => {
          const status = video.status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Données de performance des 30 derniers jours
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentVideos = videos.filter(video => new Date(video.created_at) >= thirtyDaysAgo);
        
        const performanceByDay = recentVideos.reduce((acc: Record<string, any>, video) => {
          const date = new Date(video.created_at).toISOString().split('T')[0];
          if (!acc[date]) {
            acc[date] = { videos: 0, totalViews: 0, totalEngagement: 0, count: 0 };
          }
          acc[date].videos += 1;
          acc[date].totalViews += video.views || 0;
          if (video.engagement_score !== null) {
            acc[date].totalEngagement += video.engagement_score;
            acc[date].count += 1;
          }
          return acc;
        }, {});

        const performanceData = Object.entries(performanceByDay).map(([date, data]: [string, any]) => ({
          date,
          videos: data.videos,
          avgEngagement: data.count > 0 ? data.totalEngagement / data.count : 0,
          totalViews: data.totalViews
        }));

        dashboardData = {
          totalVideos,
          totalViews,
          avgEngagement,
          totalDuration,
          videosByStatus,
          recentVideos: videos.slice(0, 5).map(video => ({
            id: video.id,
            title: video.title || `Video ${video.id}`,
            created_at: video.created_at,
            views: video.views || 0,
            engagement_score: video.engagement_score || 0,
            status: video.status || 'unknown'
          })),
          performanceData,
          progressStats: {
            completed: videosByStatus.ready || 0,
            inProgress: (videosByStatus.processing || 0) + (videosByStatus.analyzing || 0),
            totalTime: totalDuration
          },
          isEmpty: false
        };
      }
    }

    // Logger l'activité
    await supabaseClient
      .from('user_activities')
      .insert({
        user_id: user.id,
        activity_type: 'dashboard_accessed',
        activity_data: {
          optimized_query: useOptimizedQuery,
          total_videos: dashboardData.totalVideos,
          timestamp: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        data: dashboardData,
        optimized: useOptimizedQuery,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur dans optimized-dashboard-data:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de la récupération des données du dashboard',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

