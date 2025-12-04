// supabase/functions/lumi-job-conversation-reply/index.ts
// Edge Function to append a user message and Lumi AI reply to a job_conversations thread

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

interface JobConversationReplyRequest {
  conversation_id: string;
  message: string;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function ensureEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function callOpenAi(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const apiKey = ensureEnv("OPENAI_API_KEY");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.filter((m) => m.role !== "system"),
    { role: "user", content: userMessage },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[lumi-job-conversation-reply] OpenAI error:", text);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content =
    data?.choices?.[0]?.message?.content ||
    "Je n'ai pas pu générer de réponse pour le moment. Réessaie dans quelques instants.";
  return content;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

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
      console.error("[lumi-job-conversation-reply] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: JobConversationReplyRequest = await req.json();

    if (!body.conversation_id || !body.message) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: conversation_id, message",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch conversation and ensure it belongs to the user
    const { data: conversation, error: convError } = await supabaseClient
      .from("job_conversations")
      .select("*")
      .eq("id", body.conversation_id)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      console.error(
        "[lumi-job-conversation-reply] Conversation fetch error:",
        convError,
      );
      return new Response(
        JSON.stringify({
          error: "Conversation not found or access denied",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const history: ChatMessage[] = Array.isArray(conversation.messages)
      ? conversation.messages
      : [];

    const contextBlock = `
Tu es Lumi, un coach d'orientation bienveillant pour les jeunes.
Tu aides l'utilisateur à explorer un métier du futur spécifique.

Métier proposé : ${conversation.job_title}
Description du métier : ${conversation.job_description}

Raison de la recommandation :
${conversation.reason || "Non précisée"}

Filières associées : ${
      conversation.sectors && conversation.sectors.length > 0
        ? conversation.sectors.join(", ")
        : "Aucune"
    }

Description de l'utilisateur :
${conversation.user_description || "Aucune description fournie"}

Règles :
- Pose des questions courtes et concrètes si nécessaire.
- Reste positif, réaliste et accessible (15–25 ans).
- Aide à clarifier : missions quotidiennes, environnement, compétences à développer, chemins de formation possibles.
- Réponds toujours en français.
`;

    const assistantReply = await callOpenAi(
      contextBlock,
      history,
      body.message,
    );

    const updatedMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: body.message },
      { role: "assistant", content: assistantReply },
    ];

    const { data: updatedConversation, error: updateError } =
      await supabaseClient
        .from("job_conversations")
        .update({ messages: updatedMessages })
        .eq("id", body.conversation_id)
        .eq("user_id", user.id)
        .select("*")
        .single();

    if (updateError || !updatedConversation) {
      console.error(
        "[lumi-job-conversation-reply] Error updating conversation:",
        updateError,
      );
      return new Response(
        JSON.stringify({
          error: "Failed to update conversation",
          details: updateError?.message,
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
        conversation: updatedConversation,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[lumi-job-conversation-reply] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


