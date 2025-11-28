// supabase/functions/lumi-compute-profile/index.ts
// Edge Function to compute user profile from Lumi answers (DISC, traits, etc.)

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface ComputeProfileRequest {
  session_id: string;
}

// DISC color mapping
const DISC_COLORS = {
  'D': 'rouge',
  'I': 'jaune',
  'S': 'vert',
  'C': 'bleu'
} as const;

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
      console.error('[lumi-compute-profile] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData: ComputeProfileRequest = await req.json();

    if (!requestData.session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify session belongs to user and is completed
    const { data: session, error: sessionError } = await supabaseClient
      .from('lumi_sessions')
      .select('*')
      .eq('id', requestData.session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      console.error('[lumi-compute-profile] Session error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all answers for this session
    const { data: answers, error: answersError } = await supabaseClient
      .from('lumi_answers')
      .select(`
        *,
        lumi_questions (
          id,
          question_type,
          block,
          options
        )
      `)
      .eq('session_id', requestData.session_id);

    if (answersError) {
      console.error('[lumi-compute-profile] Error fetching answers:', answersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch answers', details: answersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!answers || answers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No answers found for this session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate DISC scores
    const discScores = { D: 0, I: 0, S: 0, C: 0 };
    const discAnswers = answers.filter(a => a.lumi_questions?.block === 'disc');

    for (const answer of discAnswers) {
      const answerValue = answer.answer_value || answer.answer_json;
      if (typeof answerValue === 'string') {
        let discLetter: string | null = null;
        
        // Handle "option_D", "option_I", "option_S", "option_C" format
        if (answerValue.startsWith('option_')) {
          const letter = answerValue.replace('option_', '').toUpperCase();
          if (letter in discScores) {
            discLetter = letter;
          }
        } 
        // Handle direct letter format: 'D', 'I', 'S', 'C'
        else if (answerValue.length === 1 && answerValue.toUpperCase() in discScores) {
          discLetter = answerValue.toUpperCase();
        }
        
        if (discLetter && discLetter in discScores) {
          discScores[discLetter as keyof typeof discScores]++;
        }
      }
    }

    // Determine dominant and secondary colors
    const sortedScores = Object.entries(discScores)
      .sort(([, a], [, b]) => b - a)
      .map(([letter]) => letter);

    const dominantColor = DISC_COLORS[sortedScores[0] as keyof typeof DISC_COLORS] || null;
    const secondaryColor = sortedScores[1] 
      ? DISC_COLORS[sortedScores[1] as keyof typeof DISC_COLORS] 
      : null;

    // Extract traits from other question blocks (simplified - you may want to use AI here)
    const traits: string[] = [];
    
    // Example: extract traits from talents/motivations blocks
    const talentAnswers = answers.filter(a => a.lumi_questions?.block === 'talents');
    const motivationAnswers = answers.filter(a => a.lumi_questions?.block === 'motivations');
    
    // This is a placeholder - you may want to use AI or predefined mappings
    // to convert answers into traits like 'Explorateur', 'Créateur', etc.

    // Save or update profile
    const profilePayload = {
      user_id: user.id,
      session_id: requestData.session_id,
      dominant_color: dominantColor,
      secondary_color: secondaryColor,
      disc_scores: discScores,
      traits: traits.length > 0 ? traits : null,
      computed_at: new Date().toISOString()
    };
    
    console.log('[lumi-compute-profile] Profile payload before insert:', JSON.stringify(profilePayload, null, 2));
    console.log('[lumi-compute-profile] DISC scores object:', discScores);
    console.log('[lumi-compute-profile] DISC scores type:', typeof discScores);
    
    const { data: profile, error: profileError } = await supabaseClient
      .from('lumi_profiles')
      .upsert(profilePayload, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (profileError) {
      console.error('[lumi-compute-profile] Error saving profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to save profile', details: profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile: profile
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lumi-compute-profile] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

