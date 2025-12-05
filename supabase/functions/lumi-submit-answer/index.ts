// supabase/functions/lumi-submit-answer/index.ts
// Edge Function to submit an answer and get the next question.
// AMÉLIORATION: Questionnement dynamique par IA (Tâche F1).

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const OPENAI_MODEL = "gpt-4o-mini";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface SubmitAnswerRequest {
  session_id: string;
  question_id: string;
  answer_value: string | number | null;
  answer_json?: Record<string, any>; // For complex answers
}

interface NextQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options?: Record<string, unknown>;
  block?: string;
  order_index?: number;
}

// --- Logique d'amélioration F1: Questionnement Dynamique ---

/**
 * Détermine si la réponse soumise doit déclencher une question dynamique de suivi.
 * Logique simplifiée: déclenche après une question DISC spécifique.
 */
function shouldTriggerDynamicQuestion(questionId: string): boolean {
  // NOTE: Remplacer par les vrais IDs de questions DISC critiques
  const criticalDiscQuestions = ["disc_q_1", "disc_q_5", "disc_q_10"]; 
  // Ceci est un placeholder, la logique réelle dépendra de la table lumi_questions
  return questionId.includes("disc_q"); 
}

/**
 * Appelle l'IA pour générer une question ouverte basée sur le contexte de la session.
 */
async function generateDynamicQuestion(supabase: any, userId: string, sessionId: string): Promise<string | null> {
  try {
    // 1. Récupérer le contexte de la session (questions/réponses précédentes)
    const { data: answers, error: answersError } = await supabase
      .from("lumi_answers")
      .select("question_id, answer_value, lumi_questions(question_text, block)")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5); // Limiter au 5 dernières réponses pour le contexte

    if (answersError) throw answersError;

    const context = answers.map((a: any) => {
      const qText = a.lumi_questions?.question_text || "Question inconnue";
      const block = a.lumi_questions?.block || "Général";
      const answer = typeof a.answer_value === 'object' ? JSON.stringify(a.answer_value) : a.answer_value;
      return `[${block}] Q: ${qText} | R: ${answer}`;
    }).join("\n");

    const prompt = `Tu es Lumi, un assistant d'orientation. L'utilisateur est en train de répondre à un questionnaire. Voici le contexte de ses dernières réponses:\n\n${context}\n\nAnalyse ces réponses. Génère une question ouverte unique et engageante (max 150 caractères) pour affiner sa compréhension de ses motivations ou de ses talents. Renvoie uniquement la question, sans aucune introduction ni ponctuation finale.`;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "Tu es Lumi, un assistant d'orientation. Réponds uniquement avec la question générée." },
          { role: "user", content: prompt },
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      return null;
    }

    const json = await response.json();
    const questionText = json?.choices?.[0]?.message?.content?.trim() || null;
    
    return questionText;

  } catch (error) {
    console.error("Error generating dynamic question:", error);
    return null;
  }
}

/**
 * Enregistre la question dynamique dans la table lumi_questions et la retourne.
 */
async function saveDynamicQuestion(supabase: any, questionText: string): Promise<NextQuestion | null> {
    const newQuestionId = crypto.randomUUID();
    
    const { data: newQuestion, error: insertError } = await supabase
        .from("lumi_questions")
        .insert({
            id: newQuestionId,
            question_text: questionText,
            question_type: "open_text", // Type par défaut pour les questions IA
            block: "dynamic_follow_up",
            order_index: 9999, // Utiliser order_index comme dans l'original
            is_dynamic: true, // Champ à ajouter à la table lumi_questions
        })
        .select()
        .single();

    if (insertError) {
        console.error("Error saving dynamic question:", insertError);
        return null;
    }

    return {
        id: newQuestion.id,
        question_text: newQuestion.question_text,
        question_type: newQuestion.question_type,
        block: newQuestion.block,
        order_index: newQuestion.order_index,
    };
}

// --- Logique principale ---

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get authentication token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[lumi-submit-answer] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData: SubmitAnswerRequest = await req.json();

    if (!requestData.session_id || !requestData.question_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id or question_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabaseClient
      .from('lumi_sessions')
      .select('*')
      .eq('id', requestData.session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      console.error('[lumi-submit-answer] Session error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.status !== 'in_progress') {
      return new Response(
        JSON.stringify({ error: 'Session is not in progress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save or update answer (upsert to handle re-answering)
    const { data: answer, error: answerError } = await supabaseClient
      .from('lumi_answers')
      .upsert({
        session_id: requestData.session_id,
        user_id: user.id,
        question_id: requestData.question_id,
        answer_value: requestData.answer_value?.toString() || null,
        answer_json: requestData.answer_json || null
      }, {
        onConflict: 'session_id,question_id'
      })
      .select()
      .single();

    if (answerError) {
      console.error('[lumi-submit-answer] Error saving answer:', answerError);
      return new Response(
        JSON.stringify({ error: 'Failed to save answer', details: answerError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- LOGIQUE D'AMÉLIORATION F1 ---
    let nextQuestion: NextQuestion | null = null;

    // 1. Vérifier si une question dynamique doit être déclenchée
    if (shouldTriggerDynamicQuestion(requestData.question_id)) {
      const dynamicQuestionText = await generateDynamicQuestion(supabaseClient, user.id, requestData.session_id);
      
      if (dynamicQuestionText) {
        // 2. Si oui, enregistrer et utiliser la question dynamique
        nextQuestion = await saveDynamicQuestion(supabaseClient, dynamicQuestionText);
      }
    }

    // 3. Si pas de question dynamique, chercher la prochaine question statique (logique originale)
    if (!nextQuestion) {
        // Get current question to determine next question
        const { data: currentQuestion, error: currentQuestionError } = await supabaseClient
          .from('lumi_questions')
          .select('*')
          .eq('id', requestData.question_id)
          .single();

        if (currentQuestionError) {
          console.error('[lumi-submit-answer] Error fetching current question:', currentQuestionError);
        }

        if (currentQuestion) {
          // Try to get next question in same block
          const { data: nextInBlock } = await supabaseClient
            .from('lumi_questions')
            .select('*')
            .eq('block', currentQuestion.block)
            .gt('order_index', currentQuestion.order_index)
            .order('order_index', { ascending: true })
            .limit(1)
            .single();

          if (nextInBlock) {
            nextQuestion = nextInBlock;
          } else {
            // No more questions in this block, check if there's a next block
            // For now, return null (session might be complete)
            // In future, you can implement block progression logic here
          }
        }
    }
    // --- FIN LOGIQUE D'AMÉLIORATION F1 ---


    // If no next question, mark session as completed
    if (!nextQuestion) {
      await supabaseClient
        .from('lumi_sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', requestData.session_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        answer: answer,
        next_question: nextQuestion,
        session_complete: !nextQuestion
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lumi-submit-answer] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
