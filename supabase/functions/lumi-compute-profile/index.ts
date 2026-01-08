// supabase/functions/lumi-compute-profile/index.ts
// Edge Function to compute Lumi profile from session answers

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

// Map French/English color names to DISC dimensions
const COLOR_TO_DISC: Record<string, string> = {
  'rouge': 'D',
  'red': 'D',
  'jaune': 'I',
  'yellow': 'I',
  'vert': 'S',
  'green': 'S',
  'bleu': 'C',
  'blue': 'C',
};

// Map DISC dimensions to French color names
const DISC_TO_COLOR: Record<string, string> = {
  'D': 'rouge',
  'I': 'jaune',
  'S': 'vert',
  'C': 'bleu',
};

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

    const body: ComputeProfileRequest = await req.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabaseClient
      .from('lumi_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      console.error('[lumi-compute-profile] Session error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all answers for this session with question details
    const { data: answers, error: answersError } = await supabaseClient
      .from('lumi_answers')
      .select(`
        question_id,
        answer_value,
        answer_json,
        lumi_questions (
          id,
          question_text,
          options,
          block
        )
      `)
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

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

    // Initialize DISC scores
    const discScores: Record<string, number> = { 'D': 0, 'I': 0, 'S': 0, 'C': 0 };

    // Process each answer - SIMPLE VERSION
    for (const answer of answers) {
      const question = answer.lumi_questions;
      if (!question || question.block !== 'disc') continue;

      // Get selected options
      let selectedOptions: string[] = [];
      
      // Check answer_json first (for multiple answers)
      if (answer.answer_json) {
        const json = typeof answer.answer_json === 'string' ? JSON.parse(answer.answer_json) : answer.answer_json;
        if (json?.answers && Array.isArray(json.answers)) {
          selectedOptions = json.answers;
        } else if (Array.isArray(json)) {
          selectedOptions = json;
        }
      }
      
      // Fallback to answer_value
      if (selectedOptions.length === 0 && answer.answer_value) {
        const val = String(answer.answer_value).trim();
        selectedOptions = val.includes(',') ? val.split(',').map(s => s.trim()) : [val];
      }

      // Map each selected option to DISC
      for (const opt of selectedOptions) {
        const optStr = String(opt).trim();
        let disc: string | null = null;

        // Handle "option_D", "option_I", "option_S", "option_C" format
        if (optStr.startsWith('option_')) {
          const discLetter = optStr.replace('option_', '').toUpperCase();
          if (['D', 'I', 'S', 'C'].includes(discLetter)) {
            disc = discLetter;
          }
        }
        // Direct DISC letter
        else if (['D', 'I', 'S', 'C'].includes(optStr.toUpperCase())) {
          disc = optStr.toUpperCase();
        }
        // Color name mapping
        else {
          const lower = optStr.toLowerCase();
          disc = COLOR_TO_DISC[lower] || null;
        }

        // If still not found, check question options
        if (!disc && question.options) {
          const opts = (question.options as any).options || question.options;
          if (typeof opts === 'object' && !Array.isArray(opts)) {
            for (const [key, val] of Object.entries(opts)) {
              if (key === opt || String(val) === opt || key.toLowerCase() === optStr.toLowerCase()) {
                // Check if key is "option_X" format
                if (key.startsWith('option_')) {
                  const discLetter = key.replace('option_', '').toUpperCase();
                  if (['D', 'I', 'S', 'C'].includes(discLetter)) {
                    disc = discLetter;
                  }
                } else {
                  const keyUpper = key.toUpperCase();
                  disc = ['D', 'I', 'S', 'C'].includes(keyUpper) ? keyUpper : COLOR_TO_DISC[key.toLowerCase()] || null;
                }
                if (disc) break;
              }
            }
          }
        }

        // Increment score
        if (disc && discScores[disc] !== undefined) {
          discScores[disc]++;
        }
      }
    }

    console.log('[lumi-compute-profile] Final DISC scores:', discScores);

    // Determine dominant and secondary colors
    const sortedScores = Object.entries(discScores)
      .sort(([, a], [, b]) => b - a);

    const dominantDisc = sortedScores[0]?.[0] || 'D';
    const secondaryDisc = sortedScores[1]?.[0] || 'I';

    const dominantColor = DISC_TO_COLOR[dominantDisc] || 'rouge';
    const secondaryColor = DISC_TO_COLOR[secondaryDisc] || 'jaune';

    console.log('[lumi-compute-profile] Dominant:', dominantColor, 'Secondary:', secondaryColor);

    // Create profile object
    const profile = {
      user_id: user.id,
      session_id: sessionId,
      dominant_color: dominantColor,
      secondary_color: secondaryColor,
      disc_scores: discScores,
      traits: null, // Can be populated later with AI or predefined traits
      computed_at: new Date().toISOString(),
    };

    // Save or update profile
    const { data: savedProfile, error: saveError } = await supabaseClient
      .from('lumi_profiles')
      .upsert(profile, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (saveError) {
      console.error('[lumi-compute-profile] Error saving profile:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save profile', details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[lumi-compute-profile] Profile saved successfully:', savedProfile.id);

    return new Response(
      JSON.stringify({
        success: true,
        profile: savedProfile,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lumi-compute-profile] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

