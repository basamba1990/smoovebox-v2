import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

interface SpotCoachPayload {
  transcription: string;
  energyProfile?: {
    feu: number;
    air: number;
    terre: number;
    eau: number;
  };
  userName?: string;
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { transcription, energyProfile, userName } = body as SpotCoachPayload;

    if (!transcription) {
      return new Response(JSON.stringify({ error: "Transcription is required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // 1. Récupérer la configuration de SpotCoach depuis la DB
    const { data: configData } = await supabase
      .from("agent_configurations")
      .select("configuration")
      .eq("agent_name", "spotcoach-v2")
      .eq("is_active", true)
      .maybeSingle();

    const systemPrompt = configData?.configuration?.system_prompt || `
Tu es SpotCoach, coach stratégique de la plateforme SpotBulle.
Tu analyses les pitchs des jeunes et leurs missions afin d’identifier leurs compétences du XXIe siècle.
Tu structures leurs talents selon 4 axes énergétiques : Feu (leadership), Air (innovation), Terre (structure), Eau (coopération).
Tu dois :
1. Reformuler avec clarté
2. Identifier forces dominantes
3. Proposer 2 axes d’amélioration
4. Proposer 1 micro-mission concrète
5. Relier au moins 1 ODD pertinent

IMPORTANT: Tu es un coach structurant, pas un oracle. Ne parle JAMAIS d'astrologie ou d'ésotérisme.
    `;

    // 2. Préparer l'appel à OpenAI
    const energyContext = energyProfile 
      ? `Profil énergétique actuel : Feu: ${energyProfile.feu}%, Air: ${energyProfile.air}%, Terre: ${energyProfile.terre}%, Eau: ${energyProfile.eau}%`
      : "Profil énergétique non disponible.";

    const userMessage = `
Utilisateur : ${userName || "Jeune Talent"}
${energyContext}

Transcription du pitch :
"${transcription}"

Analyse ce pitch selon ta méthodologie SpotCoach et réponds au format JSON structuré suivant :
{
  "reformulation": "Ta reformulation claire du talent",
  "forces_dominantes": ["Force 1", "Force 2"],
  "axes_amelioration": ["Axe 1", "Axe 2"],
  "micro_mission": "Ta suggestion de micro-mission concrète",
  "odd_relie": "L'ODD concerné",
  "synthese_courte": "Une synthèse de 3-4 lignes maximum"
}
    `;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!openAiResponse.ok) {
      throw new Error(`OpenAI error: ${await openAiResponse.text()}`);
    }

    const aiData = await openAiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: corsHeaders,
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
}

Deno.serve(handleRequest);
