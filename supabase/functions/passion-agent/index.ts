import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

interface PassionAgentPayload {
  passionName: string;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
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
    const { passionName, message, history = [] } = body as PassionAgentPayload;

    if (!passionName || !message) {
      return new Response(JSON.stringify({ error: "passionName and message are required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // 1. Récupérer la configuration générique de l'agent passion depuis la DB
    const { data: configData } = await supabase
      .from("agent_configurations")
      .select("configuration")
      .eq("agent_name", "passion-agent-v1")
      .eq("is_active", true)
      .maybeSingle();

    const baseSystemPrompt = configData?.configuration?.system_prompt || `
Tu es un agent expert dans la passion déclarée par l’élève.
Ta mission est de transformer cette passion en terrain d’apprentissage et de développement de compétences.
Tu dois :
1. Proposer des micro-défis adaptés
2. Identifier les compétences mobilisées
3. Relier à un impact collectif
4. Encourager la production de preuve (vidéo, action, projet)

IMPORTANT: Tu es inspirant, expert, terrain et concret. Tu actives l'engagement émotionnel.
    `;

    const dynamicSystemPrompt = `
${baseSystemPrompt}

La passion actuelle de l'élève est : ${passionName}.
Adapte toutes tes réponses et tes défis à cette passion spécifique.
    `;

    // 2. Préparer les messages pour OpenAI
    const messages = [
      { role: "system", content: dynamicSystemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message }
    ];

    // 3. Appel à OpenAI
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7,
      }),
    });

    if (!openAiResponse.ok) {
      throw new Error(`OpenAI error: ${await openAiResponse.text()}`);
    }

    const aiData = await openAiResponse.json();
    const responseText = aiData.choices[0].message.content;

    return new Response(JSON.stringify({ success: true, response: responseText }), {
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
