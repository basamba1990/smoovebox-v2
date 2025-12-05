import React, { useEffect, useState } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import { Button } from "../components/ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.jsx";
import { useNavigate } from "react-router-dom";
import { spotCoachService } from "../services/spotCoachService.js";
import { getMyLumiProfile } from "../services/lumiService.js";
import { supabase } from "../lib/supabase.js";
import { videoService } from "../services/videoService.js";
import { JobConversationChat } from "../components/JobConversationChat.jsx";

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

export default function LumiUnifiedProfile() {
  const user = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [symbolicProfile, setSymbolicProfile] = useState(null);
  const [lumiProfile, setLumiProfile] = useState(null);
  const [videoAnalysis, setVideoAnalysis] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState(null);
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [userDescription, setUserDescription] = useState("");
  // chatStep can be: 'askTracks' | 'chooseTracks' | 'askDescription' | 'typingDescription' | 'generating' | 'done'
  const [chatStep, setChatStep] = useState("askTracks");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [creatingConversationId, setCreatingConversationId] = useState(null);
  const [jobConversations, setJobConversations] = useState([]);
  const [isJobListOpen, setIsJobListOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [jobMessageInput, setJobMessageInput] = useState("");
  const [jobMessageSending, setJobMessageSending] = useState(false);
  const [isJobChatExpanded, setIsJobChatExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1) Symbolic profile (SpotCoach)
        const existingSymbolic = await spotCoachService.getExistingProfile();
        if (!cancelled && existingSymbolic) {
          setSymbolicProfile(existingSymbolic);
        }

        // 2) Lumi profile (DISC)
        const lumiResult = await getMyLumiProfile();
        if (!cancelled && lumiResult.success && lumiResult.profile) {
          setLumiProfile(lumiResult.profile);
        }

        // 3) Latest analyzed video that already has an analysis
        const { data: latestVideo, error: latestError } = await supabase
          .from("videos")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["analyzed", "COMPLETED"])
          .not("analysis", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestError) {
          console.error(
            "[LumiUnifiedProfile] Error fetching latest analyzed video:",
            latestError
          );
        }

        if (!cancelled && latestVideo?.id) {
          // Prefer embedded analysis on the video if present
          let analysis = latestVideo.analysis || null;

          // Fallback: try dedicated analyses table via service
          if (!analysis) {
            try {
              analysis = await videoService.getAnalysis(latestVideo.id);
            } catch (err) {
              console.error(
                "[LumiUnifiedProfile] Error fetching analysis from service:",
                err
              );
            }
          }

          if (analysis) {
            setVideoAnalysis({ video: latestVideo, analysis });
          }
        }

        // 4) Existing job conversations for this user
        const { data: existingConversations, error: convError } = await supabase
          .from("job_conversations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (convError) {
          console.error(
            "[LumiUnifiedProfile] Error fetching job_conversations:",
            convError
          );
        } else if (!cancelled && existingConversations) {
          setJobConversations(existingConversations);
        }
      } catch (err) {
        console.error("[LumiUnifiedProfile] Error loading data:", err);
        if (!cancelled) {
          setError(
            err?.message ||
              "Erreur lors du chargement des données de profil Lumi."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleGenerateJobs = async () => {
    setChatStep("generating");
    setJobsError(null);
    setJobs([]);
    setJobsLoading(true);

    try {
      const unifiedPayload = {
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
          sectors: selectedTracks,
          description: userDescription?.trim() || null,
        },
        language: "fr",
      };

      const { data, error } = await supabase.functions.invoke(
        "lumi-gpt-future-jobs",
        {
          body: unifiedPayload,
        }
      );

      if (error) {
        console.error("[LumiUnifiedProfile] Error calling GPT jobs:", error);
        setJobsError(
          error.message || "Erreur lors de l'appel à l'IA pour les métiers."
        );
        setChatStep("done");
        return;
      }

      if (!data?.success || !Array.isArray(data.jobs)) {
        console.error("[LumiUnifiedProfile] Invalid GPT jobs response:", data);
        setJobsError(
          "La réponse de l'IA n'a pas le format attendu. Réessaie plus tard."
        );
        setChatStep("done");
        return;
      }

      setJobs(data.jobs);
      setChatStep("done");
    } catch (err) {
      console.error("[LumiUnifiedProfile] Exception calling GPT jobs:", err);
      setJobsError(
        err?.message || "Erreur inattendue lors de l'appel à l'IA."
      );
      setChatStep("done");
    } finally {
      setJobsLoading(false);
    }
  };

  const handleRestartChat = () => {
    setSelectedTracks([]);
    setUserDescription("");
    setJobs([]);
    setJobsError(null);
    setChatStep("askTracks");
  };

  const handleStartJobConversation = async (job, index) => {
    if (!user) {
      console.warn("[LumiUnifiedProfile] No user, cannot create job conversation");
      return;
    }

    try {
      setCreatingConversationId(index);

      const payload = {
        job_title: job.title,
        job_description: job.why_fit || "",
        reason: job.why_fit || "",
        sectors: selectedTracks && selectedTracks.length > 0 ? selectedTracks : null,
        user_description: userDescription || null,
      };

      const { data, error } = await supabase.functions.invoke(
        "lumi-create-job-conversation",
        { body: payload }
      );

      if (error || !data?.success) {
        console.error(
          "[LumiUnifiedProfile] Error creating job_conversation via function:",
          error || data?.error
        );
      } else {
        console.log(
          "[LumiUnifiedProfile] job_conversation created for job:",
          job.title,
          data.conversation?.id
        );
        if (data.conversation) {
          setJobConversations((prev) => [data.conversation, ...(prev || [])]);
        }
      }
    } catch (err) {
      console.error("[LumiUnifiedProfile] Exception creating job_conversation:", err);
    } finally {
      setCreatingConversationId(null);
    }
  };

  const handleSendJobMessage = async () => {
    if (
      !selectedConversation ||
      !jobMessageInput.trim() ||
      jobMessageSending
    ) {
      return;
    }

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
          "[LumiUnifiedProfile] Error sending job conversation message:",
          error || data?.error
        );
        return;
      }

      if (data.conversation) {
        setSelectedConversation(data.conversation);
        setJobConversations((prev) =>
          (prev || []).map((conv) =>
            conv.id === data.conversation.id ? data.conversation : conv
          )
        );
      }

      setJobMessageInput("");
    } catch (err) {
      console.error(
        "[LumiUnifiedProfile] Exception sending job conversation message:",
        err
      );
    } finally {
      setJobMessageSending(false);
    }
  };

  const handleResetJobConversation = async () => {
    if (!selectedConversation || jobMessageSending) return;

    const confirmed = window.confirm(
      "Tu vas réinitialiser cette discussion.\nLumi gardera le métier, mais tous les messages seront effacés et la conversation repartira depuis le message d'accueil.\n\nContinuer ?"
    );
    if (!confirmed) return;

    try {
      setJobMessageSending(true);

      const { data, error } = await supabase.functions.invoke(
        "lumi-reset-job-conversation",
        {
          body: { conversation_id: selectedConversation.id },
        }
      );

      if (error || !data?.success) {
        console.error(
          "[LumiUnifiedProfile] Error resetting job conversation:",
          error || data?.error
        );
        return;
      }

      if (data.conversation) {
        setSelectedConversation(data.conversation);
        setJobConversations((prev) =>
          (prev || []).map((conv) =>
            conv.id === data.conversation.id ? data.conversation : conv
          )
        );
        setJobMessageInput("");
      }
    } catch (err) {
      console.error(
        "[LumiUnifiedProfile] Exception resetting job conversation:",
        err
      );
    } finally {
      setJobMessageSending(false);
    }
  };

  const handleDeleteJobConversation = async () => {
    if (!selectedConversation || jobMessageSending) return;

    const confirmed = window.confirm(
      "Tu vas supprimer ce métier de ta liste de conversations.\nCette action est définitive.\n\nContinuer ?"
    );
    if (!confirmed) return;

    try {
      setJobMessageSending(true);

      const { data, error } = await supabase.functions.invoke(
        "lumi-delete-job-conversation",
        {
          body: { conversation_id: selectedConversation.id },
        }
      );

      if (error || !data?.success) {
        console.error(
          "[LumiUnifiedProfile] Error deleting job conversation via function:",
          error || data?.error
        );
        return;
      }

      setJobConversations((prev) =>
        (prev || []).filter((conv) => conv.id !== selectedConversation.id)
      );
      setSelectedConversation(null);
      setJobMessageInput("");
    } catch (err) {
      console.error(
        "[LumiUnifiedProfile] Exception deleting job conversation:",
        err
      );
    } finally {
      setJobMessageSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-10">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            ← Retour à l'accueil
          </Button>
          <div className="flex-1 min-w-[220px] flex items-center justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
              Synthèse Lumi / SpotCoach / Vidéo
            </h1>
          </div>
        </div>

        {loading && (
          <div className="text-center text-slate-400 py-12">
            Chargement de tes profils...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Symbolic Profile */}
            <Card className="bg-slate-900/60 border-slate-800 lg:col-span-1">
              <CardHeader>
                <CardTitle>Profil Symbolique (SpotCoach)</CardTitle>
                <CardDescription>
                  Généré à partir des données de naissance et de SpotCoach.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {symbolicProfile ? (
                  <div className="space-y-4 text-sm">
                    <div className="space-y-2">
                      <p className="text-slate-300">
                        <span className="font-semibold text-slate-100">
                          Archétype :
                        </span>{" "}
                        {symbolicProfile.archetype || "—"}
                      </p>
                      <p className="text-slate-300">
                        <span className="font-semibold text-slate-100">
                          Phrase de synchronie :
                        </span>{" "}
                        {symbolicProfile.phrase_synchronie || "—"}
                      </p>
                      <p className="text-slate-300">
                        <span className="font-semibold text-slate-100">
                          Élément :
                        </span>{" "}
                        {symbolicProfile.element || "—"}
                      </p>
                    </div>

                    {symbolicProfile.profile_text && (
                      <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                        <p className="text-xs text-slate-400">
                          Texte complet du profil symbolique
                        </p>
                        <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
                          {symbolicProfile.profile_text
                            .split("\n")
                            .map((line, idx) => (
                              <p
                                key={idx}
                                className="text-slate-200 leading-relaxed"
                              >
                                {line}
                              </p>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-slate-500 border-t border-slate-800 pt-3">
                      Profil symbolique brut, tel qu'enregistré dans
                      `profiles_symboliques`.
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Aucun profil symbolique trouvé. Génère ton profil dans
                    SpotCoach.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Lumi / DISC Profile */}
            <Card className="bg-slate-900/60 border-slate-800 lg:col-span-1">
              <CardHeader>
                <CardTitle>Profil Lumi (DISC)</CardTitle>
                <CardDescription>
                  Calculé à partir des réponses au questionnaire Lumi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lumiProfile ? (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-xs text-slate-400">
                          Couleur dominante
                        </p>
                        <p className="text-lg font-semibold text-white capitalize">
                          {lumiProfile.dominant_color || "—"}
                        </p>
                      </div>
                      <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-xs text-slate-400">
                          Couleur secondaire
                        </p>
                        <p className="text-lg font-semibold text-white capitalize">
                          {lumiProfile.secondary_color || "—"}
                        </p>
                      </div>
                    </div>

                    {lumiProfile.disc_scores && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2">
                          Scores DISC
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(lumiProfile.disc_scores).map(
                            ([letter, score]) => (
                              <div
                                key={letter}
                                className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-center"
                              >
                                <p className="text-xs text-slate-400">
                                  {letter}
                                </p>
                                <p className="text-base font-semibold text-white">
                                  {score}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {lumiProfile.traits && lumiProfile.traits.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2">
                          Traits Lumi
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {lumiProfile.traits.map((trait, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs border border-indigo-500/40"
                            >
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Aucun profil Lumi trouvé. Passe le questionnaire DISC dans
                    l'espace Lumi.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Video Analysis */}
            <Card className="bg-slate-900/60 border-slate-800 lg:col-span-1">
              <CardHeader>
                <CardTitle>Analyse Vidéo</CardTitle>
                <CardDescription>
                  Résumé de la dernière vidéo analysée (si disponible).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {videoAnalysis ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-slate-300">
                      <span className="font-semibold text-slate-100">
                        Vidéo :
                      </span>{" "}
                      {videoAnalysis.video.title || "Sans titre"}
                    </p>
                    <p className="text-xs text-slate-400">
                      ID vidéo : {videoAnalysis.video.id}
                    </p>
                    {videoAnalysis.analysis.summary && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-slate-400">Résumé AI :</p>
                        <p className="text-slate-200">
                          {videoAnalysis.analysis.summary}
                        </p>
                      </div>
                    )}
                    <div className="text-xs text-slate-500 border-t border-slate-800 pt-3">
                      Analyse brute issue de la fonction `analyze-transcription`
                      / table `analyses`.
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Aucune analyse vidéo trouvée. Analyse une vidéo pour voir ce
                    bloc rempli.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* GPT Future Jobs - bottom-right chat launcher + panel */}
        {!loading && !error && (
          <>
            {/* Floating jobs list launcher (only if user has saved conversations) */}
            {jobConversations && jobConversations.length > 0 && (
              <>
                <Button
                  type="button"
                  className="fixed right-4 bottom-20 z-40 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold shadow-xl rounded-full px-4 py-2 text-xs flex items-center gap-2"
                  onClick={() => setIsJobListOpen((v) => !v)}
                >
                  <span className="h-6 w-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-bold">
                    {jobConversations.length}
                  </span>
                  <span>Mes métiers</span>
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
                        {conv.sectors && conv.sectors.length > 0 && (
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
                    {jobConversations.length === 0 && (
                      <p className="text-xs text-slate-400">
                        Aucun métier sauvegardé pour le moment.
                      </p>
                    )}
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
              >
                <span className="h-7 w-7 rounded-full bg-slate-900/20 flex items-center justify-center font-bold">
                  L
                </span>
                <span>Parler avec Lumi</span>
              </Button>
            )}

            {/* Job conversation panel (left of Lumi chat) */}
            {selectedConversation && !isChatExpanded && (
              <div
                className={
                  isJobChatExpanded
                    ? "fixed inset-0 z-40 transition-all duration-200"
                    : "fixed bottom-4 left-4 right-4 md:left-auto md:right-[22rem] w-auto max-w-sm h-[420px] z-40 transition-all duration-200"
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
                  onToggleExpand={() =>
                    setIsJobChatExpanded((prev) => !prev)
                  }
                  onReset={handleResetJobConversation}
                  onDelete={handleDeleteJobConversation}
                />
              </div>
            )}

            {/* Chat panel */}
            {isChatOpen && (
          <div
            className={
              isChatExpanded
                ? "fixed inset-0 z-40 transition-all duration-200"
                : "mt-8 fixed bottom-4 left-4 right-4 md:left-auto md:right-4 w-auto max-w-sm max-h-[75vh] z-40 overflow-y-auto transition-all duration-200"
            }
          >
            <Card
              className={
                isChatExpanded
                  ? "bg-slate-900 border-slate-800 shadow-xl w-full h-full rounded-none flex flex-col"
                  : "bg-slate-900/80 border-slate-800 shadow-xl"
              }
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>Métiers du futur (GPT)</CardTitle>
                  <CardDescription>
                    Lumi te pose quelques questions, puis te propose 10 idées de
                    métiers du futur basées sur ton profil.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    onClick={() => setIsChatExpanded((v) => !v)}
                    title={isChatExpanded ? "Exit full screen" : "Full screen"}
                  >
                    <span className="text-xs leading-none">&lt;&gt;</span>
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    onClick={() => setIsChatOpen(false)}
                  >
                    <span className="text-lg leading-none">−</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className={isChatExpanded ? "space-y-6 flex-1 overflow-y-auto" : "space-y-6"}>
                {/* Chat-style preferences */}
                <div className="space-y-4">
                  {/* Questions flow - only when no jobs yet */}
                  {jobs.length === 0 && (
                    <>
                      {/* Lumi intro */}
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                          L
                        </div>
                        <div className="bg-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 max-w-xl">
                          Bonjour, je suis <span className="font-semibold">Lumi</span>. Je
                          suis là pour t&apos;aider à explorer des pistes de métiers
                          du futur à partir de ton profil. On commence en douceur 😊
                        </div>
                      </div>

                      {/* Question 1: sectors */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                            L
                          </div>
                          <div className="bg-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 max-w-xl">
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
                            >
                              Oui
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm"
                              onClick={() => {
                                setSelectedTracks([]);
                                setChatStep("askDescription");
                              }}
                            >
                              Non
                            </Button>
                          </div>
                        )}

                        {chatStep === "chooseTracks" && (
                          <div className="space-y-2 pl-11">
                            <p className="text-xs text-slate-400">
                              Tu peux cliquer sur une ou plusieurs filières. Tu
                              peux aussi continuer sans en choisir.
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
                                        : "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500")
                                    }
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
                              >
                                Continuer avec Lumi
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Question 2: description */}
                      {(chatStep === "askDescription" ||
                        chatStep === "typingDescription" ||
                        chatStep === "generating" ||
                        chatStep === "done") && (
                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                              L
                            </div>
                            <div className="bg-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 max-w-xl">
                              Est-ce que tu veux ajouter une petite description de
                              ce que tu aimerais faire ou explorer ? (optionnel)
                            </div>
                          </div>

                          {chatStep === "askDescription" && (
                            <div className="flex gap-3 pl-11">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-sm"
                                onClick={() => setChatStep("typingDescription")}
                              >
                                Oui
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm"
                                onClick={() => {
                                  setUserDescription("");
                                  handleGenerateJobs();
                                }}
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
                                onChange={(e) =>
                                  setUserDescription(e.target.value)
                                }
                                placeholder="Ex : J'aimerais travailler avec des jeunes dans le sport, ou créer des expériences immersives autour du bien-être..."
                                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                              />
                              <div className="flex gap-3">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm"
                                  onClick={handleGenerateJobs}
                                  disabled={jobsLoading}
                                >
                                  {jobsLoading
                                    ? "Génération en cours..."
                                    : "Générer mes 10 métiers"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm"
                                  onClick={() => {
                                    setUserDescription("");
                                    handleGenerateJobs();
                                  }}
                                  disabled={jobsLoading}
                                >
                                  Ignorer la description
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {jobsLoading && (
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                      L
                    </div>
                    <div className="bg-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 max-w-xl">
                      Je réfléchis à des idées de métiers du futur pour toi...
                      <span className="ml-1 animate-pulse">● ● ●</span>
                    </div>
                  </div>
                )}

                {jobsError && !jobsLoading && (
                  <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                    {jobsError}
                  </div>
                )}

                {!jobsError && !jobsLoading && jobs.length === 0 && (
                  <p className="text-sm text-slate-400">
                    Réponds simplement aux questions de Lumi ci-dessus, puis
                    laisse l&apos;IA te proposer des pistes adaptées à ton
                    profil.
                  </p>
                )}

                {!jobsLoading && jobs.length > 0 && (
                  <div className="space-y-6">
                    {/* Ask if user wants to go again */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-sm font-bold">
                          L
                        </div>
                        <div className="bg-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 max-w-xl">
                          Est-ce que tu veux que je te propose une nouvelle
                          série de métiers du futur avec d&apos;autres pistes ?
                        </div>
                      </div>
                      <div className="flex gap-3 pl-11">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-sm"
                          onClick={handleRestartChat}
                        >
                          Oui
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm"
                        >
                          Non
                        </Button>
                      </div>
                    </div>

                    {/* Jobs list */}
                    <div className="space-y-4">
                      {jobs.map((job, index) => {
                        const hasConversation = jobConversations?.some(
                          (conv) => conv.job_title === job.title
                        );

                        return (
                          <div
                            key={index}
                            className="border border-slate-800 rounded-lg px-4 py-3 bg-slate-900/60 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm text-slate-400">
                                Métier #{index + 1}
                              </p>
                              {(job.confidence !== undefined ||
                                job.horizon_years !== undefined) && (
                                <div className="text-xs text-slate-400 flex gap-3">
                                  {job.horizon_years !== undefined && (
                                    <span>
                                      Horizon: {job.horizon_years} ans
                                    </span>
                                  )}
                                  {job.confidence !== undefined && (
                                    <span>
                                      Confiance:{" "}
                                      {Math.round(job.confidence * 100)}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-white">
                              {job.title}
                            </h3>
                            <p className="text-sm text-slate-200">
                              {job.why_fit}
                            </p>
                            {job.skills_needed &&
                              job.skills_needed.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs text-slate-400 mb-1">
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
                                    ? "text-slate-400 text-xs cursor-default"
                                    : "border-cyan-500 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-100 text-xs"
                                }
                                onClick={
                                  hasConversation
                                    ? undefined
                                    : () =>
                                        handleStartJobConversation(job, index)
                                }
                                disabled={
                                  creatingConversationId === index ||
                                  hasConversation
                                }
                              >
                                {hasConversation
                                  ? "Conversation créée"
                                  : creatingConversationId === index
                                  ? "Enregistrement..."
                                  : "Explorer ce métier avec Lumi"}
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
          </>
        )}
      </div>
    </div>
  );
}


