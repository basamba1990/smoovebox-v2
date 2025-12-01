// supabase/functions/lumi-gpt-future-jobs/index.ts
// Edge Function: Given unified user data (symbolic profile + Lumi DISC + video analysis),
// call GPT to generate 10 future job ideas with explanations and required skills.

import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

type UnifiedProfilePayload = {
  symbolic_profile?: {
    archetype?: string;
    phrase_synchronie?: string;
    element?: string;
    profile_text?: string;
  } | null;
  lumi_profile?: {
    dominant_color?: string | null;
    secondary_color?: string | null;
    disc_scores?: Record<string, number> | null;
    traits?: string[] | null;
  } | null;
  video_analysis?: {
    summary?: string | null;
    ai_score?: number | null;
    metadata?: Record<string, any> | null;
  } | null;
  language?: "fr" | "en";
};

type FutureJob = {
  title: string;
  why_fit: string;
  skills_needed: string[];
  confidence?: number;
  horizon_years?: number;
};

type FutureJobsResponse = {
  jobs: FutureJob[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Validate auth (optional: we just ensure the token is valid)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[lumi-gpt-future-jobs] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as UnifiedProfilePayload | null;

    if (!body) {
      return new Response(
        JSON.stringify({ error: "Missing request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const language = body.language || "fr";
    const symbolic = body.symbolic_profile || null;
    const lumi = body.lumi_profile || null;
    const video = body.video_analysis || null;

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Build prompt
    const userContext = {
      symbolic_profile: symbolic,
      lumi_profile: lumi,
      video_analysis: video,
    };

    const systemPromptFr = `
Tu es un conseiller d'orientation du futur, spécialisé dans les métiers 2035–2050.
Tu reçois un profil utilisateur structuré (profil symbolique, DISC / couleurs, analyse vidéo).

TON OBJECTIF :
- Proposer 10 idées de métiers ou rôles du futur, réalistes mais ambitieux.
- Chaque métier doit être aligné avec la personnalité, les talents et le style de communication de la personne.
- On ne parle PAS de métiers génériques (“ingénieur”, “médecin”), mais de rôles plus précis, situés dans des contextes concrets.

CONTRAINTES :
- Réponds UNIQUEMENT en JSON.
- Utilise EXACTEMENT ce format :

{
  "jobs": [
    {
      "title": "Titre du métier du futur",
      "why_fit": "Explication concrète, liée au profil symbolique / DISC / vidéo",
      "skills_needed": [
        "Compétence 1",
        "Compétence 2",
        "Compétence 3"
      ],
      "confidence": 0.82,
      "horizon_years": 10
    }
  ]
}

Notes :
- "confidence" est un score entre 0 et 1.
- "horizon_years" est en général entre 5 et 20 (projection temporelle).
- Adapte le vocabulaire au niveau d'un jeune (15–25 ans), sans jargon inutile.
`;

    const systemPromptEn = `
You are a future-oriented career guide for the 2035–2050 horizon.
You receive a structured user profile (symbolic profile, DISC/colors, video analysis).

YOUR GOAL:
- Propose 10 future job or role ideas, realistic but ambitious.
- Each job must align with the person's personality, talents and communication style.
- Avoid overly generic jobs (“engineer”, “doctor”); focus on concrete, contextual roles.

CONSTRAINTS:
- Reply ONLY in JSON.
- Use EXACTLY this format:

{
  "jobs": [
    {
      "title": "Future job title",
      "why_fit": "Concrete explanation tied to symbolic profile / DISC / video",
      "skills_needed": [
        "Skill 1",
        "Skill 2",
        "Skill 3"
      ],
      "confidence": 0.82,
      "horizon_years": 10
    }
  ]
}

Notes:
- "confidence" is a score between 0 and 1.
- "horizon_years" is usually between 5 and 20 (time projection).
- Use accessible language for a young person (15–25 years old), avoid unnecessary jargon.
`;

    const systemPrompt = language === "en" ? systemPromptEn : systemPromptFr;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content:
            language === "en"
              ? `Here is the unified user profile (JSON):\n${JSON.stringify(
                  userContext,
                )}`
              : `Voici le profil utilisateur unifié (JSON) :\n${JSON.stringify(
                  userContext,
                )}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";

    let parsed: FutureJobsResponse | null = null;
    try {
      parsed = JSON.parse(rawContent) as FutureJobsResponse;
    } catch (err) {
      console.error(
        "[lumi-gpt-future-jobs] JSON parse error from OpenAI:",
        err,
        rawContent,
      );
      return new Response(
        JSON.stringify({
          error: "Failed to parse OpenAI response as JSON",
          raw: rawContent,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!parsed || !Array.isArray(parsed.jobs)) {
      return new Response(
        JSON.stringify({
          error: "Invalid response format from OpenAI",
          raw: parsed,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobs: parsed.jobs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[lumi-gpt-future-jobs] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});


