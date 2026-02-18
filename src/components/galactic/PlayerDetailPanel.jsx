import React from "react";
import { getPublicUrl } from "../../lib/storageUtils.js";
import { getElementClasses } from "./galacticUtils.js";
import RadarChartFourElements from "./RadarChartFourElements.jsx";
import { Button } from "../ui/button-enhanced.jsx";

/**
 * Right-hand panel showing selected player profile + Football hobby card + connect CTA.
 * Reusable for any “selected user” detail view in the galactic map.
 */
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
            w-16 h-16 rounded-full overflow-hidden border-2 ${elementClass} shrink-0
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

export default PlayerDetailPanel;
