// src/pages/galactic-map.jsx
// "La carte galactique" - visual map of the community

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "sonner";

import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button-enhanced.jsx";
import { useDirectoryUsers, useExistingConnections } from "../hooks/useDirectory.js";
import { getPublicUrl } from "../lib/storageUtils.js";

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

  const colorClass = ELEMENT_COLORS[dominantColor] || "border-white/20 bg-white/10";
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

function PlayerDetailPanel({ user, status, onConnect }) {
  if (!user) {
    return (
      <div className="card-spotbulle-dark p-6 text-slate-100">
        <h3 className="text-lg font-semibold mb-2">Choisis une étoile ✨</h3>
        <p className="text-sm text-slate-300">
          Survole ou clique sur une planète pour découvrir le profil d&apos;un joueur, ses forces et lance une
          première connexion.
        </p>
      </div>
    );
  }

  const elementClass = getElementClasses(user.dominant_color);
  const avatarSrc = user.avatar_url
    ? (user.avatar_url.startsWith("http")
        ? user.avatar_url
        : getPublicUrl(user.avatar_url, "avatars") ||
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=200&h=200&fit=crop&crop=faces")
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
          <h3 className="text-xl font-semibold">{user.full_name || "Joueur mystérieux"}</h3>
          {user.location && (
            <p className="text-sm text-slate-300">📍 {user.location}</p>
          )}
          {user.football_interest && (
            <p className="text-sm text-teal-300 mt-1">⚽ Passionné de football</p>
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

      <div className="pt-2">
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
  );
}

export default function GalacticMap({ user, profile, onSignOut }) {
  const supabase = useSupabaseClient();
  const currentUser = useUser();
  const navigate = useNavigate();

  const { data: users = [], isLoading, error } = useDirectoryUsers("all", "");
  const {
    data: existingConnections = new Set(),
    refetch: refetchConnections,
  } = useExistingConnections();

  const [selectedUserId, setSelectedUserId] = useState(null);

  const positionedUsers = useGalaxyPositions(users);

  const getConnectionStatus = (targetUserId) => {
    if (!currentUser) return "not_connected";
    if (existingConnections.has(targetUserId)) return "pending_or_friend";
    return "can_connect";
  };

  const handleConnect = async (targetUserId) => {
    if (!currentUser) {
      toast.error("Veuillez vous connecter pour te connecter à d'autres joueurs.");
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

      toast.success(
        `Demande d'ami envoyée à ${
          targetUser?.full_name || "ce joueur"
        } !`
      );
    } catch (err) {
      console.error("❌ Erreur handleConnect:", err);
      toast.error("Une erreur est survenue lors de l'envoi de la demande.");
    }
  };

  const selectedUser = positionedUsers.find(
    (item) => item.user.id === selectedUserId
  )?.user;

  return (
    <OdysseyLayout
      currentStep={5}
      title="La carte galactique"
      subtitle="Explore la galaxie des talents, découvre des joueurs et crée tes premières connexions."
      maxWidthClass="max-w-6xl"
      onSignOut={onSignOut}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1.5fr)_320px] gap-6 items-start">
        {/* Filtres & légende */}
        <div className="card-spotbulle-dark p-4 space-y-4">
          <h2 className="text-lg font-french font-bold text-white">
            🔍 Explorer les joueurs
          </h2>
          <p className="text-xs text-slate-300">
            Utilise les filtres pour découvrir des joueurs qui te ressemblent.
          </p>

          {/* Placeholder filters for now */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Filtres (à venir)
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-full bg-slate-800/80 text-slate-300 text-xs">
                Position
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-800/80 text-slate-300 text-xs">
                Élément
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-800/80 text-slate-300 text-xs">
                Club
              </span>
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
                const avatarSrc =
                  u.avatar_url
                    ? (u.avatar_url.startsWith("http")
                        ? u.avatar_url
                        : getPublicUrl(u.avatar_url, "avatars"))
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
          status={selectedUser ? getConnectionStatus(selectedUser.id) : "can_connect"}
          onConnect={handleConnect}
        />
      </div>
    </OdysseyLayout>
  );
}

