// src/services/spotCoachService.js
// Client-side helper for interacting with the SpotCoach symbolic profile Edge Function.

import { supabase } from '../lib/supabase';

const FUNCTION_NAME = 'spotcoach-profile';

function formatServiceError(error, fallbackMessage = 'Une erreur est survenue lors de la génération du profil symbolique.') {
  if (!error) {
    return new Error(fallbackMessage);
  }

  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  const message = error?.message || error?.error || fallbackMessage;
  return new Error(message);
}

export const spotCoachService = {
  /**
   * Calls the SpotCoach Edge Function to generate and persist a symbolic profile.
   *
   * @param {Object} payload - Birth data and optional questionnaire payload expected by the Edge Function.
   * @returns {Promise<Object>} - The response from the Edge Function (profile + metadata).
   */
  async generateSymbolicProfile(payload) {

    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload invalide pour la génération du profil symbolique.');
    }

    try {
      const startedAt = Date.now();
      const payloadSize = (() => {
        try { return JSON.stringify(payload).length; } catch { return undefined; }
      })();
      const counts = {
        passions: Array.isArray(payload.passions) ? payload.passions.length : 0,
        talentQuiz: Array.isArray(payload.talentQuiz) ? payload.talentQuiz.length : 0,
        intentions: Array.isArray(payload.intentions) ? payload.intentions.length : 0,
      };
      console.log('[SpotCoachService] invoke spotcoach-profile start', {
        birth: {
          date: payload?.birth?.date,
          time: payload?.birth?.time,
          latitude: payload?.birth?.latitude,
          longitude: payload?.birth?.longitude,
          timezone: payload?.birth?.timezone,
        },
        counts,
        payloadSize,
      });

      const invokePromise = supabase.functions.invoke(FUNCTION_NAME, {
        body: {
          ...payload,
        },
      });

      const timeoutMs = 90000; // 90s to allow Astro + OpenAI to finish
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 90s calling spotcoach-profile')), timeoutMs)
      );

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

      if (error) {
        const elapsed = Date.now() - startedAt;
        console.error('[SpotCoachService] invoke error', { ms: elapsed, error });
        try { console.error('[SpotCoachService] invoke error (json):', JSON.stringify(error)); } catch {}
        try { console.error('[SpotCoachService] invoke error (toString):', String(error)); } catch {}
        try { console.error('[SpotCoachService] invoke error (props):', {
          name: error?.name,
          message: error?.message,
          status: error?.status,
          cause: error?.cause,
          context: error?.context,
        }); } catch {}
        try { console.dir(error); } catch {}
        throw formatServiceError(error);
      }

      if (!data?.success) {
        console.error('[SpotCoachService] invoke non-success', { ms: Date.now() - startedAt, data });
        throw formatServiceError(data?.error || 'La génération du profil symbolique a échoué.');
      }

      console.log('[SpotCoachService] invoke success', { ms: Date.now() - startedAt, mode: data?.mode });
      return data;
    } catch (err) {
      console.error('[SpotCoach] generateSymbolicProfile error:', err);
      try { console.error('[SpotCoach] generateSymbolicProfile error (json):', JSON.stringify(err)); } catch {}
      try { console.error('[SpotCoach] generateSymbolicProfile error (toString):', String(err)); } catch {}
      try { console.error('[SpotCoach] generateSymbolicProfile error (props):', {
        name: err?.name,
        message: err?.message,
        status: err?.status,
        cause: err?.cause,
      }); } catch {}
      try { console.dir(err); } catch {}
      throw formatServiceError(err);
    }
  },

  async getExistingProfile() {
    const startedAt = Date.now();
    console.log('[SpotCoachService] getExistingProfile start');
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) {
        console.error('[SpotCoachService] getExistingProfile auth error:', authError);
      }
      if (!user) {
        console.log('[SpotCoachService] getExistingProfile: no user session');
        return null;
      }

      const timeoutMs = 10000;
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout retrieving symbolic profile')), timeoutMs);
      });

      let data;
      let error;

      try {
        ({ data, error } = await Promise.race([
          supabase
            .from('profiles_symboliques')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          timeoutPromise,
        ]));
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (err) {
      console.error('[SpotCoachService] getExistingProfile error:', err);
      return null;
    } finally {
      console.log('[SpotCoachService] getExistingProfile end', { ms: Date.now() - startedAt });
    }
  },

  /**
   * Delete the user's symbolic profile
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteProfile() {
    const startedAt = Date.now();
    console.log('[SpotCoachService] deleteProfile start');

    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError || !session?.user) {
        console.error('[SpotCoachService] deleteProfile auth error:', authError);
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('profiles_symboliques')
        .delete()
        .eq('user_id', session.user.id);

      if (error) {
        console.error('[SpotCoachService] deleteProfile error:', error);
        throw error;
      }

      console.log('[SpotCoachService] deleteProfile success', { ms: Date.now() - startedAt });
      return { success: true };
    } catch (err) {
      console.error('[SpotCoachService] deleteProfile error:', err);
      return { success: false, error: err?.message || 'Failed to delete profile' };
    }
  },
};

export default spotCoachService;


