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

    // 2. Transcription réelle avec OpenAI Whisper
    let transcriptionText = "";
    let transcriptionSegments = [];
    
    try {
      console.log(`Starting transcription for video: ${videoId}`);
      
      // Télécharger la vidéo
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      }
      
      const videoBlob = await videoResponse.blob();
      
      // Créer un fichier temporaire pour la transcription
      const formData = new FormData();
      formData.append('file', videoBlob, 'video.mp4');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');
      
      // Appel à l'API Whisper d'OpenAI
      const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        },
        body: formData
      });
      
      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error("Whisper API error:", errorText);
        throw new Error(`Whisper API error: ${transcriptionResponse.statusText}`);
      }
      
      const transcriptionData = await transcriptionResponse.json();
      transcriptionText = transcriptionData.text || "";
      
      // Extraire les segments avec timestamps
      if (transcriptionData.segments) {
        transcriptionSegments = transcriptionData.segments.map((segment: any) => ({
          start: segment.start,
          end: segment.end,
          text: segment.text
        }));
      }
      
      console.log("Transcription completed successfully");
      
      // Enregistrer la transcription dans la base de données
      const { error: transcriptionError } = await supabaseAdmin
        .from("transcriptions")
        .insert({
          video_id: videoId,
          text: transcriptionText,
          segments: transcriptionSegments,
          confidence_score: transcriptionData.confidence || 0.95
        });

      if (transcriptionError) {
        console.error("Error saving transcription:", transcriptionError);
      }

    } catch (transcriptionErr) {
      console.error("Error during transcription:", transcriptionErr);
      // En cas d'erreur, la transcription sera vide ou contiendra un message d'erreur
      transcriptionText = "";
      transcriptionSegments = [];
      
      // Enregistrer la transcription d'erreur (ou l'absence de transcription)
      await supabaseAdmin
        .from("transcriptions")
        .insert({
          video_id: videoId,
          text: "Erreur lors de la transcription. Veuillez réessayer.",
          segments: [],
          confidence_score: 0.0
        });
    }

    // 3. Analyse OpenAI basée sur la transcription
    let analysisResult: AnalysisResult;
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Vous êtes un expert en analyse de pitch et communication. Analysez la transcription fournie et fournissez une évaluation structurée en français."
          },
          {
            role: "user",
            content: `Analysez cette transcription de pitch et fournissez une évaluation détaillée au format JSON avec les champs suivants:
            - pitch_analysis: Analyse de la structure et du contenu du pitch (en français)
            - body_language_analysis: Analyse du langage corporel et de la posture (déduite du texte si possible, en français)
            - voice_analysis: Analyse de la qualité vocale et de l'élocution (déduite du texte si possible, en français)
            - overall_score: Score global sur 100
            - strengths: Array de 3-5 points forts (en français)
            - areas_to_improve: Array de 3-5 domaines à améliorer (en français)
            
            Transcription: """${transcriptionText}"""
            
            Répondez uniquement avec un objet JSON valide.`
          },
        ],
        max_tokens: 2000,
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
          strengths: ["Vidéo reçue avec succès"],
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
        analysis: analysisResult,
        transcription: { 
          text: transcriptionText,
          segments: transcriptionSegments
        }
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
        transcription: { 
          text: transcriptionText,
          segments: transcriptionSegments
        }
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    
    // En cas d'erreur, marquer la vidéo comme échouée
    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      
      await supabaseAdmin
        .from("videos")
        .update({ status: "FAILED" })
        .eq("id", (await req.json()).videoId);
    } catch (updateError) {
      console.error("Error updating video status to FAILED:", updateError);
    }
    
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

