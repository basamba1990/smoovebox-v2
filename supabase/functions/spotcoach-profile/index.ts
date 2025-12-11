// supabase/functions/spotcoach-profile/index.ts
// Edge Function responsible for generating and storing symbolic coaching profiles (SpotCoach).
// AMÉLIORATIONS: Intégration AstroEngine (A1) et Prompt plus robuste (A3).

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

interface BirthData {
  date: string; // ISO date (YYYY-MM-DD)
  time?: string | null; // Optional time (HH:mm)
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface GenerateProfilePayload {
  name?: string;
  birth: BirthData;
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

/**
 * Tâche A1: Intégration de l'appel à l'API AstroEngine.
 * Récupère les données astrologiques brutes.
 */
async function fetchAstroData(birth: BirthData): Promise<AstroEngineResponse | null> {
  const startTime = Date.now();
  try {
    console.log("[SpotCoach] fetchAstroData START", { birth });
    
    let apiUrl: string;
    let apiKey: string;
    
    try {
      apiUrl = ensureEnv("ASTRO_ENGINE_URL");
      console.log("[SpotCoach] ASTRO_ENGINE_URL found:", apiUrl);
    } catch (err) {
      console.error("[SpotCoach] Missing ASTRO_ENGINE_URL:", err);
      return null;
    }
    
    try {
      apiKey = ensureEnv("ASTRO_ENGINE_API_KEY");
      console.log("[SpotCoach] ASTRO_ENGINE_API_KEY found:", apiKey ? "***" : "MISSING");
    } catch (err) {
      console.error("[SpotCoach] Missing ASTRO_ENGINE_API_KEY:", err);
      return null;
    }

    const requestBody = {
      date: birth.date,
      time: birth.time,
      latitude: birth.latitude,
      longitude: birth.longitude,
      timezone: birth.timezone,
    };
    
    console.log("[SpotCoach] Calling Astro Engine:", { 
      url: apiUrl, 
      hasKey: !!apiKey,
      requestBody
    });

    const fetchStart = Date.now();
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const fetchTime = Date.now() - fetchStart;
    console.log("[SpotCoach] Astro Engine response received:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      fetchTimeMs: fetchTime
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(`[SpotCoach] AstroEngine API error (${response.status}):`, details);
      return null;
    }

    const responseText = await response.text();
    console.log("[SpotCoach] Astro Engine response text:", responseText.substring(0, 200));
    
    let astroResult: AstroEngineResponse;
    try {
      astroResult = JSON.parse(responseText) as AstroEngineResponse;
      console.log("[SpotCoach] Astro Engine parsed successfully:", astroResult);
    } catch (parseError) {
      console.error("[SpotCoach] Failed to parse Astro response:", parseError, "Response:", responseText);
      return null;
    }

    const totalTime = Date.now() - startTime;
    console.log("[SpotCoach] Astro Engine success (total time:", totalTime, "ms):", astroResult);
    return astroResult;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error("[SpotCoach] Failed to fetch Astro data (time:", totalTime, "ms):", error);
    if (error instanceof Error) {
      console.error("[SpotCoach] Error name:", error.name);
      console.error("[SpotCoach] Error message:", error.message);
      console.error("[SpotCoach] Error stack:", error.stack);
    } else {
      console.error("[SpotCoach] Error (unknown type):", String(error));
    }
    return null;
  }
}

/**
 * Tâche A3: Mise à jour du prompt pour une structure plus robuste (Markdown).
 */
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

  const formatDegree = (deg: number | null | undefined) =>
    deg === null || deg === undefined || Number.isNaN(Number(deg))
      ? "inconnu"
      : `${Number(deg).toFixed(1)}°`;

  const astroFacts = astro
    ? `Données astro calculées (Swiss Ephemeris) :\n- Soleil : ${formatDegree(astro.sun_deg)} (${astro.sun_sign ?? "signe inconnu"})\n- Lune : ${formatDegree(astro.moon_deg)} (${astro.moon_sign ?? "signe inconnu"})\n- Ascendant : ${formatDegree(astro.asc_deg)} (${astro.asc_sign ?? "signe inconnu"})\n- Mode de calcul : ${astro.ephe_mode ?? "inconnu"}`
    : "Données astro indisponibles : déduis les tendances au mieux.";

  return `Tu es SpotCoach, un coach symbolique et stratégique francophone.
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

Contraintes impératives :
- Renvoie uniquement ce JSON (aucun autre texte).
- Langue: français naturel, sans emoji.
- Utilise les faits astro pour renseigner signes et degrés (arrondis à une décimale avec ~xx.x°).
- "phrase_synchronie": slogan positif, max 140 caractères.
- "archetype", "couleur_dominante", "element": termes courts et cohérents.
- "passions": 3 à 5 éléments (phrases courtes) dérivés des informations fournies.
- "profile_text" doit suivre exactement cette structure, en utilisant le format Markdown :
  ## Soleil - Signe (~degré)
  Paragraphe sur le tempérament et la motivation.
  ## Lune - Signe (~degré)
  Paragraphe sur le monde émotionnel et les besoins affectifs.
  ## Ascendant - Signe (~degré)
  Paragraphe sur l'image sociale et la manière d'aborder la vie.
  ## Points forts
  - Bullet 1
  - Bullet 2
  - Bullet 3 (3 à 5 puces maximum)
  ## Conclusion
  Phrase de synthèse unique.
- N'utilise pas de balises HTML. Utilise le format Markdown standard.

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

Faits astro:
${astroFacts}
`;
}

/**
 * Tâche A3: Ajout d'une post-validation simple du format Markdown.
 */
function validateProfileText(text: string): boolean {
  const requiredSections = ["## Soleil", "## Lune", "## Ascendant", "## Points forts", "## Conclusion"];
  return requiredSections.every(section => text.includes(section));
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
      response_format: { type: "json_object" }, // Enforce JSON output
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
    if (!(key in result) || result[key] === undefined || result[key] === null) {
      throw new Error(`OpenAI response missing required field: ${key}`);
    }
  }
  
  // Post-validation check for profile_text structure
  if (!validateProfileText(result.profile_text as string)) {
      console.warn("Profile text failed Markdown structure validation. Using raw output.");
      // NOTE: In a production environment, this should trigger a retry or a fallback.
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

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth token and user
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const supabaseUrl = ensureEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const user_id = user.id;

    // Get payload from request body (frontend sends payload directly, not wrapped)
    const requestBody = await request.json();
    const payload = (requestBody.payload || requestBody) as GenerateProfilePayload;

    validatePayload(payload);

    // 1. Fetch Astro Data (Tâche A1)
    const astroData = await fetchAstroData(payload.birth);
    
    // 2. Fetch User Name from Supabase (reuse supabase client created above)
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user_id)
      .single();

    if (userError) {
      console.warn(`Could not fetch user name for ${user_id}:`, userError.message);
    }
    const userName = userData?.full_name;

    // 3. Build Prompt and Call OpenAI
    const prompt = buildOpenAiPrompt(userName, payload, astroData);
    const symbolicProfile = await callOpenAi(prompt);

    // 4. Store Profile in Database
    // Check if profile exists, then update or insert
    const { data: existingProfile } = await supabase
      .from("profiles_symboliques")
      .select("id")
      .eq("user_id", user_id)
      .maybeSingle();

    const profileData = {
      user_id: user_id,
      name: payload.name || null,
      date: payload.birth.date,
      time: payload.birth.time || null,
      lat: payload.birth.latitude || null,
      lon: payload.birth.longitude || null,
      soleil: symbolicProfile.soleil_degre || null,
      lune: symbolicProfile.lune_degre || null,
      ascendant: symbolicProfile.ascendant_degre || null,
      profile_text: symbolicProfile.profile_text,
      phrase_synchronie: symbolicProfile.phrase_synchronie,
      archetype: symbolicProfile.archetype,
      couleur_dominante: symbolicProfile.couleur_dominante,
      element: symbolicProfile.element,
      signe_soleil: symbolicProfile.signe_soleil,
      signe_lune: symbolicProfile.signe_lune,
      signe_ascendant: symbolicProfile.signe_ascendant,
      passions: symbolicProfile.passions || [],
      updated_at: new Date().toISOString(),
    };

    let insertError;
    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from("profiles_symboliques")
        .update(profileData)
        .eq("user_id", user_id);
      insertError = error;
    } else {
      // Insert new profile
      const { error } = await supabase
        .from("profiles_symboliques")
        .insert(profileData);
      insertError = error;
    }

    if (insertError) {
      throw new Error(`Failed to store symbolic profile: ${insertError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      profile: symbolicProfile,
      astro: astroData // Include astro engine result for testing
    }), {
      headers: corsHeaders,
      status: 200,
    });
  } catch (error) {
    console.error("SpotCoach Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
}

DENO.serve(handleRequest);
