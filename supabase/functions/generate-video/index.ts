// supabase/functions/generate-video/index.ts
// Assumptions:
// - Tables job_prompts(id, user_id, job_id, generator, style, duration, prompt_text, metadata jsonb)
// - Table generated_videos(id, prompt_id, status, video_url, error_message, metadata jsonb)
// - Environment variable OPENAI_API_KEY is set via `supabase secrets set`.
// - Using npm-specifiers with versions as required by Edge Function guidelines.

import { createClient } from "npm:@supabase/supabase-js@2.45.5";
import OpenAI from "npm:openai@4.53.2";

// Use built-in Deno.serve instead of std server
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

console.info("generate-video function started");

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

    if (!prompt || !generator || !style || !duration) {
      throw new Error("Missing required fields: prompt, generator, style, duration");
    }

    // 1. Create prompt entry first if userId & jobId provided
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
          },
        })
        .select("id")
        .single();

      if (promptError) {
        console.error("Error saving prompt:", promptError);
        throw new Error(`Failed to save prompt: ${promptError.message}`);
      }

      promptId = promptData?.id ?? null;
    }

    // 2. Create generated_videos record with status generating
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
        },
      })
      .select("id, metadata")
      .single();

    if (videoError) {
      console.error("Error creating video record:", videoError);
      throw new Error(`Failed to create video record: ${videoError.message}`);
    }

    const videoId = videoData.id as string;

    // 3. Call OpenAI API (Sora placeholder). Note: As of now, OpenAI doesn't expose a public 'videos.generate' API in openai-node.
    // This block simulates/guards the call for forward compatibility. Replace with actual API once available.
    console.log("Calling OpenAI video generation (placeholder)");

    try {
      // If/when OpenAI exposes a videos API, replace with proper call
      // Example placeholder using images as a stand-in to avoid runtime errors.
      // Remove this when switching to real video API.
      const fallback = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
      });

      const imageUrl = fallback.data?.[0]?.url ?? null;
      const videoUrl = imageUrl; // Placeholder: treat image URL as result for now

      const { error: updateError } = await supabase
        .from("generated_videos")
        .update({
          video_url: videoUrl,
          status: "done",
          metadata: {
            ...videoData.metadata,
            completed_at: new Date().toISOString(),
            openai_response: {
              created: Date.now() / 1000,
              model: "gpt-image-1",
            },
          },
        })
        .eq("id", videoId);

      if (updateError) {
        console.error("Error updating video record:", updateError);
      }

      return new Response(
        JSON.stringify({
          videoUrl,
          status: "success",
          videoId,
          promptId,
          metadata: {
            generated_at: new Date().toISOString(),
            duration,
            style,
            generator,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (openaiError: any) {
      console.error("OpenAI API error:", openaiError);

      await supabase
        .from("generated_videos")
        .update({
          status: "error",
          error_message: String(openaiError?.message ?? openaiError),
          metadata: {
            ...videoData.metadata,
            error: String(openaiError?.message ?? openaiError),
            failed_at: new Date().toISOString(),
          },
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({
          error: String(openaiError?.message ?? openaiError),
          status: "error",
          videoId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error: any) {
    console.error("Error in edge function:", error);
    return new Response(
      JSON.stringify({
        error: String(error?.message ?? error),
        status: "error",
        timestamp: new Date().toISOString(),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
