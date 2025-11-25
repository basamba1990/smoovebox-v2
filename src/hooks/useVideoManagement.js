// src/hooks/useVideoManagement.js
// Custom hooks for VideoManagement page with React Query

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to fetch videos for VideoManagement page (with all fields)
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useVideoManagementVideos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['video-management-videos', user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('videos')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          updated_at,
          transcription_text,
          transcription_data,
          analysis,
          ai_result,
          error_message,
          transcription_error,
          user_id,
          storage_path,
          file_path,
          public_url,
          duration,
          performance_score
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000, // 1 minute (videos change frequently)
  });
}

/**
 * Hook to fetch video stats from Edge Function
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useVideoStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['video-stats', user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: session, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.session?.access_token) {
        throw new Error('Session non valide, veuillez vous reconnecter');
      }

      const response = await fetch('https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/refresh-user-video-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      return result.stats;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

