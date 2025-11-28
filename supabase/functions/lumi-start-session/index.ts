// supabase/functions/lumi-start-session/index.ts
// Edge Function to start a new Lumi questionnaire session

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface StartSessionRequest {
  type: 'onboarding' | 'orientation' | 'premium';
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
      console.error('[lumi-start-session] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData: StartSessionRequest = await req.json();

    if (!requestData.type || !['onboarding', 'orientation', 'premium'].includes(requestData.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid session type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new session
    const { data: session, error: sessionError } = await supabaseClient
      .from('lumi_sessions')
      .insert({
        user_id: user.id,
        type: requestData.type,
        status: 'in_progress'
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[lumi-start-session] Error creating session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get first question for this session type
    const { data: firstQuestion, error: questionError } = await supabaseClient
      .from('lumi_questions')
      .select('*')
      .eq('block', requestData.type === 'onboarding' ? 'disc' : 'disc') // Start with DISC for both
      .order('order_index', { ascending: true })
      .limit(1)
      .single();

    if (questionError && questionError.code !== 'PGRST116') {
      console.error('[lumi-start-session] Error fetching first question:', questionError);
      // Still return session even if no question found
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        first_question: firstQuestion || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lumi-start-session] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

