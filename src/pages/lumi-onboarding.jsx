// src/pages/lumi-onboarding.jsx
// Lumi Onboarding Page - Quick discovery flow

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.jsx";
import { startLumiSession, submitAnswer, computeProfile, getMyLumiProfile, getSessionAgeRange } from "../services/lumiService.js";
import HobbyFlow from "../components/HobbyFlow.jsx";
import { checkVideoProfileInformation } from "../services/videoService.js";
import { useUser } from "@supabase/auth-helpers-react";
import { toast } from "sonner";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import OdysseySteps from "../components/OdysseySteps.jsx";

// Age range options
const AGE_RANGES = [
  { value: "16-20", label: "16-20 ans" },
  { value: "21-30", label: "21-30 ans" },
  { value: "31-45", label: "31-45 ans" },
  { value: "46+", label: "46 ans et plus" },
];

// DISC Color to Element mapping
const DISC_ELEMENTS = {
  'rouge': {
    element: 'Fire',
    elementFr: 'Feu',
    icon: '🔥',
    description: 'You are Fire: direct, driven, and action-oriented. You move fast, take decisions, and push things forward.',
    descriptionFr: 'Tu es Feu : direct, déterminé et orienté action. Tu agis vite, prends des décisions et fais avancer les choses.',
    colorClass: 'from-red-500/20 to-red-600/10',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-200'
  },
  'jaune': {
    element: 'Air',
    elementFr: 'Air',
    icon: '🌬️',
    description: 'You are Air: creative, communicative, and full of ideas. You bring innovation, connect people, and keep the energy high.',
    descriptionFr: 'Tu es Air : créatif, communicatif et plein d\'idées. Tu apportes l\'innovation, connectes les gens et maintiens l\'énergie.',
    colorClass: 'from-yellow-500/20 to-yellow-600/10',
    borderClass: 'border-yellow-500/30',
    textClass: 'text-yellow-200'
  },
  'vert': {
    element: 'Earth',
    elementFr: 'Terre',
    icon: '🌱',
    description: 'You are Earth: stable, supportive, and harmonious. You bring calm, loyalty, and team spirit.',
    descriptionFr: 'Tu es Terre : stable, solidaire et harmonieux. Tu apportes le calme, la loyauté et l\'esprit d\'équipe.',
    colorClass: 'from-green-500/20 to-green-600/10',
    borderClass: 'border-green-500/30',
    textClass: 'text-green-200'
  },
  'bleu': {
    element: 'Water',
    elementFr: 'Eau',
    icon: '💧',
    description: 'You are Water: analytical, deep, and precise. You think before acting, go deep, and bring structure.',
    descriptionFr: 'Tu es Eau : analytique, profond et précis. Tu réfléchis avant d\'agir, vas en profondeur et apportes la structure.',
    colorClass: 'from-blue-500/20 to-blue-600/10',
    borderClass: 'border-blue-500/30',
    textClass: 'text-blue-200'
  }
};

// Function to determine age range from age number
function getAgeRangeFromAge(age) {
  if (age >= 16 && age <= 20) return "16-20";
  if (age >= 21 && age <= 30) return "21-30";
  if (age >= 31 && age <= 45) return "31-45";
  if (age >= 46) return "46+";
  return null;
}

export default function LumiOnboarding({ onSignOut }) {
  const navigate = useNavigate();
  const user = useUser();
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [checkingAge, setCheckingAge] = useState(true);
  const [ageRange, setAgeRange] = useState(null);
  const [showAgeSelection, setShowAgeSelection] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState(null); // For single answers (open_text, scale)
  const [currentAnswers, setCurrentAnswers] = useState([]); // For multiple answers (multiple_choice)
  const [displayOptions, setDisplayOptions] = useState([]); // Shuffled options for multiple_choice
  const [submitting, setSubmitting] = useState(false);
  const [computingProfile, setComputingProfile] = useState(false);
  const [computedProfile, setComputedProfile] = useState(null);
  const hasCheckedVideoAge = useRef(false);

  const MAX_MULTI_ANSWERS = 2;

  function toggleMultiAnswer(value) {
    setCurrentAnswers((prev) => {
      const isSelected = prev.includes(value);
      if (isSelected) {
        return prev.filter((v) => v !== value);
      }
      if (prev.length >= MAX_MULTI_ANSWERS) {
        toast.error(`Tu peux sélectionner au maximum ${MAX_MULTI_ANSWERS} réponses.`);
        return prev;
      }
      return [...prev, value];
    });
  }

  // Build a randomized display order for multiple choice options when question changes
  useEffect(() => {
    if (!currentQuestion || currentQuestion.question_type !== "multiple_choice") {
      setDisplayOptions([]);
      return;
    }

    const raw = currentQuestion.options?.options;
    let items = [];

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      // Object form: { key: label }
      items = Object.entries(raw).map(([key, label]) => ({ key, label }));
    } else if (Array.isArray(raw)) {
      // Array form: [label1, label2, ...] – use label as key as well
      items = raw.map((label) => ({ key: label, label }));
    }

    // Shuffle once (Fisher–Yates)
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    setDisplayOptions(items);
  }, [currentQuestion]);

  // Check if user already has a profile and get age from videos (only once on mount)
  useEffect(() => {
    
    if (!user?.id) {
      return;
    }
    
    if (hasCheckedVideoAge.current) {
      return;
    }
    
    // Check if ageRange is already set BEFORE doing anything async
    if (ageRange) {
      return;
    }
    
    const checkExistingProfileAndAge = async () => {
      hasCheckedVideoAge.current = true;
      setCheckingProfile(true);
      setCheckingAge(true);
      
      // Check for existing profile
      const result = await getMyLumiProfile();
      if (result.success && result.profile) {
        setComputedProfile(result.profile);
        
        // Try to get ageRange from the session that created this profile
        if (result.profile.session_id) {
          const ageRangeResult = await getSessionAgeRange(result.profile.session_id);
          if (ageRangeResult.success && ageRangeResult.age_range) {
            setAgeRange(ageRangeResult.age_range);
          }
        }
        
        setCheckingProfile(false);
        setCheckingAge(false);
        return;
      }
      
      // Only check videos if ageRange is still not set
      try {
        const result = await checkVideoProfileInformation(user.id);
        if (result.hasProfileInfo && result.ageRange) {
          setAgeRange(result.ageRange);
        } else {
          setShowAgeSelection(true);
        }
      } catch (err) {
        console.error('[STEP 13] Error checking age from videos:', err);
        setShowAgeSelection(true);
      }
      
      setCheckingAge(false);
      setCheckingProfile(false);
    };
    
    checkExistingProfileAndAge();
  }, [user, ageRange]);

  // Show loading while checking for existing profile or age
  if (checkingProfile || checkingAge) {
    return (
      <OdysseyLayout
        currentStep={2}
        title=""
        maxWidthClass="max-w-6xl"
        onSignOut={onSignOut}
      >
        <h1 className="text-2xl sm:text-3xl font-semibold text-white text-center mt-2">
          Le scan des 4 éléments
        </h1>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">✨</div>
          <p className="text-white/80">Chargement...</p>
        </div>
      </OdysseyLayout>
    );
  }

  return (
    <OdysseyLayout
      currentStep={2}
      title=""
      maxWidthClass="max-w-6xl"
      onSignOut={onSignOut}
    >
      <h1 className="text-2xl sm:text-3xl font-semibold text-white text-center mt-2">
        Le scan des 4 éléments
      </h1>
      <p className="text-white/90 text-center mt-3 mb-6 max-w-2xl mx-auto">
        Test rapide pour révéler ton élément (Feu, Air, Eau, Terre) et faire naître ton étoile.
      </p>
      {/* Age Selection Card - Show if age not found */}
      {showAgeSelection && !ageRange && !currentQuestion && !computedProfile && (
        <Card className="glass-card border-white/10 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-500 bg-white/95">
          <CardHeader className="text-center pt-6">
            <CardTitle className="text-2xl font-bold text-white">
              Quelle tranche d&apos;âge vous correspond le mieux ?
            </CardTitle>
            <CardDescription className="text-slate-500">
              Cette information nous permet de vous proposer des questions adaptées à votre situation.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
              <div className="space-y-3">
                {AGE_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => {
                      const selectedValue = range.value;
                      setAgeRange(selectedValue);
                      setShowAgeSelection(false);
                    }}
                    className="w-full p-4 text-left rounded-lg border-2 border-[#3d6b66]/40 bg-[#3d6b66]/10 text-white hover:border-[#3d6b66]/60 hover:bg-[#3d6b66]/20 transition-all"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Welcome Card - Only show when no question, no existing profile, and age range is set */}
        {!currentQuestion && !computedProfile && ageRange && !showAgeSelection && (
          <Card className="glass-card border-white/10 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-500 bg-white/95 mt-8">
            <CardHeader className="text-center pt-6">
              <CardTitle className="text-2xl font-bold text-white">
                Bienvenue dans l&apos;univers SpotBulle
              </CardTitle>
              <CardDescription className="text-slate-500">
                Lumi va te poser quelques questions pour mieux te connaître.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="space-y-4">
                <p className="text-slate-300">
                  Ce parcours rapide te permettra de :
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-300 ml-4">
                  <li>Découvrir ta couleur dominante (DISC)</li>
                  <li>Identifier tes traits de personnalité</li>
                  <li>Explorer les constellations qui te correspondent</li>
                  <li>Recevoir des recommandations personnalisées</li>
                </ul>
                <div className="pt-4">
                  <Button
                    onClick={async () => {
                      if (!ageRange) {
                        toast.error("Veuillez sélectionner une tranche d'âge");
                        return;
                      }
                      setLoading(true);
                      const result = await startLumiSession("onboarding", ageRange);
                      setLoading(false);

                      if (result.success) {
                        if (!result.session_id) {
                          console.error("No session_id in result:", result);
                          toast.error("Session ID manquant dans la réponse");
                          return;
                        }
                        setSessionId(result.session_id);
                        setCurrentQuestion(result.first_question);
                        toast.success("Session démarrée !");
                      } else {
                        toast.error(
                          result.error ||
                            "Erreur lors du démarrage de la session"
                        );
                      }
                    }}
                    className="w-full h-12 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] font-semibold"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? "Chargement..." : "Lancer le scan avec Lumi"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

         {/* Computing Profile Loading */}
         {computingProfile && (
           <Card className="bg-slate-900/60 border-slate-800">
             <CardContent className="py-12">
               <div className="text-center">
                 <div className="text-4xl mb-4">✨</div>
                 <h3 className="text-xl font-semibold text-white mb-2">
                   Calcul de ton profil...
                 </h3>
                 <p className="text-slate-400">
                   Lumi analyse tes réponses pour révéler qui tu es
                 </p>
               </div>
             </CardContent>
           </Card>
         )}

        {/* Profile Results */}
        {computedProfile && (
          <Card className="glass-card border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-500 bg-white/95 mt-6 sm:mt-8">
            <CardHeader className="text-center pt-4 sm:pt-6 px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl font-bold text-white">
                Profil du joueur
              </CardTitle>
              <CardDescription className="text-slate-500 text-sm sm:text-base">
                Synthèse de ton profil Lumi (4 éléments)
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6 px-4 sm:px-6 lg:px-8">
              {/* Top summary row inspired by player card */}
              <div className="grid grid-cols-1 md:grid-cols-[2fr,3fr] gap-4 sm:gap-6 items-center mb-4 sm:mb-6">
                {/* Left: avatar + basic info */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#3d6b66]/20 border border-[#3d6b66]/60 flex items-center justify-center text-3xl sm:text-4xl text-white shadow-lg shadow-teal-900/30">
                    {computedProfile.dominant_color && DISC_ELEMENTS[computedProfile.dominant_color]
                      ? DISC_ELEMENTS[computedProfile.dominant_color].icon
                      : "⭐️"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg font-semibold text-white truncate sm:whitespace-normal">
                      {user?.user_metadata?.full_name || user?.email || "Ton profil Lumi"}
                    </p>
                    <p className="text-[10px] sm:text-xs text-teal-100/80">
                      Profil Lumi • 4 éléments
                    </p>
                  </div>
                </div>

                {/* Right: dominant + secondary elements summary with description */}
                <div className="bg-slate-900/40 border border-teal-500/40 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-4">
                  <p className="text-xs uppercase tracking-widest text-teal-200 mb-2 sm:mb-3">
                    Tes deux énergies clés
                  </p>
                  <div className="flex flex-row gap-3 text-xs">
                    {[computedProfile.dominant_color, computedProfile.secondary_color]
                      .filter((colorKey) => colorKey && DISC_ELEMENTS[colorKey])
                      .map((colorKey, idx) => {
                        const el = DISC_ELEMENTS[colorKey];
                        const isDom = idx === 0;
                        const base =
                          "flex-1 flex flex-col rounded-xl border px-3 py-2 transition-colors";
                        const classes = isDom
                          ? "bg-[#3d6b66] border-[#3d6b66] text-white"
                          : "bg-[#3d6b66]/20 border-[#3d6b66]/70 text-teal-50";
                        return (
                          <div key={colorKey} className={`${base} ${classes}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{el.icon}</span>
                              <div>
                                <p className="text-[11px] font-semibold">
                                  {el.elementFr}
                                </p>
                                <p className="text-[10px] text-slate-200/80">
                                  {isDom ? "Énergie principale" : "Énergie secondaire"}
                                </p>
                              </div>
                            </div>
                            <p className="text-[11px] leading-snug text-slate-100/90">
                              {el.descriptionFr}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Énergie Principale summary block */}
              {computedProfile.dominant_color && DISC_ELEMENTS[computedProfile.dominant_color] && (
                <div className="rounded-xl sm:rounded-2xl border border-teal-500/40 bg-slate-900/40 px-3 sm:px-4 py-3 sm:py-4 mb-4 sm:mb-6">
                  <h3 className="text-xs sm:text-sm font-semibold text-teal-200 mb-2">
                    Énergie Principale : {DISC_ELEMENTS[computedProfile.dominant_color].elementFr}
                  </h3>
                  {computedProfile.traits?.combined_description && (
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed mb-2">
                      {computedProfile.traits.combined_description}
                    </p>
                  )}
                  {computedProfile.traits?.dominant?.percentage != null && computedProfile.traits?.secondary?.percentage != null && (
                    <p className="text-xs text-teal-100/90">
                      Votre profil est élevéement orienté {computedProfile.dominant_color} ({computedProfile.traits.dominant.percentage}%), avec une tendance {computedProfile.secondary_color} ({computedProfile.traits.secondary.percentage}%).
                    </p>
                  )}
                </div>
              )}

              {/* Profil Dominant + Secondaire (responsive: stack on small, row on sm+) */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4 sm:mb-6">
                {/* Profil Dominant (in-card) */}
                {computedProfile.traits?.dominant && computedProfile.dominant_color && DISC_ELEMENTS[computedProfile.dominant_color] && (
                  <div className="flex-1 min-w-0 rounded-xl sm:rounded-2xl border border-teal-500/40 bg-slate-900/40 px-3 sm:px-4 py-3 sm:py-4 space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl sm:text-2xl shrink-0">{DISC_ELEMENTS[computedProfile.dominant_color].icon}</span>
                        <h3 className="text-xs sm:text-sm font-semibold text-teal-200 truncate">
                          Profil Dominant • {DISC_ELEMENTS[computedProfile.dominant_color].elementFr}
                        </h3>
                      </div>
                      <span className="text-[10px] sm:text-xs text-teal-100/90 shrink-0">
                        {computedProfile.traits.dominant.intensity} ({computedProfile.traits.dominant.percentage}%)
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-white">
                      {computedProfile.traits.dominant.name}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {computedProfile.traits.dominant.description}
                    </p>
                    {computedProfile.traits.dominant.traits && computedProfile.traits.dominant.traits.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {computedProfile.traits.dominant.traits.map((trait, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-200 text-xs border border-teal-500/40"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    )}
                    {computedProfile.traits.dominant.characteristics && computedProfile.traits.dominant.characteristics.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-teal-200/90">Caractéristiques :</p>
                        {computedProfile.traits.dominant.characteristics.map((char, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                            <span className="text-teal-400 mt-0.5">•</span>
                            <span>{char}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Profil Secondaire (in-card) */}
                {computedProfile.traits?.secondary && computedProfile.secondary_color && DISC_ELEMENTS[computedProfile.secondary_color] && (
                  <div className="flex-1 min-w-0 rounded-xl sm:rounded-2xl border border-teal-500/40 bg-slate-900/40 px-3 sm:px-4 py-3 sm:py-4 space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl sm:text-2xl shrink-0">{DISC_ELEMENTS[computedProfile.secondary_color].icon}</span>
                        <h3 className="text-xs sm:text-sm font-semibold text-teal-200 truncate">
                          Profil Secondaire • {DISC_ELEMENTS[computedProfile.secondary_color].elementFr}
                        </h3>
                      </div>
                      <span className="text-[10px] sm:text-xs text-teal-100/90 shrink-0">
                        {computedProfile.traits.secondary.intensity} ({computedProfile.traits.secondary.percentage}%)
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-white">
                      {computedProfile.traits.secondary.name}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {computedProfile.traits.secondary.description}
                    </p>
                    {computedProfile.traits.secondary.traits && computedProfile.traits.secondary.traits.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {computedProfile.traits.secondary.traits.map((trait, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-200 text-xs border border-teal-500/40"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    )}
                    {computedProfile.traits.secondary.characteristics && computedProfile.traits.secondary.characteristics.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-teal-200/90">Caractéristiques :</p>
                        {computedProfile.traits.secondary.characteristics.map((char, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                            <span className="text-teal-400 mt-0.5">•</span>
                            <span>{char}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        )}

         {/* Hobby Flow Component */}
         <HobbyFlow
          computedProfile={computedProfile}
          ageRange={ageRange}
          userName={user?.user_metadata?.full_name || user?.user_metadata?.name || (user?.email ? user.email.split("@")[0] : null)}
        />

         {/* Précédent / Continuer navigation */}
         {computedProfile && (
           <div className="mt-8 flex justify-between items-center">
             <Button
               onClick={() => navigate('/embark')}
               size="lg"
               className="bg-teal-600 hover:bg-teal-500 text-white px-8"
             >
               ← Précédent
             </Button>
             <Button
               onClick={() => navigate('/module-mimetique')}
               size="lg"
               className="bg-teal-600 hover:bg-teal-500 text-white px-8"
             >
               Continuer →
             </Button>
           </div>
         )}

        {/* Question Display */}
        {currentQuestion && !computingProfile && !computedProfile && (
          <Card className="glass-card border-white/10 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-500 bg-white/95 mt-8">
            <CardHeader className="pt-6">
              <CardTitle className="text-2xl font-bold text-white">
                {currentQuestion.question_text}
              </CardTitle>
              <CardDescription className="text-slate-500">
                Question {currentQuestion.order_index}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="space-y-4">
                {/* Open Text Question */}
                {currentQuestion.question_type === "open_text" && (
                  <input
                    type="text"
                    value={currentAnswer || ""}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Ta réponse..."
                  />
                )}

                {/* Scale Question */}
                {currentQuestion.question_type === "scale" && (
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={currentAnswer || ""}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      min={currentQuestion.options?.min || 0}
                      max={currentQuestion.options?.max || 100}
                      className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Ta réponse..."
                    />
                    {currentQuestion.options?.min &&
                      currentQuestion.options?.max && (
                        <p className="text-sm text-slate-500">
                          Entre {currentQuestion.options.min} et{" "}
                          {currentQuestion.options.max}
                        </p>
                      )}
                  </div>
                )}

                {/* Multiple Choice Question - Supports Multiple Answers */}
                {currentQuestion.question_type === "multiple_choice" && (
                  <div className="space-y-3">
                    {displayOptions.map(({ key, label }) => {
                      const isSelected = currentAnswers.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            toggleMultiAnswer(key);
                          }}
                          className={`w-full p-4 text-left rounded-lg border-2 transition-all flex items-center gap-3 ${
                            isSelected
                              ? "border-[#3d6b66]/80 bg-[#3d6b66]/40 text-white"
                              : "border-[#3d6b66]/40 bg-[#3d6b66]/10 text-white hover:border-[#3d6b66]/60 hover:bg-[#3d6b66]/20"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? "border-white bg-white/20"
                              : "border-white/60"
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span>{label}</span>
                        </button>
                      );
                    })}
                    {currentAnswers.length > 0 && (
                      <p className="text-sm text-slate-500 mt-2">
                        {currentAnswers.length} réponse{currentAnswers.length > 1 ? 's' : ''} sélectionnée{currentAnswers.length > 1 ? 's' : ''}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      Maximum {MAX_MULTI_ANSWERS} réponses.
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-4 flex gap-3">
                  <Button
                    onClick={async () => {
                      // Check if question has an answer (single or multiple)
                      const hasSingleAnswer = currentAnswer !== null && currentAnswer !== '';
                      const hasMultipleAnswers = currentQuestion.question_type === "multiple_choice" && currentAnswers.length > 0;
                      
                      if (!hasSingleAnswer && !hasMultipleAnswers) {
                        toast.error("Veuillez répondre à la question");
                        return;
                      }

                      if (!sessionId) {
                        toast.error("Session ID manquant");
                        return;
                      }
                      if (!currentQuestion?.id) {
                        toast.error("Question ID manquant");
                        console.error("Current question:", currentQuestion);
                        return;
                      }

                      setSubmitting(true);
                      
                      // Prepare answer data
                      let answerValue = null;
                      let answerJson = null;
                      
                      if (currentQuestion.question_type === "multiple_choice") {
                        // For multiple choice, send as array in answer_json
                        answerJson = { answers: currentAnswers };
                        answerValue = currentAnswers.join(', '); // Also store as comma-separated string for compatibility
                      } else {
                        // For single answers (open_text, scale), use answer_value
                        answerValue = currentAnswer;
                      }
                     
                      const result = await submitAnswer(
                        sessionId,
                        currentQuestion.id,
                        answerValue,
                        answerJson
                      );
                      setSubmitting(false);

                      if (result.success) {
                        if (result.session_complete) {
                          // Compute profile when all questions are answered
                          setComputingProfile(true);
                          const profileResult = await computeProfile(sessionId);
                          setComputingProfile(false);

                          if (profileResult.success) {
                            setComputedProfile(profileResult.profile);
                            // Update ageRange from session if it was returned
                            if (profileResult.age_range && !ageRange) {
                              setAgeRange(profileResult.age_range);
                            }
                            toast.success("Profil calculé avec succès !");
                          } else {
                            toast.error(profileResult.error || "Erreur lors du calcul du profil");
                          }
                        } else {
                          setCurrentQuestion(result.next_question);
                          setCurrentAnswer(null);
                          setCurrentAnswers([]);
                        }
                      } else {
                        toast.error(
                          result.error || "Erreur lors de l'envoi de la réponse"
                        );
                      }
                    }}
                    className="flex-1 h-12 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] font-semibold"
                    size="lg"
                    disabled={submitting || ((currentAnswer === null || currentAnswer === '') && (currentQuestion?.question_type !== "multiple_choice" || currentAnswers.length === 0))}
                  >
                    {submitting ? "Envoi..." : "Suivant"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
    </OdysseyLayout>
  );
}
