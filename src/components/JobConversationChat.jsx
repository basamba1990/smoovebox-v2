// src/components/JobConversationChat.jsx
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";

/**
 * Reusable chat panel for a single job conversation thread.
 *
 * Props:
 * - conversation: job_conversations row (must include job_title, sectors, reason, user_description, messages)
 * - messageInput: current input string
 * - onMessageChange: (value: string) => void
 * - onSend: () => void
 * - sending: boolean (loading state)
 * - onClose: () => void
 * - expanded: boolean
 * - onToggleExpand: () => void
 * - onReset?: () => void
 * - onDelete?: () => void
 */
export function JobConversationChat({
  conversation,
  messageInput,
  onMessageChange,
  onSend,
  sending,
  onClose,
  expanded = false,
  onToggleExpand,
  onReset,
  onDelete,
}) {
  if (!conversation) return null;

  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : [];

  return (
    <Card className="bg-slate-900 border-slate-800 shadow-xl flex flex-col h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-sm">
            <span className="font-semibold text-white">
              {conversation.job_title}
            </span>
          </CardTitle>
          {conversation.sectors && conversation.sectors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {conversation.sectors.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-200 text-[10px] border border-cyan-500/40"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onToggleExpand && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              onClick={onToggleExpand}
              title={expanded ? "Réduire" : "Plein écran"}
            >
              <span className="text-xs leading-none">&lt;&gt;</span>
            </Button>
          )}
          {onReset && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              onClick={onReset}
              title="Réinitialiser la discussion"
            >
              <span className="text-xs leading-none">↺</span>
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-400 hover:text-red-100 hover:bg-red-900/40"
              onClick={onDelete}
              title="Supprimer ce métier"
            >
              <span className="text-xs leading-none">🗑</span>
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            onClick={onClose}
          >
            <span className="text-lg leading-none">×</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 overflow-y-auto">
        {conversation.reason && (
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-slate-100">
              Pourquoi Lumi t&apos;a proposé ce métier
            </p>
            <p>{conversation.reason}</p>
          </div>
        )}

        {conversation.user_description && (
          <div className="text-xs text-slate-300 space-y-1 border-t border-slate-800 pt-2">
            <p className="font-semibold text-slate-100">Ce que tu as partagé</p>
            <p>{conversation.user_description}</p>
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-2 border-t border-slate-800 pt-2">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={
                  msg.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-3 py-2 text-xs " +
                    (msg.role === "user"
                      ? "bg-cyan-600 text-slate-950"
                      : "bg-slate-800 text-slate-100")
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <div className="border-t border-slate-800 px-4 py-3 flex items-center gap-2">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="Pose une question à Lumi sur ce métier..."
          className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs"
          onClick={onSend}
          disabled={sending || !messageInput.trim()}
        >
          {sending ? "Envoi..." : "Envoyer"}
        </Button>
      </div>
    </Card>
  );
}
