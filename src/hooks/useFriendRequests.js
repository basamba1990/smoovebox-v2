import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useQuery } from "@tanstack/react-query";

/**
 * Load incoming and outgoing friend requests with requester/receiver profiles.
 * Reusable for any screen that shows connection requests.
 */
export function useFriendRequests() {
  const supabase = useSupabaseClient();
  const user = useUser();

  return useQuery({
    queryKey: ["friend-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { incoming: [], outgoing: [] };

      const { data: incoming, error: incError } = await supabase
        .from("friend_requests")
        .select("id, requester_id, created_at")
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (incError) {
        console.error(
          "[useFriendRequests] Erreur chargement demandes entrantes:",
          incError,
        );
        throw incError;
      }

      const { data: outgoing, error: outError } = await supabase
        .from("friend_requests")
        .select("id, receiver_id, created_at")
        .eq("requester_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (outError) {
        console.error(
          "[useFriendRequests] Erreur chargement demandes sortantes:",
          outError,
        );
        throw outError;
      }

      const requesterIds = (incoming || []).map((r) => r.requester_id);
      const receiverIds = (outgoing || []).map((r) => r.receiver_id);
      const allIds = Array.from(new Set([...requesterIds, ...receiverIds]));

      let profiles = [];
      if (allIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, sex, location")
          .in("id", allIds);

        if (profilesError) {
          console.error(
            "[useFriendRequests] Erreur chargement profils:",
            profilesError,
          );
          throw profilesError;
        }
        profiles = profilesData || [];
      }

      const profileById = profiles.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      return {
        incoming: (incoming || []).map((req) => ({
          ...req,
          profile: profileById[req.requester_id] || null,
        })),
        outgoing: (outgoing || []).map((req) => ({
          ...req,
          profile: profileById[req.receiver_id] || null,
        })),
      };
    },
  });
}
