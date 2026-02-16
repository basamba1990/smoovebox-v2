import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button-enhanced.jsx";
import { Textarea } from "../ui/textarea.jsx";

/**
 * Embedded chat panel for the football assistant agent.
 * Reuses the behaviour of FootballChatModal but fits inside the Messages tab.
 */
function FootballAgentChatPanel({ onBack, height = 520 }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage("");
    setLoading(true);

    // Add user message to local chat history
    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);

    try {
      const { data, error } = await supabase.functions.invoke("football-chat", {
        body: {
          message: userMessage,
          history: messages,
        },
      });

      if (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Erreur: ${error.message}`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data?.response ||
              "Désolé, je n'ai pas pu générer de réponse pour le moment.",
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Erreur: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div
      className="card-spotbulle-dark flex flex-col"
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-3 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors"
            aria-label="Retour aux conversations"
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
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              Assistant Football
            </span>
            <span className="text-[11px] text-slate-400">
              Pose tes questions tactiques, techniques ou analyste.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Effacer
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <h4 className="text-sm font-semibold text-white mb-1">
              Bienvenue dans le vestiaire de Lumi ⚽
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Tu peux lui demander des conseils sur ton poste, des idées
              d&apos;exercices, ou une analyse de ton style de jeu.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-200">
              <div className="bg-slate-800/70 rounded-lg p-2">
                <div className="font-semibold text-teal-300">
                  Idées d&apos;entraînement
                </div>
                <div className="text-[10px] text-slate-400">
                  « Donne-moi 3 exercices pour progresser en finition »
                </div>
              </div>
              <div className="bg-slate-800/70 rounded-lg p-2">
                <div className="font-semibold text-sky-300">
                  Rôle & positionnement
                </div>
                <div className="text-[10px] text-slate-400">
                  « Comment jouer un ailier dans un 4-3-3 ? »
                </div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-700 text-slate-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" />
                <span
                  className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"
                  style={{ animationDelay: "0.12s" }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"
                  style={{ animationDelay: "0.24s" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-700 flex gap-2 shrink-0">
        <Textarea
          placeholder="Pose ta question sur le football..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[44px] max-h-32 resize-none bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
          rows={2}
        />
        <Button
          type="button"
          onClick={sendMessage}
          disabled={loading || !message.trim()}
          className="self-end bg-teal-600 hover:bg-teal-700 text-white px-4"
        >
          Envoyer
        </Button>
      </div>
    </div>
  );
}

export default FootballAgentChatPanel;

