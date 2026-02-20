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
  GroupsTabContent,
} from "../components/galactic";
import { useFriendRequests } from "../hooks/useFriendRequests.js";
import { useGroups } from "../hooks/useGroups.js";
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
  const realtimeChannelRef = useRef(null);
  const [elementFilter, setElementFilter] = useState(null);

  const groupsApi = useGroups(supabase, currentUser, queryClient); // "rouge" | "jaune" | "vert" | "bleu" | null
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
        console.error("[GalacticMap] Erreur chargement hobby profiles:", error);
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
          const favoriteTeam = gpt.favorite_team || gpt.favoriteTeam || null;

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
        .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);

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
        .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[GalacticMap] Erreur chargement threads:", error);
        throw error;
      }

      const rows = data || [];
      const otherIds = rows.map((r) =>
        r.user_id_1 === currentUser.id ? r.user_id_2 : r.user_id_1,
      );
      if (otherIds.length === 0)
        return rows.map((r) => ({ ...r, other: null }));

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
        other:
          byId[r.user_id_1 === currentUser.id ? r.user_id_2 : r.user_id_1] ||
          null,
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

  // Unread counts per thread (for badges)
  const { data: unreadCountsRaw = [] } = useQuery({
    queryKey: ["direct-thread-unread-counts", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase.rpc("get_direct_thread_unread_counts", {
        p_user_id: currentUser.id,
      });
      if (error) {
        console.error("[GalacticMap] Erreur unread counts:", error);
        return [];
      }
      return data || [];
    },
  });
  const unreadCountByThreadId = useMemo(
    () =>
      (unreadCountsRaw || []).reduce((acc, row) => {
        if (row.thread_id && Number(row.unread_count) > 0) {
          acc[row.thread_id] = Number(row.unread_count);
        }
        return acc;
      }, {}),
    [unreadCountsRaw],
  );
  const totalUnread = useMemo(
    () => Object.values(unreadCountByThreadId).reduce((s, n) => s + n, 0),
    [unreadCountByThreadId],
  );

  const {
    data: threadMessages = [],
    isLoading: loadingMessages,
    refetch: refetchThreadMessages,
  } = useQuery({
    queryKey: ["direct-messages", selectedThreadId],
    enabled:
      !!selectedThreadId && selectedThreadId !== FOOTBALL_AGENT_THREAD_ID,
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

  const handleSendMessage = () => {
    const text = (messageDraft || "").trim();
    if (!text || !selectedThreadId) return;
    sendMessageMutation.mutate({ threadId: selectedThreadId, content: text });
  };

  // Mark thread as read when user opens it (real threads only, not agent)
  useEffect(() => {
    if (
      !currentUser ||
      !selectedThreadId ||
      selectedThreadId === FOOTBALL_AGENT_THREAD_ID
    )
      return;
    const run = async () => {
      const { error } = await supabase.from("direct_thread_reads").upsert(
        {
          thread_id: selectedThreadId,
          user_id: currentUser.id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "thread_id,user_id" },
      );
      if (error) {
        console.error("[GalacticMap] Mark read error:", error);
        return;
      }
      queryClient.invalidateQueries(["direct-thread-unread-counts", currentUser.id]);
      await queryClient.refetchQueries({ queryKey: ["direct-thread-unread-counts", currentUser.id] });
    };
    run();
  }, [currentUser?.id, selectedThreadId, supabase, queryClient]);

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
        async (payload) => {
          const threadId = payload.new?.thread_id;
          if (!threadId) return;
          queryClient.invalidateQueries(["direct-messages", threadId]);
          queryClient.invalidateQueries(["direct-threads"]);
          queryClient.invalidateQueries(["direct-thread-unread-counts", currentUser?.id]);
          // If user is viewing this thread, mark it as read so the badge disappears
          if (threadId === selectedThreadId) {
            const { error } = await supabase.from("direct_thread_reads").upsert(
              {
                thread_id: threadId,
                user_id: currentUser.id,
                last_read_at: new Date().toISOString(),
              },
              { onConflict: "thread_id,user_id" },
            );
            if (!error) {
              await queryClient.refetchQueries({
                queryKey: ["direct-thread-unread-counts", currentUser.id],
              });
            }
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
  }, [currentUser?.id, selectedThreadId, supabase, queryClient]);

  useEffect(() => {
    if (requestsError) {
      toast.error("Erreur lors du chargement de tes demandes de connexion.");
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

      const userId1 =
        currentUser.id < otherUserId ? currentUser.id : otherUserId;
      const userId2 =
        currentUser.id < otherUserId ? otherUserId : currentUser.id;

      const { error: insertError } = await supabase
        .from("friends")
        .insert({ user_id_1: userId1, user_id_2: userId2 });

      if (insertError && insertError.code !== "23505") {
        console.error("[GalacticMap] Erreur insertion friends:", insertError);
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
            Connexions ({requests.incoming.length + requests.outgoing.length})
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
            {totalUnread > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-medium bg-rose-500 text-white">
                {totalUnread}
              </span>
            )}
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
            Groupes ({groupsApi.myGroups.length})
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
              selectedUser
                ? getConnectionStatus(selectedUser.id)
                : "can_connect"
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
              unreadCountByThreadId={unreadCountByThreadId}
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

      {activeMainTab === "groups" && <GroupsTabContent {...groupsApi} />}
    </OdysseyLayout>
  );
}
