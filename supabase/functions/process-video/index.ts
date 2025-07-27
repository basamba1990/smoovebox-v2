// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Types
interface StorageEvent {
  schema: string;
  table: string;
  record: {
    id: string;
    bucket_id: string;
    name: string;
    owner: string;
    path_tokens: string[];
    last_accessed_at: string;
    created_at: string;
    updated_at: string;
    metadata: Record<string, any>;
  };
  type: "INSERT" | "UPDATE" | "DELETE";
  old_record: null | Record<string, any>;
}

Deno.serve(async (req: Request) => {
  try {
    // Vérifier la méthode
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Récupérer les données de la requête
    const payload = await req.json() as StorageEvent;
    
    // Vérifier si c\u0027est un événement d\u0027insertion dans le bucket videos
    if (payload.table !== "objects" || payload.type !== "INSERT" || 
        payload.record.bucket_id !== "videos") {
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Initialiser le client Supabase avec la clé de service
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Extraire l\u0027ID utilisateur du chemin (format: userId/filename)
    const userId = payload.record.path_tokens[0];
    const filePath = payload.record.name;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid file path format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Rechercher la vidéo correspondante avec le statut PENDING
    const { data: videos, error: queryError } = await supabaseAdmin
      .from("videos")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError || !videos || videos.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No pending video found for this user",
        error: queryError?.message
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const videoId = videos[0].id;

    // Obtenir l\u0027URL publique
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("videos")
      .getPublicUrl(filePath);

    // Mettre à jour l\u0027entrée vidéo avec le chemin du fichier
    const { error: updateError } = await supabaseAdmin
      .from("videos")
      .update({
        file_path: publicUrlData.publicUrl,
        status: "PROCESSING" // Passer au statut "en traitement"
      })
      .eq("id", videoId);

    if (updateError) {
      return new Response(JSON.stringify({ 
        error: "Failed to update video record",
        details: updateError.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Appeler l\u0027Edge Function process-video
    try {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          videoId: videoId,
          videoUrl: publicUrlData.publicUrl
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error calling process-video function:", errorText);
      }
    } catch (functionError) {
      console.error("Failed to call process-video function:", functionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Video processing initiated",
        videoId: videoId
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred",
        details: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});

