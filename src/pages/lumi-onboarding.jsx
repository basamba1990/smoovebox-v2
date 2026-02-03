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

export default function LumiOnboarding() {
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
  const [submitting, setSubmitting] = useState(false);
  const [computingProfile, setComputingProfile] = useState(false);
  const [computedProfile, setComputedProfile] = useState(null);
  const hasCheckedVideoAge = useRef(false);

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
      <div className="min-h-screen py-10" style={{ backgroundColor: "#3d6b66" }}>
        <div className="max-w-4xl mx-auto px-4">
          <OdysseySteps currentStep={2} className="mb-8" />
          <div className="text-center py-12">
            <div className="text-4xl mb-4">✨</div>
            <p className="text-white/80">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: "#3d6b66" }}>
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        <OdysseySteps currentStep={2} />
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold text-white">
            Le scan des 4 éléments
          </h1>
          <p className="text-white/90 max-w-2xl mx-auto">
            Test rapide pour révéler ton élément (Feu, Air, Eau, Terre) et faire naître ton étoile.
          </p>
        </div>

        {/* Age Selection Card - Show if age not found */}
        {showAgeSelection && !ageRange && !currentQuestion && !computedProfile && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white">
                Quelle tranche d'âge vous correspond le mieux ?
              </CardTitle>
              <CardDescription className="text-slate-400">
                Cette information nous permet de vous proposer des questions adaptées à votre situation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {AGE_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => {
                      const selectedValue = range.value;
                      setAgeRange(selectedValue);
                      setShowAgeSelection(false);
                    }}
                    className="w-full p-4 text-left rounded-lg border-2 border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:bg-indigo-500/20 transition-all"
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
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white">
                Bienvenue dans l'univers SpotBulle
              </CardTitle>
              <CardDescription className="text-slate-400">
                Lumi va te poser quelques questions pour mieux te connaître
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    className="w-full"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? "Chargement..." : "Commencer avec Lumi"}
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
           <Card className="bg-white border-slate-200 shadow-lg">
             <CardHeader>
               <CardTitle className="text-2xl text-slate-800">
                 Ton Profil
               </CardTitle>
               <CardDescription className="text-slate-600">
                 Découvre qui tu es vraiment
               </CardDescription>
             </CardHeader>
             <CardContent>
               <div className="space-y-6">
                 {/* Dominant and Secondary Colors with Elements */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {/* Dominant Color with Element */}
                   {computedProfile.dominant_color && DISC_ELEMENTS[computedProfile.dominant_color] && (
                     <div className={`p-4 bg-gradient-to-br ${DISC_ELEMENTS[computedProfile.dominant_color].colorClass} rounded-lg border ${DISC_ELEMENTS[computedProfile.dominant_color].borderClass}`}>
                       <div className="flex items-center gap-3 mb-2">
                         <span className="text-3xl">{DISC_ELEMENTS[computedProfile.dominant_color].icon}</span>
                         <div>
                           <p className="text-sm text-slate-500">Couleur Dominante</p>
                           <p className="text-xl font-bold text-slate-800 capitalize">
                             {computedProfile.dominant_color}
                           </p>
                         </div>
                       </div>
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-sm font-semibold text-slate-800 mb-1">
                          {DISC_ELEMENTS[computedProfile.dominant_color].icon} {DISC_ELEMENTS[computedProfile.dominant_color].elementFr}
                        </p>
                        <p className="text-xs text-slate-600">
                          {DISC_ELEMENTS[computedProfile.dominant_color].descriptionFr}
                        </p>
                      </div>
                     </div>
                   )}
                   
                   {/* Secondary Color with Element */}
                   {computedProfile.secondary_color && DISC_ELEMENTS[computedProfile.secondary_color] && (
                     <div className={`p-4 bg-gradient-to-br ${DISC_ELEMENTS[computedProfile.secondary_color].colorClass} rounded-lg border ${DISC_ELEMENTS[computedProfile.secondary_color].borderClass}`}>
                       <div className="flex items-center gap-3 mb-2">
                         <span className="text-3xl">{DISC_ELEMENTS[computedProfile.secondary_color].icon}</span>
                         <div>
                           <p className="text-sm text-slate-500">Couleur Secondaire</p>
                           <p className="text-xl font-bold text-slate-800 capitalize">
                             {computedProfile.secondary_color}
                           </p>
                         </div>
                       </div>
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-sm font-semibold text-slate-800 mb-1">
                          {DISC_ELEMENTS[computedProfile.secondary_color].icon} {DISC_ELEMENTS[computedProfile.secondary_color].elementFr}
                        </p>
                        <p className="text-xs text-slate-600">
                          {DISC_ELEMENTS[computedProfile.secondary_color].descriptionFr}
                        </p>
                      </div>
                     </div>
                   )}
                 </div>

                 {/* DISC Scores */}
                 {computedProfile.disc_scores && (
                   <div>
                     <h4 className="text-lg font-semibold text-slate-800 mb-3">
                       Scores DISC
                     </h4>
                     <div className="grid grid-cols-4 gap-3">
                       {Object.entries(computedProfile.disc_scores).map(([color, score]) => (
                         <div
                           key={color}
                           className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                         >
                           <p className="text-sm text-slate-500 capitalize mb-1">
                             {color}
                           </p>
                           <p className="text-xl font-bold text-slate-800">{score}</p>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {/* Traits */}
                 {computedProfile.traits && typeof computedProfile.traits === 'object' && !Array.isArray(computedProfile.traits) && (
                   <div className="space-y-6">
                     {/* Combined Description with Element */}
                     {computedProfile.traits.combined_description && computedProfile.dominant_color && DISC_ELEMENTS[computedProfile.dominant_color] && (
                       <div className={`p-4 bg-gradient-to-br ${DISC_ELEMENTS[computedProfile.dominant_color].colorClass} rounded-lg border ${DISC_ELEMENTS[computedProfile.dominant_color].borderClass}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-4xl">{DISC_ELEMENTS[computedProfile.dominant_color].icon}</span>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-800">
                            Ton Énergie Principale : {DISC_ELEMENTS[computedProfile.dominant_color].elementFr}
                          </h3>
                        </div>
                      </div>
                         <p className="text-slate-700 leading-relaxed">
                           {computedProfile.traits.combined_description}
                         </p>
                       </div>
                     )}

                     {/* Profile Type */}
                     {computedProfile.traits.profile_type && (
                       <div className="text-center">
                         <p className="text-sm text-slate-500 mb-1">Type de profil</p>
                         <p className="text-xl font-bold text-slate-800">
                           {computedProfile.traits.profile_type}
                         </p>
                       </div>
                     )}

                     {/* Dominant and Secondary Profiles */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {/* Dominant Profile */}
                       {computedProfile.traits.dominant && computedProfile.dominant_color && DISC_ELEMENTS[computedProfile.dominant_color] && (
                         <div className={`p-4 bg-gradient-to-br ${DISC_ELEMENTS[computedProfile.dominant_color].colorClass} rounded-lg border ${DISC_ELEMENTS[computedProfile.dominant_color].borderClass} space-y-3`}>
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <span className="text-2xl">{DISC_ELEMENTS[computedProfile.dominant_color].icon}</span>
                               <h4 className="text-sm font-semibold text-slate-800">
                                 Profil Dominant • {DISC_ELEMENTS[computedProfile.dominant_color].elementFr}
                               </h4>
                             </div>
                             <span className="text-xs text-slate-600">
                               {computedProfile.traits.dominant.intensity} ({computedProfile.traits.dominant.percentage}%)
                             </span>
                           </div>
                           <p className="text-lg font-bold text-slate-800">
                             {computedProfile.traits.dominant.name}
                           </p>
                          {/* Animal spirit removed */}
                           <p className="text-sm text-slate-600">
                             {computedProfile.traits.dominant.description}
                           </p>
                           {computedProfile.traits.dominant.traits && computedProfile.traits.dominant.traits.length > 0 && (
                             <div className="flex flex-wrap gap-2 mt-2">
                               {computedProfile.traits.dominant.traits.map((trait, idx) => (
                                 <span
                                   key={idx}
                                   className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs border border-amber-200"
                                 >
                                   {trait}
                                 </span>
                               ))}
                             </div>
                           )}
                           {computedProfile.traits.dominant.characteristics && computedProfile.traits.dominant.characteristics.length > 0 && (
                             <div className="mt-3 space-y-1">
                               <p className="text-xs text-slate-500">Caractéristiques :</p>
                               {computedProfile.traits.dominant.characteristics.map((char, idx) => (
                                 <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                                   <span className="text-amber-500 mt-0.5">•</span>
                                   <span>{char}</span>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                       )}

                       {/* Secondary Profile */}
                       {computedProfile.traits.secondary && computedProfile.secondary_color && DISC_ELEMENTS[computedProfile.secondary_color] && (
                         <div className={`p-4 bg-gradient-to-br ${DISC_ELEMENTS[computedProfile.secondary_color].colorClass} rounded-lg border ${DISC_ELEMENTS[computedProfile.secondary_color].borderClass} space-y-3`}>
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <span className="text-2xl">{DISC_ELEMENTS[computedProfile.secondary_color].icon}</span>
                               <h4 className="text-sm font-semibold text-slate-800">
                                 Profil Secondaire • {DISC_ELEMENTS[computedProfile.secondary_color].elementFr}
                               </h4>
                             </div>
                             <span className="text-xs text-slate-600">
                               {computedProfile.traits.secondary.intensity} ({computedProfile.traits.secondary.percentage}%)
                             </span>
                           </div>
                           <p className="text-lg font-bold text-slate-800">
                             {computedProfile.traits.secondary.name}
                           </p>
                          {/* Animal spirit removed */}
                           <p className="text-sm text-slate-600">
                             {computedProfile.traits.secondary.description}
                           </p>
                           {computedProfile.traits.secondary.traits && computedProfile.traits.secondary.traits.length > 0 && (
                             <div className="flex flex-wrap gap-2 mt-2">
                               {computedProfile.traits.secondary.traits.map((trait, idx) => (
                                 <span
                                   key={idx}
                                   className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs border border-emerald-200"
                                 >
                                   {trait}
                                 </span>
                               ))}
                             </div>
                           )}
                           {computedProfile.traits.secondary.characteristics && computedProfile.traits.secondary.characteristics.length > 0 && (
                             <div className="mt-3 space-y-1">
                               <p className="text-xs text-slate-500">Caractéristiques :</p>
                               {computedProfile.traits.secondary.characteristics.map((char, idx) => (
                                 <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                                   <span className="text-emerald-500 mt-0.5">•</span>
                                   <span>{char}</span>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                       )}
                     </div>

                     {/* All Characteristics */}
                     {computedProfile.traits.characteristics && computedProfile.traits.characteristics.length > 0 && (
                       <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                         <h4 className="text-sm font-semibold text-slate-800 mb-3">
                           Vos caractéristiques principales
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                           {computedProfile.traits.characteristics.map((char, idx) => (
                             <div key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                               <span className="text-teal-500 mt-0.5">✓</span>
                               <span>{char}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )}
               </div>
             </CardContent>
           </Card>
         )}

         {/* Hobby Flow Component */}
         <HobbyFlow computedProfile={computedProfile} ageRange={ageRange} />

         {/* Question Display */}
         {currentQuestion && !computingProfile && !computedProfile && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white">
                {currentQuestion.question_text}
              </CardTitle>
              <CardDescription className="text-slate-400">
                Question {currentQuestion.order_index}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Open Text Question */}
                {currentQuestion.question_type === "open_text" && (
                  <input
                    type="text"
                    value={currentAnswer || ""}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ta réponse..."
                    />
                    {currentQuestion.options?.min &&
                      currentQuestion.options?.max && (
                        <p className="text-sm text-slate-400">
                          Entre {currentQuestion.options.min} et{" "}
                          {currentQuestion.options.max}
                        </p>
                      )}
                  </div>
                )}

                {/* Multiple Choice Question - Supports Multiple Answers */}
                {currentQuestion.question_type === "multiple_choice" && (
                  <div className="space-y-3">
                    {currentQuestion.options?.options &&
                      typeof currentQuestion.options.options === "object" &&
                      Object.entries(currentQuestion.options.options).map(
                        ([key, value]) => {
                          const isSelected = currentAnswers.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  // Remove from selection
                                  setCurrentAnswers(currentAnswers.filter(a => a !== key));
                                } else {
                                  // Add to selection
                                  setCurrentAnswers([...currentAnswers, key]);
                                }
                              }}
                              className={`w-full p-4 text-left rounded-lg border-2 transition-all flex items-center gap-3 ${
                                isSelected
                                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                                  : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                              }`}
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected
                                  ? "border-indigo-400 bg-indigo-500"
                                  : "border-slate-500"
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <span>{value}</span>
                            </button>
                          );
                        }
                      )}
                    {Array.isArray(currentQuestion.options?.options) &&
                      currentQuestion.options.options.map((option, index) => {
                        const isSelected = currentAnswers.includes(option);
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                // Remove from selection
                                setCurrentAnswers(currentAnswers.filter(a => a !== option));
                              } else {
                                // Add to selection
                                setCurrentAnswers([...currentAnswers, option]);
                              }
                            }}
                            className={`w-full p-4 text-left rounded-lg border-2 transition-all flex items-center gap-3 ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                                : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? "border-indigo-400 bg-indigo-500"
                                : "border-slate-500"
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span>{option}</span>
                          </button>
                        );
                      })}
                    {currentAnswers.length > 0 && (
                      <p className="text-sm text-slate-400 mt-2">
                        {currentAnswers.length} réponse{currentAnswers.length > 1 ? 's' : ''} sélectionnée{currentAnswers.length > 1 ? 's' : ''}
                      </p>
                    )}
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
                    className="flex-1"
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
      </div>
    </div>
  );
}
