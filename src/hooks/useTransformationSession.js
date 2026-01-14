import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Hook pour gérer les sessions de transformation GENUP
 * Crée une nouvelle session et récupère les vidéos d'une session existante
 */
export function useTransformationSession() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Crée une nouvelle session de transformation
   */
  const createSession = useCallback(async () => {
    if (!user) {
      setError('Utilisateur non authentifié');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: session, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.session?.access_token) {
        throw new Error('Session non valide, veuillez vous reconnecter');
      }

      const response = await fetch(
        'https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/create-transformation-session',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setSessionId(result.sessionId);
      return result.sessionId;
    } catch (err) {
      console.error('Erreur lors de la création de la session:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Récupère les vidéos d'une session
   */
  const getSessionVideos = useCallback(async (sessionIdToFetch) => {
    if (!user || !sessionIdToFetch) {
      setError('Utilisateur non authentifié ou sessionId manquant');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: session, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.session?.access_token) {
        throw new Error('Session non valide, veuillez vous reconnecter');
      }

      const response = await fetch(
        'https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/get-transformation-journal',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId: sessionIdToFetch }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      return result.videos || [];
    } catch (err) {
      console.error('Erreur lors de la récupération des vidéos:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    sessionId,
    setSessionId,
    createSession,
    getSessionVideos,
    loading,
    error,
  };
}
