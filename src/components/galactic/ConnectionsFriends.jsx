import React from "react";
import { Button } from "../ui/button-enhanced.jsx";
import ProfileAvatar from "./ProfileAvatar.jsx";

/**
 * List of friends with "Ouvrir le chat" action.
 */
function ConnectionsFriends({
  friends,
  loading,
  onOpenChat,
  openChatLoading,
}) {
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-center py-10">
          <div className="flex items-center gap-3 text-slate-200">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />
            <span>Chargement de tes amis...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!friends?.length) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-slate-400">
          Tu n&apos;as pas encore d&apos;amis dans le réseau.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {friends.map((f) => (
        <div
          key={f.id}
          className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-700 bg-slate-900/80"
        >
          <div className="flex items-center gap-3">
            <ProfileAvatar profile={f} size={48} />
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
            onClick={() => onOpenChat(f.id)}
            disabled={openChatLoading}
            className="border-teal-600 text-teal-200 hover:bg-teal-900/50 px-3 py-2 text-sm"
          >
            Ouvrir le chat
          </Button>
        </div>
      ))}
    </div>
  );
}

export default ConnectionsFriends;
