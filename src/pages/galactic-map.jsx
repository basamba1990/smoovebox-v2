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
  FOOTBALL_FORMATIONS_BY_COUNT,
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
  const [memberToRemoveId, setMemberToRemoveId] = useState(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamStarters, setNewTeamStarters] = useState(11);
  const [slotAssigningId, setSlotAssigningId] = useState(null);
  const realtimeChannelRef = useRef(null);
  const realtimeGroupChannelRef = useRef(null);
  const realtimeTeamSlotsChannelRef = useRef(null);
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

  // Team for selected group (one team per group)
  const {
    data: groupTeam = null,
    isLoading: loadingGroupTeam,
  } = useQuery({
    queryKey: ["group-team", selectedGroupId],
    enabled: !!selectedGroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_teams")
        .select("id, group_id, name, starters_count, formation, owner_id")
        .eq("group_id", selectedGroupId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[GalacticMap] Erreur group_teams:", error);
        throw error;
      }
      return data || null;
    },
  });

  // Team slots for selected group's team
  const {
    data: teamSlots = [],
    isLoading: loadingTeamSlots,
  } = useQuery({
    queryKey: ["group-team-slots", groupTeam?.id],
    enabled: !!groupTeam?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_team_slots")
        .select("id, team_id, index, role, x, y, user_id")
        .eq("team_id", groupTeam.id)
        .order("index", { ascending: true });
      if (error) {
        console.error("[GalacticMap] Erreur group_team_slots:", error);
        throw error;
      }
      return data || [];
    },
  });

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

  const removeGroupMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { groupId, userId }) => {
      if (userId === currentUser?.id) {
        setSelectedGroupId(null);
      }
      setMemberToRemoveId(null);
      queryClient.invalidateQueries(["group-members", groupId]);
      queryClient.invalidateQueries(["my-groups", currentUser?.id]);
    },
    onError: () => {
      toast.error("Impossible de mettre à jour les membres du groupe.");
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async ({ groupId, name, startersCount }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const payload = {
        group_id: groupId,
        name: (name || "").trim(),
        starters_count: startersCount,
        owner_id: currentUser.id,
      };
      const { data, error } = await supabase
        .from("group_teams")
        .insert(payload)
        .select("id, starters_count, formation")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setNewTeamName("");
      setNewTeamStarters(11);
      queryClient.invalidateQueries(["group-team", selectedGroupId]);
    },
    onError: () => {
      toast.error("Impossible de créer l'équipe.");
    },
  });

  const setFormationMutation = useMutation({
    mutationFn: async ({ teamId, formation, startersCount }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const formationsForCount =
        FOOTBALL_FORMATIONS_BY_COUNT[String(startersCount)] ||
        FOOTBALL_FORMATIONS_BY_COUNT[startersCount] ||
        {};
      const def = formationsForCount[formation];
      if (!def) {
        throw new Error("Formation inconnue pour ce nombre de joueurs.");
      }

      const { error: updateError } = await supabase
        .from("group_teams")
        .update({ formation })
        .eq("id", teamId);
      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from("group_team_slots")
        .delete()
        .eq("team_id", teamId);
      if (deleteError) throw deleteError;

      const rows = (def.slots || []).map((slot) => ({
        team_id: teamId,
        index: slot.index,
        role: slot.role || null,
        x: slot.x,
        y: slot.y,
        user_id: null,
      }));
      if (rows.length) {
        const { error: insertError } = await supabase
          .from("group_team_slots")
          .insert(rows);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["group-team", selectedGroupId]);
      queryClient.invalidateQueries(["group-team-slots", groupTeam?.id]);
    },
    onError: () => {
      toast.error("Impossible de mettre à jour la formation.");
    },
  });

  const assignSlotMutation = useMutation({
    mutationFn: async ({ slotId, userId }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("group_team_slots")
        .update({ user_id: userId })
        .eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSlotAssigningId(null);
      queryClient.invalidateQueries(["group-team-slots", groupTeam?.id]);
    },
    onError: () => {
      toast.error("Impossible d'assigner le joueur à ce poste.");
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async ({ teamId }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("group_teams")
        .delete()
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSlotAssigningId(null);
      queryClient.invalidateQueries(["group-team", selectedGroupId]);
      queryClient.invalidateQueries(["group-team-slots"]);
    },
    onError: () => {
      toast.error("Impossible de supprimer l'équipe.");
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

  const handleCreateTeam = () => {
    const name = (newTeamName || "").trim();
    const starters = Number(newTeamStarters) || 0;
    if (!selectedGroupId || !name || starters <= 0 || starters > 11) return;
    createTeamMutation.mutate({
      groupId: selectedGroupId,
      name,
      startersCount: starters,
    });
  };

  const handleSetFormation = (formation) => {
    if (!groupTeam || !formation) return;
    setFormationMutation.mutate({
      teamId: groupTeam.id,
      formation,
      startersCount: groupTeam.starters_count,
    });
  };

  const handleAssignSlot = (slotId, userId) => {
    if (!slotId || !userId || !isSelectedGroupOwner) return;
    assignSlotMutation.mutate({ slotId, userId });
  };

  const handleDeleteTeam = () => {
    if (!groupTeam || !isSelectedGroupOwner) return;
    const ok = window.confirm(
      "Es-tu sûr de vouloir supprimer cette équipe ? Les postes et la composition seront perdus.",
    );
    if (!ok) return;
    deleteTeamMutation.mutate({ teamId: groupTeam.id });
  };

  const handleRemoveMemberFromGroup = () => {
    if (!selectedGroupId || !memberToRemoveId || !isSelectedGroupOwner) return;
    const memberProfile = groupMemberProfileMap[memberToRemoveId];
    const name = memberProfile?.full_name || "ce membre";
    const ok = window.confirm(
      `Es-tu sûr de vouloir retirer ${name} de ce groupe ?`,
    );
    if (!ok) return;
    removeGroupMemberMutation.mutate({
      groupId: selectedGroupId,
      userId: memberToRemoveId,
    });
  };

  const handleLeaveGroup = () => {
    if (!selectedGroupId || !currentUser?.id) return;
    const ok = window.confirm(
      "Es-tu sûr de vouloir quitter ce groupe ? Tu ne verras plus les messages.",
    );
    if (!ok) return;
    removeGroupMemberMutation.mutate({
      groupId: selectedGroupId,
      userId: currentUser.id,
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

  // Realtime: group_team_slots (team composition updates live)
  useEffect(() => {
    if (!currentUser || !supabase || !queryClient) return;
    if (realtimeTeamSlotsChannelRef.current) {
      supabase.removeChannel(realtimeTeamSlotsChannelRef.current);
      realtimeTeamSlotsChannelRef.current = null;
    }
    realtimeTeamSlotsChannelRef.current = supabase
      .channel("group_team_slots_live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_team_slots",
        },
        (payload) => {
          const teamId =
            payload.new?.team_id || payload.old?.team_id || null;
          if (teamId) {
            queryClient.invalidateQueries(["group-team-slots", teamId]);
          }
        },
      )
      .subscribe();
    return () => {
      if (realtimeTeamSlotsChannelRef.current) {
        supabase.removeChannel(realtimeTeamSlotsChannelRef.current);
        realtimeTeamSlotsChannelRef.current = null;
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
                  const removableMembers = groupMemberUserIds.filter(
                    (uid) => uid !== currentUser?.id && uid !== selectedGroup?.owner_id,
                  );
                  const removableMemberOptions = removableMembers
                    .map((uid) => groupMemberProfileMap[uid])
                    .filter(Boolean);
                  if (!availableFriends.length && !removableMemberOptions.length)
                    return null;
                  return (
                    <div className="flex flex-col gap-3">
                      {availableFriends.length > 0 && (
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
                                            return prev.filter(
                                              (id) => id !== f.id,
                                            );
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
                      )}

                      {removableMemberOptions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs text-slate-400">
                            Retirer un membre :
                          </p>
                          <select
                            className="px-2 py-1 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100 min-w-[200px]"
                            value={memberToRemoveId || ""}
                            onChange={(e) =>
                              setMemberToRemoveId(
                                e.target.value ? e.target.value : null,
                              )
                            }
                          >
                            <option value="">Sélectionner un membre</option>
                            {removableMemberOptions.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name || "Utilisateur"}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleRemoveMemberFromGroup}
                            disabled={
                              !memberToRemoveId ||
                              removeGroupMemberMutation.isLoading
                            }
                            className="px-3 py-1.5 text-xs rounded-md bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                          >
                            Retirer
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          {selectedGroupId && (
            <div className="card-spotbulle-dark p-3 border border-slate-700">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">
                      Équipe du groupe
                    </p>
                    {groupTeam && (
                      <p className="text-[11px] text-slate-400">
                        {groupTeam.starters_count} joueurs
                        {groupTeam.formation
                          ? ` · ${groupTeam.formation}`
                          : " · formation à définir"}
                      </p>
                    )}
                  </div>
                  {groupTeam && isSelectedGroupOwner && (
                    <button
                      type="button"
                      onClick={handleDeleteTeam}
                      disabled={deleteTeamMutation.isLoading}
                      className="text-[11px] text-rose-400 hover:text-rose-300"
                    >
                      Supprimer l&apos;équipe
                    </button>
                  )}
                </div>

                {loadingGroupTeam ? (
                  <p className="text-xs text-slate-500">
                    Chargement de l&apos;équipe...
                  </p>
                ) : !groupTeam ? (
                  isSelectedGroupOwner ? (
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Nom de l&apos;équipe
                        </label>
                        <input
                          type="text"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="Equipe du groupe"
                          className="w-full px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Nombre de joueurs
                        </label>
                        <select
                          value={newTeamStarters}
                          onChange={(e) =>
                            setNewTeamStarters(Number(e.target.value) || 11)
                          }
                          className="px-2 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100"
                        >
                          <option value={5}>5</option>
                          <option value={7}>7</option>
                          <option value={11}>11</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateTeam}
                        disabled={createTeamMutation.isLoading}
                        className="px-3 py-1.5 text-xs rounded-md bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                      >
                        Créer l&apos;équipe
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Aucune équipe n&apos;a encore été créée pour ce groupe.
                    </p>
                  )
                ) : (
                  <>
                    {/* Formation selector (owner only) */}
                    {isSelectedGroupOwner && (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-slate-400">
                          Formation :
                        </p>
                        {(() => {
                          const formationsForCount =
                            FOOTBALL_FORMATIONS_BY_COUNT[
                              groupTeam.starters_count
                            ] ||
                            FOOTBALL_FORMATIONS_BY_COUNT[
                              String(groupTeam.starters_count)
                            ] ||
                            {};
                          const formationNames = Object.keys(formationsForCount);
                          if (!formationNames.length) {
                            return (
                              <span className="text-xs text-slate-500">
                                Aucune formation définie pour{" "}
                                {groupTeam.starters_count} joueurs.
                              </span>
                            );
                          }
                          return (
                            <select
                              value={groupTeam.formation || ""}
                              onChange={(e) =>
                                handleSetFormation(e.target.value || null)
                              }
                              className="px-2 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100"
                            >
                              <option value="">
                                Choisir une formation
                              </option>
                              {formationNames.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                    )}

                    {/* Field + slots */}
                    {groupTeam.formation && (
                      <div className="mt-2">
                        {loadingTeamSlots ? (
                          <p className="text-xs text-slate-500">
                            Chargement des postes...
                          </p>
                        ) : !teamSlots.length ? (
                          <p className="text-xs text-slate-500">
                            Aucune position définie pour cette formation.
                          </p>
                        ) : (
                          <div className="relative w-full aspect-[3/2] bg-gradient-to-b from-emerald-900 to-emerald-800 rounded-xl border border-emerald-500/60 overflow-hidden">
                            <div className="absolute inset-x-4 inset-y-4 border border-emerald-500/40 rounded-xl" />
                            <div className="absolute inset-x-1/2 top-0 bottom-0 border-l border-emerald-500/40" />
                            <div className="absolute inset-x-8 top-1/2 border-t border-emerald-500/40" />
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-emerald-500/50" />
                            {teamSlots.map((slot) => {
                              const assignedProfile =
                                slot.user_id &&
                                groupMemberProfileMap[slot.user_id];
                              const left = `${slot.x * 100}%`;
                              const bottom = `${slot.y * 100}%`;
                              const isClickable = isSelectedGroupOwner;
                              return (
                                <button
                                  key={slot.index}
                                  type="button"
                                  className={`absolute -translate-x-1/2 translate-y-1/2 flex items-center justify-center rounded-full border-2 ${
                                    assignedProfile
                                      ? "border-white"
                                      : "border-emerald-300/80"
                                  } ${
                                    isClickable
                                      ? "cursor-pointer hover:scale-105 transition-transform"
                                      : "cursor-default"
                                  }`}
                                  style={{
                                    left,
                                    bottom,
                                    width: 40,
                                    height: 40,
                                    backgroundColor: assignedProfile
                                      ? "rgba(15, 23, 42, 0.9)"
                                      : "rgba(16, 185, 129, 0.85)",
                                    transition:
                                      "left 320ms ease, bottom 320ms ease, transform 180ms ease",
                                  }}
                                  onClick={() => {
                                    if (!isClickable) return;
                                    setSlotAssigningId(slot.id);
                                  }}
                                >
                                  {assignedProfile ? (
                                    <ProfileAvatar
                                      profile={assignedProfile}
                                      size={32}
                                      title={
                                        assignedProfile.full_name || "Joueur"
                                      }
                                    />
                                  ) : (
                                    <span className="text-[11px] font-semibold text-slate-900">
                                      {slot.role || slot.index + 1}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bench / substitutes */}
                    {groupTeam.formation && (
                      (() => {
                        const assignedIds = new Set(
                          teamSlots
                            .map((s) => s.user_id)
                            .filter(Boolean),
                        );
                        const benchPlayers = (groupMemberProfiles || []).filter(
                          (p) => !assignedIds.has(p.id),
                        );
                        if (!benchPlayers.length) return null;
                        return (
                          <div className="mt-3">
                            <p className="text-[11px] text-slate-400 mb-1">
                              Remplaçants
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {benchPlayers.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={`flex items-center justify-center rounded-full border-2 border-slate-500/70 bg-slate-800 hover:bg-slate-700/90 transition-colors ${
                                    isSelectedGroupOwner
                                      ? "cursor-pointer"
                                      : "cursor-default"
                                  }`}
                                  style={{ width: 32, height: 32 }}
                                  onClick={() => {
                                    if (!isSelectedGroupOwner) return;
                                    if (!slotAssigningId) return;
                                    handleAssignSlot(slotAssigningId, p.id);
                                  }}
                                  title={p.full_name || "Remplaçant"}
                                >
                                  <ProfileAvatar profile={p} size={24} />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    )}

                    {/* Assign player to slot (owner only) */}
                    {isSelectedGroupOwner && slotAssigningId && (
                      (() => {
                        const slot = teamSlots.find(
                          (s) => s.id === slotAssigningId,
                        );
                        if (!slot) return null;
                        const assignedIds = new Set(
                          teamSlots
                            .map((s) => s.user_id)
                            .filter(
                              (id) => id && id !== slot.user_id,
                            ),
                        );
                        const availablePlayers =
                          (groupMemberProfiles || []).filter(
                            (p) => !assignedIds.has(p.id),
                          );
                        if (!availablePlayers.length) {
                          return (
                            <p className="mt-2 text-[11px] text-slate-500">
                              Aucun membre disponible à assigner à ce poste.
                            </p>
                          );
                        }
                        return (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <p className="text-[11px] text-slate-400">
                              Choisir un joueur pour ce poste :
                            </p>
                            <select
                              className="px-2 py-1 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100 min-w-[200px]"
                              defaultValue=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                handleAssignSlot(slot.id, e.target.value);
                                e.target.value = "";
                              }}
                            >
                              <option value="">Sélectionner un joueur</option>
                              {availablePlayers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name || "Utilisateur"}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setSlotAssigningId(null)}
                              className="text-[11px] text-slate-400 hover:text-slate-200"
                            >
                              Annuler
                            </button>
                          </div>
                        );
                      })()
                    )}
                  </>
                )}
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
              groupName={selectedGroup?.name}
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
          {selectedGroupId && !isSelectedGroupOwner && (
            <div className="max-w-2xl mx-auto">
              <button
                type="button"
                onClick={handleLeaveGroup}
                className="text-xs text-rose-400 hover:text-rose-300 underline"
              >
                Quitter ce groupe
              </button>
            </div>
          )}
        </div>
      )}
    </OdysseyLayout>
  );
}
