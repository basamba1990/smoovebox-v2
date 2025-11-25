// src/hooks/useVideos.js
// Custom hook for fetching user videos with React Query

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to fetch user videos
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useVideos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['videos', user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          transcription_data,
          analysis,
          transcript,
          ai_result,
          transcription_text
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!user, // Only fetch if user is authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes (videos can change frequently)
  });
}

