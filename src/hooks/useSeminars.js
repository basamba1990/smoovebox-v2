// src/hooks/useSeminars.js
// Custom hooks for SeminarsList component with React Query

import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

/**
 * Hook to fetch seminars
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useSeminars() {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['seminars'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seminars')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (seminars don't change frequently)
  });
}

/**
 * Hook to fetch user seminar inscriptions
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useUserSeminarInscriptions() {
  const supabase = useSupabaseClient();
  const user = useUser();

  return useQuery({
    queryKey: ['seminar-inscriptions', user?.id],
    queryFn: async () => {
      if (!user) {
        return {};
      }

      const { data, error } = await supabase
        .from('seminar_inscriptions')
        .select('seminar_id, statut')
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      // Convert array to map for easier lookup
      const inscriptionsMap = {};
      data?.forEach(inscription => {
        inscriptionsMap[inscription.seminar_id] = inscription.statut;
      });

      return inscriptionsMap;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

