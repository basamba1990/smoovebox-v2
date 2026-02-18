import React from "react";
import { Button } from "../ui/button-enhanced.jsx";
import ProfileAvatar from "./ProfileAvatar.jsx";

/**
 * List of outgoing friend requests with Cancel.
 */
function ConnectionsOutgoing({
  requests,
  loading,
  onCancel,
  deleteLoading,
}) {
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-center py-10">
          <div className="flex items-center gap-3 text-slate-200">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />
            <span>Chargement de tes demandes envoyées...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!requests?.length) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-slate-400">
          Tu n&apos;as pas encore envoyé de demande d&apos;ami.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {requests.map((req) => (
        <div
          key={req.id}
          className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-700 bg-slate-900/80"
        >
          <div className="flex items-center gap-3">
            <ProfileAvatar profile={req.profile} size={48} />
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
              onClick={() => onCancel(req)}
              disabled={deleteLoading}
              className="border-slate-600 text-slate-200 hover:bg-slate-800 px-3 py-2 text-sm"
            >
              Annuler la demande
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ConnectionsOutgoing;
