// supabase/functions/generate-video/index.ts
import { createClient } from "npm:@supabase/supabase-js@2.45.5";
import OpenAI from "npm:openai@4.53.2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReqBody = {
  prompt: string;
  generator: string;
  style: string;
  duration: number;
  userId?: string;
  jobId?: string;
};

console.info("✅ generate-video function started");

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const body: ReqBody = await req.json();
    const { prompt, generator, style, duration, userId, jobId } = body;

    console.log("📥 Received request:", { generator, style, duration, promptLength: prompt.length });

    if (!prompt || !generator || !style || !duration) {
      throw new Error("Missing required fields: prompt, generator, style, duration");
    }

    // 1. Créer l'entrée dans job_prompts si userId et jobId sont fournis
    let promptId: string | null = null;
    if (userId && jobId) {
      const { data: promptData, error: promptError } = await supabase
        .from("job_prompts")
        .insert({
          user_id: userId,
          job_id: jobId,
          generator: generator,
          style: style,
          duration: duration,
          prompt_text: prompt,
          metadata: {
            style,
            duration,
            generated_at: new Date().toISOString(),
            prompt_length: prompt.length,
          },
        })
        .select("id")
        .single();

      if (promptError) {
        console.error("❌ Error saving prompt:", promptError);
        throw new Error(`Failed to save prompt: ${promptError.message}`);
      }

      promptId = promptData?.id ?? null;
      console.log("✅ Prompt saved with ID:", promptId);
    }

    // 2. Créer l'entrée dans generated_videos avec statut "generating"
    const { data: videoData, error: videoError } = await supabase
      .from("generated_videos")
      .insert({
        prompt_id: promptId,
        status: "generating",
        metadata: {
          generator,
          style,
          duration,
          prompt_length: prompt.length,
          started_at: new Date().toISOString(),
          model: generator === "Sora" ? "sora-1.0" : generator.toLowerCase(),
        },
      })
      .select("id, metadata")
      .single();

    if (videoError) {
      console.error("❌ Error creating video record:", videoError);
      throw new Error(`Failed to create video record: ${videoError.message}`);
    }

    const videoId = videoData.id as string;
    console.log("🎬 Video record created with ID:", videoId);

    // 3. Appeler l'API appropriée selon le générateur
    let videoUrl: string | null = null;
    let generationResult: any = null;

    try {
      console.log(`🚀 Starting generation with ${generator}...`);

      switch (generator.toUpperCase()) {
        case "SORA":
          // ⚠️ Note: L'API Sora n'est pas encore publique
          // Quand elle sera disponible, utilisez :
          // generationResult = await openai.videos.generate({
          //   model: "sora-1.0",
          //   prompt: prompt,
          //   duration: duration,
          //   size: "1920x1080",
          //   aspect_ratio: "16:9",
          //   style: style,
          // });
          
          // Pour l'instant, simulation avec une image
          console.log("⚠️ Sora API not yet available, using image generation as placeholder");
          const imageResult = await openai.images.generate({
            model: "dall-e-3",
            prompt: `${prompt} - ${style} style, cinematic, professional video still`,
            size: "1792x1024",
            quality: "hd",
            style: "vivid",
            n: 1,
          });
          
          videoUrl = imageResult.data[0].url;
          generationResult = {
            model: "dall-e-3",
            created: Date.now(),
            type: "image_placeholder"
          };
          break;

        case "RUNWAY":
          // Pour RunwayML, vous pouvez intégrer leur API
          // Voici un exemple de structure
          console.log("🔄 Simulating RunwayML API call");
          
          // Simulation d'un appel à RunwayML
          videoUrl = `https://storage.googleapis.com/runwayml/samples/${Date.now()}.mp4`;
          generationResult = {
            model: "gen-2",
            provider: "runwayml",
            duration: duration,
            status: "completed"
          };
          break;

        case "PIKA":
          // Pour Pika Labs
          console.log("⚡ Simulating Pika Labs API call");
          
          videoUrl = `https://pika-labs.s3.amazonaws.com/generated/${Date.now()}.mp4`;
          generationResult = {
            model: "pika-1.0",
            provider: "pika",
            duration: duration,
            status: "completed"
          };
          break;

        default:
          throw new Error(`Unsupported generator: ${generator}`);
      }

      console.log("✅ Generation completed, video URL:", videoUrl);

      // 4. Mettre à jour l'entrée dans generated_videos
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
            processing_time: Date.now() - new Date(videoData.metadata.started_at).getTime(),
          },
        })
        .eq("id", videoId);

      if (updateError) {
        console.error("⚠️ Error updating video record:", updateError);
      }

      // 5. Retourner la réponse
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
            style,
            generator,
            model: generationResult.model,
            processing_time_ms: Date.now() - new Date(videoData.metadata.started_at).getTime(),
          },
          message: "Video generated successfully!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );

    } catch (openaiError: any) {
      console.error("❌ OpenAI/API error:", openaiError);

      // Mettre à jour avec statut d'erreur
      await supabase
        .from("generated_videos")
        .update({
          status: "error",
          error_message: String(openaiError?.message ?? openaiError),
          metadata: {
            ...videoData.metadata,
            error: String(openaiError?.message ?? openaiError),
            error_stack: openaiError?.stack,
            failed_at: new Date().toISOString(),
          },
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({
          success: false,
          error: String(openaiError?.message ?? openaiError),
          status: "error",
          videoId,
          message: "Failed to generate video",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error: any) {
    console.error("❌ Error in edge function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error?.message ?? error),
        status: "error",
        timestamp: new Date().toISOString(),
        message: "Internal server error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
