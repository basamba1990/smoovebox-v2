// src/components/HobbyFlow.jsx
// Component for hobby selection, questions, and results flow

import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card.jsx";
import {
  startHobbySession,
  submitHobbyAnswer,
  getHobbyRecommendation,
  getMyHobbyProfile,
  getSessionAgeRange,
  getMyLumiProfile,
} from "../services/lumiService.js";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { getPublicUrl } from "../lib/storageUtils.js";

// Available hobbies
const HOBBIES = [
  { name: "Football", emoji: "⚽", color: "green" },
  { name: "Handball", emoji: "🤾", color: "blue" },
  { name: "Basketball", emoji: "🏀", color: "orange" },
];

// DISC Color to Element mapping (same as in lumi-onboarding.jsx, without animals)
const DISC_ELEMENTS = {
  rouge: { elementFr: "Feu", icon: "🔥" },
  jaune: { elementFr: "Air", icon: "🌬️" },
  vert: { elementFr: "Terre", icon: "🌱" },
  bleu: { elementFr: "Eau", icon: "💧" },
};

// Axis order: Air (top), Eau (right), Terre (bottom), Feu (left)
const ELEMENT_AXIS_INDEX = { jaune: 0, bleu: 1, vert: 2, rouge: 3 };

// Mapping DISC colors to badge assets for the football card
const DISC_BADGE_FILES = {
  rouge: "24 Badge feu.png",
  jaune: "25 Badge air.png",
  vert: "26 Badge terre.png",
  bleu: "27 Badge eau.png",
};

function RadarChartFourElements({ dominantColor, secondaryColor }) {
  const size = 90;
  const center = size / 2;
  const maxRadius = 28;
  const axes = [
    { label: "Air", angle: -90 },
    { label: "Eau", angle: 0 },
    { label: "Terre", angle: 90 },
    { label: "Feu", angle: 180 },
  ];

  // Base values for the 4 elements
  const values = [0.3, 0.3, 0.3, 0.3];
  if (dominantColor != null && ELEMENT_AXIS_INDEX[dominantColor] != null) {
    values[ELEMENT_AXIS_INDEX[dominantColor]] = 0.9;
  }
  if (secondaryColor != null && ELEMENT_AXIS_INDEX[secondaryColor] != null) {
    values[ELEMENT_AXIS_INDEX[secondaryColor]] = 0.6;
  }

  return (
    <div className="relative">
      <svg width={size} height={size} className="text-white">
        {/* Soft background circle */}
        <defs>
          <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(15,23,42,0.0)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.65)" />
          </radialGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={maxRadius + 4}
          fill="url(#radar-bg)"
          stroke="rgba(148, 163, 184, 0.6)"
          strokeWidth={0.6}
        />

        {/* Concentric guide rings */}
        {[0.33, 0.66, 1].map((ratio) => (
          <circle
            key={ratio}
            cx={center}
            cy={center}
            r={maxRadius * ratio}
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth={0.6}
            fill="none"
          />
        ))}

        {/* Axis lines */}
        {axes.map((ax) => {
          const rad = (ax.angle * Math.PI) / 180;
          const x = center + maxRadius * Math.cos(rad);
          const y = center + maxRadius * Math.sin(rad);
          return (
            <line
              key={ax.label}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(148, 163, 184, 0.4)"
              strokeWidth={0.6}
            />
          );
        })}

        {/* Compute bubble centers for drawing connecting line */}
        {(() => {
          const pts = axes.map((ax, i) => {
            const rad = (ax.angle * Math.PI) / 180;
            const r = maxRadius * values[i];
            const x = center + r * Math.cos(rad);
            const y = center + r * Math.sin(rad);
            return { x, y, label: ax.label, value: values[i] };
          });

          const pathD =
            pts.length > 0
              ? `M ${pts[0].x} ${pts[0].y} ` +
                pts
                  .slice(1)
                  .map((p) => `L ${p.x} ${p.y}`)
                  .join(" ") +
                " Z"
              : "";

          return (
            <>
              {/* White rounded line connecting the bubbles */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="white"
                  strokeWidth={1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeOpacity={0.9}
                />
              )}

              {/* Rounded \"bubbles\" per element */}
              {pts.map((p) => {
                const bubbleRadius = 3 + p.value * 3; // bigger bubble for stronger element
                return (
                  <circle
                    key={`${p.label}-bubble`}
                    cx={p.x}
                    cy={p.y}
                    r={bubbleRadius}
                    fill="white"
                    fillOpacity={0.9}
                    stroke="rgba(56, 189, 248, 0.8)"
                    strokeWidth={0.6}
                  />
                );
              })}
            </>
          );
        })()}

        {/* Axis labels around the circle */}
        {axes.map((ax) => {
          const rad = (ax.angle * Math.PI) / 180;
          const r = maxRadius + 10;
          const x = center + r * Math.cos(rad);
          const y = center + r * Math.sin(rad);
          return (
            <text
              key={ax.label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={8}
              fontWeight={500}
            >
              {ax.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// Build up to 4 skill badge entries based on dominant / secondary traits characteristics
function buildSkillBadgesForProfile(computedProfile) {
  if (!computedProfile || !computedProfile.dominant_color) return [];

  const dominantColor = computedProfile.dominant_color;
  const secondaryColor = computedProfile.secondary_color || null;
  const dominantChars =
    computedProfile.traits?.dominant?.characteristics || [];
  const secondaryChars =
    computedProfile.traits?.secondary?.characteristics || [];

  const badges = [];

  const addBadges = (color, labels, count, prefix) => {
    const src = DISC_BADGE_FILES[color];
    if (!src) return;
    const safeLabels =
      labels && labels.length > 0
        ? labels
        : [""];

    for (let i = 0; i < count && badges.length < 4; i += 1) {
      const baseLabel =
        safeLabels[i] ||
        safeLabels[i % safeLabels.length] ||
        "";
      badges.push({
        key: `${prefix}-${i}`,
        src,
        label: baseLabel,
      });
    }
  };

  if (secondaryColor) {
    // 2 badges for dominant, 2 for secondary
    addBadges(dominantColor, dominantChars, 2, "dom");
    addBadges(secondaryColor, secondaryChars, 2, "sec");

    // If still less than 4 (missing characteristics), fill with dominant
    if (badges.length < 4) {
      addBadges(
        dominantColor,
        dominantChars,
        4 - badges.length,
        "dom-extra",
      );
    }
  } else {
    // Only dominant color: up to 4 badges all using dominant characteristics
    addBadges(dominantColor, dominantChars, 4, "dom");
  }

  return badges.slice(0, 4);
}

export default function HobbyFlow({ computedProfile, ageRange, userName, avatarUrl }) {
  const MAX_HOBBY_MULTI_ANSWERS = 2;

  const supabaseClient = useSupabaseClient();
  const authUser = useUser();

  const [showHobbySelection, setShowHobbySelection] = useState(false);
  const [selectedHobby, setSelectedHobby] = useState(null);
  const [hobbySessionId, setHobbySessionId] = useState(null);
  const [currentHobbyQuestion, setCurrentHobbyQuestion] = useState(null);
  const [currentHobbyAnswer, setCurrentHobbyAnswer] = useState(null);
  const [currentHobbyAnswers, setCurrentHobbyAnswers] = useState([]);
  const [submittingHobbyAnswer, setSubmittingHobbyAnswer] = useState(false);
  const [gettingHobbyRecommendation, setGettingHobbyRecommendation] =
    useState(false);
  const [hobbyProfile, setHobbyProfile] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [currentHobbyDisplayOptions, setCurrentHobbyDisplayOptions] = useState(
    [],
  );

  // Local avatar URL so we can update after upload
  const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl || null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setLocalAvatarUrl(avatarUrl || null);
  }, [avatarUrl]);

  const favoritePlayer =
    hobbyProfile?.gpt_response?.favorite_player ||
    hobbyProfile?.gpt_response?.favoritePlayer ||
    null;
  const favoriteTeam =
    hobbyProfile?.gpt_response?.favorite_team ||
    hobbyProfile?.gpt_response?.favoriteTeam ||
    null;

  const handleAvatarClick = () => {
    if (!localAvatarUrl && avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !authUser || !supabaseClient) return;

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${authUser.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("[HobbyFlow] Erreur upload avatar:", uploadError);
        toast.error("Erreur lors de l'envoi de la photo");
        return;
      }

      const storagePath = `avatars/${filePath}`;

      const { error: dbError } = await supabaseClient
        .from("profiles")
        .update({ avatar_url: storagePath })
        .eq("id", authUser.id);

      if (dbError) {
        console.error("[HobbyFlow] Erreur mise à jour profil avatar:", dbError);
        toast.error("Erreur lors de la sauvegarde de la photo");
        return;
      }

      const publicUrl = getPublicUrl(storagePath, "avatars");
      setLocalAvatarUrl(publicUrl);
      toast.success("✅ Photo de profil mise à jour");
    } catch (error) {
      console.error("[HobbyFlow] Exception upload avatar:", error);
      toast.error("Erreur lors de l'envoi de la photo");
    } finally {
      // reset input so same file can be selected again if needed
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  // Build dynamic skill badges for the football DISC card from DISC characteristics
  const skillBadges = buildSkillBadgesForProfile(computedProfile);

  // Toggle helper enforcing max 2 answers (like DISC)
  const toggleHobbyMultiAnswer = (key) => {
    setCurrentHobbyAnswers((prev) => {
      const isSelected = prev.includes(key);
      if (isSelected) {
        return prev.filter((a) => a !== key);
      }
      if (prev.length >= MAX_HOBBY_MULTI_ANSWERS) {
        toast.error(
          `Tu peux choisir au maximum ${MAX_HOBBY_MULTI_ANSWERS} réponses.`,
        );
        return prev;
      }
      return [...prev, key];
    });
  };

  // Check for existing hobby profile on mount
  useEffect(() => {
    const checkExistingHobby = async () => {
      if (!computedProfile) return;

      setLoadingExisting(true);
      const hobbyResult = await getMyHobbyProfile();
      if (hobbyResult.success && hobbyResult.profile) {
        const hobby = Array.isArray(hobbyResult.profile)
          ? hobbyResult.profile[0]
          : hobbyResult.profile;
        if (hobby) {
          setHobbyProfile(hobby);
          setSelectedHobby(hobby.hobby_name);
        }
      }
      setLoadingExisting(false);
    };

    checkExistingHobby();
  }, [computedProfile]);

  // Randomize display order of options for each hobby question (like DISC)
  useEffect(() => {
    if (
      currentHobbyQuestion &&
      currentHobbyQuestion.question_type === "multiple_choice" &&
      currentHobbyQuestion.options?.options &&
      typeof currentHobbyQuestion.options.options === "object"
    ) {
      const entries = Object.entries(currentHobbyQuestion.options.options).map(
        ([key, label]) => ({ key, label }),
      );
      // Shuffle once per question id
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      setCurrentHobbyDisplayOptions(shuffled);
    } else {
      setCurrentHobbyDisplayOptions([]);
    }
  }, [currentHobbyQuestion?.id]);

  if (!computedProfile) {
    return null;
  }

  if (loadingExisting) {
    return (
      <Card className="bg-white border-slate-200 shadow-lg mt-6">
        <CardContent className="p-6">
          <p className="text-slate-600 text-center">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Hobby Selection Button - Show after profile is computed */}
      {!hobbyProfile && !currentHobbyQuestion && !showHobbySelection && (
        <Card className="glass-card border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900/60 mt-6">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">
              🎯 Découvre tes loisirs idéaux
            </CardTitle>
            <CardDescription className="text-slate-300">
              Choisis un loisir et découvre ton rôle idéal selon ton profil DISC
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowHobbySelection(true)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              size="lg"
            >
              Choisir un loisir
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Hobby Selection Cards */}
      {showHobbySelection && !selectedHobby && !currentHobbyQuestion && (
        <Card className="glass-card border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900/60 mt-6">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">
              Choisis un loisir qui t'intéresse
            </CardTitle>
            <CardDescription className="text-slate-300">
              Sélectionne un loisir pour découvrir ton rôle idéal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-row justify-center gap-4">
              {HOBBIES.map((hobby) => (
                <button
                  key={hobby.name}
                  onClick={async () => {
                    console.log(
                      "[HobbyFlow] Starting hobby session for:",
                      hobby.name,
                      "ageRange:",
                      ageRange,
                    );
                    console.log(
                      "[HobbyFlow] computedProfile:",
                      computedProfile,
                    );

                    // Verify we have a profile ID
                    if (!computedProfile?.id) {
                      toast.error(
                        "Profil DISC non trouvé. Veuillez compléter le questionnaire DISC d'abord.",
                      );
                      return;
                    }

                    setSelectedHobby(hobby.name);
                    setShowHobbySelection(false);

                    try {
                      // Verify profile exists in database before starting hobby session
                      console.log(
                        "[HobbyFlow] Verifying profile exists in database...",
                      );
                      const profileCheck = await getMyLumiProfile();
                      if (!profileCheck.success || !profileCheck.profile) {
                        toast.error(
                          "Le profil DISC n'est pas encore enregistré. Veuillez attendre quelques secondes et réessayer.",
                        );
                        setSelectedHobby(null);
                        setShowHobbySelection(true);
                        return;
                      }
                      console.log(
                        "[HobbyFlow] Profile verified in database:",
                        profileCheck.profile.id,
                      );

                      // If ageRange is null but we have a computedProfile with session_id, try to fetch it
                      let finalAgeRange = ageRange;
                      if (!finalAgeRange && computedProfile?.session_id) {
                        console.log(
                          "[HobbyFlow] ageRange is null, fetching from session:",
                          computedProfile.session_id,
                        );
                        const ageRangeResult = await getSessionAgeRange(
                          computedProfile.session_id,
                        );
                        if (
                          ageRangeResult.success &&
                          ageRangeResult.age_range
                        ) {
                          finalAgeRange = ageRangeResult.age_range;
                          console.log(
                            "[HobbyFlow] Found ageRange from session:",
                            finalAgeRange,
                          );
                        }
                      }

                      // Start hobby session
                      const result = await startHobbySession(
                        hobby.name,
                        finalAgeRange,
                      );
                      console.log(
                        "[HobbyFlow] startHobbySession result:",
                        result,
                      );

                      if (result.success && result.session) {
                        console.log("[HobbyFlow] Session started successfully");
                        setHobbySessionId(result.session.id);
                        setCurrentHobbyQuestion(result.first_question);
                        setCurrentHobbyAnswer(null);
                        setCurrentHobbyAnswers([]);
                      } else {
                        console.error(
                          "[HobbyFlow] Failed to start session:",
                          result,
                        );
                        const errorMsg =
                          result.error ||
                          result.details ||
                          "Erreur lors du démarrage";
                        toast.error(errorMsg);
                        setSelectedHobby(null);
                        setShowHobbySelection(true);
                      }
                    } catch (error) {
                      console.error(
                        "[HobbyFlow] Exception starting hobby session:",
                        error,
                      );
                      toast.error(error.message || "Erreur inattendue");
                      setSelectedHobby(null);
                      setShowHobbySelection(true);
                    }
                  }}
                  className="p-6 rounded-2xl border border-white/10 bg-slate-900/60 hover:border-teal-500/70 hover:bg-slate-900/80 transition-all text-center space-y-3 shadow-lg"
                >
                  <div className="text-5xl">{hobby.emoji}</div>
                  <div className="text-lg sm:text-xl font-semibold text-white">
                    {hobby.name}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <Button
                onClick={() => setShowHobbySelection(false)}
                variant="outline"
                className="px-6 py-2 rounded-full border-teal-400 text-teal-300 hover:bg-teal-500/10 hover:border-teal-300 transition-all"
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hobby Question Display */}
      {currentHobbyQuestion && !hobbyProfile && (
        <Card className="glass-card border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900/60 mt-6">
          <CardHeader className="pt-4 sm:pt-6 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">
              {currentHobbyQuestion.question_text}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {selectedHobby} - Question {currentHobbyQuestion.order_index}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4 sm:pb-6 px-4 sm:px-6 lg:px-8">
            <div className="space-y-4">
              {/* Multiple Choice Question (styled like DISC questions) */}
              {currentHobbyQuestion.question_type === "multiple_choice" && (
                <div className="space-y-3">
                  {currentHobbyDisplayOptions.map(({ key, label }) => {
                    const isSelected = currentHobbyAnswers.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          toggleHobbyMultiAnswer(key);
                        }}
                        className={`w-full p-4 text-left rounded-lg border-2 transition-all flex items-center gap-3 ${
                          isSelected
                            ? "border-[#3d6b66]/80 bg-[#3d6b66]/40 text-white"
                            : "border-[#3d6b66]/40 bg-[#3d6b66]/10 text-white hover:border-[#3d6b66]/60 hover:bg-[#3d6b66]/20"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? "border-white bg-white/20"
                              : "border-white/60"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                  {currentHobbyAnswers.length > 0 && (
                    <p className="text-sm text-slate-300 mt-2">
                      {currentHobbyAnswers.length} réponse
                      {currentHobbyAnswers.length > 1 ? "s" : ""} sélectionnée
                      {currentHobbyAnswers.length > 1 ? "s" : ""}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Maximum {MAX_HOBBY_MULTI_ANSWERS} réponses.
                  </p>
                </div>
              )}

              {/* Open Text Question (free input, like favorite player/team) */}
              {currentHobbyQuestion.question_type === "open_text" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={currentHobbyAnswer || ""}
                    onChange={(e) => setCurrentHobbyAnswer(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900/80 border border-slate-500/60 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Ta réponse..."
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4 flex gap-3">
              <Button
                onClick={async () => {
                  const hasAnswer =
                    currentHobbyQuestion.question_type === "multiple_choice"
                      ? currentHobbyAnswers.length > 0
                      : currentHobbyAnswer !== null &&
                        currentHobbyAnswer !== "";

                  if (!hasAnswer) {
                    toast.error("Veuillez répondre à la question");
                    return;
                  }

                  if (!hobbySessionId || !currentHobbyQuestion?.id) {
                    toast.error("Session ou question manquante");
                    return;
                  }

                  setSubmittingHobbyAnswer(true);

                  const answerJson =
                    currentHobbyQuestion.question_type === "multiple_choice" &&
                    currentHobbyAnswers.length > 0
                      ? { answers: currentHobbyAnswers }
                      : null;

                  const answerValue =
                    currentHobbyQuestion.question_type === "multiple_choice"
                      ? null
                      : currentHobbyAnswer;

                  const result = await submitHobbyAnswer(
                    hobbySessionId,
                    currentHobbyQuestion.id,
                    answerValue,
                    answerJson,
                  );

                  if (result.success) {
                    if (result.is_complete) {
                      // All questions answered, get GPT recommendation
                      setGettingHobbyRecommendation(true);
                      const recResult =
                        await getHobbyRecommendation(hobbySessionId);
                      if (recResult.success && recResult.profile) {
                        setHobbyProfile(recResult.profile);
                        setCurrentHobbyQuestion(null);
                        toast.success("Recommandation générée avec succès !");
                      } else {
                        toast.error(
                          recResult.error || "Erreur lors de la génération",
                        );
                      }
                      setGettingHobbyRecommendation(false);
                    } else {
                      // Next question
                      setCurrentHobbyQuestion(result.next_question);
                      setCurrentHobbyAnswer(null);
                      setCurrentHobbyAnswers([]);
                    }
                  } else {
                    toast.error(
                      result.error || "Erreur lors de l'envoi de la réponse",
                    );
                  }

                  setSubmittingHobbyAnswer(false);
                }}
                className="flex-1 h-12 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] font-semibold"
                size="lg"
                disabled={
                  submittingHobbyAnswer ||
                  gettingHobbyRecommendation ||
                  ((currentHobbyAnswer === null || currentHobbyAnswer === "") &&
                    (currentHobbyQuestion?.question_type !==
                      "multiple_choice" ||
                      currentHobbyAnswers.length === 0))
                }
              >
                {submittingHobbyAnswer
                  ? "Envoi..."
                  : gettingHobbyRecommendation
                    ? "Génération..."
                    : "Suivant"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hobby Results - Ton Rôle Idéal */}
      {hobbyProfile && computedProfile && (
        <Card className="glass-card border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900/60 mt-6">
          <CardHeader className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              {selectedHobby &&
                HOBBIES.find((h) => h.name === selectedHobby)?.emoji && (
                  <span className="text-3xl">
                    {HOBBIES.find((h) => h.name === selectedHobby)?.emoji}
                  </span>
                )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl sm:text-2xl font-bold text-white">
                  {selectedHobby} - Ton Rôle Idéal
                </CardTitle>
                {computedProfile.dominant_color &&
                  DISC_ELEMENTS[computedProfile.dominant_color] && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg">
                        {DISC_ELEMENTS[computedProfile.dominant_color].icon}
                      </span>
                      <span className="text-sm text-teal-200">
                        Énergie{" "}
                        {
                          DISC_ELEMENTS[computedProfile.dominant_color]
                            .elementFr
                        }
                      </span>
                    </div>
                  )}
              </div>
            </div>
            <CardDescription className="text-slate-300 mt-2">
              Recommandation basée sur ton profil Lumi
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4 sm:pb-6 px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {/* Fit Score */}
              {hobbyProfile.fit_score !== null && (
                <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-300">
                      Score de compatibilité
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {hobbyProfile.fit_score}%
                    </p>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        hobbyProfile.fit_score >= 80
                          ? "bg-green-400"
                          : hobbyProfile.fit_score >= 50
                            ? "bg-yellow-400"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${hobbyProfile.fit_score}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Recommended Role */}
              {hobbyProfile.recommended_role && (
                <div className="p-4 rounded-xl border border-teal-500/40 bg-teal-500/10">
                  <p className="text-sm text-teal-200 mb-2">Rôle recommandé</p>
                  <p className="text-2xl font-bold text-white">
                    {hobbyProfile.recommended_role}
                  </p>
                </div>
              )}

              {/* Description */}
              {hobbyProfile.description && (
                <div className="p-4 rounded-xl border border-white/10 bg-slate-900/70">
                  <h4 className="text-lg font-semibold text-white mb-2">
                    Description
                  </h4>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-line">
                    {hobbyProfile.description}
                  </p>
                </div>
              )}

              {/* Development Tips */}
              {hobbyProfile.development_tips && (
                <div className="p-4 rounded-xl border border-white/10 bg-slate-900/70">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    💡 Conseils de développement
                  </h4>
                  <div className="space-y-2">
                    {hobbyProfile.development_tips
                      .split("\n")
                      .filter((tip) => tip.trim())
                      .map((tip, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-slate-200"
                        >
                          <span className="text-teal-400 mt-0.5">•</span>
                          <span>{tip.trim()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Decorative football DISC card under hobby results when Football is selected */}
      {hobbyProfile && selectedHobby === "Football" && (
        <div className="mt-4 flex justify-center">
          <Card
            className="rounded-xl border-none bg-transparent overflow-hidden w-full max-w-[360px]"
            style={{
              backgroundImage: "url('/football-disc-card/17 Fond.png')",
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              minHeight: "260px",
            }}
          >
            <CardContent className="h-full w-full sm:px-8 py-4 space-y-4 justify-center">
              {/* Header: title + logo */}
              <div className="w-full flex  items-center">
                <div className="rounded-xl relative bg-gradient-to-b from-green-800/45 to-black-500/10 shadow-lg shadow-sky-900/60 px-6 py-2 text-center">
                  <p className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase">
                    Profil du joueur
                  </p>
                  <div className="absolute -top-3 -right-17">
                    <img
                      src="/football-disc-card/Logo-Genup.png"
                      alt="Genup"
                      className="w-22"
                    />
                  </div>
                </div>
              </div>

              {/* First section: player photo, radar chart, details, skill badges */}
              {computedProfile && (
                <div className="rounded-xl border-[4px] border-teal-500/80 p-3 space-y-3">
                  <div className="flex gap-3 items-start justify-evenly">
                    {/* Left: player photo placeholder / real photo */}
                    <div className="shrink-0 flex flex-col items-center">
                      <button
                        type="button"
                        onClick={handleAvatarClick}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-600/90 border-2 border-white/40 flex items-center justify-center overflow-hidden ring-2 ring-white/20 ${
                          !localAvatarUrl ? "cursor-pointer hover:ring-teal-400/60" : ""
                        }`}
                      >
                        {localAvatarUrl ? (
                          <img
                            src={localAvatarUrl}
                            alt={userName || "Photo joueur"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white/70" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                        )}
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                      <p className="text-[10px] sm:text-xs font-semibold text-white mt-1 uppercase truncate max-w-[72px] sm:max-w-[80px] text-center">
                        {userName ? String(userName).trim() : "—"}
                      </p>
                      <div className=" text-white text-xs">
                        {hobbyProfile?.recommended_role || "—"}
                      </div>
                      
                    </div>
                    {/* Right: radar chart (Air, Eau, Terre, Feu) */}
                    <div className=" min-w-0 flex flex-col items-center">
                      <RadarChartFourElements
                        dominantColor={computedProfile.dominant_color}
                        secondaryColor={computedProfile.secondary_color}
                      />
                      <div className="mt-1 text-[10px] text-white/90">
                        <p>
                          Joueur:{" "}
                          <span className="font-semibold">
                            {favoritePlayer || "-"}
                          </span>
                        </p>
                        <p>
                          Équipe:{" "}
                          <span className="font-semibold">
                            {favoriteTeam || "—"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Skill badges row (4 icons, dominant / secondary characteristics) */}
                  {skillBadges.length > 0 && (
                    <div className="flex justify-center gap-1.5">
                      {skillBadges.map((badge) => (
                        <div
                          key={badge.key}
                          className="flex flex-col items-center"
                          title={badge.label}
                        >
                          <img
                            src={`/football-disc-card/${badge.src}`}
                            alt=""
                            className="w-20 h-20 object-contain"
                          />
                          <span className="text-[8px] sm:text-[9px] text-white/80 text-center max-w-[72px] leading-tight line-clamp-2">
                            {badge.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Motivational line above second section */}
              <p className="text-base sm:text-lg font-bold text-teal-400">
                Ta créativité fait de toi un joueur unique !
              </p>
              {/* Second section: text, robot, CTA */}
              <div className="relative rounded-xl bg-white/10 border border-white/10 p-4 min-h-[200px]">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-1">
                      Fier de son premier micro ?
                    </p>
                    <p className="text-xs text-slate-300 mb-1">
                      <Link
                        to="/module-mimetique"
                        className="text-teal-400 font-medium hover:text-teal-300 underline underline-offset-2"
                      >
                        Cliquer ici
                      </Link>
                    </p>
                    <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
                      <li>ta vidéo talent</li>
                      <li>ton profil complet</li>
                      <li>rejoindre l&apos;association et nos coachs</li>
                    </ul>
                  </div>
                </div>
                <img
                  src="/football-disc-card/23 Lumi foot.png"
                  alt="Lumi"
                  className="absolute bottom-2 -right-20 w-40 h-64 object-contain object-bottom"
                />
                <p className="text-sm sm:text-base font-bold text-teal-400 mt-4">
                  Rejoins l&apos;association et nos coachs !
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
