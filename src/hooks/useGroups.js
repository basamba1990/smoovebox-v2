// Reusable hook: groups list, group chat, members, team (formation + slots).
// Use with GroupsTabContent or any UI that needs full group features.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FOOTBALL_FORMATIONS_BY_COUNT } from "../components/galactic/footballFormations.js";

export function useGroups(supabase, currentUser, queryClient) {
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupMessageDraft, setGroupMessageDraft] = useState("");
  const [friendIdsToAdd, setFriendIdsToAdd] = useState([]);
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [memberToRemoveId, setMemberToRemoveId] = useState(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamStarters, setNewTeamStarters] = useState(11);
  const [slotAssigningId, setSlotAssigningId] = useState(null);
  const realtimeGroupChannelRef = useRef(null);
  const realtimeTeamSlotsChannelRef = useRef(null);

  // Friends (for add-member; shared query key with page)
  const { data: friends = [] } = useQuery({
    queryKey: ["friends", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from("friends")
        .select("user_id_1, user_id_2")
        .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);
      if (error) throw error;
      const otherIds = (data || []).map((row) =>
        row.user_id_1 === currentUser.id ? row.user_id_2 : row.user_id_1,
      );
      if (!otherIds.length) return [];
      const { data: profiles, error: e2 } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, sex, location")
        .in("id", otherIds);
      if (e2) throw e2;
      return profiles || [];
    },
  });

  const { data: myGroups = [], isLoading: loadingMyGroups } = useQuery({
    queryKey: ["my-groups", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      const { data: memberRows, error: memberError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", currentUser.id);
      if (memberError) throw memberError;
      const groupIds = (memberRows || []).map((r) => r.group_id).filter(Boolean);
      if (groupIds.length === 0) return [];
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("id, name, owner_id, created_at")
        .in("id", groupIds)
        .order("created_at", { ascending: false });
      if (groupsError) throw groupsError;
      return groupsData || [];
    },
  });

  const selectedGroup = useMemo(
    () => myGroups.find((g) => g.id === selectedGroupId) || null,
    [myGroups, selectedGroupId],
  );
  const isSelectedGroupOwner =
    !!selectedGroup && selectedGroup.owner_id === currentUser?.id;

  const { data: groupUnreadCountsRaw = [] } = useQuery({
    queryKey: ["group-unread-counts", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase.rpc("get_group_unread_counts", {
        p_user_id: currentUser.id,
      });
      if (error) {
        console.error("[useGroups] Erreur unread counts:", error);
        return [];
      }
      return data || [];
    },
  });
  const unreadCountByGroupId = useMemo(
    () =>
      (groupUnreadCountsRaw || []).reduce((acc, row) => {
        if (row.group_id && Number(row.unread_count) > 0) {
          acc[row.group_id] = Number(row.unread_count);
        }
        return acc;
      }, {}),
    [groupUnreadCountsRaw],
  );
  const totalUnreadGroups = useMemo(
    () => Object.values(unreadCountByGroupId).reduce((s, n) => s + n, 0),
    [unreadCountByGroupId],
  );

  const { data: groupTeam = null, isLoading: loadingGroupTeam } = useQuery({
    queryKey: ["group-team", selectedGroupId],
    enabled: !!selectedGroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_teams")
        .select("id, group_id, name, starters_count, formation, owner_id")
        .eq("group_id", selectedGroupId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data || null;
    },
  });

  const { data: teamSlots = [], isLoading: loadingTeamSlots } = useQuery({
    queryKey: ["group-team-slots", groupTeam?.id],
    enabled: !!groupTeam?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_team_slots")
        .select("id, team_id, index, role, x, y, user_id")
        .eq("team_id", groupTeam.id)
        .order("index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: groupMessages = [], isLoading: loadingGroupMessages } =
    useQuery({
      queryKey: ["group-messages", selectedGroupId],
      enabled: !!selectedGroupId,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("group_messages")
          .select("id, group_id, sender_id, content, created_at")
          .eq("group_id", selectedGroupId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data || [];
      },
    });

  const { data: groupMembers = [], isLoading: loadingGroupMembers } = useQuery({
    queryKey: ["group-members", selectedGroupId],
    enabled: !!selectedGroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("id, group_id, user_id")
        .eq("group_id", selectedGroupId);
      if (error) throw error;
      return data || [];
    },
  });

  const groupMessageSenderIds = useMemo(
    () => [
      ...new Set((groupMessages || []).map((m) => m.sender_id).filter(Boolean)),
    ],
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

  const groupMemberUserIds = useMemo(
    () => [
      ...new Set((groupMembers || []).map((m) => m.user_id).filter(Boolean)),
    ],
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
      if (error) throw error;
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
    onSuccess: (_, __, context) => {
      queryClient.invalidateQueries(["my-groups"]);
      if (typeof context?.onSuccess === "function") context.onSuccess();
    },
    onError: () => toast.error("Impossible de créer le groupe."),
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
    onError: () => toast.error("Impossible d'envoyer le message."),
  });

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
    onError: () => toast.error("Impossible d'ajouter cet ami au groupe."),
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
      if (userId === currentUser?.id) setSelectedGroupId(null);
      setMemberToRemoveId(null);
      queryClient.invalidateQueries(["group-members", groupId]);
      queryClient.invalidateQueries(["my-groups", currentUser?.id]);
    },
    onError: () =>
      toast.error("Impossible de mettre à jour les membres du groupe."),
  });

  const createTeamMutation = useMutation({
    mutationFn: async ({ groupId, name, startersCount }) => {
      if (!currentUser) throw new Error("Non authentifié");
      const { data, error } = await supabase
        .from("group_teams")
        .insert({
          group_id: groupId,
          name: (name || "").trim(),
          starters_count: startersCount,
          owner_id: currentUser.id,
        })
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
    onError: () => toast.error("Impossible de créer l'équipe."),
  });

  const setFormationMutation = useMutation({
    mutationFn: async ({ teamId, formation, startersCount }) => {
      const formationsForCount =
        FOOTBALL_FORMATIONS_BY_COUNT[String(startersCount)] ||
        FOOTBALL_FORMATIONS_BY_COUNT[startersCount] ||
        {};
      const def = formationsForCount[formation];
      if (!def) throw new Error("Formation inconnue pour ce nombre de joueurs.");
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
    onError: () => toast.error("Impossible de mettre à jour la formation."),
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
    onError: () => toast.error("Impossible d'assigner le joueur à ce poste."),
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
    onError: () => toast.error("Impossible de supprimer l'équipe."),
  });

  const handleCreateGroup = (name, onSuccess) => {
    createGroupMutation.mutate(name, { context: { onSuccess } });
  };

  const handleSendGroupMessage = () => {
    const text = (groupMessageDraft || "").trim();
    if (!text || !selectedGroupId) return;
    sendGroupMessageMutation.mutate({
      groupId: selectedGroupId,
      content: text,
    });
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
    const name = groupMemberProfileMap[memberToRemoveId]?.full_name || "ce membre";
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

  // Mark group as read when user opens it
  useEffect(() => {
    if (!currentUser || !selectedGroupId) return;
    const run = async () => {
      const { error } = await supabase.from("group_reads").upsert(
        {
          group_id: selectedGroupId,
          user_id: currentUser.id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "group_id,user_id" },
      );
      if (error) {
        console.error("[useGroups] Mark group read error:", error);
        return;
      }
      queryClient.invalidateQueries(["group-unread-counts", currentUser.id]);
      await queryClient.refetchQueries({
        queryKey: ["group-unread-counts", currentUser.id],
      });
    };
    run();
  }, [currentUser?.id, selectedGroupId, supabase, queryClient]);

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
        async (payload) => {
          const groupId = payload.new?.group_id;
          if (!groupId) return;
          queryClient.invalidateQueries(["group-messages", groupId]);
          queryClient.invalidateQueries(["group-unread-counts", currentUser?.id]);
          if (groupId === selectedGroupId) {
            const { error } = await supabase.from("group_reads").upsert(
              {
                group_id: groupId,
                user_id: currentUser.id,
                last_read_at: new Date().toISOString(),
              },
              { onConflict: "group_id,user_id" },
            );
            if (!error) {
              await queryClient.refetchQueries({
                queryKey: ["group-unread-counts", currentUser.id],
              });
            }
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
  }, [currentUser?.id, selectedGroupId, supabase, queryClient]);

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
        { event: "*", schema: "public", table: "group_team_slots" },
        (payload) => {
          const teamId =
            payload.new?.team_id || payload.old?.team_id || null;
          if (teamId)
            queryClient.invalidateQueries(["group-team-slots", teamId]);
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

  return {
    currentUser,
    myGroups,
    loadingMyGroups,
    unreadCountByGroupId,
    totalUnreadGroups,
    selectedGroupId,
    setSelectedGroupId,
    selectedGroup,
    isSelectedGroupOwner,
    groupTeam,
    loadingGroupTeam,
    teamSlots,
    loadingTeamSlots,
    groupMessages,
    loadingGroupMessages,
    groupMembers,
    loadingGroupMembers,
    groupMemberUserIds,
    groupMemberProfileMap,
    groupMemberProfiles,
    groupSenderProfileMap,
    groupMessageDraft,
    setGroupMessageDraft,
    friendIdsToAdd,
    setFriendIdsToAdd,
    isFriendPickerOpen,
    setIsFriendPickerOpen,
    memberToRemoveId,
    setMemberToRemoveId,
    newTeamName,
    setNewTeamName,
    newTeamStarters,
    setNewTeamStarters,
    slotAssigningId,
    setSlotAssigningId,
    friends,
    handleCreateGroup,
    handleSendGroupMessage,
    handleAddFriendToGroup,
    handleCreateTeam,
    handleSetFormation,
    handleAssignSlot,
    handleDeleteTeam,
    handleRemoveMemberFromGroup,
    handleLeaveGroup,
    createGroupMutation,
    addGroupMemberMutation,
    removeGroupMemberMutation,
    sendGroupMessageMutation,
    createTeamMutation,
    setFormationMutation,
    assignSlotMutation,
    deleteTeamMutation,
  };
}
