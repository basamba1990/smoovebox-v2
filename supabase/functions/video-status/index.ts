// video-status.ts - Function pour vérifier le statut des vidéos
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Gestion des requêtes CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Configuration Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Récupération du token JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non authentifié", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Récupération des paramètres
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "ID vidéo requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Récupération des données vidéo
    const { data: video, error: videoError } = await serviceClient
      .from("videos")
      .select(`
        *,
        transcriptions (
          id,
          status,
          confidence_score,
          processed_at,
          analysis_result,
          error_message
        )
      `)
      .eq("id", videoId)
      .single();
    
    if (videoError) {
      return new Response(
        JSON.stringify({ error: "Erreur lors de la récupération de la vidéo", details: videoError.message }),
        { status: videoError.code === "PGRST116" ? 404 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Vérifier l'autorisation
    if (video.user_id !== user.id && !video.is_public) {
      return new Response(
        JSON.stringify({ error: "Accès non autorisé à cette vidéo" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Normaliser le statut pour cohérence dans l'affichage
    const normalizeStatus = (status) => {
      if (!status) return "draft";
      
      const statusLower = status.toLowerCase();
      if (["completed", "analyzed", "published"].includes(statusLower)) {
        return "published";
      } else if (["processing", "transcribing", "analyzing"].includes(statusLower)) {
        return "processing";
      } else if (["failed", "error"].includes(statusLower)) {
        return "failed";
      } else if (["pending", "draft", "ready"].includes(statusLower)) {
        return "draft";
      }
      return statusLower;
    };
    
    // Calculer le statut global de la vidéo
    const videoStatus = normalizeStatus(video.status);
    let progress = 0;
    
    switch (videoStatus) {
      case "draft":
        progress = 0;
        break;
      case "processing":
        progress = 50;
        break;
      case "published":
        progress = 100;
        break;
      case "failed":
        progress = 0;
        break;
    }
    
    // Déterminer si la vidéo a une transcription
    const hasTranscription = !!(
      video.transcription || 
      (video.transcription_data && typeof video.transcription_data === 'object') ||
      (video.transcriptions && video.transcriptions.length > 0)
    );
    
    // Déterminer si la vidéo a une analyse
    const hasAnalysis = !!(
      video.analysis && 
      typeof video.analysis === 'object'
    );
    
    // Formater la réponse
    const response = {
      id: video.id,
      status: videoStatus,
      progress,
      hasTranscription,
      hasAnalysis,
      url: video.url || video.public_url,
      title: video.title,
      created_at: video.created_at,
      updated_at: video.updated_at,
      error_message: video.error_message,
    };
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erreur:", error);
    return new Response(
      JSON.stringify({ error: "Erreur interne du serveur", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
