// supabase/functions/lumi-start-session/index.ts
// Edge Function to start a new Lumi session and get the first question

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface StartSessionRequest {
  type?: string; // 'onboarding', 'orientation', 'premium'
  age_range?: string; // '16-20', '21-30', '31-45', '46+'
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

    // Validate auth
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
      console.error('[lumi-start-session] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: StartSessionRequest = await req.json();
    console.log('[BACKEND] Received request body:', JSON.stringify(body));
    const sessionType = body.type || 'onboarding';
    const ageRange = body.age_range ? String(body.age_range).trim() : null;
    
    console.log('[BACKEND] Parsed - type:', sessionType, 'age_range:', ageRange, 'age_range type:', typeof ageRange);
    console.log('[BACKEND] Cleaned age_range value:', JSON.stringify(ageRange));

    // Create new session
    const sessionId = crypto.randomUUID();
    const sessionData = {
      id: sessionId,
      user_id: user.id,
      type: sessionType,
      status: 'in_progress',
      age_range: ageRange,
      created_at: new Date().toISOString(),
    };
    console.log('[BACKEND] Creating session with data:', JSON.stringify(sessionData));
    const { error: sessionError } = await supabaseClient
      .from('lumi_sessions')
      .insert(sessionData);

    if (sessionError) {
      console.error('[lumi-start-session] Error creating session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get first question based on age_range
    console.log('[BACKEND] Building query for age_range:', ageRange);
    
    // Build base query with block filter
    let query = supabaseClient
      .from('lumi_questions')
      .select('*')
      .eq('block', 'disc');

    // Apply age_range filter BEFORE ordering/limiting
    if (ageRange && ageRange.trim() !== '') {
      console.log('[BACKEND] Applying age_range filter:', ageRange);
      query = query.eq('age_range', ageRange);
    } else {
      console.log('[BACKEND] No age_range provided, filtering for null age_range');
      query = query.is('age_range', null);
    }

    // Apply ordering and limit AFTER the filter
    query = query.order('order_index', { ascending: true }).limit(1);
    
    console.log('[BACKEND] Executing query with filters...');
    const { data: questions, error: questionsError } = await query;
    
    console.log('[BACKEND] Query result - found', questions?.length || 0, 'questions');
    if (questionsError) {
      console.error('[BACKEND] Query error:', questionsError);
    }
    if (questions && questions.length > 0) {
      console.log('[BACKEND] First question - id:', questions[0].id, 'age_range:', questions[0].age_range, 'order_index:', questions[0].order_index);
      console.log('[BACKEND] Expected age_range:', ageRange, 'Got age_range:', questions[0].age_range, 'Match:', questions[0].age_range === ageRange);
    }

    if (questionsError) {
      console.error('[lumi-start-session] Error fetching questions:', questionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch questions', details: questionsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No questions found for this age range' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstQuestion = questions[0];
    
    console.log('[BACKEND] First question found - id:', firstQuestion.id, 'age_range:', firstQuestion.age_range);
    console.log('[BACKEND] Session created with age_range:', ageRange);
    console.log('[BACKEND] Question age_range matches session age_range:', firstQuestion.age_range === ageRange);

    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        session: {
          id: sessionId,
          user_id: user.id,
          type: sessionType,
          status: 'in_progress',
          age_range: ageRange,
          created_at: sessionData.created_at,
        },
        first_question: {
          id: firstQuestion.id,
          question_text: firstQuestion.question_text,
          question_type: firstQuestion.question_type,
          options: firstQuestion.options,
          block: firstQuestion.block,
          order_index: firstQuestion.order_index,
          age_range: firstQuestion.age_range,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[lumi-start-session] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


