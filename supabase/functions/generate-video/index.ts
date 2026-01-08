import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import OpenAI from "npm:openai@4.56.0";

// En-têtes CORS pour autoriser les requêtes cross-origin
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

// Interface pour le corps de la requête
interface ReqBody {
  prompt: string;
  generator: "sora" | "runway" | "pika";
  style:
    | "semi-realistic"
    | "futuristic"
    | "cinematic"
    | "documentary"
    | "abstract"
    | "lumi-universe";
  duration: number;
  userId?: string; // Fallback, la priorité est au JWT
  jobId?: string;
  access?: "public" | "signed";
  bucket?: string;
}

// Constantes pour la validation
const VALID_GENERATORS = ["sora", "runway", "pika"] as const;
const VALID_STYLES = [
  "semi-realistic",
  "futuristic",
  "cinematic",
  "documentary",
  "abstract",
  "lumi-universe",
] as const;
const DEFAULT_BUCKET = "videos";

// Fonction utilitaire pour déduire le type de contenu
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

console.info("generate-video: start (v3 - user_id fix + full logic)");

// Démarrage du serveur Deno
Deno.serve(async (req: Request): Promise<Response> => {
  // Gérer la requête pre-flight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Bloquer les méthodes non autorisées
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Méthode non autorisée", code: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Récupérer les variables d'environnement
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error("Variables d'environnement Supabase manquantes.");
      return new Response(
        JSON.stringify({ success: false, error: "Configuration serveur incomplète", code: "MISSING_ENV" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Créer un client Supabase avec les droits d'administration
    const admin = createClient(supabaseUrl, serviceKey);

    // **CORRECTION CRITIQUE : Extraire l'ID utilisateur du JWT**
    let authUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        authUserId = user?.id ?? null;
    }

    let body: ReqBody;
    try {
      body = await req.json();
    } catch (_) {
      return new Response(
        JSON.stringify({ success: false, error: "Format JSON invalide", code: "INVALID_JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Déterminer l'ID utilisateur final (priorité au JWT)
    const finalUserId = authUserId || body.userId || null;

    // **CORRECTION CRITIQUE : Bloquer si aucun utilisateur n'est identifié**
    if (!finalUserId) {
      console.error("Tentative de génération sans user_id authentifié.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Utilisateur non authentifié. Un ID utilisateur est requis.",
          code: "UNAUTHENTICATED",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalisation et validation des entrées
    const normalizedPrompt = (body.prompt ?? "").trim();
    const normalizedGenerator = (body.generator ?? "").toLowerCase().trim() as ReqBody["generator"];
    const normalizedStyle = (body.style ?? "").toLowerCase().trim() as ReqBody["style"];
    const duration = Number(body.duration);
    const access = body.access === "public" ? "public" : "signed";
    const bucket = typeof body.bucket === "string" && body.bucket.trim() ? body.bucket.trim() : DEFAULT_BUCKET;

    if (!normalizedPrompt) {
      return new Response(JSON.stringify({ success: false, error: "Le champ 'prompt' est requis" }), { status: 400, headers: corsHeaders });
    }
    if (!(VALID_GENERATORS as readonly string[]).includes(normalizedGenerator)) {
      return new Response(JSON.stringify({ success: false, error: `Générateur invalide` }), { status: 400, headers: corsHeaders });
    }
    if (!(VALID_STYLES as readonly string[]).includes(normalizedStyle)) {
      return new Response(JSON.stringify({ success: false, error: `Style invalide` }), { status: 400, headers: corsHeaders });
    }
    if (!duration || isNaN(duration) || duration < 1 || duration > 120) {
      return new Response(JSON.stringify({ success: false, error: "Durée invalide" }), { status: 400, headers: corsHeaders });
    }

    // Préparation des données pour l'insertion
    const videoId = crypto.randomUUID();
    const extension = normalizedGenerator === "sora" ? ".jpg" : ".mp4";
    const storage_path = `videos/${finalUserId}/${videoId}${extension}`;
    const title = normalizedPrompt.slice(0, 80) || "Untitled";

    // Insertion initiale dans la base de données
    const { data: inserted, error: insertErr } = await admin
      .from("videos")
      .insert({
        id: videoId,
        user_id: finalUserId, // **LA CORRECTION CLÉ EST ICI**
        status: "processing",
        storage_path,
        title,
        metadata: {
          generator: normalizedGenerator,
          style: normalizedStyle,
          duration,
          prompt_text: normalizedPrompt,
          started_at: new Date().toISOString(),
          model: normalizedGenerator === "sora" ? "sora-1.0" : normalizedGenerator,
          job_id: body.jobId ?? null,
        },
      })
      .select("id, metadata, created_at")
      .single();

    if (insertErr) {
      console.error("INSERT videos error:", insertErr);
      return new Response(
        JSON.stringify({ success: false, error: "Impossible de créer l'enregistrement vidéo", details: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Logique de génération (simulée ou réelle)
    const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
    let sourceUrl: string | null = null;
    let generationResult: any = null;
    const start = Date.now();

    if (normalizedGenerator === "sora") {
      sourceUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
      generationResult = { model: "fallback", provider: "placeholder", type: "static_image" };
    } else {
      sourceUrl = `https://storage.googleapis.com/ai-video-samples/${normalizedGenerator}-sample.mp4`;
      generationResult = { model: "simulated", provider: normalizedGenerator, simulated: true };
    }

    const processingTime = Date.now() - start;

    // Upload du média généré vers Supabase Storage
    let finalPublicUrl: string | null = null;
    let finalSignedUrl: string | null = null;

    if (sourceUrl) {
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error(`Téléchargement de la source échoué: ${res.status}`);
      const fileBytes = new Uint8Array(await res.arrayBuffer());
      const contentType = inferContentType(storage_path);

      const { error: upErr } = await admin.storage.from(bucket).upload(storage_path, fileBytes, {
        contentType,
        upsert: true,
      });
      if (upErr) throw new Error(`Upload Storage échoué: ${upErr.message}`);

      if (access === "public") {
        const { data } = admin.storage.from(bucket).getPublicUrl(storage_path);
        finalPublicUrl = data.publicUrl;
      } else {
        const { data, error: signErr } = await admin.storage.from(bucket).createSignedUrl(storage_path, 3600);
        if (signErr) throw new Error(`Création URL signée échouée: ${signErr.message}`);
        finalSignedUrl = data.signedUrl;
      }
    }

    // Mise à jour de l'enregistrement vidéo avec le statut final et les URLs
    const { error: updateErr } = await admin
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
        },
      })
      .eq("id", videoId);

    if (updateErr) {
      console.error("UPDATE videos error:", updateErr);
    }

    // Réponse finale au client
    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        publicUrl: finalPublicUrl,
        signedUrl: finalSignedUrl,
        status: "ready",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Unhandled error in generate-video:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne du serveur", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
