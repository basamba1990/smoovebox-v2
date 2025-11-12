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

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 45s calling spotcoach-profile')), 45000)
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
};

export default spotCoachService;


