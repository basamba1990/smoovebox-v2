// supabase/functions/lumi-award-badges/index.ts
// Edge Function to award badges to users based on events/achievements

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version, x-client-name, x-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface AwardBadgesRequest {
  user_id?: string; // Optional, will use auth user if not provided
  event_type: string; // 'session_completed', 'constellation_joined', 'project_created', 'first_pitch', etc.
  event_details?: Record<string, any>; // Additional context about the event
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
      console.error('[lumi-award-badges] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse request body
    const requestData: AwardBadgesRequest = await req.json();

    if (!requestData.event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map event types to badge slugs
    const eventToBadgeMap: Record<string, string[]> = {
      'session_completed': ['lumi_session_completed'],
      'orientation_completed': ['orientation_2035', 'lumi_orientation_completed'],
      'constellation_joined': ['constellation_joined'], // Will be enhanced with specific constellation badge
      'project_created': ['first_project', 'project_creator'],
      'first_pitch': ['first_pitch'],
      'profile_completed': ['profile_complete']
    };

    // Get badges to award based on event type
    const badgeSlugs = eventToBadgeMap[requestData.event_type] || [];

    // If event is constellation_joined, add specific constellation badge
    if (requestData.event_type === 'constellation_joined' && requestData.event_details?.category_id) {
      const { data: category } = await supabaseClient
        .from('project_categories')
        .select('name')
        .eq('id', requestData.event_details.category_id)
        .single();

      if (category) {
        const categorySlug = `constellation_${category.name.toLowerCase().replace(/\s+/g, '_')}`;
        badgeSlugs.push(categorySlug);
      }
    }

    if (badgeSlugs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No badges to award for this event type',
          awarded_badges: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get badge IDs from slugs
    const { data: badges, error: badgesError } = await supabaseClient
      .from('badges')
      .select('id, slug, name, description, category, icon')
      .in('slug', badgeSlugs);

    if (badgesError) {
      console.error('[lumi-award-badges] Error fetching badges:', badgesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch badges', details: badgesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!badges || badges.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No matching badges found',
          awarded_badges: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which badges user already has
    const { data: existingBadges, error: existingError } = await supabaseClient
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId)
      .in('badge_id', badges.map(b => b.id));

    const existingBadgeIds = (existingBadges || []).map(b => b.badge_id);

    // Award new badges only
    const newBadges = badges.filter(b => !existingBadgeIds.includes(b.id));
    const awardedBadges = [];

    for (const badge of newBadges) {
      const { data: userBadge, error: awardError } = await supabaseClient
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_id: badge.id,
          badge_name: badge.name,
          badge_description: badge.description,
          category: badge.category,
          awarded_at: new Date().toISOString(),
          source: requestData.event_type,
          points: 10 // Default points, can be customized per badge
        })
        .select()
        .single();

      if (awardError) {
        console.error(`[lumi-award-badges] Error awarding badge ${badge.slug}:`, awardError);
      } else {
        awardedBadges.push(userBadge);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_type: requestData.event_type,
        awarded_badges: awardedBadges,
        already_had: badges.filter(b => existingBadgeIds.includes(b.id)).map(b => b.name)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lumi-award-badges] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

