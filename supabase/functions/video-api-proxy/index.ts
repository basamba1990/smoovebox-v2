// supabase/functions/video-api-proxy/index.ts
import { createClient } from "npm:@supabase/supabase-js@2.45.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { provider, prompt, duration, style, userId, jobId } = await req.json();
    
    let videoUrl = null;
    let result = null;

    switch (provider.toLowerCase()) {
      case "runway":
        // Appel réel à l'API RunwayML
        const runwayResponse = await fetch("https://api.runwayml.com/v1/video/generate", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("RUNWAY_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            duration_seconds: duration,
            style_preset: style,
            aspect_ratio: "16:9",
          }),
        });
        
        result = await runwayResponse.json();
        videoUrl = result.video_url;
        break;

      case "pika":
        // Appel réel à l'API Pika Labs
        const pikaResponse = await fetch("https://api.pika.art/v1/generate", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("PIKA_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            duration,
            style,
            quality: "hd",
          }),
        });
        
        result = await pikaResponse.json();
        videoUrl = result.video_url;
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        provider,
        result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 400, headers: corsHeaders }
    );
  }
});
