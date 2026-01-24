// src/services/lumiService.js
// Service for Lumi system - handles session management, questions, and profile computation

import { supabase, invokeEdgeFunctionWithRetry } from '../lib/supabase.js';

/**
 * Start a new Lumi session
 * @param {string} type - Session type: 'onboarding', 'orientation', or 'premium'
 * @param {string} ageRange - Age range: '16-20', '21-30', '31-45', '46+'
 * @returns {Promise<{success: boolean, session_id?: string, first_question?: object, error?: string}>}
 */
export async function startLumiSession(type = 'onboarding', ageRange = null) {
  try {
    console.log('[SERVICE] startLumiSession called');
    console.log('[SERVICE] Parameters - type:', type, 'ageRange:', ageRange, 'ageRange type:', typeof ageRange);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('[SERVICE] No session, returning error');
      return { success: false, error: 'Not authenticated' };
    }

    const requestBody = { type, age_range: ageRange };
    console.log('[SERVICE] Invoking lumi-start-session with body:', JSON.stringify(requestBody));
    const { data, error } = await supabase.functions.invoke('lumi-start-session', {
      body: requestBody,
    });
    
    console.log('[SERVICE] Response received - data:', JSON.stringify(data), 'error:', error);

    if (error) {
      console.error('[LumiService] Error starting session:', error);
      return { success: false, error: error.message };
    }

    console.log('[LumiService] Response data:', data);

    if (data?.success) {
      // Handle both old format (session) and new format (session_id)
      const sessionId = data.session_id || data.session?.id;
      if (!sessionId) {
        console.error('[LumiService] No session_id found in response:', data);
        return { success: false, error: 'Session ID not found in response' };
      }
      
      return {
        success: true,
        session_id: sessionId,
        first_question: data.first_question,
      };
    }

    return { success: false, error: data?.error || 'Unknown error' };
  } catch (error) {
    console.error('[LumiService] Exception starting session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit an answer and get the next question
 * @param {string} session_id - Session ID
 * @param {string} question_id - Question ID
 * @param {any} answer_value - Answer value (string, number, etc.)
 * @param {object} answer_json - Optional JSON answer for complex answers
 * @returns {Promise<{success: boolean, next_question?: object, session_status?: string, error?: string}>}
 */
export async function submitAnswer(session_id, question_id, answer_value, answer_json = null) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('lumi-submit-answer', {
      body: {
        session_id,
        question_id,
        answer_value,
        answer_json,
      },
    });

    if (error) {
      console.error('[LumiService] Error submitting answer:', error);
      return { success: false, error: error.message };
    }

    if (data?.success) {
      return {
        success: true,
        next_question: data.next_question,
        session_status: data.session_status,
        session_complete: !data.next_question,
      };
    }

    return { success: false, error: data?.error || 'Unknown error' };
  } catch (error) {
    console.error('[LumiService] Exception submitting answer:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get age range from a session
 * @param {string} session_id - Session ID
 * @returns {Promise<{success: boolean, age_range?: string, error?: string}>}
 */
export async function getSessionAgeRange(session_id) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('lumi_sessions')
      .select('age_range')
      .eq('id', session_id)
      .maybeSingle();

    if (error) {
      console.error('[LumiService] Error fetching session age_range:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      age_range: data?.age_range || null,
    };
  } catch (error) {
    console.error('[LumiService] Exception fetching session age_range:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Compute the Lumi profile from session answers
 * @param {string} session_id - Session ID
 * @returns {Promise<{success: boolean, profile?: object, age_range?: string, error?: string}>}
 */
export async function computeProfile(session_id) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('lumi-compute-profile', {
      body: { session_id },
    });

    if (error) {
      console.error('[LumiService] Error computing profile:', error);
      return { success: false, error: error.message };
    }

    // Also fetch age_range from session
    const ageRangeResult = await getSessionAgeRange(session_id);
    const age_range = ageRangeResult.success ? ageRangeResult.age_range : null;

    if (data?.success) {
      return {
        success: true,
        profile: data.profile,
        age_range: age_range,
      };
    }

    return { success: false, error: data?.error || 'Unknown error' };
  } catch (error) {
    console.error('[LumiService] Exception computing profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's existing Lumi profile
 * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
 */
export async function getMyLumiProfile() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('lumi_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[LumiService] Error fetching profile:', error);
      return { success: false, error: error.message };
    }

    if (data) {
      return {
        success: true,
        profile: data,
      };
    }

    return { success: true, profile: null };
  } catch (error) {
    console.error('[LumiService] Exception fetching profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get recommendations based on Lumi profile
 * @param {string} session_id - Session ID
 * @returns {Promise<{success: boolean, categories?: array, project_templates?: array, jobs?: array, error?: string}>}
 */
export async function getRecommendations(session_id) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('lumi-get-recommendations', {
      body: { session_id },
    });

    if (error) {
      console.error('[LumiService] Error getting recommendations:', error);
      return { success: false, error: error.message };
    }

    if (data?.success) {
      return {
        success: true,
        categories: data.categories,
        project_templates: data.project_templates,
        jobs: data.jobs,
      };
    }

    return { success: false, error: data?.error || 'Unknown error' };
  } catch (error) {
    console.error('[LumiService] Exception getting recommendations:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start a new hobby session when user selects a hobby
 * @param {string} hobbyName - Name of the selected hobby (e.g., 'Football', 'Handball', 'Basketball')
 * @param {string} ageRange - Optional age range from main DISC profile
 * @returns {Promise<{success: boolean, session?: object, first_question?: object, error?: string}>}
 */
export async function startHobbySession(hobbyName, ageRange = null) {
  try {
    console.log('[LumiService] startHobbySession called with:', { hobbyName, ageRange });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[LumiService] No auth session found');
      return { success: false, error: 'Not authenticated' };
    }

    console.log('[LumiService] Invoking lumi-hobby-start-session with retry...');
    
    const requestBody = {
      hobby_name: hobbyName,
      age_range: ageRange,
    };

    // Use the retry mechanism with HTTPS fallback
    const result = await invokeEdgeFunctionWithRetry('lumi-hobby-start-session', requestBody, {
      maxRetries: 3,
      timeout: 30000,
      useHttpsFallback: true
    });

    if (!result.success) {
      console.error('[LumiService] Error starting hobby session:', result.error);
      return { success: false, error: result.error?.message || result.error || 'Unknown error' };
    }

    const data = result.data;
    console.log('[LumiService] Response received:', data);

    if (data?.success) {
      console.log('[LumiService] Hobby session started successfully');
      return {
        success: true,
        session: data.session,
        first_question: data.first_question,
      };
    }

    console.error('[LumiService] Response indicates failure:', data);
    return { success: false, error: data?.error || 'Unknown error', details: data };
  } catch (error) {
    console.error('[LumiService] Exception starting hobby session:', error);
    return { success: false, error: error.message || 'Failed to start hobby session' };
  }
}

/**
 * Submit a hobby answer and get the next question
 * @param {string} session_id - Hobby session ID
 * @param {string} question_id - Question ID
 * @param {any} answer_value - Answer value (string, number, etc.)
 * @param {object} answer_json - Optional JSON answer for complex answers (multiple choice)
 * @returns {Promise<{success: boolean, next_question?: object, is_complete?: boolean, error?: string}>}
 */
export async function submitHobbyAnswer(session_id, question_id, answer_value, answer_json = null) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const requestBody = {
      session_id,
      question_id,
      answer_value,
      answer_json,
    };

    const result = await invokeEdgeFunctionWithRetry('lumi-hobby-submit-answer', requestBody, {
      maxRetries: 3,
      timeout: 30000,
      useHttpsFallback: true
    });

    if (!result.success) {
      console.error('[LumiService] Error submitting hobby answer:', result.error);
      return { success: false, error: result.error?.message || result.error || 'Unknown error' };
    }

    const data = result.data;
    if (data?.success) {
      return {
        success: true,
        next_question: data.next_question,
        is_complete: data.is_complete,
      };
    }

    return { success: false, error: data?.error || 'Unknown error' };
  } catch (error) {
    console.error('[LumiService] Exception submitting hobby answer:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get hobby recommendation from GPT based on DISC profile + hobby answers
 * @param {string} session_id - Hobby session ID
 * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
 */
export async function getHobbyRecommendation(session_id) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const requestBody = { session_id };
    
    const result = await invokeEdgeFunctionWithRetry('lumi-hobby-recommend', requestBody, {
      maxRetries: 3,
      timeout: 60000, // Longer timeout for GPT processing
      useHttpsFallback: true
    });

    if (!result.success) {
      console.error('[LumiService] Error getting hobby recommendation:', result.error);
      return { success: false, error: result.error?.message || result.error || 'Unknown error' };
    }

    const data = result.data;
    if (data?.success) {
      return {
        success: true,
        profile: data.profile,
      };
    }

    return { success: false, error: data?.error || 'Unknown error' };
  } catch (error) {
    console.error('[LumiService] Exception getting hobby recommendation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's existing hobby profile
 * @param {string} hobbyName - Optional: specific hobby name, or null for all hobbies
 * @returns {Promise<{success: boolean, profile?: object|array, error?: string}>}
 */
export async function getMyHobbyProfile(hobbyName = null) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    let query = supabase
      .from('lumi_hobby_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (hobbyName) {
      query = query.eq('hobby_name', hobbyName);
    }

    const { data, error } = await query;

    if (error && error.code !== 'PGRST116') {
      console.error('[LumiService] Error fetching hobby profile:', error);
      return { success: false, error: error.message };
    }

    if (data && data.length > 0) {
      // If specific hobby requested, return single object; otherwise return array
      if (hobbyName && data.length > 0) {
        return {
          success: true,
          profile: data[0],
        };
      }
      return {
        success: true,
        profile: data,
      };
    }

    return { success: true, profile: null };
  } catch (error) {
    console.error('[LumiService] Exception fetching hobby profile:', error);
    return { success: false, error: error.message };
  }
}
