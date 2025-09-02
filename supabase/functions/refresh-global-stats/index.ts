// /functions/refresh-global-stats/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

serve(async (req) => {
  // Initialise le client avec la clé service_role
  const supabase = createClient(
    Deno.env.get("MY_SUPABASE_URL")!,
    Deno.env.get("MY_SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Exécute la commande SQL pour rafraîchir la MV
  const { error } = await supabase.rpc("refresh_global_stats"); // si tu gardes la fonction SQL
  // OU directement avec SQL
  // const { error } = await supabase
  //   .rpc("sql", { query: "REFRESH MATERIALIZED VIEW public.global_stats;" });

  if (error) {
    return new Response(`Erreur: ${error.message}`, { status: 500 });
  }

  return new Response("Materialized view global_stats rafraîchie ✅");
});
