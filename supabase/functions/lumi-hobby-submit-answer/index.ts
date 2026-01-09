// supabase/functions/lumi-hobby-submit-answer/index.ts
// Edge Function to submit hobby answers and get next question

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { session_id, question_id, answer_value, answer_json } = body;

    if (!session_id || !question_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id or question_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabaseClient
      .from('lumi_hobby_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save answer
    const answerData: any = {
      session_id: session_id,
      user_id: user.id,
      hobby_name: session.hobby_name,
      question_id: question_id,
    };

    if (answer_json) {
      answerData.answer_json = answer_json;
      // Also store as comma-separated string for backward compatibility
      if (answer_json.answers && Array.isArray(answer_json.answers)) {
        answerData.answer_value = answer_json.answers.join(',');
      }
    } else if (answer_value) {
      answerData.answer_value = answer_value;
    }

    const { data: savedAnswer, error: answerError } = await supabaseClient
      .from('lumi_hobby_answers')
      .insert(answerData)
      .select()
      .single();

    if (answerError) {
      return new Response(
        JSON.stringify({ error: 'Failed to save answer', details: answerError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current question order
    const { data: currentQuestion } = await supabaseClient
      .from('lumi_hobby_questions')
      .select('order_index')
      .eq('id', question_id)
      .single();

    // Get next question for this hobby
    const { data: nextQuestion, error: nextError } = await supabaseClient
      .from('lumi_hobby_questions')
      .select('*')
      .eq('hobby_name', session.hobby_name)
      .gt('order_index', currentQuestion?.order_index || 0)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();

    const isComplete = !nextQuestion;

    return new Response(
      JSON.stringify({
        success: true,
        answer: savedAnswer,
        next_question: isComplete ? null : nextQuestion,
        is_complete: isComplete,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

