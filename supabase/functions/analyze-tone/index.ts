import { createClient } from "npm:@supabase/supabase-js@2.45.4"
import OpenAI from "npm:openai@4.28.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-client-version, apikey, content-type",
  "Access-Control-Max-Age": "86400",
}

interface AnalyzeToneRequest {
  audio: string; // base64
  userId?: string;
  language?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      throw new Error("Missing environment variables")
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })
    
    // Parse request body
    const { audio, language = 'fr' } = await req.json() as AnalyzeToneRequest

    if (!audio) {
      return new Response(JSON.stringify({ error: "Audio data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 1. Convert base64 to File for Whisper
    const binaryString = atob(audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: "audio/webm" })
    const file = new File([blob], "audio.webm", { type: "audio/webm" })

    // 2. Transcribe with Whisper
    console.log("🎙️ Transcribing audio...")
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: language,
    })

    console.log("✅ Transcription:", transcription.text)

    // 3. Analyze Tone with GPT-4o
    console.log("🧠 Analyzing tone...")
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert vocal and communication coach. 
          Analyze the tone of the provided transcription and return a JSON object.
          
          The output must follow this exact JSON structure:
          {
            "emotion": "one word (enthousiaste, calme, énergique, stressé, etc.)",
            "pace": "one word (lent, modéré, rapide, dynamique)",
            "clarity": "one word (faible, moyenne, bonne, excellente)",
            "energy": "one word (faible, moyenne, élevée, intense)",
            "confidence": 0.0 to 1.0 (number),
            "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
          }
          
          Important: Suggestions must be in French. Focus on the vocal energy and communication style inferred from the text and rhythm.`
        },
        {
          role: "user",
          content: `Analyze this transcription: "${transcription.text}"`
        }
      ],
      response_format: { type: "json_object" }
    })

    const analysis = JSON.parse(completion.choices[0].message.content!)
    
    console.log("✅ Analysis complete")

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          ...analysis,
          analyzed_at: new Date().toISOString()
        },
        transcription: transcription.text
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("💥 Error in analyze-tone:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
