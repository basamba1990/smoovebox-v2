// supabase/functions/lumi-get-recommendations/index.ts
// Edge Function to get personalized recommendations (categories, projects, jobs) based on Lumi profile

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface GetRecommendationsRequest {
  user_id?: string; // Optional, will use auth user if not provided
  session_id?: string; // Optional, to link recommendations to a session
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
      console.error('[lumi-get-recommendations] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse request body
    const requestData: GetRecommendationsRequest = await req.json();

    // Get user's Lumi profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('lumi_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[lumi-get-recommendations] Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile', details: profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'No Lumi profile found. Please complete a Lumi session first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dominantColor = profile.dominant_color;
    const traits = profile.traits || [];

    // Get all categories (constellations) - for now, return all
    // Later you can filter based on profile
    const { data: categories, error: categoriesError } = await supabaseClient
      .from('project_categories')
      .select('*')
      .order('order_index', { ascending: true });

    if (categoriesError) {
      console.error('[lumi-get-recommendations] Error fetching categories:', categoriesError);
    }

    // Get recommended project templates based on profile
    let projectTemplatesQuery = supabaseClient
      .from('project_templates')
      .select('*');

    // Filter by recommended colors if dominant color exists
    if (dominantColor) {
      projectTemplatesQuery = projectTemplatesQuery.contains('recommended_colors', [dominantColor]);
    }

    const { data: projectTemplates, error: projectsError } = await projectTemplatesQuery
      .order('difficulty_level', { ascending: true })
      .limit(10);

    if (projectsError) {
      console.error('[lumi-get-recommendations] Error fetching project templates:', projectsError);
    }

    // Get recommended jobs based on profile
    let jobsQuery = supabaseClient
      .from('jobs')
      .select('*');

    // Filter by recommended colors if dominant color exists
    if (dominantColor) {
      jobsQuery = jobsQuery.contains('recommended_colors', [dominantColor]);
    }

    const { data: jobs, error: jobsError } = await jobsQuery
      .order('future_2035_relevance', { ascending: false })
      .limit(10);

    if (jobsError) {
      console.error('[lumi-get-recommendations] Error fetching jobs:', jobsError);
    }

    // Prepare recommendation data
    const recommendedCategoryIds = (categories || []).map(c => c.id);
    const recommendedProjectTemplateIds = (projectTemplates || []).map(p => p.id);
    const recommendedJobIds = (jobs || []).map(j => j.id);

    // Save recommendations to database
    const { data: recommendation, error: recommendationError } = await supabaseClient
      .from('lumi_recommendations')
      .upsert({
        user_id: userId,
        session_id: requestData.session_id || null,
        recommended_category_ids: recommendedCategoryIds,
        recommended_project_template_ids: recommendedProjectTemplateIds,
        recommended_job_ids: recommendedJobIds
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (recommendationError) {
      console.error('[lumi-get-recommendations] Error saving recommendations:', recommendationError);
      // Continue anyway, return recommendations even if save fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile: profile,
        recommendations: {
          categories: categories || [],
          project_templates: projectTemplates || [],
          jobs: jobs || []
        },
        recommendation_id: recommendation?.id || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lumi-get-recommendations] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

