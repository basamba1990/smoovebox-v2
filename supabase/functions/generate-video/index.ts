import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// En-têtes CORS pour autoriser les requêtes cross-origin
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-source, x-client-id",
  "Access-Control-Max-Age": "86400",
};

// Interface pour le corps de la requête
interface ReqBody {
  prompt: string;
  generator: "sora" | "runway" | "pika";
  style: "semi-realistic" | "futuristic" | "cinematic" | "documentary" | "abstract" | "lumi-universe";
  duration: number;
  userId?: string;
  jobId?: string;
  access?: "public" | "signed";
  bucket?: string;
}

// Constantes pour la validation
const VALID_GENERATORS = ["sora", "runway", "pika"] as const;
const VALID_STYLES = ["semi-realistic", "futuristic", "cinematic", "documentary", "abstract", "lumi-universe"] as const;
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

// Fonction pour décoder le JWT sans validation (juste extraction)
const decodeJWT = (token: string): { sub?: string; user_id?: string } => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Token JWT invalide');
    }
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch (error) {
    console.error('❌ Erreur décodage JWT:', error);
    return {};
  }
};

console.info("🚀 generate-video: Démarrage Edge Function v4 (JWT fix + validation complète)");

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
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Récupérer les variables d'environnement
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error("❌ Variables d'environnement Supabase manquantes.");
      return new Response(
        JSON.stringify({ success: false, error: "Configuration serveur incomplète", code: "MISSING_ENV" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Créer un client Supabase avec les droits d'administration
    const admin = createClient(supabaseUrl, serviceKey);

    // **EXTRACTION CRITIQUE : Récupérer l'ID utilisateur du JWT**
    let authUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const payload = decodeJWT(token);
        authUserId = payload.sub || payload.user_id || null;
        
        if (authUserId) {
          console.log("✅ User ID extrait du JWT:", authUserId);
        } else {
          console.warn("⚠️ JWT valide mais sans sub/user_id");
        }
      } catch (error) {
        console.error("❌ Erreur lors de l'extraction JWT:", error);
      }
    }

    // Parser le body de la requête
    let body: ReqBody;
    try {
      body = await req.json();
      console.log("📥 Body reçu:", { ...body, promptPreview: body.prompt?.substring(0, 50) + '...' });
    } catch (_) {
      return new Response(
        JSON.stringify({ success: false, error: "Format JSON invalide", code: "INVALID_JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // **DÉTERMINATION FINALE DE L'USER ID (priorité JWT > body)**
    const finalUserId = authUserId || body.userId || null;
    
    // **VALIDATION CRITIQUE : Bloquer si aucun utilisateur identifié**
    if (!finalUserId) {
      console.error("❌ Tentative de génération sans user_id authentifié.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Utilisateur non authentifié. Un ID utilisateur valide est requis.",
          code: "UNAUTHENTICATED",
          details: { authHeaderPresent: !!authHeader, bodyUserId: !!body.userId }
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🎯 User ID final pour insertion:", finalUserId);

    // Normalisation et validation des entrées
    const normalizedPrompt = (body.prompt ?? "").trim();
    const normalizedGenerator = (body.generator ?? "").toLowerCase().trim() as ReqBody["generator"];
    const normalizedStyle = (body.style ?? "").toLowerCase().trim() as ReqBody["style"];
    const duration = Number(body.duration);
    const access = body.access === "public" ? "public" : "signed";
    const bucket = typeof body.bucket === "string" && body.bucket.trim() ? body.bucket.trim() : DEFAULT_BUCKET;

    // VALIDATIONS STRICTES
    if (!normalizedPrompt || normalizedPrompt.length < 10) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Le champ 'prompt' est requis et doit contenir au moins 10 caractères",
          code: "INVALID_PROMPT" 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!VALID_GENERATORS.includes(normalizedGenerator)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Générateur invalide: ${body.generator}. Valides: ${VALID_GENERATORS.join(', ')}`,
          code: "INVALID_GENERATOR" 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!VALID_STYLES.includes(normalizedStyle)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Style invalide: ${body.style}. Valides: ${VALID_STYLES.join(', ')}`,
          code: "INVALID_STYLE" 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!duration || isNaN(duration) || duration < 1 || duration > 120) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Durée invalide. Doit être un nombre entre 1 et 120 secondes",
          code: "INVALID_DURATION" 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // **PRÉPARATION DES DONNÉES POUR L'INSERTION**
    const videoId = crypto.randomUUID();
    const extension = normalizedGenerator === "sora" ? ".jpg" : ".mp4";
    const storagePath = `videos/${finalUserId}/${videoId}${extension}`;
    const title = normalizedPrompt.slice(0, 80) || "Génération métier futur";

    console.log("💾 Préparation insertion DB:", {
      videoId,
      userId: finalUserId,
      storagePath,
      titlePreview: title
    });

    // **INSERTION DANS LA BASE DE DONNÉES**
    const { data: inserted, error: insertErr } = await admin
      .from("videos")
      .insert({
        id: videoId,
        user_id: finalUserId, // **COLONNE CORRECTE : user_id (snake_case)**
        status: "processing",
        storage_path: storagePath,
        title: title,
        metadata: {
          generator: normalizedGenerator,
          style: normalizedStyle,
          duration: duration,
          prompt_text: normalizedPrompt,
          started_at: new Date().toISOString(),
          model: normalizedGenerator === "sora" ? "sora-1.0" : normalizedGenerator,
          job_id: body.jobId || null,
          user_id: finalUserId, // Dupliqué dans metadata pour requêtes
        },
      })
      .select("id, metadata, created_at")
      .single();

    if (insertErr) {
      console.error("❌ INSERT videos error:", insertErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Impossible de créer l'enregistrement vidéo",
          details: insertErr.message,
          code: "DB_INSERT_ERROR",
          hint: "Vérifiez que la colonne 'user_id' existe et accepte NOT NULL"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Enregistrement DB créé:", inserted.id);

    // **LOGIGUE DE GÉNÉRATION (SIMULÉE POUR L'EXEMPLE)**
    const startTime = Date.now();
    let sourceUrl: string;
    let generationResult: any;

    if (normalizedGenerator === "sora") {
      // Placeholder pour Sora (non disponible)
      sourceUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
      generationResult = {
        model: "dall-e-3",
        provider: "openai",
        type: "static_image",
        is_placeholder: true,
        note: "Sora API non disponible, image DALL-E générée comme placeholder"
      };
    } else {
      // Simulation pour Runway/Pika
      sourceUrl = `https://storage.googleapis.com/ai-video-samples/${normalizedGenerator}-sample.mp4`;
      generationResult = {
        model: normalizedGenerator === "runway" ? "gen-2" : "pika-1.0",
        provider: normalizedGenerator,
        simulated: true,
        is_placeholder: true
      };
    }

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Génération simulée terminée en ${processingTime}ms`);

    // **UPLOAD VERS STORAGE**
    let finalPublicUrl: string | null = null;
    let finalSignedUrl: string | null = null;

    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error(`Téléchargement source échoué: ${res.status}`);
      
      const fileBytes = new Uint8Array(await res.arrayBuffer());
      const contentType = inferContentType(storagePath);
      
      console.log(`📤 Upload vers Storage: ${bucket}/${storagePath}`);
      
      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(storagePath, fileBytes, {
          contentType,
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) throw new Error(`Upload Storage échoué: ${uploadError.message}`);

      // Génération des URLs
      if (access === "public") {
        const { data: publicData } = admin.storage.from(bucket).getPublicUrl(storagePath);
        finalPublicUrl = publicData.publicUrl;
        console.log("🌐 URL publique générée:", finalPublicUrl);
      } else {
        const { data: signedData, error: signError } = await admin.storage
          .from(bucket)
          .createSignedUrl(storagePath, 3600); // 1 heure
        
        if (signError) throw new Error(`Création URL signée échouée: ${signError.message}`);
        finalSignedUrl = signedData.signedUrl;
        console.log("🔐 URL signée générée");
      }
    } catch (storageError) {
      console.error("❌ Erreur Storage:", storageError);
      // On continue même en cas d'erreur Storage
    }

    // **MISE À JOUR DE L'ENREGISTREMENT VIDÉO**
    const updateData = {
      video_url: sourceUrl,
      public_url: finalPublicUrl,
      url: access === "signed" ? finalSignedUrl : finalPublicUrl,
      status: "ready",
      metadata: {
        ...inserted.metadata,
        completed_at: new Date().toISOString(),
        generation_result: generationResult,
        processing_time_ms: processingTime,
        storage_bucket: bucket,
        storage_path: storagePath,
        access_type: access
      }
    };

    const { error: updateErr } = await admin
      .from("videos")
      .update(updateData)
      .eq("id", videoId);

    if (updateErr) {
      console.error("⚠️ UPDATE videos warning:", updateErr);
    } else {
      console.log("✅ Vidéo marquée comme 'ready'");
    }

    // **RÉPONSE FINALE AU CLIENT**
    const responseData = {
      success: true,
      videoId,
      videoUrl: sourceUrl,
      publicUrl: finalPublicUrl,
      signedUrl: finalSignedUrl,
      status: "ready",
      metadata: {
        model: generationResult.model,
        style: normalizedStyle,
        duration: duration,
        is_placeholder: generationResult.is_placeholder || false,
        processing_time_ms: processingTime
      }
    };

    console.log("📤 Réponse envoyée au client:", { videoId, status: "ready" });

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("💥 Erreur non gérée dans generate-video:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Erreur interne du serveur",
        details: error instanceof Error ? error.message : String(error),
        code: "INTERNAL_SERVER_ERROR",
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
