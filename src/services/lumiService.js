// src/services/lumiService.js
// Service for Lumi system - handles session management, questions, and profile computation

import { supabase } from '../lib/supabase.js';

/**
 * Start a new Lumi session
 * @param {string} type - Session type: 'onboarding', 'orientation', or 'premium'
 * @returns {Promise<{success: boolean, session_id?: string, first_question?: object, error?: string}>}
 */
export async function startLumiSession(type = 'onboarding') {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('lumi-start-session', {
      body: { type },
    });

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
 * Compute the Lumi profile from session answers
 * @param {string} session_id - Session ID
 * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
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

    if (data?.success) {
      return {
        success: true,
        profile: data.profile,
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

