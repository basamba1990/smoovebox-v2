import React from "react";
import ProfileAvatar from "./ProfileAvatar.jsx";

/**
 * List of conversation threads. Clicking a thread calls onSelectThread(thread).
 * unreadCountByThreadId: { [threadId]: number } for badge.
 */
function DirectMessageThreadList({
  threads,
  loading,
  onSelectThread,
  unreadCountByThreadId = {},
}) {
  return (
    <div className="card-spotbulle-dark overflow-hidden">
      <h3 className="p-4 text-base font-french font-bold text-white border-b border-slate-700">
        Conversations
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
        </div>
      ) : !threads?.length ? (
        <div className="p-8 text-center">
          <p className="text-slate-400 text-sm mb-2">Aucune conversation.</p>
          <p className="text-slate-500 text-xs">
            Ouvre un chat depuis l’onglet Connexions → Amis.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-700">
          {threads.map((t) => {
            const unread = unreadCountByThreadId[t.id] || 0;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelectThread(t.id)}
                  className="w-full flex items-center gap-3 p-4 text-left text-slate-200 hover:bg-slate-800/60 transition-colors"
                >
                  <ProfileAvatar profile={t.other} size={48} />
                  <span className="text-sm font-medium truncate flex-1 min-w-0">
                    {t.other?.full_name || "Utilisateur"}
                  </span>
                  {unread > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-medium bg-rose-500 text-white">
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

export default DirectMessageThreadList;
