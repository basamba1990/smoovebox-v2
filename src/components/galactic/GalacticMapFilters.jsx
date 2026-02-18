import React from "react";

/**
 * Filters + legend for the galactic map (Élément, Club).
 * Controlled: elementFilter and hasClubFilter are passed from parent.
 */
function GalacticMapFilters({
  elementFilter,
  onElementFilterClick,
  hasClubFilter,
  onClubFilterToggle,
}) {
  return (
    <div className="card-spotbulle-dark p-4 space-y-4">
      <h2 className="text-lg font-french font-bold text-white">
        🔍 Explorer les joueurs
      </h2>
      <p className="text-xs text-slate-300">
        Utilise les filtres pour explorer la galaxie.
      </p>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Filtres
        </p>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[11px] text-slate-400 mr-1">Élément :</span>
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
                onClick={() => onElementFilterClick(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[11px] text-slate-400 mr-1">Club :</span>
            <button
              type="button"
              className={`px-2 py-1 rounded-full text-[11px] border ${
                hasClubFilter
                  ? "bg-teal-500 text-white border-teal-400"
                  : "bg-slate-800/80 text-slate-200 border-slate-600"
              }`}
              onClick={() => onClubFilterToggle()}
            >
              {hasClubFilter ? "Avec club uniquement" : "Tous les joueurs"}
            </button>
          </div>
        </div>
      </div>

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
  );
}

export default GalacticMapFilters;
