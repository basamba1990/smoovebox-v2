import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0';
serve(async (req)=>{
  const { user_id_param } = await req.json();
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: {
      headers: {
        'x-supa-v-api-key': Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      }
    }
  });
  try {
    // Fetch user statistics
    const { data: userStats, error: statsError } = await supabaseClient.from('profiles') // Assuming 'profiles' table contains user stats or can be joined for them
    .select('id, username, full_name, email, created_at') // Select relevant profile data
    .eq('user_id', user_id_param).single();
    if (statsError) {
      console.error('Error fetching user stats:', statsError);
      throw statsError;
    }
    // Fetch recent videos
    const { data: recentVideos, error: videosError } = await supabaseClient.from('videos').select('id, title, created_at, status, analysis, performance_score, duration').eq('profile_id', userStats.id) // Link to profile_id
    .eq('status', 'published').order('created_at', {
      ascending: false
    }).limit(5);
    if (videosError) {
      console.warn('Error fetching recent videos (might be empty):', videosError);
    }
    // Fetch user achievements
    const { data: userAchievements, error: achievementsError } = await supabaseClient.from('user_achievements').select('*, achievements(*)').eq('user_id', user_id_param).order('earned_at', {
      ascending: false
    });
    if (achievementsError) {
      console.warn('Error fetching user achievements (might be empty):', achievementsError);
    }
    // Fetch user skills
    const { data: userSkills, error: skillsError } = await supabaseClient.from('user_skills').select('skill_name, current_score, previous_score').eq('user_id', user_id_param);
    if (skillsError) {
      console.warn('Error fetching user skills (might be empty):', skillsError);
    }
    // Fetch user activity streak (assuming a function or table for this)
    // This part might need a specific SQL function or a more complex query
    // For now, let's assume a placeholder or a simple fetch if a table exists
    const { data: userActivityStreak, error: streakError } = await supabaseClient.from('user_activities') // Assuming user_activities table has streak info
    .select('current_streak, best_streak') // Adjust column names as per your schema
    .eq('user_id', user_id_param).order('created_at', {
      ascending: false
    }).limit(1);
    if (streakError) {
      console.warn('Error fetching user activity streak (might be empty):', streakError);
    }
    return new Response(JSON.stringify({
      userStats,
      recentVideos: recentVideos || [],
      userAchievements: userAchievements || [],
      userSkills: userSkills || [],
      userActivityStreak: userActivityStreak && userActivityStreak.length > 0 ? userActivityStreak[0] : {
        current_streak: 0,
        best_streak: 0
      }
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
