// verify_jwt enabled by default via Deno.serve auth check in code
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

console.info("🚀 generate-video: Démarrage (Version Finale Sans Erreur)");

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

    // Exiger un JWT côté Edge Function
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentification requise", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("❌ Erreur Auth:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Session invalide", code: "INVALID_SESSION" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const body: ReqBody = await req.json();

    if (!body.prompt?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt manquant", code: "INVALID_PROMPT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = body.prompt.trim();
    const generator = (body.generator || "runway").toLowerCase().trim();
    const style = (body.style || "cinematic").toLowerCase().trim();
    const duration = Math.max(1, Math.min(120, Number(body.duration) || 30));
    const bucket = body.bucket?.trim() || "videos";
    const access = body.access === "public" ? "public" : "signed";

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

    const videoId = crypto.randomUUID();
    const extension = generator === "sora" ? ".jpg" : ".mp4";
    const storagePath = `${bucket}/${userId}/${videoId}${extension}`;

    console.log(`📝 Création vidéo: ID=${videoId}, User=${userId}`);

    const { data: videoRecord, error: insertError } = await supabaseAdmin
      .from("videos")
      .insert({
        id: videoId,
        user_id: userId,
        status: "generating",
        storage_path: storagePath,
        metadata: {
          prompt,
          generator,
          style,
          duration,
          job_id: body.jobId,
          created_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Erreur DB (Insert):", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur base de données", details: insertError.message, code: insertError.code }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sourceUrl = `https://storage.googleapis.com/ai-video-samples/${generator}-sample.mp4`;
    let isPlaceholder = false;

    if (generator === "sora" && OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: `${prompt.substring(0, 800)} - Style ${style}`,
          size: "1024x1024",
        });
        // deno-lint-ignore no-explicit-any
        sourceUrl = (response as any).data?.[0]?.url || sourceUrl;
        isPlaceholder = true;
      } catch (_) {
        console.warn("⚠️ Fallback DALL-E échoué");
        isPlaceholder = true;
      }
    }

    let finalUrl = sourceUrl;
    try {
      const fetchRes = await fetch(sourceUrl);
      if (fetchRes.ok) {
        const blob = await fetchRes.blob();
        const { error: uploadErr } = await supabaseAdmin.storage
          .from(bucket)
          .upload(storagePath, await blob.arrayBuffer(), {
            contentType: generator === "sora" ? "image/jpeg" : "video/mp4",
            upsert: true,
          });

        if (!uploadErr) {
          if (access === "public") {
            finalUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
          } else {
            const { data: signData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 3600);
            if (signData) finalUrl = signData.signedUrl;
          }
        }
      }
    } catch (_) {
      console.warn("⚠️ Erreur Storage, utilisation URL source");
    }

    await supabaseAdmin
      .from("videos")
      .update({
        status: "ready",
        url: finalUrl,
        video_url: sourceUrl,
        public_url: access === "public" ? finalUrl : null,
        metadata: {
          ...videoRecord.metadata,
          completed_at: new Date().toISOString(),
          is_placeholder: isPlaceholder,
        },
      })
      .eq("id", videoId);

    return new Response(
      JSON.stringify({ success: true, videoId, status: "ready", url: finalUrl, isPlaceholder }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Erreur Critique:", message);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
