// supabase/functions/test-astro-engine/index.ts
// Simple test function to call the astro engine directly

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const DENO = (globalThis as any).Deno as {
  serve: (handler: (request: Request) => Response | Promise<Response>) => Promise<void>;
  env: { get: (name: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
} as const;

function ensureEnv(name: string): string {
  const value = DENO.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { date, time, latitude, longitude, timezone } = await request.json();

    if (!date || latitude === undefined || longitude === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: date, latitude, longitude" }),
        { headers: corsHeaders, status: 400 }
      );
    }

    let apiUrl: string;
    let apiKey: string;
    
    try {
      apiUrl = ensureEnv("ASTRO_ENGINE_URL");
      console.log("[TestAstro] ASTRO_ENGINE_URL found:", apiUrl);
    } catch (err) {
      console.error("[TestAstro] Missing ASTRO_ENGINE_URL:", err);
      return new Response(
        JSON.stringify({ error: "Missing ASTRO_ENGINE_URL secret. Check Supabase Dashboard → Edge Functions → Secrets" }),
        { headers: corsHeaders, status: 500 }
      );
    }
    
    try {
      apiKey = ensureEnv("ASTRO_ENGINE_API_KEY");
      console.log("[TestAstro] ASTRO_ENGINE_API_KEY found, length:", apiKey?.length || 0);
    } catch (err) {
      console.error("[TestAstro] Missing ASTRO_ENGINE_API_KEY:", err);
      return new Response(
        JSON.stringify({ error: "Missing ASTRO_ENGINE_API_KEY secret. Check Supabase Dashboard → Edge Functions → Secrets" }),
        { headers: corsHeaders, status: 500 }
      );
    }

    console.log("[TestAstro] Calling astro engine:", { apiUrl, hasKey: !!apiKey, keyLength: apiKey?.length, date, time, latitude, longitude, timezone });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date,
        time: time || null,
        latitude,
        longitude,
        timezone: timezone || null,
      }),
    });

    console.log("[TestAstro] Response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[TestAstro] Error response:", errorText);
      return new Response(
        JSON.stringify({ 
          error: `Astro engine error (${response.status})`, 
          details: errorText 
        }),
        { headers: corsHeaders, status: response.status }
      );
    }

    const result = await response.json();
    console.log("[TestAstro] Success:", result);

    return new Response(
      JSON.stringify({ success: true, astro: result }),
      { headers: corsHeaders, status: 200 }
    );
  } catch (error) {
    console.error("[TestAstro] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to call astro engine", 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
}

DENO.serve(handleRequest);

