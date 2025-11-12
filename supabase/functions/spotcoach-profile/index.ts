// supabase/functions/spotcoach-profile/index.ts
// Edge Function responsible for generating and storing symbolic coaching profiles (SpotCoach).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - npm specifier supported by Supabase Edge Runtime (Deno)
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const DENO = (globalThis as any).Deno as {
  serve: (handler: (request: Request) => Response | Promise<Response>) => Promise<void>;
  env: { get: (name: string) => string | undefined };
};

if (!DENO) {
  throw new Error("Deno global is not available in this runtime");
}

const ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-client-version",
  "x-client-name",
  "x-client-platform",
  "x-client-type",
  "x-supertokens-def",
  "x-csrftoken",
  "x-requested-with",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": ALLOWED_HEADERS.join(", "),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
} as const;

type QuizAnswer = {
  id: string;
  question: string;
  answer: string;
  score?: number;
};

interface GenerateProfilePayload {
  name?: string;
  birth: {
    date: string; // ISO date (YYYY-MM-DD)
    time?: string | null; // Optional time (HH:mm)
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  passions?: QuizAnswer[];
  discProfile?: {
    dominantColor?: string;
    scores?: Record<string, number>;
    summary?: string;
  };
  talentQuiz?: QuizAnswer[];
  intentions?: string[];
}

interface AiSymbolicProfile {
  profile_text: string;
  phrase_synchronie: string;
  archetype: string;
  couleur_dominante: string;
  element: string;
  signe_soleil: string;
  signe_lune: string;
  signe_ascendant: string;
  passions: string[];
  soleil_degre?: number | null;
  lune_degre?: number | null;
  ascendant_degre?: number | null;
}

const AI_RESPONSE_SCHEMA = [
  "profile_text",
  "phrase_synchronie",
  "archetype",
  "couleur_dominante",
  "element",
  "signe_soleil",
  "signe_lune",
  "signe_ascendant",
  "passions",
  "soleil_degre",
  "lune_degre",
  "ascendant_degre",
] as const;

const OPENAI_MODEL = "gpt-4o-mini";

interface AstroEngineResponse {
  sun_deg: number | null;
  moon_deg: number | null;
  asc_deg: number | null;
  sun_sign: string | null;
  moon_sign: string | null;
  asc_sign: string | null;
  tz_used?: string | null;
  ephe_mode?: string;
  [key: string]: unknown;
}

function ensureEnv(name: string): string {
  const value = DENO.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validatePayload(payload: GenerateProfilePayload) {
  if (!payload) {
    throw new Error("Payload is required");
  }

  if (!payload.birth?.date) {
    throw new Error("Birth date is required (YYYY-MM-DD)");
  }

  if (!payload.birth.latitude || !payload.birth.longitude) {
    throw new Error("Latitude and longitude are required for the birth location");
  }

  if (!payload.birth.time) {
    console.warn("[SpotCoach] Birth time not provided. Ascendant/House calculations will be approximate or omitted.");
  }
}

function buildOpenAiPrompt(
  userName: string | undefined,
  payload: GenerateProfilePayload,
  astro: AstroEngineResponse | null
) {
  const name = userName || sanitizeString(payload.name) || "Utilisateur";
  const birth = payload.birth;

  const baseInfo = `
Nom: ${name}
Date de naissance: ${birth.date}
Heure de naissance: ${birth.time ?? "Non fournie"}
Ville: ${birth.city ?? "Non fournie"}
Latitude: ${birth.latitude}
Longitude: ${birth.longitude}
Fuseau horaire: ${birth.timezone ?? "Non fourni"}
`;

  const passionsBlock = (payload.passions ?? [])
    .map((item) => `- ${item.question}: ${item.answer}${item.score !== undefined ? ` (score: ${item.score})` : ""}`)
    .join("\n") || "Aucune réponse";

  const discBlock = payload.discProfile
    ? `Profil DISC déclaré:\nCouleur dominante: ${payload.discProfile.dominantColor ?? "Non fournie"}\nScores: ${JSON.stringify(payload.discProfile.scores ?? {}, null, 2)}\nRésumé: ${payload.discProfile.summary ?? "N/A"}`
    : "Aucun profil DISC fourni";

  const talentBlock = (payload.talentQuiz ?? [])
    .map((item) => `- ${item.question}: ${item.answer}`)
    .join("\n") || "Pas de questionnaire talent";

  const intentionsBlock = (payload.intentions ?? []).map((x) => `- ${x}`).join("\n") || "Aucune intention partagée";

  const astroBlock = astro
    ? `Faits astrologiques calculés (Swiss Ephemeris):
- Soleil: ${astro.sun_deg ?? "null"}° (${astro.sun_sign ?? "inconnu"})
- Lune: ${astro.moon_deg ?? "null"}° (${astro.moon_sign ?? "inconnu"})
- Ascendant: ${astro.asc_deg ?? "null"}° (${astro.asc_sign ?? "inconnu"})`
    : "Faits astrologiques précis non disponibles (calcule signe/degrés au mieux à partir du contexte).";

  return `Tu es SpotCoach, un coach symbolique et stratégique.
Tu combines:
- L'analyse astrologique (à partir des données de naissance)
- Le modèle DISC / 4 couleurs
- Un questionnaire passions / talents
- Les intentions personnelles de l'utilisateur

OBJECTIF: Générer un profil symbolique structuré en JSON respectant strictement le schéma suivant:
{
  "profile_text": string,
  "phrase_synchronie": string,
  "archetype": string,
  "couleur_dominante": string,
  "element": string,
  "signe_soleil": string,
  "signe_lune": string,
  "signe_ascendant": string,
  "passions": string[],
  "soleil_degre": number | null,
  "lune_degre": number | null,
  "ascendant_degre": number | null
}

Contraintes:
- Renvoie UNIQUEMENT le JSON (aucun texte avant ou après).
- Si une information astronomique est inconnue, mets null.
- La phrase_synchronie doit être courte (max 140 caractères) et inspirante.
- L'archetype doit être un mot ou expression courte.
- Les passions doivent être un tableau de chaînes résumant les axes majeurs.
- Utilise un ton professionnel, positif et concret.

DONNÉES UTILISATEUR:
${baseInfo}

Questionnaire passions:
${passionsBlock}

Questionnaire talents:
${talentBlock}

Intentions / objectifs:
${intentionsBlock}

Profil DISC:
${discBlock}

${astroBlock}

Analyse et synthèse:
- 1) Identifie les grands thèmes symboliques qui émergent
- 2) Synthétise les talents / passions clés
- 3) Propose un archetype central et couleur dominante cohérents
- 4) Donne une phrase_synchronie inspirante rappelant l'essence de la personne.
`;
}

async function callOpenAi(prompt: string, signal?: AbortSignal): Promise<AiSymbolicProfile> {
  const apiKey = ensureEnv("OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Tu es SpotCoach, un coach symbolique expert. Réponds en JSON strict." },
        { role: "user", content: prompt },
      ],
      max_tokens: 900,
      temperature: 0.7,
    }),
    signal,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${details}`);
  }

  const json = await response.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";

  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("Failed to parse OpenAI JSON content:", content);
    throw new Error(`Unable to parse OpenAI response as JSON: ${(err as Error).message}`);
  }

  const result = parsed as Partial<AiSymbolicProfile>;
  for (const key of AI_RESPONSE_SCHEMA) {
    if (!(key in result)) {
      throw new Error(`OpenAI response missing required field: ${key}`);
    }
  }

  return {
    profile_text: String(result.profile_text ?? ""),
    phrase_synchronie: String(result.phrase_synchronie ?? ""),
    archetype: String(result.archetype ?? ""),
    couleur_dominante: String(result.couleur_dominante ?? ""),
    element: String(result.element ?? ""),
    signe_soleil: String(result.signe_soleil ?? ""),
    signe_lune: String(result.signe_lune ?? ""),
    signe_ascendant: String(result.signe_ascendant ?? ""),
    passions: Array.isArray(result.passions) ? result.passions.map((p) => String(p)) : [],
    soleil_degre: sanitizeNumber(result.soleil_degre),
    lune_degre: sanitizeNumber(result.lune_degre),
    ascendant_degre: sanitizeNumber(result.ascendant_degre),
  };
}

async function fetchAstroData(birth: GenerateProfilePayload["birth"]): Promise<AstroEngineResponse | null> {
  const url = DENO.env.get("ASTRO_ENGINE_URL");
  if (!url) {
    return null;
  }

  const apiKey = DENO.env.get("ASTRO_ENGINE_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        date: birth.date,
        time: birth.time ?? null,
        latitude: birth.latitude,
        longitude: birth.longitude,
        timezone: birth.timezone ?? null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("[SpotCoach] Astro engine error:", response.status, txt);
      return null;
    }

    const data = await response.json() as AstroEngineResponse;
    return data;
  } catch (err) {
    console.error("[SpotCoach] Astro engine fetch failed:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function saveOrUpdateSymbolicProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: GenerateProfilePayload,
  aiProfile: AiSymbolicProfile,
) {
  const birth = payload.birth;

  // 1) Check if a row already exists for this user
  const { data: existing, error: checkError } = await supabase
    .from("profiles_symboliques")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    throw new Error(`Failed to check existing profile: ${checkError.message}`);
  }

  if (existing?.id) {
    // 2) Update existing row
    const { data: updated, error: updateError } = await supabase
      .from("profiles_symboliques")
      .update({
        name: sanitizeString(payload.name) ?? "Profil SpotCoach",
        date: birth.date,
        time: sanitizeString(birth.time) ?? null,
        lat: birth.latitude,
        lon: birth.longitude,
        soleil: aiProfile.soleil_degre,
        lune: aiProfile.lune_degre,
        ascendant: aiProfile.ascendant_degre,
        profile_text: aiProfile.profile_text,
        phrase_synchronie: aiProfile.phrase_synchronie,
        archetype: aiProfile.archetype,
        couleur_dominante: aiProfile.couleur_dominante,
        element: aiProfile.element,
        signe_soleil: aiProfile.signe_soleil,
        signe_lune: aiProfile.signe_lune,
        signe_ascendant: aiProfile.signe_ascendant,
        passions: aiProfile.passions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update profiles_symboliques: ${updateError.message}`);
    }
    return updated;
  }

  // 3) Insert new row
  const { data: inserted, error: insertError } = await supabase
    .from("profiles_symboliques")
    .insert({
      user_id: userId,
      name: sanitizeString(payload.name) ?? "Profil SpotCoach",
      date: birth.date,
      time: sanitizeString(birth.time) ?? null,
      lat: birth.latitude,
      lon: birth.longitude,
      soleil: aiProfile.soleil_degre,
      lune: aiProfile.lune_degre,
      ascendant: aiProfile.ascendant_degre,
      profile_text: aiProfile.profile_text,
      phrase_synchronie: aiProfile.phrase_synchronie,
      archetype: aiProfile.archetype,
      couleur_dominante: aiProfile.couleur_dominante,
      element: aiProfile.element,
      signe_soleil: aiProfile.signe_soleil,
      signe_lune: aiProfile.signe_lune,
      signe_ascendant: aiProfile.signe_ascendant,
      passions: aiProfile.passions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to insert profiles_symboliques: ${insertError.message}`);
  }
  return inserted;
}

DENO.serve(async (req: Request) => {
  try {
    const origin = req.headers.get("Origin") || "unknown";
    const reqMethod = req.headers.get("Access-Control-Request-Method") || req.method;
    const reqHeaders = req.headers.get("Access-Control-Request-Headers") || "";
    console.log("[SpotCoach] Incoming request:", { method: req.method, origin, reqMethod, reqHeaders });

    if (req.method === "OPTIONS") {
      // Dynamically reflect requested headers/methods for preflight
      const dynamicHeaders: Record<string, string> = { ...corsHeaders } as any;
      if (reqHeaders) dynamicHeaders["Access-Control-Allow-Headers"] = reqHeaders;
      if (reqMethod) dynamicHeaders["Access-Control-Allow-Methods"] = reqMethod + ", OPTIONS";
      return new Response("ok", { status: 200, headers: dynamicHeaders });
    }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = ensureEnv("SUPABASE_URL");
    const serviceKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");
    console.log("[SpotCoach] Env ok:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      hasOpenAI: !!DENO.env.get("OPENAI_API_KEY"),
    });

    const supabaseClient = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Invalid Bearer token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    console.log("[SpotCoach] Verifying user token...");
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !authData?.user) {
      console.error("[SpotCoach] Auth error", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const user = authData.user;

    let payload: GenerateProfilePayload;
    try {
      const raw = await req.text();
      console.log("[SpotCoach] Raw body length:", raw?.length || 0);
      payload = JSON.parse(raw);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON payload", details: String(err) }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    try {
      validatePayload(payload);
    } catch (validationError) {
      return new Response(JSON.stringify({ error: (validationError as Error).message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const astroData = await fetchAstroData(payload.birth);

    const prompt = buildOpenAiPrompt(
      user.user_metadata?.full_name ?? user.email ?? undefined,
      payload,
      astroData
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let aiProfile: AiSymbolicProfile;
    try {
      console.log("[SpotCoach] Calling OpenAI...");
      aiProfile = await callOpenAi(prompt, controller.signal);
      console.log("[SpotCoach] OpenAI response received");
    } finally {
      clearTimeout(timeoutId);
    }

    const enrichedProfile: AiSymbolicProfile = {
      ...aiProfile,
      soleil_degre: astroData?.sun_deg ?? aiProfile.soleil_degre ?? null,
      lune_degre: astroData?.moon_deg ?? aiProfile.lune_degre ?? null,
      ascendant_degre: astroData?.asc_deg ?? aiProfile.ascendant_degre ?? null,
      signe_soleil: astroData?.sun_sign ?? aiProfile.signe_soleil,
      signe_lune: astroData?.moon_sign ?? aiProfile.signe_lune,
      signe_ascendant: astroData?.asc_sign ?? aiProfile.signe_ascendant,
    };

    console.log("[SpotCoach] Persisting profile to profiles_symboliques...");
    const storedProfile = await saveOrUpdateSymbolicProfile(supabaseClient, user.id, payload, enrichedProfile);
    console.log("[SpotCoach] Save/Update complete:", { id: storedProfile?.id, user_id: storedProfile?.user_id });

    return new Response(JSON.stringify({
      success: true,
      mode: "persisted",
      profile: enrichedProfile,
      astro: astroData,
      stored: storedProfile,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("[SpotCoach] Unexpected error", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: (error as Error).message,
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
  } catch (outerErr) {
    console.error("[SpotCoach] Fatal handler error", outerErr);
    return new Response(JSON.stringify({ error: "Fatal handler error", details: String(outerErr) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});


