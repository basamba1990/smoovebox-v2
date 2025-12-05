// supabase/functions/lumi-create-job-conversation/index.ts
// Edge Function to create a job conversation thread for a selected future job

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface CreateJobConversationRequest {
  job_title: string;
  job_description: string;
  reason: string;
  sectors?: string[] | null;
  user_description?: string | null;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[lumi-create-job-conversation] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const body: CreateJobConversationRequest = await req.json();

    if (!body.job_title || !body.job_description || !body.reason) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: job_title, job_description, reason',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const introLines: string[] = [];
    introLines.push(
      `Salut, je suis SpotCoach. Cette conversation est dédiée au métier "${body.job_title}".`,
    );
    introLines.push(
      "On va voir ensemble si ce métier peut vraiment te correspondre et comment tu pourrais t'y préparer.",
    );
    if (body.sectors && body.sectors.length > 0) {
      introLines.push(
        `Tu m'as indiqué que tu t'intéressais particulièrement à : ${body.sectors.join(
          ", ",
        )}.`,
      );
    }
    if (body.user_description && body.user_description.trim().length > 0) {
      introLines.push(
        `Tu m'as aussi partagé ceci sur ce que tu aimerais faire : "${body.user_description.trim()}".`,
      );
    }
    introLines.push(
      "Dis-moi d'abord ce qui t'attire le plus dans ce métier, ou ce qui t'inquiète le plus.",
    );

    const initialMessages: ChatMessage[] = [
      {
        role: "assistant",
        content: introLines.join(" "),
      },
    ];

    const insertPayload = {
      user_id: user.id,
      job_title: body.job_title,
      job_description: body.job_description,
      reason: body.reason,
      sectors: body.sectors && body.sectors.length > 0 ? body.sectors : null,
      user_description:
        body.user_description && body.user_description.trim().length > 0
          ? body.user_description
          : null,
      messages: initialMessages,
    };

    const { data, error } = await supabaseClient
      .from('job_conversations')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      console.error(
        '[lumi-create-job-conversation] Error inserting job_conversations row:',
        error,
      );
      return new Response(
        JSON.stringify({
          error: 'Failed to create job conversation',
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation: data,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[lumi-create-job-conversation] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


