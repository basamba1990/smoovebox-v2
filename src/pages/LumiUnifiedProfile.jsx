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
        return;
      }

      if (!data?.success || !Array.isArray(data.jobs)) {
        console.error("[LumiUnifiedProfile] Invalid GPT jobs response:", data);
        setJobsError(
          "La réponse de l'IA n'a pas le format attendu. Réessaie plus tard."
        );
        return;
      }

      setJobs(data.jobs);
    } catch (err) {
      console.error("[LumiUnifiedProfile] Exception calling GPT jobs:", err);
      setJobsError(
        err?.message || "Erreur inattendue lors de l'appel à l'IA."
      );
    } finally {
      setJobsLoading(false);
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
            <Button
              onClick={handleGenerateJobs}
              disabled={jobsLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap"
            >
              {jobsLoading
                ? "Génération en cours..."
                : "Générer 10 métiers du futur"}
            </Button>
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

        {/* GPT Future Jobs */}
        {!loading && !error && (
          <div className="mt-8">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle>Métiers du futur (GPT)</CardTitle>
                <CardDescription>
                  Propositions générées à partir de ton profil symbolique, DISC,
                  de ton analyse vidéo et, si tu le souhaites, de tes domaines
                  d&apos;intérêt.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Optional preferences */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-100 mb-2">
                      Domaines qui t&apos;intéressent (optionnel)
                    </p>
                    <p className="text-xs text-slate-400 mb-3">
                      Sélectionne une ou plusieurs filières qui t&apos;attirent.
                      Cela aidera l&apos;IA à proposer des métiers plus ciblés.
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
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-100 mb-2">
                      Décris ton projet ou ce que tu aimerais explorer
                      (optionnel)
                    </p>
                    <textarea
                      rows={3}
                      value={userDescription}
                      onChange={(e) => setUserDescription(e.target.value)}
                      placeholder="Ex : J'aimerais travailler avec des jeunes dans le sport, ou créer des expériences immersives autour du bien-être..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    />
                  </div>
                </div>

                {jobsError && (
                  <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                    {jobsError}
                  </div>
                )}

                {!jobsError && !jobsLoading && jobs.length === 0 && (
                  <p className="text-sm text-slate-400">
                    Clique sur le bouton{" "}
                    <span className="font-semibold">
                      “Générer 10 métiers du futur”
                    </span>{" "}
                    pour voir des idées de rôles adaptés à ton profil.
                  </p>
                )}

                {!jobsLoading && jobs.length > 0 && (
                  <div className="space-y-4">
                    {jobs.map((job, index) => (
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
                        {job.skills_needed && job.skills_needed.length > 0 && (
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
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}


