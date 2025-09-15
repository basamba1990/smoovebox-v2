import { createClient } from "npm:@supabase/supabase-js@2.46.2";
import OpenAI from "npm:openai@4.56.0";

// CORS communs
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}

console.info("tts function started");

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(
      { error: "Méthode non autorisée", details: "Seule la méthode POST est supportée" },
      { status: 405 },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !openaiApiKey) {
      return json(
        {
          error: "Configuration incomplète",
          details: "Vérifiez SUPABASE_URL, SUPABASE_ANON_KEY et OPENAI_API_KEY",
        },
        { status: 500 },
      );
    }

    // Client pour vérifier le JWT utilisateur
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Auth: exiger un access_token Supabase (pas un ID token d’un autre fournisseur)
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json(
        {
          error: "Non autorisé",
          details:
            "Header Authorization manquant. Envoyez 'Authorization: Bearer <access_token>' issu de supabase.auth.getSession().",
        },
        { status: 401 },
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data, error: userError } = await supabase.auth.getUser(token);
    if (userError || !data?.user) {
      console.error("Erreur de vérification du token:", userError?.message || userError);
      return json(
        {
          error: "Token d'authentification invalide",
          details:
            "Le token doit être un access_token Supabase valide (avec la claim 'sub').",
        },
        { status: 401 },
      );
    }

    // Validation Content-Type
    const contentType = req.headers.get("Content-Type") || req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json(
        { error: "Content-Type invalide", details: "'application/json' requis" },
        { status: 400 },
      );
    }

    // Lecture payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(
        { error: "JSON invalide", details: "Le corps de la requête doit être un JSON valide" },
        { status: 400 },
      );
    }

    const text: unknown = body?.text;
    const voice: unknown = body?.voice;
    const speed: unknown = body?.speed;

    if (typeof text !== "string" || text.trim().length === 0) {
      return json(
        { error: "Texte requis", details: "Fournir un 'text' non vide (string)" },
        { status: 400 },
      );
    }

    // Garde-fous côté API
    const maxChars = 4000; // Ajustez au besoin
    const cleanText = text.trim().slice(0, maxChars);

    const allowedVoices = new Set([
      "alloy",
      "verse",
      "coral",
      "sage",
      "vivid",
      "bright",
    ]);
    const selectedVoice = typeof voice === "string" && allowedVoices.has(voice) ? voice : "alloy";

    let selectedSpeed = 1.0;
    if (typeof speed === "number" && isFinite(speed)) {
      selectedSpeed = Math.min(2.0, Math.max(0.25, speed));
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Appel TTS
    const result = await openai.audio.speech.create({
      model: "tts-1",
      voice: selectedVoice,
      input: cleanText,
      speed: selectedSpeed,
      format: "mp3",
    });

    const arrayBuffer = await result.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Content-Length", buffer.length.toString());

    return new Response(buffer, { status: 200, headers });
  } catch (err: any) {
    console.error("Erreur TTS:", err);
    return json(
      {
        error: "Erreur interne",
        details: err?.message || "Erreur inattendue",
      },
      { status: 500 },
    );
  }
});
