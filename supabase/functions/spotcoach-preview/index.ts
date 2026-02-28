// supabase/functions/spotcoach-preview/index.ts
// Variante de SpotCoach qui génère un profil symbolique SANS l'enregistrer en base.

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
  date: string;
  time?: string | null;
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
    console.warn("[SpotCoachPreview] Birth time not provided. Ascendant/House calculations will be approximate or omitted.");
  }
}

async function fetchAstroData(birth: BirthData): Promise<AstroEngineResponse | null> {
  const startTime = Date.now();
  try {
    console.log("[SpotCoachPreview] fetchAstroData START", { birth });

    let apiUrl: string;
    let apiKey: string;

    try {
      apiUrl = ensureEnv("ASTRO_ENGINE_URL");
    } catch (err) {
      console.error("[SpotCoachPreview] Missing ASTRO_ENGINE_URL:", err);
      return null;
    }

    try {
      apiKey = ensureEnv("ASTRO_ENGINE_API_KEY");
    } catch (err) {
      console.error("[SpotCoachPreview] Missing ASTRO_ENGINE_API_KEY:", err);
      return null;
    }

    const requestBody = {
      date: birth.date,
      time: birth.time,
      latitude: birth.latitude,
      longitude: birth.longitude,
      timezone: birth.timezone,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(`[SpotCoachPreview] AstroEngine API error (${response.status}):`, details);
      return null;
    }

    const responseText = await response.text();

    let astroResult: AstroEngineResponse;
    try {
      astroResult = JSON.parse(responseText) as AstroEngineResponse;
    } catch (parseError) {
      console.error("[SpotCoachPreview] Failed to parse Astro response:", parseError, "Response:", responseText);
      return null;
    }

    console.log("[SpotCoachPreview] Astro Engine success:", astroResult);
    return astroResult;
  } catch (error) {
    console.error("[SpotCoachPreview] Failed to fetch Astro data:", error);
    return null;
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
Date de naissance: ${birth.date}
Ville de naissance: ${birth.city ?? "Non fournie"}
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
  "passions": string[],
  "soleil_degre": number | null,
  "lune_degre": number | null,
  "ascendant_degre": number | null
}

Contraintes impératives :
- Renvoie uniquement ce JSON (aucun autre texte).
- Langue: français naturel, avec emojis pour enrichir le texte.
- Utilise les faits astro pour renseigner signes et degrés (arrondis à une décimale avec ~xx.x°).
- "phrase_synchronie": slogan positif, max 140 caractères.
- "archetype", "couleur_dominante", "element": termes courts et cohérents.
- "passions": 3 à 5 éléments (phrases courtes) dérivés des informations fournies.
- "profile_text" doit suivre EXACTEMENT cette structure avec emojis et formatage :

## 🧬 Synthèse générale
...
`;
}

function validateProfileText(text: string): boolean {
  const requiredSections = ["🧬 Synthèse générale", "🌟 Interprétation détaillée", "☀️ Soleil", "🌙 Lune", "⬆️ Ascendant", "🔥 Archetype", "✨ Résumé narratif", "💪 Forces", "⚠️ Défis", "🧭 Conseil"];
  return requiredSections.every(section => text.includes(section));
}

async function callOpenAi(
  prompt: string,
  astroData: AstroEngineResponse | null,
  signal?: AbortSignal
): Promise<AiSymbolicProfile> {
  const apiKey = ensureEnv("OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Tu es SpotCoach, un coach symbolique expert. Réponds en JSON strict." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
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
    console.error("[SpotCoachPreview] Failed to parse OpenAI JSON content:", content);
    throw new Error(`Unable to parse OpenAI response as JSON: ${(err as Error).message}`);
  }

  const result = parsed as Partial<AiSymbolicProfile>;
  for (const key of AI_RESPONSE_SCHEMA) {
    if (!(key in result) || result[key] === undefined || result[key] === null) {
      throw new Error(`OpenAI response missing required field: ${key}`);
    }
  }

  if (!validateProfileText(result.profile_text as string)) {
    console.warn("[SpotCoachPreview] Profile text failed Markdown structure validation. Using raw output.");
  }

  return {
    profile_text: String(result.profile_text ?? ""),
    phrase_synchronie: String(result.phrase_synchronie ?? ""),
    archetype: String(result.archetype ?? ""),
    couleur_dominante: String(result.couleur_dominante ?? ""),
    element: String(result.element ?? ""),
    signe_soleil: String(astroData?.sun_sign ?? result.signe_soleil ?? ""),
    signe_lune: String(astroData?.moon_sign ?? result.signe_lune ?? ""),
    signe_ascendant: String(astroData?.asc_sign ?? result.signe_ascendant ?? ""),
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

    const requestBody = await request.json();
    const payload = (requestBody.payload || requestBody) as GenerateProfilePayload;

    validatePayload(payload);

    const astroData = await fetchAstroData(payload.birth);

    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.warn(`[SpotCoachPreview] Could not fetch user name for ${user.id}:`, userError.message);
    }
    const userName = userData?.full_name;

    const prompt = buildOpenAiPrompt(userName, payload, astroData);
    const symbolicProfile = await callOpenAi(prompt, astroData);

    return new Response(JSON.stringify({
      success: true,
      mode: "preview",
      profile: symbolicProfile,
      astro: astroData,
    }), {
      headers: corsHeaders,
      status: 200,
    });
  } catch (error) {
    console.error("[SpotCoachPreview] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
}

DENO.serve(handleRequest);

