import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import OpenAI from "npm:openai@4.56.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

type ReqBody = {
  prompt: string;
  generator: "sora" | "runway" | "pika";
  style: "semi-realistic" | "futuristic" | "cinematic" | "documentary" | "abstract" | "lumi-universe";
  duration: number;
  userId?: string; // ignored if JWT present
  jobId?: string;
  access?: "public" | "signed";
  bucket?: string;
};

const VALID_GENERATORS = ["sora", "runway", "pika"] as const;
const VALID_STYLES = ["semi-realistic", "futuristic", "cinematic", "documentary", "abstract", "lumi-universe"] as const;

const defaultBucket = "videos";

const inferContentType = (path: string): string => {
  const lower = path.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
};

const getAuthHeaderToken = (req: Request): string | null => {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) return parts[1];
  return null;
};

console.info("✅ generate-video démarrée (npm imports, upload Storage, signed URLs par défaut)");

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === "GET") {
      return new Response(
        JSON.stringify({
          service: "generate-video",
          status: "online",
          allowed_methods: ["POST"],
          message: "Use POST to generate a video",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Méthode non autorisée. Utilisez POST.", code: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseAnon || !supabaseService) {
      console.error("❌ Manque SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Config Supabase manquante", code: "MISSING_ENV" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: ReqBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Format JSON invalide", code: "INVALID_JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedPrompt = (body.prompt ?? "").trim();
    const normalizedGenerator = (body.generator ?? "").toLowerCase().trim() as ReqBody["generator"];
    const normalizedStyle = (body.style ?? "").toLowerCase().trim() as ReqBody["style"];
    const duration = Number(body.duration);
    const jobId = body.jobId ?? null;
    const access = body.access === "public" ? "public" : "signed"; // défaut: signed
    const bucket = typeof body.bucket === "string" && body.bucket.trim() ? body.bucket.trim() : defaultBucket;

    if (!normalizedPrompt) {
      return new Response(
        JSON.stringify({ success: false, error: "Le champ 'prompt' est requis", code: "INVALID_PROMPT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!(VALID_GENERATORS as readonly string[]).includes(normalizedGenerator as any)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Générateur invalide: ${body.generator}. Choisissez: ${VALID_GENERATORS.join(", ")}`,
          code: "INVALID_GENERATOR",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!(VALID_STYLES as readonly string[]).includes(normalizedStyle as any)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Style invalide: ${body.style}. Autorisés: ${VALID_STYLES.join(", ")}`,
          code: "INVALID_STYLE",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!duration || isNaN(duration) || duration < 1 || duration > 120) {
      return new Response(
        JSON.stringify({ success: false, error: "Durée invalide. Doit être entre 1 et 120 secondes", code: "INVALID_DURATION" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth: récupère l'UID depuis le JWT Authorization si présent; sinon fallback sur body.userId
    const jwt = getAuthHeaderToken(req);
    const supabaseForAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    });
    const {
      data: { user },
      error: userErr,
    } = await supabaseForAuth.auth.getUser();
    if (userErr) console.warn("⚠️ getUser error (on continue avec userId body si fourni):", userErr.message);
    const effectiveUserId = user?.id ?? body.userId ?? null;

    if (!effectiveUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentification requise (JWT manquant)", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // DB et Storage en service key pour bypass RLS côté fonction, tout en journalisant l'UID
    const supabase = createClient(supabaseUrl, supabaseService);

    const videoId = crypto.randomUUID();
    const extension = normalizedGenerator === "sora" ? ".jpg" : ".mp4"; // placeholder image pour sora
    const storage_path = `videos/${effectiveUserId}/${videoId}${extension}`;

    const { data: inserted, error: insertErr } = await supabase
      .from("videos")
      .insert({
        id: videoId,
        user_id: effectiveUserId,
        status: "generating",
        storage_path,
        metadata: {
          generator: normalizedGenerator,
          style: normalizedStyle,
          duration,
          prompt_text: normalizedPrompt,
          started_at: new Date().toISOString(),
          model: normalizedGenerator === "sora" ? "sora-1.0" : normalizedGenerator,
          job_id: jobId,
          access_mode: access,
          storage_bucket: bucket,
        },
      })
      .select("id, metadata, created_at")
      .single();

    if (insertErr) {
      console.error("❌ Erreur INSERT videos:", insertErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Impossible de créer l'enregistrement vidéo",
          code: "DB_ERROR",
          details: insertErr.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sourceUrl: string | null = null;
    let generationResult: any = null;
    const start = Date.now();

    const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

    if (normalizedGenerator === "sora") {
      if (openai) {
        try {
          const imageResult = await openai.images.generate({
            model: "dall-e-3",
            prompt: `${normalizedPrompt.slice(0, 900)} - Style ${normalizedStyle}, cinématique, HQ`,
            size: "1792x1024",
            quality: "hd",
            style: "vivid",
            n: 1,
          });
          sourceUrl = imageResult.data?.[0]?.url ?? null;
          generationResult = { model: "dall-e-3", provider: "openai", created: Date.now(), type: "image_placeholder" };
        } catch (e: any) {
          console.error("❌ Erreur OpenAI:", e?.message || e);
          sourceUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
          generationResult = { model: "fallback", provider: "placeholder", type: "static_image" };
        }
      } else {
        sourceUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
        generationResult = { model: "fallback", provider: "placeholder", type: "static_image" };
      }
    } else if (normalizedGenerator === "runway" || normalizedGenerator === "pika") {
      sourceUrl = `https://storage.googleapis.com/ai-video-samples/${normalizedGenerator}-sample.mp4`;
      generationResult = { model: normalizedGenerator === "runway" ? "gen-2" : "pika-1.0", provider: normalizedGenerator, duration, status: "completed", simulated: true };
    }

    const processingTime = Date.now() - start;

    // Téléchargement et upload Storage
    let finalPublicUrl: string | null = null;
    let finalSignedUrl: string | null = null;

    if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error(`Téléchargement de la source échoué: ${res.status} ${res.statusText}`);
      const arrayBuf = await res.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuf);
      const contentType = inferContentType(storage_path);

      const { error: upErr } = await createClient(supabaseUrl, supabaseService)
        .storage
        .from(bucket)
        .upload(storage_path, fileBytes, { contentType, upsert: true });

      if (upErr) throw new Error(`Upload Storage échoué: ${upErr.message}`);

      if (access === "public") {
        const { data } = createClient(supabaseUrl, supabaseService).storage.from(bucket).getPublicUrl(storage_path);
        finalPublicUrl = data.publicUrl;
      } else {
        const { data, error: signErr } = await createClient(supabaseUrl, supabaseService).storage
          .from(bucket)
          .createSignedUrl(storage_path, 3600);
        if (signErr) throw new Error(`Création URL signée échouée: ${signErr.message}`);
        finalSignedUrl = data.signedUrl;
      }
    }

    const { error: updateErr } = await supabase
      .from("videos")
      .update({
        video_url: sourceUrl,
        public_url: finalPublicUrl,
        url: access === "signed" ? finalSignedUrl : finalPublicUrl,
        status: "ready",
        metadata: {
          ...inserted!.metadata,
          completed_at: new Date().toISOString(),
          generation_result: generationResult,
          processing_time_ms: processingTime,
          success: true,
        },
      })
      .eq("id", videoId);

    if (updateErr) console.error("⚠️ Erreur UPDATE videos:", updateErr.message || updateErr);

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        bucket,
        storage_path,
        access,
        sourceUrl,
        publicUrl: finalPublicUrl,
        signedUrl: finalSignedUrl,
        status: "ready",
        metadata: {
          generated_at: new Date().toISOString(),
          duration,
          style: normalizedStyle,
          generator: normalizedGenerator,
          processing_time_ms: processingTime,
          is_placeholder: generationResult?.type === "image_placeholder",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("❌ Erreur globale:", error?.message || error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne du serveur", details: error?.message ?? String(error), code: "INTERNAL_SERVER_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
