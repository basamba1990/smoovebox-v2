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

console.info("🚀 generate-video: Démarrage (Version Finale Corrigée v2)");

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
        JSON.stringify({ success: false, error: "Authentification requise", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Client utilisateur: on passe le JWT utilisateur (RLS actif)
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    });

    // Client admin: pour opérations système (Storage, signed URL, mises à jour finales)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // Vérifier l'utilisateur à partir du token
    const { data: userRes, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Session invalide", code: "INVALID_SESSION" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userRes.user.id;

    const body: ReqBody = await req.json();
    if (!body?.prompt?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt manquant", code: "INVALID_PROMPT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = body.prompt.trim();
    const generator = (body.generator || "runway").toLowerCase().trim() as "sora" | "runway" | "pika";
    const style = (body.style || "cinematic").toLowerCase().trim();
    const duration = Math.max(1, Math.min(120, Number(body.duration) || 30));
    const bucket = body.bucket?.trim() || "videos";
    const access = body.access === "public" ? "public" : "signed";

    // Enregistrement initial sous identité utilisateur (respect policies RLS)
    const videoId = crypto.randomUUID();
    const extension = generator === "sora" ? ".jpg" : ".mp4"; // placeholder image si sora
    const storagePath = `${bucket}/${userId}/${videoId}${extension}`;

    const insertPayload: Record<string, unknown> = {
      id: videoId,
      user_id: userId,
      status: "generating",
      storage_path: storagePath,
      metadata: {
        prompt,
        generator,
        style,
        duration,
        job_id: body.jobId ?? null,
        created_at: new Date().toISOString(),
      },
      title: "Untitled video",
    };

    const { data: videoRecord, error: insertError } = await supabaseUser
      .from("videos")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("❌ Insert videos (RLS)", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur base de données (insert)", details: insertError.message, code: insertError.code }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Choisir une source (mock/placeholder)
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
        // @ts-ignore
        sourceUrl = response?.data?.[0]?.url || sourceUrl;
        isPlaceholder = true;
      } catch (e) {
        console.warn("⚠️ OpenAI placeholder fallback", e);
        isPlaceholder = true;
      }
    }

    // Upload dans Storage puis obtention d'une URL finale
    let finalUrl = sourceUrl;
    try {
      const fetchRes = await fetch(sourceUrl);
      if (fetchRes.ok) {
        const arrayBuffer = await fetchRes.arrayBuffer();
        const { error: uploadErr } = await supabaseAdmin.storage
          .from(bucket)
          .upload(storagePath, arrayBuffer, {
            contentType: generator === "sora" ? "image/jpeg" : "video/mp4",
            upsert: true,
          });

        if (!uploadErr) {
          if (access === "public") {
            const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
            if (pub?.publicUrl) finalUrl = pub.publicUrl;
          } else {
            const { data: signData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 3600);
            if (signData?.signedUrl) finalUrl = signData.signedUrl;
          }
        } else {
          console.warn("⚠️ Upload storage error", uploadErr);
        }
      }
    } catch (e) {
      console.warn("⚠️ Storage fetch/upload fallback", e);
    }

    // Mise à jour finale: IMPORTANT -> ne jamais écrire dans une colonne inexistante ('url')
    const updatePayload: Record<string, unknown> = {
      status: "ready",
      video_url: finalUrl,        // URL exploitable pour l'UI
      public_url: access === "public" ? finalUrl : null,
      storage_path: storagePath,
      metadata: {
        ...(videoRecord?.metadata ?? {}),
        completed_at: new Date().toISOString(),
        is_placeholder: isPlaceholder,
      },
    };

    const { error: updateErr } = await supabaseAdmin
      .from("videos")
      .update(updatePayload)
      .eq("id", videoId);

    if (updateErr) {
      console.error("❌ Update videos (final)", updateErr);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur base de données (update)", details: updateErr.message, code: updateErr.code }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        status: "ready",
        url: finalUrl,
        video_url: finalUrl,
        public_url: access === "public" ? finalUrl : null,
        metadata: updatePayload.metadata,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
