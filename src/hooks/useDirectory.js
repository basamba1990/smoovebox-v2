// src/hooks/useDirectory.js
// Custom hooks for directory page data fetching with React Query

import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

/**
 * Hook to fetch users from directory
 * @param {string} filter - Filter type: 'all', 'creators', 'football', 'adults'
 * @param {string} searchTerm - Search term for filtering users
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useDirectoryUsers(filter = 'all', searchTerm = '') {
  const supabase = useSupabaseClient();
  const user = useUser();

  return useQuery({
    queryKey: ['directory-users', filter, searchTerm, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, bio, location, skills, avatar_url, is_creator, football_interest, is_major, passions, clubs, sex, created_at, dominant_color')
        .neq('id', user?.id) // Exclude current user
        .order('created_at', { ascending: false });

      // Apply filters
      if (filter === 'creators') {
        query = query.eq('is_creator', true);
      } else if (filter === 'football') {
        query = query.eq('football_interest', true);
      } else if (filter === 'adults') {
        query = query.eq('is_major', true);
      }

      // Apply search
      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%,skills.cs.{${searchTerm}}`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!user, // Only fetch if user is authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch existing connections for the current user
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useExistingConnections() {
  const supabase = useSupabaseClient();
  const user = useUser();

  return useQuery({
    queryKey: ['directory-connections', user?.id],
    queryFn: async () => {
      if (!user) {
        return new Set();
      }

      // 1) Outgoing friend requests (pending or accepted)
      const { data: requests, error: reqError } = await supabase
        .from('friend_requests')
        .select('receiver_id, status')
        .eq('requester_id', user.id);

      if (reqError) {
        throw reqError;
      }

      // 2) Existing friendships
      const { data: friends, error: friendsError } = await supabase
        .from('friends')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      if (friendsError) {
        throw friendsError;
      }

      const ids = new Set();

      // Mark all outgoing requests (pending or accepted) as "existing connection"
      (requests || []).forEach((row) => {
        ids.add(row.receiver_id);
      });

      // Add all friends (the "other" user in each pair)
      (friends || []).forEach((row) => {
        const otherId = row.user_id_1 === user.id ? row.user_id_2 : row.user_id_1;
        ids.add(otherId);
      });

      return ids;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch user videos for directory
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useUserVideos() {
  const supabase = useSupabaseClient();
  const user = useUser();

  return useQuery({
    queryKey: ['directory-user-videos', user?.id],
    queryFn: async () => {
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('videos')
        .select('id, title, public_url, storage_path, created_at, status')
        .eq('user_id', user.id)
        .eq('status', 'analyzed') // Only analyzed videos
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

