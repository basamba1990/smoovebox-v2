import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Variables d'environnement manquantes: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function errorResponse(msg: string, status: number = 400) {
  return new Response(JSON.stringify({ error: msg, success: false }), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (req.method !== "POST") {
      return errorResponse("Method not allowed. Use POST.", 405);
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return errorResponse("Missing sessionId in request body", 400);
    }

    // Get the user from the JWT in the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Authorization header missing", 401);
    }
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse("Invalid or expired token", 401);
    }

    const { data: videos, error } = await supabase
      .from("videos")
      .select(`
        id,
        title,
        description,
        status,
        created_at,
        updated_at,
        video_type,
        session_id,
        transcription_text,
        analysis,
        ai_result,
        public_url
      `)
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching videos:", error);
      return errorResponse(error.message, 500);
    }

    return new Response(JSON.stringify({ videos, success: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
      status: 200,
    });
  } catch (err) {
    console.error("get-transformation-journal error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
