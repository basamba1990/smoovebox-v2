// src/components/FutureJobsGptPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import { supabase } from "../lib/supabase.js";

import { Button } from "./ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card.jsx";
import { JobConversationChat } from "./JobConversationChat.jsx";

const TRACK_OPTIONS = [
  "Filière Informatique & Numérique",
  "Filière Sport & Santé",
  "Filière Commerce & Marketing",
  "Filière Finance & Comptabilité",
  "Filière Industrie & Production",
  "Filière Logistique & Transport",
  "Filière Hôtellerie, Tourisme & Restauration",
  "Filière BTP & Architecture",
  "Filière Communication, Design & Création",
  "Filière Juridique & Administratif",
  "Filière Agriculture & Environnement",
  "Filière Éducation & Formation",
];

export default function FutureJobsGptPanel({
  user: userProp,
  symbolicProfile = null,
  lumiProfile = null,
  videoAnalysis = null,
  inline = false,
  disabled = false,
}) {
  const userFromHook = useUser();
  const user = userProp ?? userFromHook;

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState(null);

  const [selectedTracks, setSelectedTracks] = useState([]);
  const [userDescription, setUserDescription] = useState("");

  // 'askTracks' | 'chooseTracks' | 'askDescription' | 'typingDescription' | 'generating' | 'done'
  const [chatStep, setChatStep] = useState("askTracks");

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  const [jobConversations, setJobConversations] = useState([]);
  const [isJobListOpen, setIsJobListOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isJobChatExpanded, setIsJobChatExpanded] = useState(false);

  const [creatingConversationId, setCreatingConversationId] = useState(null);

  const [jobMessageInput, setJobMessageInput] = useState("");
  const [jobMessageSending, setJobMessageSending] = useState(false);

  const canUse = useMemo(() => !!user?.id && !disabled, [user?.id, disabled]);

  const uiMode = inline ? "inline" : "floating";
  const isInline = uiMode === "inline";
  const isLight = isInline;

  const bubbleClass = isLight
    ? "bg-white border border-slate-200 text-slate-800"
    : "bg-slate-800 text-slate-100";
  const mutedTextClass = isLight ? "text-slate-600" : "text-slate-400";
  const outlineBtnClass = isLight
    ? "border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-sm"
    : "border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm";
  const trackBtnUnselectedClass = isLight
    ? "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50"
    : "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500";
  const textareaClass = isLight
    ? "w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
    : "w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500";

  useEffect(() => {
    let cancelled = false;
    const loadJobConversations = async () => {
      if (!canUse) return;
      try {
        const { data, error } = await supabase
          .from("job_conversations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error(
            "[FutureJobsGptPanel] Error fetching job_conversations:",
            error
          );
          return;
        }
        if (!cancelled) setJobConversations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(
          "[FutureJobsGptPanel] Exception fetching job_conversations:",
          err
        );
      }
    };

    loadJobConversations();
    return () => {
      cancelled = true;
    };
  }, [canUse, user?.id]);

  const buildUnifiedPayload = () => ({
    symbolic_profile: symbolicProfile
      ? {
          archetype: symbolicProfile.archetype,
          phrase_synchronie: symbolicProfile.phrase_synchronie,
          element: symbolicProfile.element,
          profile_text: symbolicProfile.profile_text,
        }
      : null,
    lumi_profile: lumiProfile
      ? {
          dominant_color: lumiProfile.dominant_color,
          secondary_color: lumiProfile.secondary_color,
          disc_scores: lumiProfile.disc_scores,
          traits: lumiProfile.traits,
        }
      : null,
    video_analysis: videoAnalysis
      ? {
          summary: videoAnalysis.analysis?.summary,
          ai_score: videoAnalysis.analysis?.ai_score,
          metadata: videoAnalysis.analysis?.metadata,
        }
      : null,
    extra_preferences: {
      sectors: selectedTracks?.length ? selectedTracks : null,
      description: userDescription?.trim() || null,
    },
    language: "fr",
  });

  const handleRestartChat = () => {
    setSelectedTracks([]);
    setUserDescription("");
    setJobs([]);
    setJobsError(null);
    setChatStep("askTracks");
  };

  const handleGenerateJobs = async () => {
    if (!canUse) return;
    setChatStep("generating");
    setJobsError(null);
    setJobs([]);
    setJobsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "lumi-gpt-future-jobs",
        { body: buildUnifiedPayload() }
      );

      if (error) {
        console.error("[FutureJobsGptPanel] Error calling GPT jobs:", error);
        setJobsError(
          error.message || "Erreur lors de l'appel à l'IA pour les métiers."
        );
        setChatStep("done");
        return;
      }

      if (!data?.success || !Array.isArray(data.jobs)) {
        console.error("[FutureJobsGptPanel] Invalid GPT jobs response:", data);
        setJobsError(
          "La réponse de l'IA n'a pas le format attendu. Réessaie plus tard."
        );
        setChatStep("done");
        return;
      }

      setJobs(data.jobs);
      setChatStep("done");
    } catch (err) {
      console.error("[FutureJobsGptPanel] Exception calling GPT jobs:", err);
      setJobsError(err?.message || "Erreur inattendue lors de l'appel à l'IA.");
      setChatStep("done");
    } finally {
      setJobsLoading(false);
    }
  };

  const handleStartJobConversation = async (job, index) => {
    if (!canUse) return;
    try {
      setCreatingConversationId(index);
      const { data, error } = await supabase.functions.invoke(
        "lumi-create-job-conversation",
        {
          body: {
            job_title: job.title,
            job_description: job.why_fit || "",
            reason: job.why_fit || "",
            sectors: selectedTracks?.length ? selectedTracks : null,
            user_description: userDescription?.trim() || null,
          },
        }
      );

      if (error || !data?.success) {
        console.error(
          "[FutureJobsGptPanel] Error creating job_conversation:",
          error || data?.error
        );
        return;
      }

      if (data.conversation) {
        setJobConversations((prev) => [data.conversation, ...(prev || [])]);
      }
    } catch (err) {
      console.error("[FutureJobsGptPanel] Exception creating job conversation:", err);
    } finally {
      setCreatingConversationId(null);
    }
  };

  const handleSendJobMessage = async () => {
    if (!canUse) return;
    if (!selectedConversation || !jobMessageInput.trim() || jobMessageSending) return;

    try {
      setJobMessageSending(true);
      const { data, error } = await supabase.functions.invoke(
        "lumi-job-conversation-reply",
        {
          body: {
            conversation_id: selectedConversation.id,
            message: jobMessageInput.trim(),
          },
        }
      );

      if (error || !data?.success) {
        console.error(
          "[FutureJobsGptPanel] Error sending job conversation message:",
          error || data?.error
        );
        return;
      }

      if (data.conversation) {
        setSelectedConversation(data.conversation);
        setJobConversations((prev) =>
          (prev || []).map((c) =>
            c.id === data.conversation.id ? data.conversation : c
          )
        );
      }
      setJobMessageInput("");
    } catch (err) {
      console.error("[FutureJobsGptPanel] Exception sending job message:", err);
    } finally {
      setJobMessageSending(false);
    }
  };

  const handleResetJobConversation = async () => {
    if (!canUse) return;
    if (!selectedConversation || jobMessageSending) return;
    const confirmed = window.confirm(
      "Tu vas réinitialiser cette discussion.\nLumi gardera le métier, mais tous les messages seront effacés et la conversation repartira depuis le message d'accueil.\n\nContinuer ?"
    );
    if (!confirmed) return;

    try {
      setJobMessageSending(true);
      const { data, error } = await supabase.functions.invoke(
        "lumi-reset-job-conversation",
        { body: { conversation_id: selectedConversation.id } }
      );
      if (error || !data?.success) {
        console.error(
          "[FutureJobsGptPanel] Error resetting job conversation:",
          error || data?.error
        );
        return;
      }
      if (data.conversation) {
        setSelectedConversation(data.conversation);
        setJobConversations((prev) =>
          (prev || []).map((c) =>
            c.id === data.conversation.id ? data.conversation : c
          )
        );
        setJobMessageInput("");
      }
    } catch (err) {
      console.error("[FutureJobsGptPanel] Exception resetting job conversation:", err);
    } finally {
      setJobMessageSending(false);
    }
  };

  const handleDeleteJobConversation = async () => {
    if (!canUse) return;
    if (!selectedConversation || jobMessageSending) return;
    const confirmed = window.confirm(
      "Tu vas supprimer ce métier de ta liste de conversations.\nCette action est définitive.\n\nContinuer ?"
    );
    if (!confirmed) return;

    try {
      setJobMessageSending(true);
      const { data, error } = await supabase.functions.invoke(
        "lumi-delete-job-conversation",
        { body: { conversation_id: selectedConversation.id } }
      );
      if (error || !data?.success) {
        console.error(
          "[FutureJobsGptPanel] Error deleting job conversation:",
          error || data?.error
        );
        return;
      }

      setJobConversations((prev) =>
        (prev || []).filter((c) => c.id !== selectedConversation.id)
      );
      setSelectedConversation(null);
      setJobMessageInput("");
    } catch (err) {
      console.error("[FutureJobsGptPanel] Exception deleting job conversation:", err);
    } finally {
      setJobMessageSending(false);
    }
  };

  return (
    <div className={uiMode === "inline" ? "w-full" : ""}>
      {/* Launchers row (inline) OR floating launchers (default) */}
      {uiMode === "inline" ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
          {jobConversations?.length > 0 && (
            <div>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold shadow-sm rounded-full px-4 py-3 text-sm flex items-center justify-center gap-2"
                onClick={() => setIsJobListOpen((v) => !v)}
              >
                <span className="h-6 w-6 rounded-full bg-cyan-500/15 text-cyan-700 flex items-center justify-center text-xs font-bold">
                  {jobConversations.length}
                </span>
                <span>Mes métiers choisis</span>
              </Button>
            </div>
          )}

          {!isChatOpen && (
            <Button
              type="button"
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-sm rounded-full px-5 py-3 text-sm flex items-center justify-center gap-2"
              onClick={() => {
                setIsChatOpen(true);
                setChatStep("askTracks");
              }}
              disabled={!canUse}
              title={!canUse ? "Connecte-toi pour utiliser Spot coach" : undefined}
            >
              <span className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center font-bold">
                L
              </span>
              <span>Parler avec Spot Coach</span>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Floating jobs list launcher (only if user has saved conversations) */}
          {jobConversations?.length > 0 && (
            <>
              <Button
                type="button"
                className="fixed right-4 bottom-20 z-40 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold shadow-xl rounded-full px-4 py-2 text-xs flex items-center gap-2"
                onClick={() => setIsJobListOpen((v) => !v)}
              >
                <span className="h-6 w-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-bold">
                  {jobConversations.length}
                </span>
                <span>Mes métiers choisis</span>
              </Button>

              {isJobListOpen && (
                <div className="fixed right-4 bottom-32 z-50 w-80 max-h-80 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl overflow-y-auto p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-slate-200">
                      Mes pistes de métiers
                    </p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                      onClick={() => setIsJobListOpen(false)}
                    >
                      <span className="text-sm leading-none">×</span>
                    </Button>
                  </div>

                  {jobConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 space-y-1"
                      onClick={() => {
                        setSelectedConversation(conv);
                        setIsJobListOpen(false);
                        setIsJobChatExpanded(false);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <p className="text-sm font-semibold text-white line-clamp-2">
                        {conv.job_title}
                      </p>
                      {conv.reason && (
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {conv.reason}
                        </p>
                      )}
                      {conv.sectors?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {conv.sectors.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-200 text-[10px] border border-cyan-500/40"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {conv.created_at && (
                        <p className="text-[10px] text-slate-500 pt-1">
                          Créé le{" "}
                          {new Date(conv.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Floating Lumi chat launcher */}
          {!isChatOpen && (
            <Button
              type="button"
              className="fixed right-4 bottom-4 z-40 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold shadow-xl rounded-full px-4 py-3 flex items-center gap-2 transition-transform duration-200"
              onClick={() => {
                setIsChatOpen(true);
                setChatStep("askTracks");
              }}
              disabled={!canUse}
              title={!canUse ? "Connecte-toi pour utiliser Spot coach" : undefined}
            >
              <span className="h-7 w-7 rounded-full bg-slate-900/20 flex items-center justify-center font-bold">
                L
              </span>
              <span>Parler avec Spot Coach</span>
            </Button>
          )}
        </>
      )}

      {/* Inline "Mes métiers choisis" panel (no popup) */}
      {uiMode === "inline" && jobConversations?.length > 0 && isJobListOpen && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Mes métiers choisis
              </p>
              <p className="text-xs text-slate-600">
                Clique sur un métier pour rouvrir la discussion.
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              onClick={() => setIsJobListOpen(false)}
              title="Fermer"
            >
              <span className="text-lg leading-none">×</span>
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto p-3 space-y-2">
            {jobConversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 hover:bg-slate-100 transition-colors"
                onClick={() => {
                  setSelectedConversation(conv);
                  setIsJobListOpen(false);
                  setIsJobChatExpanded(false);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                      {conv.job_title}
                    </p>
                    {conv.reason && (
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                        {conv.reason}
                      </p>
                    )}
                    {conv.sectors?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {conv.sectors.slice(0, 4).map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-800 text-[10px] border border-cyan-500/30"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {conv.created_at && (
                    <p className="text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(conv.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Job conversation panel */}
      {selectedConversation && !isChatExpanded && (
        <div
          className={
            uiMode === "inline"
              ? isJobChatExpanded
                ? "fixed inset-0 z-40 transition-all duration-200"
                : "mt-4"
              : isJobChatExpanded
                ? "fixed inset-0 z-40 transition-all duration-200"
                : "fixed bottom-4 left-4 right-4 md:left-auto md:right-88 w-auto max-w-sm h-[420px] z-40 transition-all duration-200"
          }
        >
          <JobConversationChat
            conversation={selectedConversation}
            messageInput={jobMessageInput}
            onMessageChange={setJobMessageInput}
            onSend={handleSendJobMessage}
            sending={jobMessageSending}
            onClose={() => {
              setSelectedConversation(null);
              setIsJobChatExpanded(false);
            }}
            expanded={isJobChatExpanded}
            onToggleExpand={() => setIsJobChatExpanded((prev) => !prev)}
            onReset={handleResetJobConversation}
            onDelete={handleDeleteJobConversation}
          />
        </div>
      )}

      {/* Main chat panel */}
      {isChatOpen && (
        <div
          className={
            isChatExpanded
              ? "fixed inset-0 z-40 transition-all duration-200"
              : uiMode === "inline"
                ? "mt-4 w-full"
                : "mt-8 fixed bottom-4 left-4 right-4 md:left-auto md:right-4 w-auto max-w-sm max-h-[75vh] z-40 overflow-y-auto transition-all duration-200"
          }
        >
          <Card
            className={
              isChatExpanded
                ? (isLight
                    ? "bg-white border-slate-200 shadow-xl w-full h-full rounded-none flex flex-col"
                    : "bg-slate-900 border-slate-800 shadow-xl w-full h-full rounded-none flex flex-col")
                : uiMode === "inline"
                  ? "bg-white border-slate-200 shadow-xl"
                  : "bg-slate-900/80 border-slate-800 shadow-xl"
            }
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className={isLight ? "text-slate-900" : undefined}>
                  Métiers du futur (GPT)
                </CardTitle>
                <CardDescription
                  className={
                    uiMode === "inline"
                      ? "mt-2 bg-white text-slate-700 border border-slate-200 rounded-lg px-3 py-2"
                      : undefined
                  }
                >
                  Spot coach te pose quelques questions, puis te propose 10 idées de
                  métiers du futur basées sur ton profil.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={
                    isLight
                      ? "h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      : "h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                  }
                  onClick={() => setIsChatOpen(false)}
                  title="Fermer"
                >
                  <span className="text-lg leading-none">×</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent
              className={
                isChatExpanded
                  ? "space-y-6 flex-1 overflow-y-auto"
                  : uiMode === "inline"
                    ? "space-y-6 max-h-[70vh] overflow-y-auto"
                    : "space-y-6"
              }
            >
              {!canUse && (
                <div
                  className={
                    isLight
                      ? "rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      : "rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200"
                  }
                >
                  Connecte-toi pour utiliser Spot coach.
                </div>
              )}

              {jobs.length === 0 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                      L
                    </div>
                    <div className={`rounded-2xl px-4 py-3 text-sm max-w-xl ${bubbleClass}`}>
                      Bonjour, je suis{" "}
                      <span className="font-semibold">Spot coach</span>. Je suis là
                      pour t&apos;aider à explorer des pistes de métiers du futur à partir
                      de ton profil.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                        L
                      </div>
                      <div className={`rounded-2xl px-4 py-3 text-sm max-w-xl ${bubbleClass}`}>
                        Est-ce que tu veux choisir une ou plusieurs{" "}
                        <span className="font-semibold">filières</span> qui
                        t&apos;intéressent ?
                      </div>
                    </div>

                    {chatStep === "askTracks" && (
                      <div className="flex gap-3 pl-11">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-sm"
                          onClick={() => setChatStep("chooseTracks")}
                          disabled={!canUse}
                        >
                          Oui
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={outlineBtnClass}
                          onClick={() => {
                            setSelectedTracks([]);
                            setChatStep("askDescription");
                          }}
                          disabled={!canUse}
                        >
                          Non
                        </Button>
                      </div>
                    )}

                    {chatStep === "chooseTracks" && (
                      <div className="space-y-2 pl-11">
                        <p className={`text-xs ${mutedTextClass}`}>
                          Tu peux cliquer sur une ou plusieurs filières. Tu peux
                          aussi continuer sans en choisir.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {TRACK_OPTIONS.map((track) => {
                            const selected = selectedTracks.includes(track);
                            return (
                              <button
                                key={track}
                                type="button"
                                onClick={() => {
                                  setSelectedTracks((prev) =>
                                    selected
                                      ? prev.filter((t) => t !== track)
                                      : [...prev, track]
                                  );
                                }}
                                className={
                                  "text-left px-3 py-2 rounded-lg border text-xs sm:text-sm transition-all " +
                                  (selected
                                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-100"
                                    : trackBtnUnselectedClass)
                                }
                                disabled={!canUse}
                              >
                                {track}
                              </button>
                            );
                          })}
                        </div>
                        <div className="pt-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 text-white text-sm"
                            onClick={() => setChatStep("askDescription")}
                            disabled={!canUse}
                          >
                            Continuer avec Spot coach
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {(chatStep === "askDescription" ||
                    chatStep === "typingDescription" ||
                    chatStep === "generating" ||
                    chatStep === "done") && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                          L
                        </div>
                        <div className={`rounded-2xl px-4 py-3 text-sm max-w-xl ${bubbleClass}`}>
                          Est-ce que tu veux ajouter une petite description de ce que tu aimerais faire ou explorer ? (optionnel)
                        </div>
                      </div>

                      {chatStep === "askDescription" && (
                        <div className="flex gap-3 pl-11">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-sm"
                            onClick={() => setChatStep("typingDescription")}
                            disabled={!canUse}
                          >
                            Oui
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={outlineBtnClass}
                            onClick={() => {
                              setUserDescription("");
                              handleGenerateJobs();
                            }}
                            disabled={!canUse}
                          >
                            Non
                          </Button>
                        </div>
                      )}

                      {chatStep === "typingDescription" && (
                        <div className="space-y-2 pl-11">
                          <textarea
                            rows={3}
                            value={userDescription}
                            onChange={(e) => setUserDescription(e.target.value)}
                            placeholder="Ex : J'aimerais travailler avec des jeunes dans le sport, ou créer des expériences immersives autour du bien-être..."
                            className={textareaClass}
                            disabled={!canUse}
                          />
                          <div className="flex gap-3">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white text-sm"
                              onClick={handleGenerateJobs}
                              disabled={!canUse || jobsLoading}
                            >
                              {jobsLoading ? "Génération en cours..." : "Générer mes 10 métiers"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={outlineBtnClass}
                              onClick={() => {
                                setUserDescription("");
                                handleGenerateJobs();
                              }}
                              disabled={!canUse || jobsLoading}
                            >
                              Ignorer la description
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {jobsLoading && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                    L
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm max-w-xl ${bubbleClass}`}>
                    Je réfléchis à des idées de métiers du futur pour toi...
                    <span className="ml-1 animate-pulse">● ● ●</span>
                  </div>
                </div>
              )}

              {jobsError && !jobsLoading && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                  {jobsError}
                </div>
              )}

              {!jobsLoading && jobs.length > 0 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                        L
                      </div>
                      <div className={`rounded-2xl px-4 py-3 text-sm max-w-xl ${bubbleClass}`}>
                        Est-ce que tu veux que je te propose une nouvelle série de métiers du futur avec d&apos;autres pistes ?
                      </div>
                    </div>
                    <div className="flex gap-3 pl-11">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-sm"
                        onClick={handleRestartChat}
                        disabled={!canUse}
                      >
                        Oui
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={outlineBtnClass}
                        disabled
                        title="(UI placeholder)"
                      >
                        Non
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {jobs.map((job, index) => {
                      const hasConversation = jobConversations?.some(
                        (conv) => conv.job_title === job.title
                      );
                      return (
                        <div
                          key={index}
                          className={
                            isLight
                              ? "border border-slate-200 rounded-lg px-4 py-3 bg-white space-y-2"
                              : "border border-slate-800 rounded-lg px-4 py-3 bg-slate-900/60 space-y-2"
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm ${mutedTextClass}`}>
                              Métier #{index + 1}
                            </p>
                            {(job.confidence !== undefined ||
                              job.horizon_years !== undefined) && (
                              <div className={`text-xs ${mutedTextClass} flex gap-3`}>
                                {job.horizon_years !== undefined && (
                                  <span>Horizon: {job.horizon_years} ans</span>
                                )}
                                {job.confidence !== undefined && (
                                  <span>
                                    Confiance: {Math.round(job.confidence * 100)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <h3 className={isLight ? "text-lg font-semibold text-slate-900" : "text-lg font-semibold text-white"}>
                            {job.title}
                          </h3>
                          <p className={isLight ? "text-sm text-slate-700" : "text-sm text-slate-200"}>
                            {job.why_fit}
                          </p>

                          {job.skills_needed?.length > 0 && (
                            <div className="mt-1">
                              <p className={`text-xs ${mutedTextClass} mb-1`}>
                                Compétences à développer :
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {job.skills_needed.map((skill, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-200 text-xs border border-cyan-500/40"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end pt-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={hasConversation ? "ghost" : "outline"}
                              className={
                                hasConversation
                                  ? `text-xs cursor-default ${isLight ? "text-slate-500" : "text-slate-400"}`
                                  : `border-cyan-500 hover:bg-cyan-500/10 text-xs ${isLight ? "text-cyan-700 hover:text-cyan-800" : "text-cyan-300 hover:text-cyan-100"}`
                              }
                              onClick={
                                hasConversation
                                  ? undefined
                                  : () => handleStartJobConversation(job, index)
                              }
                              disabled={
                                !canUse ||
                                creatingConversationId === index ||
                                hasConversation
                              }
                            >
                              {hasConversation
                                ? "Conversation créée"
                                : creatingConversationId === index
                                  ? "Enregistrement..."
                                  : "Explorer ce métier"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

