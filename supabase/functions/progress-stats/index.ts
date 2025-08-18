// progress-stats.ts - Function pour récupérer les statistiques de progression
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Gestion des requêtes CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé", details: authError }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Récupérer les statistiques de progression
    const { data: progressStats, error: progressError } = await supabaseClient.rpc(
      "get_user_progress_stats",
      { user_id_param: user.id }
    );

    if (progressError) {
      console.error("Erreur lors de la récupération des statistiques:", progressError);
      
      // Plan de secours si la fonction SQL n'existe pas
      const { data: videos, error: videosError } = await supabaseClient
        .from("videos")
        .select("id, title, created_at, status, analysis, performance_score, duration")
        .or(`user_id.eq.${user.id},profile_id.in.(SELECT id FROM profiles WHERE user_id = '${user.id}')`)
        .order("created_at", { ascending: false });

      if (videosError) {
        throw new Error(`Erreur lors de la récupération des vidéos: ${videosError.message}`);
      }

      // Générer des statistiques de base à partir des vidéos
      const publishedVideos = videos?.filter(v => v.status === "published") || [];
      const fallbackStats = {
        overall_stats: {
          total_videos: publishedVideos.length,
          average_score: publishedVideos.length > 0 
            ? Math.round(publishedVideos.reduce((sum, v) => sum + (v.performance_score || 0), 0) / publishedVideos.length) 
            : 0,
          best_score: publishedVideos.length > 0
            ? Math.max(...publishedVideos.map(v => v.performance_score || 0))
            : 0
        },
        recent_performance: publishedVideos.slice(0, 10).map(v => ({
          date: new Date(v.created_at).toISOString().split('T')[0],
          score: v.performance_score || 0
        })),
        skills: {
          clarity: { current: 75, previous: 70 },
          structure: { current: 70, previous: 65 },
          expressivity: { current: 80, previous: 75 },
          creativity: { current: 85, previous: 80 },
          rhythm: { current: 82, previous: 78 }
        },
        activity_streak: { current_streak: 0, best_streak: 0 }
      };

      return new Response(JSON.stringify(fallbackStats), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(progressStats), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur serveur:", error);
    return new Response(JSON.stringify({ error: `Erreur interne du serveur: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
