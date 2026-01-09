// supabase/functions/lumi-hobby-start-session/index.ts
// Edge Function to start a hobby session when user selects a hobby

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  console.log('[lumi-hobby-start-session] Request received:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      console.log('[lumi-hobby-start-session] Method not allowed:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[lumi-hobby-start-session] Missing environment variables');
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
      console.error('[lumi-hobby-start-session] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    console.log('[lumi-hobby-start-session] Validating token...');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[lumi-hobby-start-session] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[lumi-hobby-start-session] User authenticated:', user.id);
    const body = await req.json();
    const { hobby_name, age_range } = body;
    console.log('[lumi-hobby-start-session] Body received:', { hobby_name, age_range });

    if (!hobby_name) {
      return new Response(
        JSON.stringify({ error: 'Missing hobby_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's main DISC profile to link it
    console.log('[lumi-hobby-start-session] Fetching DISC profile for user:', user.id);
    const { data: discProfile, error: discError } = await supabaseClient
      .from('lumi_profiles')
      .select('id, dominant_color, secondary_color, session_id')
      .eq('user_id', user.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (discError) {
      console.error('[lumi-hobby-start-session] Error fetching DISC profile:', discError);
      return new Response(
        JSON.stringify({ error: 'Error fetching DISC profile', details: discError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!discProfile) {
      console.log('[lumi-hobby-start-session] No DISC profile found for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Main DISC profile not found. Complete the main DISC questionnaire first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[lumi-hobby-start-session] DISC profile found:', discProfile.id);
    
    // Use age_range from request body (passed from frontend), or get it from session if needed
    let finalAgeRange = age_range;
    if (!finalAgeRange && discProfile.session_id) {
      console.log('[lumi-hobby-start-session] age_range not provided, fetching from session:', discProfile.session_id);
      const { data: profileSession } = await supabaseClient
        .from('lumi_sessions')
        .select('age_range')
        .eq('id', discProfile.session_id)
        .maybeSingle();
      
      if (profileSession?.age_range) {
        finalAgeRange = profileSession.age_range;
        console.log('[lumi-hobby-start-session] Found age_range from session:', finalAgeRange);
      }
    }

    // Check if user already has a completed hobby profile for this hobby
    const { data: existingProfile } = await supabaseClient
      .from('lumi_hobby_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('hobby_name', hobby_name)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          success: true,
          session: null,
          first_question: null,
          message: 'Hobby profile already exists for this hobby',
          existing_profile_id: existingProfile.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new hobby session
    console.log('[lumi-hobby-start-session] Creating hobby session...');
    const sessionData = {
      user_id: user.id,
      hobby_name: hobby_name,
      status: 'in_progress',
      age_range: finalAgeRange || null,
      disc_profile_id: discProfile.id,
    };
    console.log('[lumi-hobby-start-session] Session data:', sessionData);
    
    const { data: session, error: sessionError } = await supabaseClient
      .from('lumi_hobby_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (sessionError || !session) {
      console.error('[lumi-hobby-start-session] Error creating session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[lumi-hobby-start-session] Session created:', session.id);

    // Get first question for this hobby
    console.log('[lumi-hobby-start-session] Fetching first question for hobby:', hobby_name);
    const { data: firstQuestion, error: questionError } = await supabaseClient
      .from('lumi_hobby_questions')
      .select('*')
      .eq('hobby_name', hobby_name)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (questionError) {
      console.error('[lumi-hobby-start-session] Error fetching question:', questionError);
      return new Response(
        JSON.stringify({ 
          error: 'Error fetching questions', 
          details: questionError.message,
          hobby_name: hobby_name 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!firstQuestion) {
      console.log('[lumi-hobby-start-session] No questions found for hobby:', hobby_name);
      return new Response(
        JSON.stringify({ 
          error: 'No questions found for this hobby', 
          hobby_name: hobby_name 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[lumi-hobby-start-session] First question found:', firstQuestion.id);

    return new Response(
      JSON.stringify({
        success: true,
        session: session,
        first_question: firstQuestion,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lumi-hobby-start-session] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message,
        stack: (error as Error).stack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

