// supabase/functions/spotcoach-synthesis/index.ts
// Returns a short 3–4 line synthesis from birth data (no sign names, no astro jargon). Does not save to DB.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const DENO = (globalThis as any).Deno as {
  serve: (handler: (request: Request) => Response | Promise<Response>) => Promise<void>;
  env: { get: (name: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

interface BirthData {
  date: string;
  time?: string | null;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface Payload {
  birth: BirthData;
  name?: string;
}

interface AstroEngineResponse {
  sun_deg: number | null;
  moon_deg: number | null;
  asc_deg: number | null;
  sun_sign: string | null;
  moon_sign: string | null;
  asc_sign: string | null;
  [key: string]: unknown;
}

function ensureEnv(name: string): string {
  const v = DENO.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function fetchAstroData(birth: BirthData): Promise<AstroEngineResponse | null> {
  try {
    const apiUrl = ensureEnv("ASTRO_ENGINE_URL");
    const apiKey = ensureEnv("ASTRO_ENGINE_API_KEY");
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        date: birth.date,
        time: birth.time ?? null,
        latitude: birth.latitude,
        longitude: birth.longitude,
        timezone: birth.timezone ?? null,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function callOpenAiForSynthesis(
  birth: BirthData,
  astro: AstroEngineResponse | null,
  userName?: string
): Promise<string> {
  const apiKey = ensureEnv("OPENAI_API_KEY");
  const format = (d: number | null | undefined) =>
    d != null && Number.isFinite(d) ? `${Number(d).toFixed(1)}°` : "—";

  const astroSummary = astro
    ? `Données calculées : Soleil ${format(astro.sun_deg)}, Lune ${format(astro.moon_deg)}, Ascendant ${format(astro.asc_deg)}`
    : "Données non disponibles.";

  const prompt = `Tu es un coach personnel francophone. À partir des informations suivantes, rédige une synthèse courte de 3 à 4 lignes maximum, en français, sur l'énergie et la personnalité de la personne.
- Style chaleureux, personnel (tu/vous).
- INTERDIT : Ne jamais mentionner de noms de signes du zodiaque (Bélier, Taureau, Gémeaux, Cancer, Lion, Vierge, Balance, Scorpion, Sagittaire, Capricorne, Verseau, Poissons) ni de termes comme "Soleil en", "Lune en", "Ascendant en". Parler uniquement en termes d'énergie, de tempérament, de forces, de personnalité.
- Réponse en texte brut uniquement (pas de JSON, pas de titres).

Infos :
- Nom : ${userName ?? "Utilisateur"}
- Date de naissance : ${birth.date}
- Lieu : ${birth.city ?? "Non fourni"} (lat ${birth.latitude}, lon ${birth.longitude})
- Fuseau : ${birth.timezone ?? "Non fourni"}
- Données calculées : ${astroSummary}

Synthèse (3–4 lignes) :`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu rédiges des synthèses courtes et chaleureuses. Tu n'utilises JAMAIS de noms de signes du zodiaque (Bélier, Taureau, Gémeaux, Cancer, Lion, Vierge, Balance, Scorpion, Sagittaire, Capricorne, Verseau, Poissons) ni de termes astrologiques techniques. Tu décris la personnalité et l'énergie en langage courant." },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${txt}`);
  }

  const json = await res.json();
  let text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty content");

  const signNames = /\b(Bélier|Taureau|Gémeaux|Cancer|Lion|Vierge|Balance|Scorpion|Sagittaire|Capricorne|Verseau|Poissons)\b/gi;
  text = text.replace(signNames, "").replace(/\s{2,}/g, " ").trim();
  return text;
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        headers: corsHeaders,
        status: 401,
      });
    }

    const supabase = createClient(
      ensureEnv("SUPABASE_URL"),
      ensureEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: corsHeaders,
        status: 401,
      });
    }

    const body = await request.json();
    const payload = (body.payload || body) as Payload;
    const birth = payload?.birth;
    if (!birth?.date || birth.latitude == null || birth.longitude == null) {
      return new Response(JSON.stringify({ error: "birth.date, birth.latitude, birth.longitude required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    const astroData = await fetchAstroData(birth);
    const { data: userData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const userName = userData?.full_name;

    const synthesis = await callOpenAiForSynthesis(birth, astroData, userName);

    return new Response(
      JSON.stringify({ success: true, synthesis }),
      { headers: corsHeaders, status: 200 }
    );
  } catch (err) {
    console.error("[SpotCoachSynthesis] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: corsHeaders, status: 500 }
    );
  }
}

DENO.serve(handleRequest);
