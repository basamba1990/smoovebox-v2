// supabase/functions/football-chat/index.ts
// Edge Function for football chat assistant with free web search (DuckDuckGo + OpenAI)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
} as const;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type FootballChatPayload = {
  message: string;
  history?: ChatMessage[];
};

// Search web for current football information using DuckDuckGo HTML search (FREE, no API key)
async function searchFootballInfo(query: string): Promise<string> {
  try {
    const searchQuery = encodeURIComponent(`${query} football 2024 2025 actualités`);
    
    // Try DuckDuckGo HTML search (free, no key)
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${searchQuery}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
      }
    );

    if (!response.ok) {
      console.warn("[FootballChat] Search failed, continuing without web context");
      return "";
    }

    const html = await response.text();
    
    // Extract text content from HTML (simple extraction)
    // Remove scripts, styles, and extract visible text
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract first 2000 characters as context
    const context = text.substring(0, 2000);
    
    if (context.length > 100) {
      return `Informations trouvées sur le web (2024-2025):\n${context}...\n\nUtilise ces informations pour répondre de manière précise et à jour.`;
    }

    return "";
  } catch (err) {
    console.error("[FootballChat] Web search error:", err);
    return "";
  }
}

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
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: FootballChatPayload = await req.json();
    const { message, history = [] } = payload;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Search web for current information
    const searchContext = await searchFootballInfo(message);

    // Build messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `Tu es un assistant expert en football. Réponds en français de manière claire et accessible.

${searchContext ? `Informations récentes trouvées sur le web:\n${searchContext}\n\nUtilise ces informations récentes (2024-2025) pour répondre de manière précise et à jour.` : "Aucune information récente trouvée. Réponds avec tes connaissances mais mentionne que les informations peuvent ne pas être à jour."}`
      },
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      {
        role: "user",
        content: message,
      },
    ];

    // Call OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || 
      "Désolé, je n'ai pas pu générer de réponse.";

    return new Response(
      JSON.stringify({ 
        response,
        usedWebSearch: !!searchContext
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[FootballChat] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

