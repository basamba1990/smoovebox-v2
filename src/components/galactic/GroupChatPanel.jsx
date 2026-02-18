import React from "react";
import { Button } from "../ui/button-enhanced.jsx";
import { Textarea } from "../ui/textarea.jsx";

/**
 * Group chat view: header (back + group name), messages with sender name, input.
 */
function GroupChatPanel({
  groupId,
  groupName,
  messages,
  loadingMessages,
  currentUserId,
  senderProfiles = {},
  messageDraft,
  onMessageDraftChange,
  onSendMessage,
  sendLoading,
  onBack,
  className = "",
  containerHeight = "520px",
  memberCount,
  isOwner,
}) {
  const getSenderName = (senderId) => {
    if (senderId === currentUserId) return "Toi";
    const p = senderProfiles[senderId];
    return p?.full_name || "Utilisateur";
  };

  return (
    <div
      className={`card-spotbulle-dark flex flex-col ${className}`}
      style={{ height: containerHeight }}
    >
      <div className="flex items-center gap-3 p-3 border-b border-slate-700 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors"
          aria-label="Retour aux groupes"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {groupName || "Groupe"}
            </p>
            {typeof memberCount === "number" && (
              <p className="text-[11px] text-slate-400">
                {memberCount} membre{memberCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
          {isOwner && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/40">
              Admin
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loadingMessages ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />
          </div>
        ) : (
          (messages || []).map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender_id === currentUserId ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.sender_id === currentUserId
                    ? "bg-teal-600 text-white"
                    : "bg-slate-700 text-slate-100"
                }`}
              >
                {msg.sender_id !== currentUserId && (
                  <div className="text-[10px] text-teal-300/90 mb-0.5">
                    {getSenderName(msg.sender_id)}
                  </div>
                )}
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

      <div className="p-3 border-t border-slate-700 flex gap-2 shrink-0">
        <Textarea
          placeholder="Écris un message..."
          value={messageDraft}
          onChange={(e) => onMessageDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
          className="min-h-[44px] max-h-32 resize-none bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
          rows={2}
        />
        <Button
          onClick={onSendMessage}
          disabled={!(messageDraft || "").trim() || sendLoading}
          className="self-end bg-teal-600 hover:bg-teal-700 text-white px-4"
        >
          Envoyer
        </Button>
      </div>
    </div>
  );
}

export default GroupChatPanel;
