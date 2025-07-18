import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Créer un client Supabase factice si les variables ne sont pas configurées
export const supabase = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://test.supabase.co' 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: () => Promise.resolve({ data: null, error: new Error('Configuration manquante') }),
        signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Configuration manquante') }),
        signOut: () => Promise.resolve({ error: null })
      },
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: new Error('Configuration manquante') })
        })
      },
      from: () => ({
        insert: () => Promise.resolve({ data: null, error: new Error('Configuration manquante') })
      })
    };

export const openai = openaiApiKey && openaiApiKey !== 'test_key' 
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

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
export const getTranscription = async (file) => {
  try {
    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });
    return { success: true, data: response };
  } catch (error) {
    console.error("Erreur transcription:", error);
    return { success: false, error: error.message };
  }
};

// Fonction pour l'analyse NLP via GPT-4
export const analyzePitch = async (transcription) => {
  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [{
        role: "user",
        content: `Analyze the following video pitch transcription and provide suggestions for improvement, sentiment, confidence score (0-100), and keywords. Format the output as a JSON object with 'suggestions' (array of objects with type, title, description), 'sentiment' (string), 'confidence' (number), and 'keywords' (array of strings).

Transcription: ${transcription}`,
      }],
      model: "gpt-4o",
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(chatCompletion.choices[0].message.content);
    return { success: true, data: analysis };
  } catch (error) {
    console.error("Erreur analyse:", error);
    return { success: false, error: error.message };
  }
};

export default supabase;


