// supabase/functions/lumi-gpt-future-jobs/index.ts
// Edge Function: Given unified user data (symbolic profile + Lumi DISC + video analysis),
// call GPT to generate 10 future job ideas with explanations and required skills.
// Updated for SpotBulle 2035: Hybridization and Operational Dashboard style.

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
  extra_preferences?: {
    sectors?: string[] | null;
    description?: string | null;
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

    // Validate auth
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
    const extras = body.extra_preferences || null;

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Build prompt
    const userContext = {
      symbolic_profile: symbolic,
      lumi_profile: lumi,
      video_analysis: video,
      extra_preferences: extras,
    };

    const systemPromptFr = `
Tu es l'IA stratégique de SpotBulle 2035, spécialisée dans l'hybridation des métiers et la dynamique vivante des talents.
Tu reçois un profil utilisateur structuré (profil symbolique, DISC / couleurs, analyse vidéo, préférences).

TON OBJECTIF :
- Proposer 10 idées de métiers HYBRIDES pour 2035, basées sur le modèle SpotBulle : Passions → Émotions → Compétences → Projets.
- Tu dois impérativement t'inspirer des 5 piliers stratégiques de SpotBulle 2035 :
  1. Architecte de trajectoires hybrides (Assemble passions, compétences et projets)
  2. Designer de récits professionnels vivants (Identité en mouvement, parole, image)
  3. Facilitateur humain–IA (Médiation technologique, augmentation sans déshumanisation)
  4. Assembleur de collectifs de projet (Synergie de talents, équipes dynamiques)
  5. Éclaireur de compétences futures (Prospective, veille stratégique)

CONSIGNES DE RÉDACTION :
- Chaque métier doit être une HYBRIDATION concrète (ex: "Coach Sportif & Facilitateur IA" ou "Designer de Récits & Impact Environnemental").
- Le champ "why_fit" doit expliquer comment le métier réunit les PASSIONS et les ÉMOTIONS détectées dans le profil.
- Évite le jargon fantastique. Reste OPÉRATIONNEL et PROFESSIONNEL.
- Situe les métiers dans un contexte de "Tableau de bord opérationnel".

CONTRAINTES TECHNIQUES :
- Réponds UNIQUEMENT en JSON.
- Format :
{
  "jobs": [
    {
      "title": "Titre du métier hybride 2035",
      "why_fit": "Lien direct avec Passions/Émotions/Talents du profil",
      "skills_needed": ["Compétence 1", "Compétence 2", "Compétence 3"],
      "confidence": 0.95,
      "horizon_years": 10
    }
  ]
}
`;

    const systemPromptEn = `
You are the SpotBulle 2035 Strategic AI, specialized in job hybridization and living talent dynamics.
You receive a structured user profile (symbolic profile, DISC/colors, video analysis, preferences).

YOUR GOAL:
- Propose 10 HYBRID job ideas for 2035, based on the SpotBulle model: Passions → Emotions → Skills → Projects.
- You must draw inspiration from the 5 strategic pillars of SpotBulle 2035:
  1. Hybrid Trajectory Architect (Assembles passions, skills, and projects)
  2. Living Professional Narrative Designer (Identity in motion, speech, image)
  3. Human–AI Facilitator (Technological mediation, augmentation without dehumanization)
  4. Project Collective Assembler (Talent synergy, dynamic teams)
  5. Future Skills Scout (Prospective, strategic monitoring)

WRITING GUIDELINES:
- Each job must be a concrete HYBRIDIZATION (e.g., "Sports Coach & AI Facilitator" or "Narrative Designer & Environmental Impact").
- The "why_fit" field must explain how the job unites the PASSIONS and EMOTIONS detected in the profile.
- Avoid fantastic jargon. Stay OPERATIONAL and PROFESSIONAL.
- Place the jobs in an "Operational Dashboard" context.

TECHNICAL CONSTRAINTS:
- Reply ONLY in JSON.
- Format:
{
  "jobs": [
    {
      "title": "2035 Hybrid Job Title",
      "why_fit": "Direct link with Passions/Emotions/Talents from the profile",
      "skills_needed": ["Skill 1", "Skill 2", "Skill 3"],
      "confidence": 0.95,
      "horizon_years": 10
    }
  ]
}
`;

    const systemPrompt = language === "en" ? systemPromptEn : systemPromptFr;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: language === "en"
            ? `User Profile (JSON):\n${JSON.stringify(userContext)}`
            : `Profil Utilisateur (JSON) :\n${JSON.stringify(userContext)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawContent) as FutureJobsResponse;

    return new Response(
      JSON.stringify({ success: true, jobs: parsed.jobs }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[lumi-gpt-future-jobs] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
