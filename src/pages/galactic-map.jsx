// src/pages/galactic-map.jsx
// "La carte galactique" - visual map of the community

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import OdysseyLayout from "../components/OdysseyLayout.jsx";
import {
  ProfileAvatar,
  GalacticMapFilters,
  GalaxyMap,
  PlayerDetailPanel,
  ConnectionsIncoming,
  ConnectionsOutgoing,
  ConnectionsFriends,
  DirectMessageThreadList,
  DirectMessageChat,
  FootballAgentChatPanel,
  GroupList,
  GroupChatPanel,
} from "../components/galactic";
import { useFriendRequests } from "../hooks/useFriendRequests.js";
import { useGalaxyPositions } from "../hooks/useGalaxyPositions.js";
import {
  useDirectoryUsers,
  useExistingConnections,
} from "../hooks/useDirectory.js";

export default function GalacticMap({ user, profile, onSignOut }) {
  const supabase = useSupabaseClient();
  const currentUser = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const FOOTBALL_AGENT_THREAD_ID = "football-agent";

  const { data: users = [], isLoading, error } = useDirectoryUsers("all", "");
  const { data: existingConnections = new Set(), refetch: refetchConnections } =
    useExistingConnections();

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserHobby, setSelectedUserHobby] = useState(null);
  const [loadingHobby, setLoadingHobby] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("map"); // "map" | "connections" | "messages" | "groups"
  const [activeSubTab, setActiveSubTab] = useState("incoming"); // "incoming" | "outgoing" | "friends"
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupMessageDraft, setGroupMessageDraft] = useState("");
  const [friendIdsToAdd, setFriendIdsToAdd] = useState([]);
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const realtimeChannelRef = useRef(null);
  const realtimeGroupChannelRef = useRef(null);
  const [elementFilter, setElementFilter] = useState(null); // "rouge" | "jaune" | "vert" | "bleu" | null
  const [hasClubFilter, setHasClubFilter] = useState(false); // filter on users who have a club in their hobby profile

  const {
    data: requests = { incoming: [], outgoing: [] },
    isLoading: loadingRequests,
    error: requestsError,
  } = useFriendRequests();

  const {
    data: hobbyProfiles = [],
    isLoading: loadingHobbyProfiles,
    error: hobbyProfilesError,
  } = useQuery({
    queryKey: ["hobby-profiles-football", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lumi_hobby_profiles")
        .select(
          "user_id, hobby_name, dominant_color, secondary_color, gpt_response",
        )
        .eq("hobby_name", "Football");

      if (error) {
        console.error(
          "[GalacticMap] Erreur chargement hobby profiles:",
          error,
        );
        throw error;
      }

      return data || [];
    },
  });

  const hobbyByUserId = useMemo(
    () =>
      hobbyProfiles.reduce((acc, hp) => {
        acc[hp.user_id] = hp;
        return acc;
      }, {}),
    [hobbyProfiles],
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        const hobby = hobbyByUserId[u.id];

        // No filters -> show everyone
        if (!elementFilter && !hasClubFilter) {
          return true;
        }

        // With filters -> must have a football hobby profile
        if (!hobby) {
          return false;
        }

        if (elementFilter && hobby.dominant_color !== elementFilter) {
          return false;
        }

        if (hasClubFilter) {
          const gpt = hobby.gpt_response || {};
          const favoriteTeam =
            gpt.favorite_team || gpt.favoriteTeam || null;

          if (
            !favoriteTeam ||
            (typeof favoriteTeam === "string" &&
              favoriteTeam.trim().length === 0)
          ) {
            return false;
          }
        }

        return true;
      }),
    [users, hobbyByUserId, elementFilter, hasClubFilter],
  );

  const positionedUsers = useGalaxyPositions(filteredUsers);

  const {
    data: friends = [],
    isLoading: loadingFriends,
    error: friendsError,
  } = useQuery({
    queryKey: ["friends", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from("friends")
        .select("user_id_1, user_id_2")
        .or(
          `user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`,
        );

      if (error) {
        console.error("[GalacticMap] Erreur chargement amis:", error);
        throw error;
      }

      const otherIds = (data || []).map((row) =>
        row.user_id_1 === currentUser.id ? row.user_id_2 : row.user_id_1,
      );

      if (!otherIds.length) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, sex, location")
        .in("id", otherIds);

      if (profilesError) {
        console.error(
          "[GalacticMap] Erreur chargement profils amis:",
          profilesError,
        );
        throw profilesError;
      }

      return profiles || [];
    },
  });

  // Direct message threads (user_id_1 < user_id_2)
  const {
    data: threadsRaw = [],
    isLoading: loadingThreads,
    refetch: refetchThreads,
  } = useQuery({
    queryKey: ["direct-threads", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from("direct_threads")
        .select("id, user_id_1, user_id_2, created_at")
        .or(
          `user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`,
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[GalacticMap] Erreur chargement threads:", error);
        throw error;
      }

      const rows = data || [];
      const otherIds = rows.map((r) =>
        r.user_id_1 === currentUser.id ? r.user_id_2 : r.user_id_1,
      );
      if (otherIds.length === 0) return rows.map((r) => ({ ...r, other: null }));

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, sex")
        .in("id", otherIds);

      if (profilesError) {
        console.error("[GalacticMap] Erreur profils threads:", profilesError);
        const baseThreads = rows.map((r) => ({
          ...r,
          other: null,
        }));
        return baseThreads;
      }

      const byId = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const baseThreads = rows.map((r) => ({
        ...r,
        other: byId[r.user_id_1 === currentUser.id ? r.user_id_2 : r.user_id_1] || null,
      }));

      return baseThreads;
    },
  });

  // Inject a synthetic "Assistant Football" thread at the top of the list
  const threads = useMemo(() => {
    const base = threadsRaw || [];
    const agentThread = {
      id: FOOTBALL_AGENT_THREAD_ID,
      other: {
        id: FOOTBALL_AGENT_THREAD_ID,
        full_name: "Assistant Football",
        avatar_url: null,
        sex: null,
        location: null,
      },
      isAgent: true,
    };
    return [agentThread, ...base];
  }, [threadsRaw, FOOTBALL_AGENT_THREAD_ID]);

  const {
    data: threadMessages = [],
    isLoading: loadingMessages,
    refetch: refetchThreadMessages,
  } = useQuery({
    queryKey: ["direct-messages", selectedThreadId],
    enabled: !!selectedThreadId && selectedThreadId !== FOOTBALL_AGENT_THREAD_ID,
    queryFn: async () => {
      if (!selectedThreadId || selectedThreadId === FOOTBALL_AGENT_THREAD_ID) {
        return [];
      }
      const { data, error } = await supabase
        .from("direct_messages")
        .select("id, thread_id, sender_id, content, created_at")
        .eq("thread_id", selectedThreadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[GalacticMap] Erreur chargement messages:", error);
        throw error;
      }
      return data || [];
    },
  });

  // Groups: my groups
  const {
    data: myGroups = [],
    isLoading: loadingMyGroups,
  } = useQuery({
    queryKey: ["my-groups", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      const { data: memberRows, error: memberError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", currentUser.id);
      if (memberError) {
        console.error("[GalacticMap] Erreur group_members:", memberError);
        throw memberError;
      }
      const groupIds = (memberRows || []).map((r) => r.group_id).filter(Boolean);
      if (groupIds.length === 0) return [];
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("id, name, owner_id, created_at")
        .in("id", groupIds)
        .order("created_at", { ascending: false });
      if (groupsError) {
        console.error("[GalacticMap] Erreur groups:", groupsError);
        throw groupsError;
      }
      return groupsData || [];
    },
  });

  const selectedGroup = useMemo(
    () => myGroups.find((g) => g.id === selectedGroupId) || null,
    [myGroups, selectedGroupId],
  );
  const isSelectedGroupOwner =
    !!selectedGroup && selectedGroup.owner_id === currentUser?.id;

  // Group messages for selected group
  const {
    data: groupMessages = [],
    isLoading: loadingGroupMessages,
  } = useQuery({
    queryKey: ["group-messages", selectedGroupId],
    enabled: !!selectedGroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_messages")
        .select("id, group_id, sender_id, content, created_at")
        .eq("group_id", selectedGroupId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[GalacticMap] Erreur group_messages:", error);
        throw error;
      }
      return data || [];
    },
  });

  // Group members for selected group
  const {
    data: groupMembers = [],
    isLoading: loadingGroupMembers,
  } = useQuery({
    queryKey: ["group-members", selectedGroupId],
    enabled: !!selectedGroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("id, group_id, user_id")
        .eq("group_id", selectedGroupId);
      if (error) {
        console.error("[GalacticMap] Erreur group_members (membres):", error);
        throw error;
      }
      return data || [];
    },
  });

  // Sender profiles for group messages (to show names)
  const groupMessageSenderIds = useMemo(
    () => [...new Set((groupMessages || []).map((m) => m.sender_id).filter(Boolean))],
    [groupMessages],
  );
  const { data: groupSenderProfiles = [] } = useQuery({
    queryKey: ["profiles", groupMessageSenderIds],
    enabled: groupMessageSenderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", groupMessageSenderIds);
      if (error) throw error;
      return data || [];
    },
  });
  const groupSenderProfileMap = useMemo(
    () =>
      (groupSenderProfiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {}),
    [groupSenderProfiles],
  );

  // Profiles for group members (to display and to filter available friends)
  const groupMemberUserIds = useMemo(
    () => [...new Set((groupMembers || []).map((m) => m.user_id).filter(Boolean))],
    [groupMembers],
  );
  const { data: groupMemberProfiles = [] } = useQuery({
    queryKey: ["group-member-profiles", selectedGroupId],
    enabled: !!selectedGroupId && groupMemberUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", groupMemberUserIds);
      if (error) {
        console.error("[GalacticMap] Erreur profils membres de groupe:", error);
        throw error;
      }
      return data || [];
    },
  });
  const groupMemberProfileMap = useMemo(
    () =>
      (groupMemberProfiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {}),
    [groupMemberProfiles],
  );

  const openOrCreateThreadMutation = useMutation({
    mutationFn: async (otherUserId) => {
      if (!currentUser) throw new Error("Non authentifié");
      const uid1 = currentUser.id < otherUserId ? currentUser.id : otherUserId;
      const uid2 = currentUser.id < otherUserId ? otherUserId : currentUser.id;

      const { data: existing } = await supabase
        .from("direct_threads")
        .select("id")
        .eq("user_id_1", uid1)
        .eq("user_id_2", uid2)
        .maybeSingle();

      if (existing) return existing.id;

      const { data: inserted, error } = await supabase
        .from("direct_threads")
        .insert({ user_id_1: uid1, user_id_2: uid2 })
        .select("id")
        .single();

      if (error) {
        console.error("[GalacticMap] Erreur création thread:", error);
        throw error;
      }
      return inserted.id;
    },
    onSuccess: (threadId) => {
      setSelectedThreadId(threadId);
      setActiveMainTab("messages");
      queryClient.invalidateQueries(["direct-threads"]);
    },
    onError: () => {
      toast.error("Impossible d'ouvrir la conversation.");
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, content }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const { error } = await supabase.from("direct_messages").insert({
        thread_id: threadId,
        sender_id: currentUser.id,
        content: (content || "").trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_, { threadId }) => {
      setMessageDraft("");
      queryClient.invalidateQueries(["direct-messages", threadId]);
    },
    onError: () => {
      toast.error("Impossible d'envoyer le message.");
    },
  });

  const openOrCreateThread = (otherUserId) => {
    openOrCreateThreadMutation.mutate(otherUserId);
  };

  const createGroupMutation = useMutation({
    mutationFn: async (name) => {
      if (!currentUser) throw new Error("Non authentifié");
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({ name: (name || "").trim(), owner_id: currentUser.id })
        .select("id")
        .single();
      if (groupError) throw groupError;
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, user_id: currentUser.id });
      if (memberError) throw memberError;
      return group.id;
    },
    onSuccess: (groupId, name, context) => {
      queryClient.invalidateQueries(["my-groups"]);
      const onSuccess = context?.onSuccess;
      if (typeof onSuccess === "function") onSuccess();
    },
    onError: () => {
      toast.error("Impossible de créer le groupe.");
    },
  });

  const sendGroupMessageMutation = useMutation({
    mutationFn: async ({ groupId, content }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const { error } = await supabase.from("group_messages").insert({
        group_id: groupId,
        sender_id: currentUser.id,
        content: (content || "").trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_, { groupId }) => {
      setGroupMessageDraft("");
      queryClient.invalidateQueries(["group-messages", groupId]);
    },
    onError: () => {
      toast.error("Impossible d'envoyer le message.");
    },
  });

  const handleCreateGroup = (name, onSuccess) => {
    createGroupMutation.mutate(name, { context: { onSuccess } });
  };

  const addGroupMemberMutation = useMutation({
    mutationFn: async ({ groupId, userIds }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const ids = userIds || [];
      if (!ids.length) return;
      const rows = ids.map((id) => ({ group_id: groupId, user_id: id }));
      const { error } = await supabase.from("group_members").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, { groupId }) => {
      setFriendIdsToAdd([]);
      setIsFriendPickerOpen(false);
      queryClient.invalidateQueries(["group-members", groupId]);
      queryClient.invalidateQueries(["my-groups", currentUser?.id]);
    },
    onError: () => {
      toast.error("Impossible d'ajouter cet ami au groupe.");
    },
  });

  const handleSendGroupMessage = () => {
    const text = (groupMessageDraft || "").trim();
    if (!text || !selectedGroupId) return;
    sendGroupMessageMutation.mutate({ groupId: selectedGroupId, content: text });
  };

  const handleAddFriendToGroup = () => {
    if (!selectedGroupId || !friendIdsToAdd.length || !isSelectedGroupOwner)
      return;
    addGroupMemberMutation.mutate({
      groupId: selectedGroupId,
      userIds: friendIdsToAdd,
    });
  };

  const handleSendMessage = () => {
    const text = (messageDraft || "").trim();
    if (!text || !selectedThreadId) return;
    sendMessageMutation.mutate({ threadId: selectedThreadId, content: text });
  };

  // Realtime: subscribe to new direct messages so the UI updates without refresh
  useEffect(() => {
    if (!currentUser || !supabase || !queryClient) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    realtimeChannelRef.current = supabase
      .channel("direct_messages_live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          const threadId = payload.new?.thread_id;
          if (threadId) {
            queryClient.invalidateQueries(["direct-messages", threadId]);
            queryClient.invalidateQueries(["direct-threads"]);
          }
        },
      )
      .subscribe();

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [currentUser?.id, supabase, queryClient]);

  // Realtime: group_messages
  useEffect(() => {
    if (!currentUser || !supabase || !queryClient) return;
    if (realtimeGroupChannelRef.current) {
      supabase.removeChannel(realtimeGroupChannelRef.current);
      realtimeGroupChannelRef.current = null;
    }
    realtimeGroupChannelRef.current = supabase
      .channel("group_messages_live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
        },
        (payload) => {
          const groupId = payload.new?.group_id;
          if (groupId) {
            queryClient.invalidateQueries(["group-messages", groupId]);
          }
        },
      )
      .subscribe();
    return () => {
      if (realtimeGroupChannelRef.current) {
        supabase.removeChannel(realtimeGroupChannelRef.current);
        realtimeGroupChannelRef.current = null;
      }
    };
  }, [currentUser?.id, supabase, queryClient]);

  useEffect(() => {
    if (requestsError) {
      toast.error(
        "Erreur lors du chargement de tes demandes de connexion.",
      );
    }
    if (friendsError) {
      toast.error("Erreur lors du chargement de tes amis.");
    }
    if (hobbyProfilesError) {
      toast.error("Erreur lors du chargement des profils hobby.");
    }
  }, [requestsError, friendsError, hobbyProfilesError]);

  const acceptMutation = useMutation({
    mutationFn: async ({ requestId, otherUserId }) => {
      if (!currentUser) throw new Error("Non authentifié");

      const { error: updateError } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId)
        .eq("receiver_id", currentUser.id);

      if (updateError) {
        console.error(
          "[GalacticMap] Erreur update friend_requests:",
          updateError,
        );
        throw updateError;
      }

      const userId1 = currentUser.id < otherUserId ? currentUser.id : otherUserId;
      const userId2 = currentUser.id < otherUserId ? otherUserId : currentUser.id;

      const { error: insertError } = await supabase
        .from("friends")
        .insert({ user_id_1: userId1, user_id_2: userId2 });

      if (insertError && insertError.code !== "23505") {
        console.error(
          "[GalacticMap] Erreur insertion friends:",
          insertError,
        );
        throw insertError;
      }
    },
    onSuccess: () => {
      toast.success("Demande acceptée, vous êtes maintenant amis.");
      queryClient.invalidateQueries(["friend-requests"]);
    },
    onError: () => {
      toast.error("Impossible d'accepter la demande pour le moment.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ requestId, isIncoming }) => {
      if (!currentUser) throw new Error("Non authentifié");

      const column = isIncoming ? "receiver_id" : "requester_id";

      const { error: deleteError } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId)
        .eq(column, currentUser.id);

      if (deleteError) {
        console.error(
          "[GalacticMap] Erreur suppression friend_requests:",
          deleteError,
        );
        throw deleteError;
      }
    },
    onSuccess: () => {
      toast.success("Demande mise à jour.");
      queryClient.invalidateQueries(["friend-requests"]);
    },
    onError: () => {
      toast.error("Impossible de modifier la demande pour le moment.");
    },
  });

  const handleAcceptRequest = (req) => {
    acceptMutation.mutate({
      requestId: req.id,
      otherUserId: req.requester_id,
    });
  };

  const handleRejectRequest = (req) => {
    deleteMutation.mutate({ requestId: req.id, isIncoming: true });
  };

  const handleCancelOutgoing = (req) => {
    deleteMutation.mutate({ requestId: req.id, isIncoming: false });
  };

  const getConnectionStatus = (targetUserId) => {
    if (!currentUser) return "not_connected";
    if (existingConnections.has(targetUserId)) return "pending_or_friend";
    return "can_connect";
  };

  const handleConnect = async (targetUserId) => {
    if (!currentUser) {
      toast.error(
        "Veuillez vous connecter pour te connecter à d'autres joueurs.",
      );
      navigate("/login");
      return;
    }

    if (existingConnections.has(targetUserId)) {
      toast.info("Tu as déjà une demande ou une connexion avec ce joueur.");
      return;
    }

    try {
      const targetUser = users.find((u) => u.id === targetUserId);

      const { error } = await supabase.from("friend_requests").insert({
        requester_id: currentUser.id,
        receiver_id: targetUserId,
        status: "pending",
      });

      if (error) {
        console.error("❌ Erreur Supabase (friend request):", error);
        toast.error("Impossible d'envoyer la demande. Réessaie plus tard.");
        return;
      }

      await refetchConnections();
      await queryClient.invalidateQueries(["friend-requests"]);

      toast.success(
        `Demande d'ami envoyée à ${targetUser?.full_name || "ce joueur"} !`,
      );
    } catch (err) {
      console.error("❌ Erreur handleConnect:", err);
      toast.error("Une erreur est survenue lors de l'envoi de la demande.");
    }
  };

  const selectedUser = positionedUsers.find(
    (item) => item.user.id === selectedUserId,
  )?.user;

  // Load football hobby profile for the selected user (if any)
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUserHobby(null);
      return;
    }

    let isCancelled = false;

    const loadHobby = async () => {
      try {
        setLoadingHobby(true);
        const { data, error } = await supabase
          .from("lumi_hobby_profiles")
          .select(
            "dominant_color, secondary_color, recommended_role, gpt_response",
          )
          .eq("user_id", selectedUserId)
          .eq("hobby_name", "Football")
          .maybeSingle();

        if (error) {
          console.error(
            "[GalacticMap] Erreur chargement hobby profile:",
            error,
          );
          if (!isCancelled) {
            setSelectedUserHobby(null);
          }
          return;
        }

        if (!isCancelled && data) {
          const gpt = data.gpt_response || {};
          const favoritePlayer =
            gpt.favorite_player || gpt.favoritePlayer || null;
          const favoriteTeam = gpt.favorite_team || gpt.favoriteTeam || null;

          setSelectedUserHobby({
            dominant_color: data.dominant_color,
            secondary_color: data.secondary_color,
            recommended_role: data.recommended_role,
            favoritePlayer,
            favoriteTeam,
          });
        } else if (!isCancelled) {
          setSelectedUserHobby(null);
        }
      } finally {
        if (!isCancelled) {
          setLoadingHobby(false);
        }
      }
    };

    loadHobby();

    return () => {
      isCancelled = true;
    };
  }, [selectedUserId, supabase]);

  return (
    <OdysseyLayout
      currentStep={5}
      title="La carte galactique"
      subtitle="Explore la galaxie des talents, découvre des joueurs et crée tes premières connexions."
      maxWidthClass="max-w-6xl"
      onSignOut={onSignOut}
    >
      {/* Main tabs */}
      <div className="flex items-center justify-between mb-5">
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-900/80">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              activeMainTab === "map"
                ? "bg-teal-500 text-white"
                : "bg-slate-900 text-slate-200"
            }`}
            onClick={() => setActiveMainTab("map")}
          >
            Carte galactique
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-l border-slate-700 ${
              activeMainTab === "connections"
                ? "bg-teal-500 text-white"
                : "bg-slate-900 text-slate-200"
            }`}
            onClick={() => setActiveMainTab("connections")}
          >
            Connexions (
            {requests.incoming.length + requests.outgoing.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-l border-slate-700 ${
              activeMainTab === "messages"
                ? "bg-teal-500 text-white"
                : "bg-slate-900 text-slate-200"
            }`}
            onClick={() => setActiveMainTab("messages")}
          >
            Conversations ({threads.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-l border-slate-700 ${
              activeMainTab === "groups"
                ? "bg-teal-500 text-white"
                : "bg-slate-900 text-slate-200"
            }`}
            onClick={() => setActiveMainTab("groups")}
          >
            Groupes ({myGroups.length})
          </button>
        </div>
      </div>

      {/* Sub-tabs inside Connexions */}
      {activeMainTab === "connections" && (
        <div className="max-w-3xl mx-auto mb-4">
          <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-900/80">
            <button
              type="button"
              className={`px-4 py-2 text-xs sm:text-sm font-medium ${
                activeSubTab === "incoming"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-900 text-slate-200"
              }`}
              onClick={() => setActiveSubTab("incoming")}
            >
              Invitations reçues ({requests.incoming.length})
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-xs sm:text-sm font-medium border-l border-slate-700 ${
                activeSubTab === "outgoing"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-900 text-slate-200"
              }`}
              onClick={() => setActiveSubTab("outgoing")}
            >
              Invitations envoyées ({requests.outgoing.length})
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-xs sm:text-sm font-medium border-l border-slate-700 ${
                activeSubTab === "friends"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-900 text-slate-200"
              }`}
              onClick={() => setActiveSubTab("friends")}
            >
              Amis ({friends.length})
            </button>
          </div>
        </div>
      )}

      {activeMainTab === "map" && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1.5fr)_320px] gap-6 items-start">
          <GalacticMapFilters
            elementFilter={elementFilter}
            onElementFilterClick={(key) =>
              setElementFilter((prev) => (prev === key ? null : key))
            }
            hasClubFilter={hasClubFilter}
            onClubFilterToggle={() => setHasClubFilter((v) => !v)}
          />
          <GalaxyMap
            positionedUsers={positionedUsers}
            selectedUserId={selectedUserId}
            onSelectUser={setSelectedUserId}
            isLoading={isLoading}
          />
          <PlayerDetailPanel
            user={selectedUser}
            status={
              selectedUser ? getConnectionStatus(selectedUser.id) : "can_connect"
            }
            onConnect={handleConnect}
            hobbyProfile={selectedUserHobby}
            loadingHobby={loadingHobby}
          />
        </div>
      )}

      {activeMainTab === "connections" && activeSubTab === "incoming" && (
        <ConnectionsIncoming
          requests={requests.incoming}
          loading={loadingRequests}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
          acceptLoading={acceptMutation.isLoading}
          deleteLoading={deleteMutation.isLoading}
        />
      )}

      {activeMainTab === "connections" && activeSubTab === "outgoing" && (
        <ConnectionsOutgoing
          requests={requests.outgoing}
          loading={loadingRequests}
          onCancel={handleCancelOutgoing}
          deleteLoading={deleteMutation.isLoading}
        />
      )}

      {activeMainTab === "connections" && activeSubTab === "friends" && (
        <ConnectionsFriends
          friends={friends}
          loading={loadingFriends}
          onOpenChat={openOrCreateThread}
          openChatLoading={openOrCreateThreadMutation.isLoading}
        />
      )}

      {activeMainTab === "messages" && (
        <div className="max-w-2xl mx-auto min-h-[420px]">
          {!selectedThreadId ? (
            <DirectMessageThreadList
              threads={threads}
              loading={loadingThreads}
              onSelectThread={setSelectedThreadId}
            />
          ) : selectedThreadId === FOOTBALL_AGENT_THREAD_ID ? (
            <FootballAgentChatPanel
              onBack={() => setSelectedThreadId(null)}
              height={520}
            />
          ) : (
            <DirectMessageChat
              threadId={selectedThreadId}
              otherUser={threads.find((t) => t.id === selectedThreadId)?.other}
              messages={threadMessages}
              loadingMessages={loadingMessages}
              currentUserId={currentUser?.id}
              messageDraft={messageDraft}
              onMessageDraftChange={setMessageDraft}
              onSendMessage={handleSendMessage}
              sendLoading={sendMessageMutation.isLoading}
              onBack={() => setSelectedThreadId(null)}
              containerHeight="520px"
            />
          )}
        </div>
      )}

      {activeMainTab === "groups" && (
        <div className="max-w-2xl mx-auto min-h-[420px] space-y-4">
          {selectedGroupId && (
            <div className="card-spotbulle-dark p-3 border border-slate-700">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-1">
                    Membres du groupe
                  </p>
                  {loadingGroupMembers ? (
                    <p className="text-xs text-slate-500">
                      Chargement des membres...
                    </p>
                  ) : groupMemberUserIds.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Aucun membre pour le moment.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {groupMemberUserIds
                        .filter((uid) => uid !== currentUser?.id)
                        .map((uid) => {
                        const m = groupMemberProfileMap[uid];
                        return (
                          <div key={uid} className="flex items-center">
                            <ProfileAvatar
                              profile={m}
                              size={28}
                              title={m?.full_name || "Utilisateur"}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {(() => {
                  if (!isSelectedGroupOwner) return null;
                  const memberIdSet = new Set(groupMemberUserIds);
                  const availableFriends =
                    friends?.filter(
                      (f) =>
                        !memberIdSet.has(f.id) && f.id !== currentUser?.id,
                    ) || [];
                  if (!availableFriends.length) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-slate-400">
                        Ajouter des amis au groupe :
                      </p>
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() =>
                            setIsFriendPickerOpen((open) => !open)
                          }
                          className="inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100 min-w-[200px]"
                        >
                          <span className="truncate">
                            {friendIdsToAdd.length === 0
                              ? "Ajouter des amis"
                              : `${friendIdsToAdd.length} ami(s) sélectionné(s)`}
                          </span>
                          <svg
                            className="w-3 h-3 text-slate-300"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        {isFriendPickerOpen && (
                          <div className="absolute z-20 mt-1 w-56 rounded-md bg-slate-900 border border-slate-700 shadow-lg max-h-56 overflow-y-auto">
                            {availableFriends.map((f) => {
                              const checked = friendIdsToAdd.includes(f.id);
                              return (
                                <label
                                  key={f.id}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-600 bg-slate-800"
                                    checked={checked}
                                    onChange={(e) => {
                                      setFriendIdsToAdd((prev) => {
                                        if (e.target.checked) {
                                          return prev.includes(f.id)
                                            ? prev
                                            : [...prev, f.id];
                                        }
                                        return prev.filter((id) => id !== f.id);
                                      });
                                    }}
                                  />
                                  <span className="truncate">
                                    {f.full_name || "Utilisateur"}
                                  </span>
                                </label>
                              );
                            })}
                            {availableFriends.length === 0 && (
                              <div className="px-3 py-2 text-xs text-slate-500">
                                Aucun ami disponible.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddFriendToGroup}
                        disabled={
                          !friendIdsToAdd.length ||
                          addGroupMemberMutation.isLoading
                        }
                        className="px-3 py-1.5 text-xs rounded-md bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          {!selectedGroupId ? (
            <GroupList
              groups={myGroups}
              loading={loadingMyGroups}
              onSelectGroup={setSelectedGroupId}
              onCreateGroup={handleCreateGroup}
              createLoading={createGroupMutation.isLoading}
            />
          ) : (
            <GroupChatPanel
              groupId={selectedGroupId}
              groupName={myGroups.find((g) => g.id === selectedGroupId)?.name}
              messages={groupMessages}
              loadingMessages={loadingGroupMessages}
              currentUserId={currentUser?.id}
              senderProfiles={groupSenderProfileMap}
              messageDraft={groupMessageDraft}
              onMessageDraftChange={setGroupMessageDraft}
              onSendMessage={handleSendGroupMessage}
              sendLoading={sendGroupMessageMutation.isLoading}
              onBack={() => setSelectedGroupId(null)}
              containerHeight="520px"
            />
          )}
        </div>
      )}
    </OdysseyLayout>
  );
}
