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

console.info("✅ generate-video démarrée (Version Robuste - JWT Auth)");

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Gestion du CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "POST requis", code: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Configuration Supabase manquante");
    }

    // 2. Authentification via JWT (Sécurité Maximale)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Non authentifié", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("❌ Erreur Auth:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Session invalide", code: "INVALID_SESSION" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const body: ReqBody = await req.json();

    // 3. Validation des données
    if (!body.prompt?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt requis", code: "INVALID_PROMPT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Normalisation
    const prompt = body.prompt.trim();
    const generator = (body.generator || "runway").toLowerCase().trim();
    const style = (body.style || "cinematic").toLowerCase().trim();
    const duration = Math.max(1, Math.min(120, Number(body.duration) || 30));
    const bucket = body.bucket?.trim() || "videos";
    const access = body.access === "public" ? "public" : "signed";

    // 5. Client Admin pour les opérations DB/Storage
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const videoId = crypto.randomUUID();
    const extension = generator === "sora" ? ".jpg" : ".mp4";
    const storagePath = `${bucket}/${userId}/${videoId}${extension}`;

    console.log(`📝 Création vidéo pour user: ${userId}, ID: ${videoId}`);

    // 6. Insertion initiale
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
      console.error("❌ Erreur DB:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur base de données", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Simulation / Appel API (Sora/Runway/Pika)
    let sourceUrl: string;
    let isPlaceholder = false;

    if (generator === "sora") {
      const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
      if (openai) {
        try {
          const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `${prompt.substring(0, 800)} - Style ${style}, cinematic, high quality`,
            size: "1024x1024",
            n: 1,
          });
          sourceUrl = (response as any).data?.[0]?.url || "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
          isPlaceholder = true;
        } catch (e) {
          console.warn("⚠️ Fallback DALL-E:", e);
          sourceUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
          isPlaceholder = true;
        }
      } else {
        sourceUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
        isPlaceholder = true;
      }
    } else {
      sourceUrl = `https://storage.googleapis.com/ai-video-samples/${generator}-sample.mp4`;
    }

    // 8. Upload vers Storage
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
    } catch (e) {
      console.warn("⚠️ Erreur Storage (fallback URL source):", e);
    }

    // 9. Mise à jour finale
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
      JSON.stringify({
        success: true,
        videoId,
        status: "ready",
        url: finalUrl,
        isPlaceholder,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Erreur Critique:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
