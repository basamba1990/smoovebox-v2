// functions/tts/index.ts
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

console.info("tts function started (public, no auth)");

Deno.serve(async (req: Request) => {
  // Préflight
  if (req.method === "OPTIONS") {
    console.info("Préflight OPTIONS reçu");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.warn(`Méthode non autorisée: ${req.method}`);
    return json(
      { error: "Méthode non autorisée", details: "Seule la méthode POST est supportée" },
      { status: 405 }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    console.info("Variables d'environnement lues");

    if (!supabaseUrl || !supabaseAnonKey || !openaiApiKey) {
      console.error("Configuration incomplète");
      return json(
        {
          error: "Configuration incomplète",
          details: "Vérifiez SUPABASE_URL, SUPABASE_ANON_KEY et OPENAI_API_KEY",
        },
        { status: 500 }
      );
    }

    // Initialisation du client Supabase (juste pour configuration, pas d'authentification)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.info("Client Supabase initialisé");

    const contentType = req.headers.get("Content-Type") || req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn("Content-Type invalide");
      return json(
        { error: "Content-Type invalide", details: "'application/json' requis" },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = await req.json();
      console.info("Payload JSON reçu:", body);
    } catch {
      console.error("Erreur parsing JSON");
      return json(
        { error: "JSON invalide", details: "Le corps de la requête doit être un JSON valide" },
        { status: 400 }
      );
    }

    const text: unknown = body?.text;
    const voice: unknown = body?.voice;
    const speed: unknown = body?.speed;

    if (typeof text !== "string" || text.trim().length === 0) {
      console.warn("Texte requis manquant ou vide");
      return json(
        { error: "Texte requis", details: "Fournir un 'text' non vide (string)" },
        { status: 400 }
      );
    }

    const maxChars = 4000;
    const cleanText = text.trim().slice(0, maxChars);

    const allowedVoices = new Set(["alloy", "verse", "coral", "sage", "vivid", "bright"]);
    const selectedVoice = typeof voice === "string" && allowedVoices.has(voice) ? voice : "alloy";

    let selectedSpeed = 1.0;
    if (typeof speed === "number" && isFinite(speed)) {
      selectedSpeed = Math.min(2.0, Math.max(0.25, speed));
    }

    console.info(`Paramètres TTS: text="${cleanText}", voice="${selectedVoice}", speed=${selectedSpeed}`);

    const openai = new OpenAI({ apiKey: openaiApiKey });

    console.info("Appel OpenAI TTS...");
    const result = await openai.audio.speech.create({
      model: "tts-1",
      voice: selectedVoice,
      input: cleanText,
      speed: selectedSpeed,
      format: "mp3",
    });
    console.info("Réponse OpenAI reçue");

    const arrayBuffer = await result.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    console.info(`TTS généré, taille du buffer: ${buffer.length} bytes`);

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Content-Length", buffer.length.toString());

    console.info("Réponse TTS envoyée avec succès");
    return new Response(buffer, { status: 200, headers });

  } catch (err: any) {
    console.error("Erreur TTS capturée:", err);
    return json(
      { error: "Erreur interne", details: err?.message || "Erreur inattendue" },
      { status: 500 }
    );
  }
});
