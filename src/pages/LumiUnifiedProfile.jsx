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

export default function LumiUnifiedProfile() {
  const user = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [symbolicProfile, setSymbolicProfile] = useState(null);
  const [lumiProfile, setLumiProfile] = useState(null);
  const [videoAnalysis, setVideoAnalysis] = useState(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-10">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            ← Retour à l'accueil
          </Button>
          <h1 className="text-2xl md:text-3xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
            Synthèse Lumi / SpotCoach / Vidéo
          </h1>
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
      </div>
    </div>
  );
}


