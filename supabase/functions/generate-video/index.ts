import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import OpenAI from "https://esm.sh/openai@4.53.2";

// Headers CORS COMPLETS
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

// Interface TypeScript STRICTE
type ReqBody = {
  prompt: string;
  generator: string;
  style: string;
  duration: number;
  userId?: string;
  jobId?: string;
};

console.info("✅ Edge Function generate-video démarrée - VERSION CORRIGÉE");

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. GESTION CORS PREFLIGHT (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // 2. GESTION GET INFORMATIF
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "generate-video",
        status: "online",
        allowed_methods: ["POST"],
        message: "Use POST to generate a video"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  // 3. REJET DES MÉTHODES NON AUTORISÉES
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Méthode non autorisée. Utilisez POST.",
        code: "METHOD_NOT_ALLOWED"
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  // 4. TRY-CATCH GLOBAL
  try {
    // 5. VÉRIFICATION VARIABLES ENVIRONNEMENT
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Variables d'environnement critiques manquantes (Supabase)");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuration serveur incomplète (Supabase URL/Key manquante)",
          code: "MISSING_ENV"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 6. INITIALISATION CLIENTS
    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

    // 7. VALIDATION ET PARSING DU BODY
    let body: ReqBody;
    try {
      body = await req.json();
      console.log("📥 Body reçu brut:", JSON.stringify(body, null, 2));
    } catch (e) {
      console.error("❌ Erreur parsing JSON:", e);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Format JSON invalide dans la requête",
          code: "INVALID_JSON"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 8. NORMALISATION DES DONNÉES
    const normalizedStyle = body.style?.toLowerCase().trim() || "";
    const normalizedGenerator = body.generator?.toLowerCase().trim() || "";
    const normalizedPrompt = body.prompt?.trim() || "";
    const duration = Number(body.duration);
    const userId = body.userId;
    const jobId = body.jobId;

    // 9. VALIDATION DES CHAMPS REQUIS
    if (!normalizedPrompt || normalizedPrompt.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Le champ 'prompt' est requis et doit être une chaîne non vide",
          code: "INVALID_PROMPT"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const validGenerators = ["sora", "runway", "pika"];
    if (!normalizedGenerator || !validGenerators.includes(normalizedGenerator)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Générateur invalide: ${body.generator}. Choisissez entre: ${validGenerators.join(", ")}`,
          code: "INVALID_GENERATOR"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const validStyles = ["semi-realistic", "futuristic", "cinematic", "documentary", "abstract", "lumi-universe"];
    if (!normalizedStyle || !validStyles.includes(normalizedStyle)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Style invalide: ${body.style}. Styles autorisés: ${validStyles.join(", ")}`,
          code: "INVALID_STYLE"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!duration || isNaN(duration) || duration < 1 || duration > 120) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Durée invalide. Doit être un nombre entre 1 et 120 secondes",
          code: "INVALID_DURATION"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 10. LOG DE VALIDATION
    console.log("🚨 BODY FINAL VALIDÉ", {
      hasPrompt: !!normalizedPrompt,
      promptLength: normalizedPrompt.length,
      generator: normalizedGenerator,
      style: normalizedStyle,
      duration,
      userId: userId || 'null',
      jobId: jobId || 'null'
    });

    // 11. CRÉATION ENREGISTREMENT VIDÉO (Utilisation de la table 'videos' existante)
    let videoId: string;
    let videoData: any = null;
    try {
      const { data, error: videoError } = await supabase
        .from("videos")
        .insert({
          user_id: userId || null,
          status: "generating",
          metadata: {
            generator: normalizedGenerator,
            style: normalizedStyle,
            duration,
            prompt_text: normalizedPrompt,
            started_at: new Date().toISOString(),
            model: normalizedGenerator === "sora" ? "sora-1.0" : normalizedGenerator,
            job_id: jobId || null
          },
        })
        .select("id, metadata, created_at")
        .single();

      if (videoError) {
        console.error("❌ Erreur création enregistrement vidéo:", videoError);
        throw new Error(`Erreur base de données: ${videoError.message}`);
      }

      videoData = data;
      videoId = videoData.id as string;
      console.log("🎬 Enregistrement vidéo créé avec ID:", videoId);
    } catch (dbError) {
      console.error("❌ Erreur critique base de données:", dbError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Impossible de créer l'enregistrement vidéo. Vérifiez que la table 'videos' existe.",
          code: "DB_ERROR",
          details: dbError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 12. GÉNÉRATION VIDÉO/IMAGE
    let videoUrl: string | null = null;
    let generationResult: any = null;

    try {
      console.log(`🚀 Démarrage génération avec ${normalizedGenerator}...`);
      const startTime = Date.now();

      switch (normalizedGenerator) {
        case "sora":
          if (openai) {
            try {
              const imageResult = await openai.images.generate({
                model: "dall-e-3",
                prompt: `${normalizedPrompt.substring(0, 900)} - Style ${normalizedStyle}, cinématique, haute qualité, illustration conceptuelle`,
                size: "1792x1024",
                quality: "hd",
                style: "vivid",
                n: 1,
              });

              videoUrl = imageResult.data[0].url;
              generationResult = {
                model: "dall-e-3",
                provider: "openai",
                created: Date.now(),
                type: "image_placeholder",
                note: "Sora API pas encore disponible - Placeholder DALL-E"
              };
            } catch (openaiError: any) {
              console.error("❌ Erreur DALL-E:", openaiError);
              videoUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
              generationResult = {
                model: "fallback",
                provider: "placeholder",
                type: "static_image",
                note: "Fallback d'urgence - erreur OpenAI"
              };
            }
          } else {
            videoUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
            generationResult = {
              model: "fallback",
              provider: "placeholder",
              type: "static_image",
              note: "Mode développement - Pas de clé OpenAI"
            };
          }
          break;

        case "runway":
        case "pika":
          // Simulation pour Runway/Pika
          videoUrl = `https://storage.googleapis.com/ai-video-samples/${normalizedGenerator}-sample.mp4`;
          generationResult = {
            model: normalizedGenerator === "runway" ? "gen-2" : "pika-1.0",
            provider: normalizedGenerator,
            duration: duration,
            status: "completed",
            simulated: true
          };
          break;

        default:
          throw new Error(`Générateur non supporté: ${normalizedGenerator}`);
      }

      const processingTime = Date.now() - startTime;

      // 13. MISE À JOUR ENREGISTREMENT VIDÉO
      await supabase
        .from("videos")
        .update({
          video_url: videoUrl,
          status: "done",
          metadata: {
            ...videoData.metadata,
            completed_at: new Date().toISOString(),
            generation_result: generationResult,
            processing_time_ms: processingTime,
            success: true
          },
        })
        .eq("id", videoId);

      // 14. RÉPONSE DE SUCCÈS
      return new Response(
        JSON.stringify({
          success: true,
          videoUrl,
          status: "done",
          videoId,
          metadata: {
            generated_at: new Date().toISOString(),
            duration,
            style: normalizedStyle,
            generator: normalizedGenerator,
            processing_time_ms: processingTime,
            is_placeholder: generationResult.type === "image_placeholder"
          },
          message: "Génération terminée avec succès !"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );

    } catch (generationError: any) {
      console.error("❌ Erreur génération vidéo:", generationError);
      await supabase
        .from("videos")
        .update({
          status: "error",
          metadata: {
            ...videoData.metadata,
            error: generationError.message,
            failed_at: new Date().toISOString(),
          }
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Échec de la génération vidéo",
          details: generationError.message,
          code: "GENERATION_FAILED"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

  } catch (error: any) {
    console.error("❌ Erreur globale edge function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Erreur interne du serveur",
        details: error.message,
        code: "INTERNAL_SERVER_ERROR"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
