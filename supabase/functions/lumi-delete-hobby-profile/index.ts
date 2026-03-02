// supabase/functions/lumi-delete-hobby-profile/index.ts
// Edge Function to delete the user's hobby profile for a given hobby, plus answers and sessions.
// Uses service role to bypass RLS.

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

interface DeleteHobbyProfileRequest {
  hobby_name: string;
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
      console.error("[lumi-delete-hobby-profile] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = user.id;
    let body: DeleteHobbyProfileRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const hobbyName = body?.hobby_name;
    if (!hobbyName || typeof hobbyName !== "string" || !hobbyName.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid hobby_name" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get session ids for this user and hobby
    const { data: sessions, error: sessionsFetchError } = await supabaseClient
      .from("lumi_hobby_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("hobby_name", hobbyName.trim());

    if (sessionsFetchError) {
      console.error(
        "[lumi-delete-hobby-profile] Error fetching hobby sessions:",
        sessionsFetchError,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: sessionsFetchError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sessionIds = (sessions || []).map((s) => s.id).filter((id) => !!id);

    // 1. Delete hobby answers for those sessions
    if (sessionIds.length > 0) {
      const { error: answersError } = await supabaseClient
        .from("lumi_hobby_answers")
        .delete()
        .eq("user_id", userId)
        .in("session_id", sessionIds);

      if (answersError) {
        console.error(
          "[lumi-delete-hobby-profile] Error deleting lumi_hobby_answers:",
          answersError,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: answersError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 2. Delete hobby sessions
      const { error: sessionsError } = await supabaseClient
        .from("lumi_hobby_sessions")
        .delete()
        .eq("user_id", userId)
        .eq("hobby_name", hobbyName.trim());

      if (sessionsError) {
        console.error(
          "[lumi-delete-hobby-profile] Error deleting lumi_hobby_sessions:",
          sessionsError,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: sessionsError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // 3. Delete hobby profile
    const { error: profileError } = await supabaseClient
      .from("lumi_hobby_profiles")
      .delete()
      .eq("user_id", userId)
      .eq("hobby_name", hobbyName.trim());

    if (profileError) {
      console.error(
        "[lumi-delete-hobby-profile] Error deleting lumi_hobby_profiles:",
        profileError,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: profileError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[lumi-delete-hobby-profile] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
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
