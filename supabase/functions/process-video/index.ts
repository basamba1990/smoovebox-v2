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

    // 2. Simulation de la transcription (à remplacer par une API de transcription réelle)
    let transcriptionText = "";
    try {
      // Ici, vous intégreriez l'appel à une API de transcription comme Whisper, AssemblyAI, Google Cloud Speech-to-Text, etc.
      // Pour l'instant, nous allons simuler une transcription.
      console.log(`Simulating transcription for video: ${videoId}`);
      // En production, vous feriez un appel réseau ici, par exemple:
      // const transcriptionResponse = await fetch("VOTRE_API_TRANSCRIPTION_URL", { method: "POST", body: JSON.stringify({ videoUrl }) });
      // const transcriptionData = await transcriptionResponse.json();
      // transcriptionText = transcriptionData.text;

      // Simulation de texte transcrit
      transcriptionText = `Ceci est une transcription simulée de la vidéo. Le pitch était clair et concis. Le langage corporel était confiant. La voix était bien modulée.`;
      
      // Enregistrer la transcription dans la base de données
      const { error: transcriptionError } = await supabaseAdmin
        .from("transcriptions")
        .insert({
          video_id: videoId,
          text: transcriptionText,
          segments: [
            { start: 0, end: 5, text: "Ceci est une transcription simulée" },
            { start: 6, end: 10, text: "Le pitch était clair" }
          ], // Exemple de segments
          confidence_score: 0.95 // Exemple de score de confiance
        });

      if (transcriptionError) {
        console.error("Error saving transcription:", transcriptionError);
      }

    } catch (transcriptionErr) {
      console.error("Error during transcription simulation:", transcriptionErr);
      transcriptionText = "Transcription non disponible en raison d'une erreur.";
    }

    // 3. Analyse OpenAI basée sur la transcription
    let analysisResult: AnalysisResult;
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Vous êtes un expert en analyse de pitch et communication. Analysez la transcription fournie et fournissez une évaluation structurée."
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `Analysez cette transcription de pitch et fournissez une évaluation détaillée au format JSON avec les champs suivants:\n                - pitch_analysis: Analyse de la structure et du contenu du pitch\n                - body_language_analysis: Analyse du langage corporel et de la posture (déduite du texte si possible)\n                - voice_analysis: Analyse de la qualité vocale et de l'élocution (déduite du texte si possible)\n                - overall_score: Score global sur 100\n                - strengths: Array de 3 points forts\n                - areas_to_improve: Array de 3 domaines à améliorer\n                \n                Transcription: """${transcriptionText}"""\n                \n                Répondez uniquement avec un objet JSON valide.` 
              }
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      const analysisText = response.choices[0].message.content || "";
      
      try {
        const parsedAnalysis = JSON.parse(analysisText);
        analysisResult = {
          video_id: videoId,
          pitch_analysis: parsedAnalysis.pitch_analysis || "Analyse non disponible",
          body_language_analysis: parsedAnalysis.body_language_analysis || "Analyse non disponible",
          voice_analysis: parsedAnalysis.voice_analysis || "Analyse non disponible",
          overall_score: parsedAnalysis.overall_score || 0,
          strengths: parsedAnalysis.strengths || [],
          areas_to_improve: parsedAnalysis.areas_to_improve || []
        };
      } catch (parseError) {
        console.error("Error parsing OpenAI response:", parseError);
        analysisResult = {
          video_id: videoId,
          pitch_analysis: analysisText.substring(0, 500) || "Erreur lors de l'analyse",
          body_language_analysis: "Analyse automatique non disponible",
          voice_analysis: "Analyse automatique non disponible",
          overall_score: 50,
          strengths: ["Analyse en cours"],
          areas_to_improve: ["Réessayer l'analyse"]
        };
      }
    } catch (openaiError) {
      console.error("Error calling OpenAI API:", openaiError);
      analysisResult = {
        video_id: videoId,
        pitch_analysis: "Erreur lors de l'analyse automatique. Veuillez réessayer.",
        body_language_analysis: "Service d'analyse temporairement indisponible",
        voice_analysis: "Service d'analyse temporairement indisponible",
        overall_score: 0,
        strengths: ["Vidéo reçue avec succès"],
        areas_to_improve: ["Réessayer l'analyse plus tard"]
      };
    }

    // 4. Enregistrer les résultats dans la base de données
    const { data: analysisData, error: analysisError } = await supabaseAdmin
      .from("analyses")
      .insert(analysisResult)
      .select()
      .single();

    if (analysisError) {
      console.error("Error saving analysis:", analysisError);
      return new Response(JSON.stringify({ error: "Failed to save analysis results" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5. Mettre à jour le statut de la vidéo à "COMPLETED" et ajouter les données d'analyse et de transcription
    const { error: finalUpdateError } = await supabaseAdmin
      .from("videos")
      .update({ 
        status: "COMPLETED",
        analysis: analysisResult, // Ajout des données d'analyse
        transcription: { text: transcriptionText } // Ajout de la transcription
      })
      .eq("id", videoId);

    if (finalUpdateError) {
      console.error("Error updating final video status:", finalUpdateError);
    }

    // 6. Retourner les résultats
    return new Response(
      JSON.stringify({
        success: true,
        message: "Video processed successfully",
        analysis: analysisData,
        transcription: { text: transcriptionText }
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




