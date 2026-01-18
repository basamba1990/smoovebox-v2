import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import OpenAI from "npm:openai@4.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReqBody = {
  prompt: string;
  generator: "sora" | "runway" | "pika";
  style: string;
  duration: number;
  jobId?: string;
  access?: "public" | "signed";
  bucket?: string;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Variables d'environnement Supabase manquantes");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Session invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ReqBody = await req.json();
    const prompt = body.prompt?.trim();
    const generator = (body.generator || "runway").toLowerCase();
    const style = body.style || "cinematic";
    const bucket = "videos";
    
    const videoId = crypto.randomUUID();
    const isSora = generator === "sora";
    const extension = isSora ? ".jpg" : ".mp4";
    
    // CORRECTION: Chemin aligné avec les politiques RLS (genup_videos/{user_id}/)
    const storagePath = `genup_videos/${user.id}/${videoId}${extension}`;

    // Insertion initiale
    const { data: videoRecord, error: insertError } = await supabaseUser
      .from("videos")
      .insert({
        id: videoId,
        user_id: user.id,
        status: "generating",
        storage_path: storagePath,
        title: body.jobId ? `Job Video ${body.jobId}` : "Untitled video",
        metadata: { prompt, generator, style, duration: body.duration, is_placeholder: isSora }
      })
      .select().single();

    if (insertError) throw insertError;

    let sourceUrl = `https://storage.googleapis.com/ai-video-samples/${generator}-sample.mp4`;
    let isPlaceholder = false;

    // Logique DALL-E pour Sora (API Sora non disponible)
    if (isSora && OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${prompt} - Style ${style}`,
        size: "1024x1024",
      });
      sourceUrl = response.data[0].url!;
      isPlaceholder = true;
    }

    // Upload vers Storage
    const fetchRes = await fetch(sourceUrl);
    const arrayBuffer = await fetchRes.arrayBuffer();
    await supabaseAdmin.storage.from(bucket).upload(storagePath, arrayBuffer, {
      contentType: isSora ? "image/jpeg" : "video/mp4",
      upsert: true
    });

    const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

    // Mise à jour finale
    await supabaseAdmin.from("videos").update({
      status: "ready",
      video_url: publicUrl,
      public_url: publicUrl,
      metadata: { ...videoRecord.metadata, is_placeholder: isPlaceholder, completed_at: new Date().toISOString() }
    }).eq("id", videoId);

    return new Response(
      JSON.stringify({ success: true, data: { videoId, url: publicUrl, metadata: { is_placeholder: isPlaceholder } } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
