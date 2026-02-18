import React from "react";
import { getPublicUrl } from "../../lib/storageUtils.js";
import { getElementClasses } from "./galacticUtils.js";

/**
 * Galaxy map canvas: positions users as nodes in a circle.
 * Reusable: pass positionedUsers (array of { user, x, y }), selectedUserId, onSelectUser.
 */
function GalaxyMap({
  positionedUsers,
  selectedUserId,
  onSelectUser,
  isLoading,
}) {
  return (
    <div className="relative">
      <div className="relative w-full h-[480px] sm:h-[560px] bg-slate-950/50 border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(15,23,42,0.8)]">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
        <div className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none">
          <div className="absolute w-64 h-64 rounded-full bg-teal-500/20 blur-3xl -top-10 -left-10" />
          <div className="absolute w-72 h-72 rounded-full bg-sky-500/15 blur-3xl top-1/2 -right-16" />
          <div className="absolute w-56 h-56 rounded-full bg-indigo-500/15 blur-3xl bottom-0 -left-8" />
        </div>

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
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => onSelectUser(u.id)}
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

          {!positionedUsers.length && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-200 px-4">
                <p className="text-lg font-semibold mb-2">
                  Aucun joueur à afficher pour le moment
                </p>
                <p className="text-sm text-slate-300">
                  Participe à l&apos;Odyssée de Lumi pour découvrir la galaxie
                  des talents !
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
  );
}

export default GalaxyMap;
