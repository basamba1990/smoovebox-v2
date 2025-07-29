// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4.28.0";

// Types
interface VideoProcessRequest {
  videoId: string;
  videoUrl: string;
}

interface AnalysisResult {
  video_id: string;
  pitch_analysis: string;
  body_language_analysis: string;
  voice_analysis: string;
  overall_score: number;
  strengths: string[];
  areas_to_improve: string[];
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
    const { videoId, videoUrl } = await req.json() as VideoProcessRequest;
    
    if (!videoId || !videoUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields: videoId or videoUrl" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Initialiser les clients
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY") || "",
    });

    // 1. Mettre à jour le statut de la vidéo à "PROCESSING"
    const { error: updateError } = await supabaseAdmin
      .from("videos")
      .update({ status: "PROCESSING" })
      .eq("id", videoId);

    if (updateError) {
      console.error("Error updating video status:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update video status" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Simuler l\u0027analyse OpenAI (dans un environnement réel, vous utiliseriez l\u0027API Vision)
    // Note: GPT-4 Vision ne peut pas réellement analyser des vidéos complètes, seulement des images
    // Dans un cas réel, vous pourriez extraire des frames clés ou utiliser un service spécialisé
    
    // Simulation d\u0027analyse pour le développement
    const mockAnalysis: AnalysisResult = {
      video_id: videoId,
      pitch_analysis: "Le pitch est bien structuré avec une introduction claire, un développement cohérent et une conclusion impactante. Le message principal est facilement identifiable.",
      body_language_analysis: "Posture confiante et ouverte. Les gestes sont naturels et renforcent le discours. Le contact visuel est maintenu de façon constante.",
      voice_analysis: "Voix claire et bien modulée. Le rythme est approprié avec des pauses stratégiques. Volume adéquat pour l\u0027environnement.",
      overall_score: 85,
      strengths: [
        "Excellente structure du pitch",
        "Contact visuel engageant",
        "Utilisation efficace des pauses pour l\u0027impact"
      ],
      areas_to_improve: [
        "Pourrait varier davantage le ton pour éviter la monotonie",
        "Quelques hésitations dans la partie technique",
        "Pourrait utiliser plus d\u0027exemples concrets"
      ]
    };

    // Dans un environnement de production, vous utiliseriez:
    /*
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analysez cette vidéo de pitch et fournissez une évaluation détaillée sur: 1) Qualité du pitch, 2) Langage corporel, 3) Qualité vocale. Donnez un score global sur 100, 3 points forts et 3 domaines à améliorer." 
            },
            { 
              type: "image_url", 
              image_url: { url: videoUrl } 
            }
          ],
        },
      ],
      max_tokens: 1000,
    });

    const analysisText = response.choices[0].message.content || "";
    // Traiter la réponse pour extraire les informations structurées
    // ...
    */

    // 3. Enregistrer les résultats dans la base de données
    const { data: analysisData, error: analysisError } = await supabaseAdmin
      .from("analyses")
      .insert(mockAnalysis)
      .select()
      .single();

    if (analysisError) {
      console.error("Error saving analysis:", analysisError);
      return new Response(JSON.stringify({ error: "Failed to save analysis results" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Mettre à jour le statut de la vidéo à "COMPLETED" et ajouter les données d'analyse
    const { error: finalUpdateError } = await supabaseAdmin
      .from("videos")
      .update({ 
        status: "COMPLETED",
        analysis: mockAnalysis // Ajout des données d'analyse
      })
      .eq("id", videoId);

    if (finalUpdateError) {
      console.error("Error updating final video status:", finalUpdateError);
      // Continue despite error as analysis is already saved
    }

    // 5. Retourner les résultats
    return new Response(
      JSON.stringify({
        success: true,
        message: "Video processed successfully",
        analysis: analysisData
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



