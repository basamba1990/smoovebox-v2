// supabase/functions/lumi-delete-profile/index.ts
// Edge Function to delete the user's Lumi DISC profile, answers, and sessions.
// Uses service role to bypass RLS.

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

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
      console.error("[lumi-delete-profile] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = user.id;

    // Fetch all Lumi profiles for this user to get session_ids
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("lumi_profiles")
      .select("id, session_id")
      .eq("user_id", userId);

    if (profilesError) {
      console.error(
        "[lumi-delete-profile] Error fetching lumi_profiles:",
        profilesError,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: profilesError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sessionIds = profiles
      .map((p) => p.session_id)
      .filter((id): id is string => !!id);

    // 1. Delete answers tied to those sessions
    if (sessionIds.length > 0) {
      const { error: answersError } = await supabaseClient
        .from("lumi_answers")
        .delete()
        .eq("user_id", userId)
        .in("session_id", sessionIds);

      if (answersError) {
        console.error(
          "[lumi-delete-profile] Error deleting lumi_answers:",
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

      // 2. Delete sessions
      const { error: sessionsError } = await supabaseClient
        .from("lumi_sessions")
        .delete()
        .eq("user_id", userId)
        .in("id", sessionIds);

      if (sessionsError) {
        console.error(
          "[lumi-delete-profile] Error deleting lumi_sessions:",
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

    // 3. Delete Lumi profiles
    const { error: profilesDeleteError } = await supabaseClient
      .from("lumi_profiles")
      .delete()
      .eq("user_id", userId);

    if (profilesDeleteError) {
      console.error(
        "[lumi-delete-profile] Error deleting lumi_profiles:",
        profilesDeleteError,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: profilesDeleteError.message,
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
    console.error("[lumi-delete-profile] Unexpected error:", error);
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
