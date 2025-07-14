import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fonctions utilitaires pour l'upload de vidéos
export const uploadVideo = async (file, userId) => {
  try {
    const fileName = `${userId}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("videos")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    // Enregistrer les métadonnées en base
    const videoData = {
      user_id: userId,
      file_path: data.path,
      file_name: file.name,
      file_size: file.size,
      upload_date: new Date().toISOString(),
    };

    const { data: dbData, error: dbError } = await supabase
      .from("videos")
      .insert(videoData);

    if (dbError) throw dbError;

    return { success: true, data: dbData };
  } catch (error) {
    console.error("Erreur upload:", error);
    return { success: false, error: error.message };
  }
};

// Fonction pour obtenir la transcription via Whisper
export const getTranscription = async (videoPath) => {
  try {
    // Simulation d'appel à l'API Whisper
    console.log("Transcription de:", videoPath);
    
    // En production, ceci ferait un appel à l'API OpenAI Whisper
    const mockTranscription = {
      text: "Bonjour, je m'appelle Marie et je vous présente notre startup...",
      segments: [
        { start: 0, end: 5, text: "Bonjour, je m'appelle Marie" },
        { start: 5, end: 10, text: "et je vous présente notre startup" },
      ],
    };

    return { success: true, data: mockTranscription };
  } catch (error) {
    console.error("Erreur transcription:", error);
    return { success: false, error: error.message };
  }
};

// Fonction pour l'analyse NLP via GPT-4
export const analyzePitch = async (transcription) => {
  try {
    console.log("Analyse NLP de:", transcription.substring(0, 50) + "...");
    
    // Simulation d'analyse GPT-4
    const mockAnalysis = {
      suggestions: [
        {
          type: "amélioration",
          title: "Rythme de parole",
          description: "Ralentissez légèrement pour améliorer la compréhension",
        },
      ],
      sentiment: "positif",
      confidence: 85,
      keywords: ["startup", "innovation", "technologie"],
    };

    return { success: true, data: mockAnalysis };
  } catch (error) {
    console.error("Erreur analyse:", error);
    return { success: false, error: error.message };
  }
};

export default supabase;


