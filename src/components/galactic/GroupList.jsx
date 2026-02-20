import React, { useState } from "react";

/**
 * List of groups the user belongs to, with "Créer un groupe" and create form.
 * unreadCountByGroupId: { [groupId]: number } for badge.
 */
function GroupList({
  groups,
  loading,
  onSelectGroup,
  onCreateGroup,
  createLoading,
  unreadCountByGroupId = {},
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const handleCreate = () => {
    const name = (newGroupName || "").trim();
    if (!name || createLoading) return;
    onCreateGroup(name, () => {
      setNewGroupName("");
      setShowCreate(false);
    });
  };

  return (
    <div className="card-spotbulle-dark overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-base font-french font-bold text-white">Groupes</h3>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="text-sm font-medium text-teal-400 hover:text-teal-300"
        >
          Créer un groupe
        </button>
      </div>

      {showCreate && (
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex flex-col gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Nom du groupe"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!(newGroupName || "").trim() || createLoading}
              className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50"
            >
              {createLoading ? "Création…" : "Créer"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewGroupName(""); }}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
        </div>
      ) : !groups?.length ? (
        <div className="p-8 text-center">
          <p className="text-slate-400 text-sm mb-2">Aucun groupe.</p>
          <p className="text-slate-500 text-xs">
            Crée un groupe ou rejoins-en un pour discuter à plusieurs.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-700">
          {groups.map((g) => {
            const unread = unreadCountByGroupId[g.id] || 0;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onSelectGroup(g.id)}
                  className="w-full flex items-center gap-3 p-4 text-left text-slate-200 hover:bg-slate-800/60 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm font-medium shrink-0">
                    {g.name?.charAt(0)?.toUpperCase() || "G"}
                  </div>
                  <span className="text-sm font-medium truncate flex-1 min-w-0">
                    {g.name || "Sans nom"}
                  </span>
                  {unread > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-medium bg-rose-500 text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default GroupList;
