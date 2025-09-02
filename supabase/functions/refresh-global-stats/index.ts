// /functions/refresh-global-stats/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("MY_SUPABASE_URL")!,
    Deno.env.get("MY_SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Appelle la fonction SQL Edge-safe
  const { error } = await supabase.rpc("refresh_global_stats_edge");

  if (error) {
    return new Response(`Erreur: ${error.message}`, { status: 500 });
  }

  return new Response("Materialized view global_stats rafraîchie ✅");
});
