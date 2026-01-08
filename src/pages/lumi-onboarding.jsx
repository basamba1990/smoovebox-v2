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
import { startLumiSession, submitAnswer, computeProfile, getMyLumiProfile } from "../services/lumiService.js";
import { checkVideoProfileInformation } from "../services/videoService.js";
import { useUser } from "@supabase/auth-helpers-react";
import { toast } from "sonner";

// Age range options
const AGE_RANGES = [
  { value: "16-20", label: "16-20 ans" },
  { value: "21-30", label: "21-30 ans" },
  { value: "31-45", label: "31-45 ans" },
  { value: "46+", label: "46 ans et plus" },
];

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
    console.log('[STEP 1] useEffect triggered - user:', user?.id, 'hasCheckedVideoAge:', hasCheckedVideoAge.current, 'ageRange:', ageRange);
    
    if (!user?.id) {
      console.log('[STEP 2] No user ID, returning');
      return;
    }
    
    if (hasCheckedVideoAge.current) {
      console.log('[STEP 3] Already checked video age, returning');
      return;
    }
    
    // Check if ageRange is already set BEFORE doing anything async
    if (ageRange) {
      console.log('[STEP 4] Age range already set to:', ageRange, '- skipping all checks');
      return;
    }
    
    console.log('[STEP 5] Starting async check for profile and age');
    
    const checkExistingProfileAndAge = async () => {
      console.log('[STEP 6] Inside async function, setting hasCheckedVideoAge to true');
      hasCheckedVideoAge.current = true;
      setCheckingProfile(true);
      setCheckingAge(true);
      
      // Check for existing profile
      console.log('[STEP 7] Checking for existing profile...');
      const result = await getMyLumiProfile();
      if (result.success && result.profile) {
        console.log('[STEP 8] Found existing profile, setting computedProfile');
        setComputedProfile(result.profile);
        setCheckingProfile(false);
        setCheckingAge(false);
        return;
      }
      
      // Only check videos if ageRange is still not set
      console.log('[STEP 9] No existing profile, checking videos for age...');
      try {
        const result = await checkVideoProfileInformation(user.id);
        console.log('[STEP 10] Video check result:', result);
        if (result.hasProfileInfo && result.ageRange) {
          console.log('[STEP 11] Found age from video:', result.ageRange, '- setting ageRange state');
          setAgeRange(result.ageRange);
        } else {
          console.log('[STEP 12] No age found in videos, showing age selection');
          setShowAgeSelection(true);
        }
      } catch (err) {
        console.error('[STEP 13] Error checking age from videos:', err);
        setShowAgeSelection(true);
      }
      
      setCheckingAge(false);
      setCheckingProfile(false);
      console.log('[STEP 14] Finished async check');
    };
    
    checkExistingProfileAndAge();
  }, [user, ageRange]);

  // Show loading while checking for existing profile or age
  if (checkingProfile || checkingAge) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">✨</div>
            <p className="text-slate-400">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-10">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            ← Retour à l'accueil
          </Button>
          <h1 className="text-4xl font-bold mb-2">
            Découvre qui tu es avec Lumi
          </h1>
          <p className="text-slate-400">
            Réponds à quelques questions pour découvrir ta couleur dominante et
            tes talents
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
                      console.log('[USER ACTION] User clicked age range button:', selectedValue);
                      console.log('[USER ACTION] Current ageRange state before set:', ageRange);
                      setAgeRange(selectedValue);
                      console.log('[USER ACTION] Called setAgeRange with:', selectedValue);
                      setShowAgeSelection(false);
                      console.log('[USER ACTION] Set showAgeSelection to false');
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
                      console.log('[START SESSION] Button clicked - current ageRange state:', ageRange);
                      if (!ageRange) {
                        console.log('[START SESSION] No ageRange, showing error');
                        toast.error("Veuillez sélectionner une tranche d'âge");
                        return;
                      }
                      console.log('[START SESSION] Calling startLumiSession with ageRange:', ageRange);
                      setLoading(true);
                      const result = await startLumiSession("onboarding", ageRange);
                      console.log('[START SESSION] Session started, result:', result);
                      console.log('[START SESSION] Result session_id:', result.session_id);
                      setLoading(false);

                      if (result.success) {
                        console.log("Session result:", result.session_id);
                        if (!result.session_id) {
                          console.error("No session_id in result:", result);
                          toast.error("Session ID manquant dans la réponse");
                          return;
                        }
                        setSessionId(result.session_id);
                        setCurrentQuestion(result.first_question);
                        console.log("Session ID set:", result.session_id);
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
           <Card className="bg-slate-900/60 border-slate-800">
             <CardHeader>
               <CardTitle className="text-2xl text-white">
                 Ton Profil Lumi
               </CardTitle>
               <CardDescription className="text-slate-400">
                 Découvre qui tu es vraiment
               </CardDescription>
             </CardHeader>
             <CardContent>
               <div className="space-y-6">
                 {/* Dominant and Secondary Colors */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                     <p className="text-sm text-slate-400 mb-2">Couleur Dominante</p>
                     <p className="text-2xl font-bold text-white capitalize">
                       {computedProfile.dominant_color || "Non déterminé"}
                     </p>
                   </div>
                   <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                     <p className="text-sm text-slate-400 mb-2">Couleur Secondaire</p>
                     <p className="text-2xl font-bold text-white capitalize">
                       {computedProfile.secondary_color || "Non déterminé"}
                     </p>
                   </div>
                 </div>

                 {/* DISC Scores */}
                 {computedProfile.disc_scores && (
                   <div>
                     <h4 className="text-lg font-semibold text-white mb-3">
                       Scores DISC
                     </h4>
                     <div className="grid grid-cols-4 gap-3">
                       {Object.entries(computedProfile.disc_scores).map(([color, score]) => (
                         <div
                           key={color}
                           className="p-3 bg-slate-800 rounded-lg border border-slate-700"
                         >
                           <p className="text-sm text-slate-400 capitalize mb-1">
                             {color}
                           </p>
                           <p className="text-xl font-bold text-white">{score}</p>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {/* Traits */}
                 {computedProfile.traits && computedProfile.traits.length > 0 && (
                   <div>
                     <h4 className="text-lg font-semibold text-white mb-3">
                       Tes Traits
                     </h4>
                     <div className="flex flex-wrap gap-2">
                       {computedProfile.traits.map((trait, index) => (
                         <span
                           key={index}
                           className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm border border-indigo-500/30"
                         >
                           {trait}
                         </span>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             </CardContent>
           </Card>
         )}

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
                      
                      console.log("Submitting answer:", {
                        sessionId,
                        questionId: currentQuestion.id,
                        answerValue,
                        answerJson,
                      });
                      
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
