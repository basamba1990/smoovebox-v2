// supabase/functions/lumi-reset-job-conversation/index.ts
// Edge Function to clear the chat history of a job_conversations thread
// while keeping the row and rebuilding Lumi's welcome message.

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

interface ResetJobConversationRequest {
  conversation_id: string;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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
      console.error("[lumi-reset-job-conversation] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: ResetJobConversationRequest = await req.json();

    if (!body.conversation_id) {
      return new Response(
        JSON.stringify({ error: "Missing conversation_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch conversation to rebuild intro from stored fields
    const { data: conversation, error: convError } = await supabaseClient
      .from("job_conversations")
      .select("*")
      .eq("id", body.conversation_id)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      console.error(
        "[lumi-reset-job-conversation] Conversation fetch error:",
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

    const introLines: string[] = [];
    introLines.push(
      `Salut, je suis SpotCoach. Cette conversation est dédiée au métier "${conversation.job_title}".`,
    );
    introLines.push(
      "On va voir ensemble si ce métier peut vraiment te correspondre et comment tu pourrais t'y préparer.",
    );
    if (conversation.sectors && conversation.sectors.length > 0) {
      introLines.push(
        `Tu m'as indiqué que tu t'intéressais particulièrement à : ${conversation.sectors.join(
          ", ",
        )}.`,
      );
    }
    if (conversation.user_description) {
      const trimmedDesc = String(conversation.user_description).trim();
      if (trimmedDesc.length > 0) {
        introLines.push(
          `Tu m'as aussi partagé ceci sur ce que tu aimerais faire : "${trimmedDesc}".`,
        );
      }
    }
    introLines.push(
      "Dis-moi d'abord ce qui t'attire le plus dans ce métier, ou ce qui t'inquiète le plus.",
    );

    const initialMessages: ChatMessage[] = [
      {
        role: "assistant",
        content: introLines.join(" "),
      },
    ];

    const { data: updatedConversation, error: updateError } =
      await supabaseClient
        .from("job_conversations")
        .update({ messages: initialMessages })
        .eq("id", body.conversation_id)
        .eq("user_id", user.id)
        .select("*")
        .single();

    if (updateError || !updatedConversation) {
      console.error(
        "[lumi-reset-job-conversation] Error updating conversation:",
        updateError,
      );
      return new Response(
        JSON.stringify({
          error: "Failed to reset conversation",
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
    console.error("[lumi-reset-job-conversation] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


