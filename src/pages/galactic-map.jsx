// src/pages/galactic-map.jsx
// "La carte galactique" - visual map of the community

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button-enhanced.jsx";
import { Input } from "../components/ui/input.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import {
  useDirectoryUsers,
  useExistingConnections,
} from "../hooks/useDirectory.js";
import { getPublicUrl } from "../lib/storageUtils.js";

function Avatar({ profile, size = 48 }) {
  const fallback =
    profile?.sex === "female"
      ? "/default-avatars/female.png"
      : profile?.sex === "male"
        ? "/default-avatars/male.png"
        : "/default-avatars/neutral.png";

  const src = React.useMemo(() => {
    if (!profile?.avatar_url) return fallback;
    if (profile.avatar_url.startsWith("http")) return profile.avatar_url;
    return getPublicUrl(profile.avatar_url, "avatars") || fallback;
  }, [profile?.avatar_url, fallback]);

  return (
    <img
      src={src}
      alt={profile?.full_name || "Utilisateur"}
      className="rounded-full object-cover border-2 border-blue-200"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.src = fallback;
      }}
    />
  );
}

function useFriendRequests() {
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
          "[GalacticMap] Erreur chargement demandes entrantes:",
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
          "[GalacticMap] Erreur chargement demandes sortantes:",
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
            "[GalacticMap] Erreur chargement profils connexions:",
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

// Lightweight radar chart reused from the HobbyFlow card (only for display)
function RadarChartFourElements({ dominantColor, secondaryColor }) {
  const size = 90;
  const center = size / 2;
  const maxRadius = 28;
  const axes = [
    { label: "Air", angle: -90 },
    { label: "Eau", angle: 0 },
    { label: "Terre", angle: 90 },
    { label: "Feu", angle: 180 },
  ];

  const ELEMENT_AXIS_INDEX = { jaune: 0, bleu: 1, vert: 2, rouge: 3 };

  // Base values for the 4 elements
  const values = [0.3, 0.3, 0.3, 0.3];
  if (dominantColor != null && ELEMENT_AXIS_INDEX[dominantColor] != null) {
    values[ELEMENT_AXIS_INDEX[dominantColor]] = 0.9;
  }
  if (secondaryColor != null && ELEMENT_AXIS_INDEX[secondaryColor] != null) {
    values[ELEMENT_AXIS_INDEX[secondaryColor]] = 0.6;
  }

  return (
    <div className="relative">
      <svg width={size} height={size} className="text-white">
        <defs>
          <radialGradient id="radar-bg-galaxy" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(15,23,42,0.0)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.65)" />
          </radialGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={maxRadius + 4}
          fill="url(#radar-bg-galaxy)"
          stroke="rgba(148, 163, 184, 0.6)"
          strokeWidth={0.6}
        />

        {[0.33, 0.66, 1].map((ratio) => (
          <circle
            key={ratio}
            cx={center}
            cy={center}
            r={maxRadius * ratio}
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth={0.6}
            fill="none"
          />
        ))}

        {axes.map((ax) => {
          const rad = (ax.angle * Math.PI) / 180;
          const x = center + maxRadius * Math.cos(rad);
          const y = center + maxRadius * Math.sin(rad);
          return (
            <line
              key={ax.label}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(148, 163, 184, 0.4)"
              strokeWidth={0.6}
            />
          );
        })}

        {(() => {
          const pts = axes.map((ax, i) => {
            const rad = (ax.angle * Math.PI) / 180;
            const r = maxRadius * values[i];
            const x = center + r * Math.cos(rad);
            const y = center + r * Math.sin(rad);
            return { x, y, label: ax.label, value: values[i] };
          });

          const pathD =
            pts.length > 0
              ? `M ${pts[0].x} ${pts[0].y} ` +
                pts
                  .slice(1)
                  .map((p) => `L ${p.x} ${p.y}`)
                  .join(" ") +
                " Z"
              : "";

          return (
            <>
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="white"
                  strokeWidth={1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeOpacity={0.9}
                />
              )}

              {pts.map((p) => {
                const bubbleRadius = 3 + p.value * 3;
                return (
                  <circle
                    key={`${p.label}-bubble`}
                    cx={p.x}
                    cy={p.y}
                    r={bubbleRadius}
                    fill="white"
                    fillOpacity={0.9}
                    stroke="rgba(56, 189, 248, 0.8)"
                    strokeWidth={0.6}
                  />
                );
              })}
            </>
          );
        })()}

        {axes.map((ax) => {
          const rad = (ax.angle * Math.PI) / 180;
          const r = maxRadius + 10;
          const x = center + r * Math.cos(rad);
          const y = center + r * Math.sin(rad);
          return (
            <text
              key={ax.label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={8}
              fontWeight={500}
            >
              {ax.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Simple helper to map a DISC dominant_color to a Tailwind color class.
 * You can adjust the mapping to match your existing design tokens.
 */
const ELEMENT_COLORS = {
  rouge: "border-red-400 bg-red-500/30",
  jaune: "border-yellow-400 bg-yellow-400/30",
  vert: "border-emerald-400 bg-emerald-400/30",
  bleu: "border-sky-400 bg-sky-400/30",
};

function getElementClasses(dominantColor) {
  if (!dominantColor) return "border-white/20 bg-white/10";

  const colorClass =
    ELEMENT_COLORS[dominantColor] || "border-white/20 bg-white/10";
  return `${colorClass}`;
}

/**
 * Compute simple polar coordinates for each user to place them in a "galaxy" circle.
 * Returns an array of { user, x, y } where x & y are percentages (0–100).
 */
function useGalaxyPositions(users) {
  return useMemo(() => {
    const count = users.length || 1;
    const radiusBase = 25; // base radius in percentage
    const radiusStep = 12;

    return users.map((user, index) => {
      const angle = (index / count) * Math.PI * 2;
      const layer = index % 3;
      const radius = radiusBase + layer * radiusStep;

      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;

      return {
        user,
        x,
        y,
      };
    });
  }, [users]);
}

function PlayerDetailPanel({
  user,
  status,
  onConnect,
  hobbyProfile,
  loadingHobby,
}) {
  if (!user) {
    return (
      <div className="card-spotbulle-dark p-6 text-slate-100">
        <h3 className="text-lg font-semibold mb-2">Choisis une étoile ✨</h3>
        <p className="text-sm text-slate-300">
          Survole ou clique sur une planète pour découvrir le profil d&apos;un
          joueur, ses forces et lance une première connexion.
        </p>
      </div>
    );
  }

  const elementClass = getElementClasses(user.dominant_color);
  const avatarSrc = user.avatar_url
    ? user.avatar_url.startsWith("http")
      ? user.avatar_url
      : getPublicUrl(user.avatar_url, "avatars") ||
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=200&h=200&fit=crop&crop=faces"
    : "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=200&h=200&fit=crop&crop=faces";

  return (
    <div className="card-spotbulle-dark p-6 text-slate-100 space-y-4">
      <div className="flex items-center gap-4">
        <div
          className={`
            w-16 h-16 rounded-full overflow-hidden border-2 ${elementClass} flex-shrink-0
          `}
        >
          <img
            src={avatarSrc}
            alt={user.full_name || "Joueur"}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h3 className="text-xl font-semibold">
            {user.full_name || "Joueur mystérieux"}
          </h3>
          {user.location && (
            <p className="text-sm text-slate-300">📍 {user.location}</p>
          )}
          {user.football_interest && (
            <p className="text-sm text-teal-300 mt-1">
              ⚽ Passionné de football
            </p>
          )}
        </div>
      </div>

      {user.passions && user.passions.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">❤️ Ses passions</p>
          <div className="flex flex-wrap gap-1">
            {user.passions.slice(0, 3).map((p, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-1 rounded-full text-[11px] bg-slate-800/80 text-slate-100"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Football hobby profile (half card) + connect CTA below */}
      <div className="mt-4 space-y-3">
        <div>
          {loadingHobby && (
            <p className="text-xs text-slate-300">
              Chargement du profil football...
            </p>
          )}
          {!loadingHobby && hobbyProfile && (
            <div className="mt-1 rounded-xl border-[3px] border-teal-500/80 p-3 bg-slate-900/60 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-300">
                    Football - Rôle idéal
                  </p>
                  <p className="text-sm font-semibold text-slate-50 truncate">
                    {hobbyProfile.recommended_role ||
                      "Profil en cours de calcul"}
                  </p>
                </div>
                <div className="shrink-0">
                  <RadarChartFourElements
                    dominantColor={hobbyProfile.dominant_color}
                    secondaryColor={hobbyProfile.secondary_color}
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-200 space-y-1">
                {hobbyProfile.favoritePlayer && (
                  <p>
                    Joueur préféré :{" "}
                    <span className="font-semibold">
                      {hobbyProfile.favoritePlayer}
                    </span>
                  </p>
                )}
                {hobbyProfile.favoriteTeam && (
                  <p>
                    Équipe préférée :{" "}
                    <span className="font-semibold">
                      {hobbyProfile.favoriteTeam}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-1">
          {status === "can_connect" && (
            <Button
              onClick={() => onConnect(user.id)}
              className="w-full bg-teal-500 hover:bg-teal-400 text-white"
            >
              🤝 Se connecter
            </Button>
          )}
          {status === "pending_or_friend" && (
            <Button
              disabled
              className="w-full bg-gray-300 text-gray-600 cursor-not-allowed"
            >
              ✅ Demande envoyée / déjà ami
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GalacticMap({ user, profile, onSignOut }) {
  const supabase = useSupabaseClient();
  const currentUser = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, error } = useDirectoryUsers("all", "");
  const { data: existingConnections = new Set(), refetch: refetchConnections } =
    useExistingConnections();

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserHobby, setSelectedUserHobby] = useState(null);
  const [loadingHobby, setLoadingHobby] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("map"); // "map" | "connections" | "messages"
  const [activeSubTab, setActiveSubTab] = useState("incoming"); // "incoming" | "outgoing" | "friends"
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const realtimeChannelRef = useRef(null);
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
    data: threads = [],
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
        return rows.map((r) => ({ ...r, other: null }));
      }

      const byId = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      return rows.map((r) => ({
        ...r,
        other: byId[r.user_id_1 === currentUser.id ? r.user_id_2 : r.user_id_1] || null,
      }));
    },
  });

  const {
    data: threadMessages = [],
    isLoading: loadingMessages,
    refetch: refetchThreadMessages,
  } = useQuery({
    queryKey: ["direct-messages", selectedThreadId],
    enabled: !!selectedThreadId,
    queryFn: async () => {
      if (!selectedThreadId) return [];
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
            Messages ({threads.length})
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
          {/* Filtres & légende */}
          <div className="card-spotbulle-dark p-4 space-y-4">
            <h2 className="text-lg font-french font-bold text-white">
              🔍 Explorer les joueurs
            </h2>
            <p className="text-xs text-slate-300">
              Utilise les filtres pour explorer la galaxie.
            </p>

            {/* Filtres */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Filtres
              </p>
              <div className="space-y-2">
                {/* Élément */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[11px] text-slate-400 mr-1">
                    Élément :
                  </span>
                  {[
                    { key: null, label: "Tous" },
                    { key: "rouge", label: "Feu" },
                    { key: "jaune", label: "Air" },
                    { key: "vert", label: "Terre" },
                    { key: "bleu", label: "Eau" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      className={`px-2 py-1 rounded-full text-[11px] border ${
                        elementFilter === opt.key
                          ? "bg-teal-500 text-white border-teal-400"
                          : "bg-slate-800/80 text-slate-200 border-slate-600"
                      }`}
                      onClick={() =>
                        setElementFilter((current) =>
                          current === opt.key ? null : opt.key,
                        )
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Club */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[11px] text-slate-400 mr-1">
                    Club :
                  </span>
                  <button
                    type="button"
                    className={`px-2 py-1 rounded-full text-[11px] border ${
                      hasClubFilter
                        ? "bg-teal-500 text-white border-teal-400"
                        : "bg-slate-800/80 text-slate-200 border-slate-600"
                    }`}
                    onClick={() => setHasClubFilter((v) => !v)}
                  >
                    {hasClubFilter ? "Avec club uniquement" : "Tous les joueurs"}
                  </button>
                </div>
              </div>
            </div>

            {/* Légende */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Légende
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1 text-red-300">
                  <span className="w-3 h-3 rounded-full bg-red-500/60 border border-red-400" />
                  Feu
                </span>
                <span className="flex items-center gap-1 text-yellow-300">
                  <span className="w-3 h-3 rounded-full bg-yellow-400/60 border border-yellow-400" />
                  Air
                </span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <span className="w-3 h-3 rounded-full bg-emerald-400/60 border border-emerald-400" />
                  Terre
                </span>
                <span className="flex items-center gap-1 text-sky-300">
                  <span className="w-3 h-3 rounded-full bg-sky-400/60 border border-sky-400" />
                  Eau
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Les couleurs représentent l&apos;énergie principale (Feu, Air,
                Terre, Eau). Clique sur une étoile pour voir son profil.
              </p>
            </div>
          </div>

        {/* Carte galactique */}
        <div className="relative">
          <div className="relative w-full h-[480px] sm:h-[560px] bg-slate-950/50 border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(15,23,42,0.8)]">
            {/* Fond "galaxie" simple */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
            <div className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none">
              <div className="absolute w-64 h-64 rounded-full bg-teal-500/20 blur-3xl -top-10 -left-10" />
              <div className="absolute w-72 h-72 rounded-full bg-sky-500/15 blur-3xl top-1/2 -right-16" />
              <div className="absolute w-56 h-56 rounded-full bg-indigo-500/15 blur-3xl bottom-0 -left-8" />
            </div>

            {/* Nodes */}
            <div className="relative w-full h-full">
              {positionedUsers.map(({ user: u, x, y }) => {
                const isSelected = selectedUserId === u.id;
                const elementClass = getElementClasses(u.dominant_color);
                const avatarSrc = u.avatar_url
                  ? u.avatar_url.startsWith("http")
                    ? u.avatar_url
                    : getPublicUrl(u.avatar_url, "avatars")
                  : null;
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`
                      absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1
                      transition-transform duration-300
                      ${isSelected ? "scale-125" : "hover:scale-110"}
                    `}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                    }}
                    onClick={() => setSelectedUserId(u.id)}
                    aria-label={u.full_name || "Joueur"}
                  >
                    <div
                      className={`
                        w-12 h-12 rounded-full border-2 ${elementClass} 
                        flex items-center justify-center overflow-hidden
                        shadow-[0_0_10px_rgba(148,163,184,0.6)]
                      `}
                    >
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={u.full_name || "Joueur"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-100 font-semibold">
                          {u.full_name
                            ? u.full_name.charAt(0).toUpperCase()
                            : "?"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Message si aucun joueur */}
              {!positionedUsers.length && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-200 px-4">
                    <p className="text-lg font-semibold mb-2">
                      Aucun joueur à afficher pour le moment
                    </p>
                    <p className="text-sm text-slate-300">
                      Participe à l&apos;Odyssée de Lumi pour découvrir la
                      galaxie des talents !
                    </p>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-slate-200">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-400 border-t-transparent" />
                    <p>Chargement de la carte galactique...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

          {/* Panneau de détail joueur */}
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
        <div className="max-w-3xl mx-auto space-y-4">
          {loadingRequests ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-3 text-slate-200">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />
                <span>Chargement de tes demandes reçues...</span>
              </div>
            </div>
          ) : requests.incoming.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n&apos;as pas encore de demandes d&apos;amis en attente.
            </p>
          ) : (
            requests.incoming.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-700 bg-slate-900/80"
              >
                <div className="flex items-center gap-3">
                  <Avatar profile={req.profile} size={48} />
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {req.profile?.full_name || "Utilisateur"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {req.profile?.location || "Localisation non précisée"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Demande reçue le{" "}
                      {new Date(req.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => handleAcceptRequest(req)}
                    disabled={acceptMutation.isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-sm"
                  >
                    Accepter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRejectRequest(req)}
                    disabled={deleteMutation.isLoading}
                    className="border-slate-600 text-slate-200 hover:bg-slate-800 px-3 py-2 text-sm"
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeMainTab === "connections" && activeSubTab === "outgoing" && (
        <div className="max-w-3xl mx-auto space-y-4">
          {loadingRequests ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-3 text-slate-200">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />
                <span>Chargement de tes demandes envoyées...</span>
              </div>
            </div>
          ) : requests.outgoing.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n&apos;as pas encore envoyé de demande d&apos;ami.
            </p>
          ) : (
            requests.outgoing.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-700 bg-slate-900/80"
              >
                <div className="flex items-center gap-3">
                  <Avatar profile={req.profile} size={48} />
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {req.profile?.full_name || "Utilisateur"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {req.profile?.location || "Localisation non précisée"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Demande envoyée le{" "}
                      {new Date(req.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => handleCancelOutgoing(req)}
                    disabled={deleteMutation.isLoading}
                    className="border-slate-600 text-slate-200 hover:bg-slate-800 px-3 py-2 text-sm"
                  >
                    Annuler la demande
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeMainTab === "connections" && activeSubTab === "friends" && (
        <div className="max-w-3xl mx-auto space-y-4">
          {loadingFriends ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-3 text-slate-200">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />
                <span>Chargement de tes amis...</span>
              </div>
            </div>
          ) : friends.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n&apos;as pas encore d&apos;amis dans le réseau.
            </p>
          ) : (
            friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-700 bg-slate-900/80"
              >
                <div className="flex items-center gap-3">
                  <Avatar profile={f} size={48} />
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {f.full_name || "Utilisateur"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {f.location || "Localisation non précisée"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => openOrCreateThread(f.id)}
                  disabled={openOrCreateThreadMutation.isLoading}
                  className="border-teal-600 text-teal-200 hover:bg-teal-900/50 px-3 py-2 text-sm"
                >
                  Ouvrir le chat
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {activeMainTab === "messages" && (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 min-h-[420px] border border-slate-700 rounded-lg overflow-hidden bg-slate-900/80">
          {/* Thread list */}
          <div className="border-r border-slate-700 flex flex-col bg-slate-900/90">
            <h3 className="p-3 text-sm font-semibold text-slate-200 border-b border-slate-700">
              Conversations
            </h3>
            {loadingThreads ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
              </div>
            ) : threads.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">
                Aucune conversation. Ouvre un chat depuis l’onglet Amis.
              </p>
            ) : (
              <ul className="overflow-y-auto flex-1">
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedThreadId(t.id)}
                      className={`w-full flex items-center gap-3 p-3 text-left border-b border-slate-700/80 ${
                        selectedThreadId === t.id
                          ? "bg-teal-900/50 text-white"
                          : "text-slate-200 hover:bg-slate-800/80"
                      }`}
                    >
                      <Avatar profile={t.other} size={40} />
                      <span className="text-sm font-medium truncate">
                        {t.other?.full_name || "Utilisateur"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Chat area */}
          <div className="flex flex-col min-h-0">
            {!selectedThreadId ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-6">
                Choisis une conversation ou ouvre un chat depuis l’onglet Amis.
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMessages ? (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />
                    </div>
                  ) : (
                    threadMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.sender_id === currentUser?.id
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            msg.sender_id === currentUser?.id
                              ? "bg-teal-600 text-white"
                              : "bg-slate-700 text-slate-100"
                          }`}
                        >
                          {msg.content}
                          <div className="text-[10px] opacity-80 mt-1">
                            {new Date(msg.created_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-slate-700 flex gap-2">
                  <Textarea
                    placeholder="Écris ton message..."
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="min-h-[44px] max-h-32 resize-none bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                    rows={2}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={
                      !(messageDraft || "").trim() ||
                      sendMessageMutation.isLoading
                    }
                    className="self-end bg-teal-600 hover:bg-teal-700 text-white px-4"
                  >
                    Envoyer
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </OdysseyLayout>
  );
}
