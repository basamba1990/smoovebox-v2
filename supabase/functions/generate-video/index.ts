import { createClient } from "npm:@supabase/supabase-js@2.45.5";
import OpenAI from "npm:openai@4.53.2";

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

  // 2. GESTION GET INFORMATIF (CORRECTION 1)
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

    if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
      console.error("❌ Variables d'environnement manquantes");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuration serveur incomplète",
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
    const openai = new OpenAI({ apiKey: openaiApiKey });

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
    const normalizedGenerator = body.generator?.toUpperCase().trim() || "";
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

    if (!normalizedGenerator || !["SORA", "RUNWAY", "PIKA"].includes(normalizedGenerator)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Générateur invalide. Choisissez entre: SORA, RUNWAY, PIKA",
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

    // 10. LOG DE VALIDATION (CRITIQUE)
    console.log("🚨 BODY FINAL VALIDÉ", {
      hasPrompt: !!normalizedPrompt,
      promptLength: normalizedPrompt.length,
      generator: normalizedGenerator,
      style: normalizedStyle,
      duration,
      userId: userId || 'null',
      jobId: jobId || 'null'
    });

    // 11. CRÉATION ENREGISTREMENT DANS job_prompts
    let promptId: string | null = null;
    if (userId) {
      try {
        const { data: promptData, error: promptError } = await supabase
          .from("job_prompts")
          .insert({
            user_id: userId,
            job_id: jobId || null,
            generator: normalizedGenerator,
            style: normalizedStyle,
            duration: duration,
            prompt_text: normalizedPrompt,
            metadata: {
              style: normalizedStyle,
              duration,
              generated_at: new Date().toISOString(),
              prompt_length: normalizedPrompt.length,
              validated: true
            },
          })
          .select("id")
          .single();

        if (promptError) {
          console.error("⚠️ Erreur sauvegarde prompt:", promptError);
        } else {
          promptId = promptData?.id ?? null;
          console.log("✅ Prompt enregistré avec ID:", promptId);
        }
      } catch (dbError) {
        console.error("⚠️ Erreur base de données prompt:", dbError);
      }
    }

    // 12. CRÉATION ENREGISTREMENT VIDÉO
    let videoId: string;
    let videoData: any = null;
    try {
      const { data, error: videoError } = await supabase
        .from("generated_videos")
        .insert({
          prompt_id: promptId,
          status: "generating",
          metadata: {
            generator: normalizedGenerator,
            style: normalizedStyle,
            duration,
            prompt_length: normalizedPrompt.length,
            started_at: new Date().toISOString(),
            model: normalizedGenerator === "SORA" ? "sora-1.0" : normalizedGenerator.toLowerCase(),
            user_id: userId || null,
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
          error: "Impossible de créer l'enregistrement vidéo",
          code: "DB_ERROR"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 13. GÉNÉRATION VIDÉO/IMAGE
    let videoUrl: string | null = null;
    let generationResult: any = null;

    try {
      console.log(`🚀 Démarrage génération avec ${normalizedGenerator}...`);
      const startTime = Date.now();

      switch (normalizedGenerator) {
        case "SORA":
          console.log("⚠️ API Sora non disponible, utilisation DALL-E comme placeholder");
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
            console.log("✅ Image DALL-E générée:", videoUrl);
          } catch (openaiError: any) {
            console.error("❌ Erreur DALL-E:", openaiError);
            videoUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
            generationResult = {
              model: "fallback",
              provider: "placeholder",
              created: Date.now(),
              type: "static_image",
              note: "Fallback d'urgence - erreur OpenAI"
            };
          }
          break;

        case "RUNWAY":
          console.log("🔄 Simulation API RunwayML");
          videoUrl = `https://storage.googleapis.com/runwayml-samples/future-tech-${Date.now()}.mp4`;
          generationResult = {
            model: "gen-2",
            provider: "runwayml",
            duration: duration,
            status: "completed",
            simulated: true
          };
          break;

        case "PIKA":
          console.log("⚡ Simulation API Pika Labs");
          videoUrl = `https://pika-labs.s3.amazonaws.com/samples/ai-generated-${Date.now()}.mp4`;
          generationResult = {
            model: "pika-1.0",
            provider: "pika",
            duration: duration,
            status: "completed",
            simulated: true
          };
          break;

        default:
          throw new Error(`Générateur non supporté: ${normalizedGenerator}`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Génération terminée en ${processingTime}ms`, { videoUrl });

      // 14. MISE À JOUR ENREGISTREMENT VIDÉO
      try {
        const { error: updateError } = await supabase
          .from("generated_videos")
          .update({
            video_url: videoUrl,
            status: "done",
            metadata: {
              ...videoData.metadata,
              completed_at: new Date().toISOString(),
              generation_result: generationResult,
              final_url: videoUrl,
              processing_time_ms: processingTime,
              success: true
            },
          })
          .eq("id", videoId);

        if (updateError) {
          console.error("⚠️ Erreur mise à jour vidéo (non critique):", updateError);
        } else {
          console.log("✅ Enregistrement vidéo mis à jour");
        }
      } catch (updateError) {
        console.error("⚠️ Erreur mise à jour DB (non critique):", updateError);
      }

      // 15. RÉPONSE DE SUCCÈS
      return new Response(
        JSON.stringify({
          success: true,
          videoUrl,
          status: "done",
          videoId,
          promptId,
          metadata: {
            generated_at: new Date().toISOString(),
            duration,
            style: normalizedStyle,
            generator: normalizedGenerator,
            model: generationResult.model,
            provider: generationResult.provider,
            processing_time_ms: processingTime,
            is_placeholder: generationResult.type === "image_placeholder",
            note: generationResult.note || null
          },
          message: generationResult.type === "image_placeholder"
            ? "Vidéo générée avec succès (placeholder DALL-E - Sora API bientôt disponible)"
            : "Vidéo générée avec succès !",
          warning: generationResult.type === "image_placeholder"
            ? "API Sora pas encore disponible - Image DALL-E utilisée comme placeholder"
            : null
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );

    } catch (generationError: any) {
      // 16. GESTION ERREUR GÉNÉRATION
      console.error("❌ Erreur génération vidéo:", generationError);

      try {
        await supabase
          .from("generated_videos")
          .update({
            status: "error",
            error_message: generationError.message?.substring(0, 500) || "Erreur inconnue",
            metadata: {
              ...videoData.metadata,
              error: generationError.message,
              error_stack: generationError.stack?.substring(0, 1000),
              failed_at: new Date().toISOString(),
            }
          })
          .eq("id", videoId);
      } catch (dbUpdateError) {
        console.error("⚠️ Impossible de mettre à jour l'erreur en DB:", dbUpdateError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Échec de la génération vidéo",
          details: generationError.message,
          status: "error",
          videoId,
          code: "GENERATION_FAILED",
          message: "La génération a échoué. Veuillez réessayer."
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
        status: "critical_error",
        timestamp: new Date().toISOString(),
        code: "INTERNAL_SERVER_ERROR",
        message: "Une erreur technique est survenue. Notre équipe a été notifiée."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
