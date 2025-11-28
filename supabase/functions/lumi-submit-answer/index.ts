// supabase/functions/lumi-submit-answer/index.ts
// Edge Function to submit an answer and get the next question

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

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

    // Get current question to determine next question
    const { data: currentQuestion, error: currentQuestionError } = await supabaseClient
      .from('lumi_questions')
      .select('*')
      .eq('id', requestData.question_id)
      .single();

    if (currentQuestionError) {
      console.error('[lumi-submit-answer] Error fetching current question:', currentQuestionError);
    }

    // Get next question in the same block, or first question of next block
    let nextQuestion = null;
    
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

