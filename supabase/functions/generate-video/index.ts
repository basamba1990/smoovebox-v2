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
  style: "semi-realistic" | "futuristic" | "cinematic" | "documentary" | "abstract" | "lumi-universe";
  duration: number;
  userId: string; // REQUIS - Le frontend DOIT l'envoyer
  jobId?: string;
  access?: "public" | "signed";
  bucket?: string;
};

console.info("✅ generate-video démarrée (version simplifiée avec userId requis)");

Deno.serve(async (req: Request): Promise<Response> => {
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

    const body: ReqBody = await req.json();

    // VALIDATION SIMPLE
    if (!body.prompt?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt requis", code: "INVALID_PROMPT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId requis dans le body", code: "USER_ID_REQUIRED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NORMALISATION
    const prompt = body.prompt.trim();
    const generator = body.generator.toLowerCase().trim();
    const style = body.style.toLowerCase().trim();
    const userId = body.userId.trim();
    const duration = Math.max(1, Math.min(120, Number(body.duration) || 30));
    const bucket = body.bucket?.trim() || "videos";
    const access = body.access === "public" ? "public" : "signed";

    // CLIENT SERVICE (bypass RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "edge-generate-video" } }
    });

    const videoId = crypto.randomUUID();
    const extension = generator === "sora" ? ".jpg" : ".mp4";
    const storagePath = `${bucket}/${userId}/${videoId}${extension}`;

    console.log(`📝 INSERT video pour userId: ${userId}, videoId: ${videoId}`);

    // ÉTAPE 1: INSERT dans la table (status: generating)
    const { data: videoRecord, error: insertError } = await supabase
      .from("videos")
      .insert({
        id: videoId,
        user_id: userId, // ← GARANTI non NULL
        status: "generating",
        storage_path: storagePath,
        metadata: {
          prompt: prompt,
          generator: generator,
          style: style,
          duration: duration,
          created_at: new Date().toISOString(),
          user_id: userId // Double sécurité
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ ERREUR INSERT:", insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Erreur base de données",
          details: insertError.message,
          hint: "Vérifiez que la table videos existe avec user_id comme colonne requise et défaut supprimé à auth.uid()"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ INSERT réussi, ID:", videoRecord.id);

    // ÉTAPE 2: Génération du contenu (simulée)
    let sourceUrl: string;
    let isPlaceholder = false;

    if (generator === "sora") {
      // Placeholder DALL-E
      const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
      if (openai) {
        try {
          const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `${prompt.substring(0, 800)} - Style ${style}, futuriste, haute qualité`,
            size: "1024x1024",
            quality: "standard",
            n: 1,
          });
          // @ts-ignore - SDK types allow b64/url; we accept url here
          sourceUrl = response.data[0]?.url || "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
          isPlaceholder = true;
        } catch (error) {
          console.warn("⚠️ DALL-E échoué, fallback:", error);
          sourceUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
          isPlaceholder = true;
        }
      } else {
        sourceUrl = "https://storage.googleapis.com/ai-video-placeholders/future-job-concept.jpg";
        isPlaceholder = true;
      }
    } else {
      // Vidéos simulées
      sourceUrl = `https://storage.googleapis.com/ai-video-samples/${generator}-sample.mp4`;
    }

    // ÉTAPE 3: Upload vers Supabase Storage (optionnel)
    let finalUrl = sourceUrl;
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error(`fetch ${sourceUrl} -> ${response.status}`);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: generator === "sora" ? "image/jpeg" : "video/mp4",
          upsert: true
        });

      if (!uploadError) {
        if (access === "public") {
          const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
          finalUrl = data.publicUrl;
        } else {
          const { data, error: signErr } = await supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, 3600);
          if (!signErr) finalUrl = data.signedUrl;
        }
      } else {
        console.warn("⚠️ Upload storage échoué:", uploadError);
      }
    } catch (storageError) {
      console.warn("⚠️ Storage échoué, on garde l'URL source:", storageError);
    }

    // ÉTAPE 4: Mise à jour du statut
    await supabase
      .from("videos")
      .update({
        status: "ready",
        video_url: sourceUrl,
        public_url: access === "public" ? finalUrl : null,
        url: finalUrl,
        metadata: {
          ...videoRecord.metadata,
          completed_at: new Date().toISOString(),
          is_placeholder: isPlaceholder,
          final_url: finalUrl
        }
      })
      .eq("id", videoId);

    // RÉPONSE DE SUCCÈS
    return new Response(
      JSON.stringify({
        success: true,
        videoId: videoId,
        status: "ready",
        url: finalUrl,
        isPlaceholder: isPlaceholder,
        message: "Vidéo générée avec succès"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ ERREUR GLOBALE:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Erreur interne",
        details: error.message,
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
