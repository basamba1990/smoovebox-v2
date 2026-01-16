// src/components/HobbyFlow.jsx
// Component for hobby selection, questions, and results flow

import React, { useState, useEffect } from "react";
import { Button } from "./ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card.jsx";
import { startHobbySession, submitHobbyAnswer, getHobbyRecommendation, getMyHobbyProfile, getSessionAgeRange, getMyLumiProfile } from "../services/lumiService.js";
import { toast } from "sonner";

// Available hobbies
const HOBBIES = [
  { name: "Football", emoji: "⚽", color: "green" },
  { name: "Handball", emoji: "🤾", color: "blue" },
  { name: "Basketball", emoji: "🏀", color: "orange" },
];

// DISC Color to Element mapping (same as in lumi-onboarding.jsx, without animals)
const DISC_ELEMENTS = {
  'rouge': { elementFr: 'Feu', icon: '🔥' },
  'jaune': { elementFr: 'Air', icon: '🌬️' },
  'vert': { elementFr: 'Terre', icon: '🌱' },
  'bleu': { elementFr: 'Eau', icon: '💧' }
};

export default function HobbyFlow({ computedProfile, ageRange }) {
  const [showHobbySelection, setShowHobbySelection] = useState(false);
  const [selectedHobby, setSelectedHobby] = useState(null);
  const [hobbySessionId, setHobbySessionId] = useState(null);
  const [currentHobbyQuestion, setCurrentHobbyQuestion] = useState(null);
  const [currentHobbyAnswer, setCurrentHobbyAnswer] = useState(null);
  const [currentHobbyAnswers, setCurrentHobbyAnswers] = useState([]);
  const [submittingHobbyAnswer, setSubmittingHobbyAnswer] = useState(false);
  const [gettingHobbyRecommendation, setGettingHobbyRecommendation] = useState(false);
  const [hobbyProfile, setHobbyProfile] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Check for existing hobby profile on mount
  useEffect(() => {
    const checkExistingHobby = async () => {
      if (!computedProfile) return;
      
      setLoadingExisting(true);
      const hobbyResult = await getMyHobbyProfile();
      if (hobbyResult.success && hobbyResult.profile) {
        const hobby = Array.isArray(hobbyResult.profile) ? hobbyResult.profile[0] : hobbyResult.profile;
        if (hobby) {
          setHobbyProfile(hobby);
          setSelectedHobby(hobby.hobby_name);
        }
      }
      setLoadingExisting(false);
    };

    checkExistingHobby();
  }, [computedProfile]);

  if (!computedProfile) {
    return null;
  }

  if (loadingExisting) {
    return (
      <Card className="bg-slate-900/60 border-slate-800 mt-6">
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Hobby Selection Button - Show after profile is computed */}
      {!hobbyProfile && !currentHobbyQuestion && !showHobbySelection && (
        <Card className="bg-slate-900/60 border-slate-800 mt-6">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              🎯 Découvre tes loisirs idéaux
            </CardTitle>
            <CardDescription className="text-slate-400">
              Choisis un loisir et découvre ton rôle idéal selon ton profil DISC
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowHobbySelection(true)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              size="lg"
            >
              Choisir un loisir
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Hobby Selection Cards */}
      {showHobbySelection && !selectedHobby && !currentHobbyQuestion && (
        <Card className="bg-slate-900/60 border-slate-800 mt-6">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              Choisis un loisir qui t'intéresse
            </CardTitle>
            <CardDescription className="text-slate-400">
              Sélectionne un loisir pour découvrir ton rôle idéal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {HOBBIES.map((hobby) => (
                <button
                  key={hobby.name}
                  onClick={async () => {
                    console.log('[HobbyFlow] Starting hobby session for:', hobby.name, 'ageRange:', ageRange);
                    console.log('[HobbyFlow] computedProfile:', computedProfile);
                    
                    // Verify we have a profile ID
                    if (!computedProfile?.id) {
                      toast.error('Profil DISC non trouvé. Veuillez compléter le questionnaire DISC d\'abord.');
                      return;
                    }
                    
                    setSelectedHobby(hobby.name);
                    setShowHobbySelection(false);
                    
                    try {
                      // Verify profile exists in database before starting hobby session
                      console.log('[HobbyFlow] Verifying profile exists in database...');
                      const profileCheck = await getMyLumiProfile();
                      if (!profileCheck.success || !profileCheck.profile) {
                        toast.error('Le profil DISC n\'est pas encore enregistré. Veuillez attendre quelques secondes et réessayer.');
                        setSelectedHobby(null);
                        setShowHobbySelection(true);
                        return;
                      }
                      console.log('[HobbyFlow] Profile verified in database:', profileCheck.profile.id);
                      
                      // If ageRange is null but we have a computedProfile with session_id, try to fetch it
                      let finalAgeRange = ageRange;
                      if (!finalAgeRange && computedProfile?.session_id) {
                        console.log('[HobbyFlow] ageRange is null, fetching from session:', computedProfile.session_id);
                        const ageRangeResult = await getSessionAgeRange(computedProfile.session_id);
                        if (ageRangeResult.success && ageRangeResult.age_range) {
                          finalAgeRange = ageRangeResult.age_range;
                          console.log('[HobbyFlow] Found ageRange from session:', finalAgeRange);
                        }
                      }
                      
                      // Start hobby session
                      const result = await startHobbySession(hobby.name, finalAgeRange);
                      console.log('[HobbyFlow] startHobbySession result:', result);
                      
                      if (result.success && result.session) {
                        console.log('[HobbyFlow] Session started successfully');
                        setHobbySessionId(result.session.id);
                        setCurrentHobbyQuestion(result.first_question);
                        setCurrentHobbyAnswer(null);
                        setCurrentHobbyAnswers([]);
                      } else {
                        console.error('[HobbyFlow] Failed to start session:', result);
                        const errorMsg = result.error || result.details || "Erreur lors du démarrage";
                        toast.error(errorMsg);
                        setSelectedHobby(null);
                        setShowHobbySelection(true);
                      }
                    } catch (error) {
                      console.error('[HobbyFlow] Exception starting hobby session:', error);
                      toast.error(error.message || "Erreur inattendue");
                      setSelectedHobby(null);
                      setShowHobbySelection(true);
                    }
                  }}
                  className="p-6 bg-slate-800 rounded-lg border-2 border-slate-700 hover:border-indigo-500 transition-all text-center space-y-3"
                >
                  <div className="text-5xl">{hobby.emoji}</div>
                  <div className="text-xl font-semibold text-white">{hobby.name}</div>
                </button>
              ))}
            </div>
            <Button
              onClick={() => setShowHobbySelection(false)}
              variant="outline"
              className="w-full mt-4 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Annuler
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Hobby Question Display */}
      {currentHobbyQuestion && !hobbyProfile && (
        <Card className="bg-slate-900/60 border-slate-800 mt-6">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              {currentHobbyQuestion.question_text}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {selectedHobby} - Question {currentHobbyQuestion.order_index}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Multiple Choice Question */}
              {currentHobbyQuestion.question_type === "multiple_choice" && (
                <div className="space-y-3">
                  {currentHobbyQuestion.options?.options &&
                    typeof currentHobbyQuestion.options.options === "object" &&
                    Object.entries(currentHobbyQuestion.options.options).map(
                      ([key, value]) => {
                        const isSelected = currentHobbyAnswers.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setCurrentHobbyAnswers(currentHobbyAnswers.filter(a => a !== key));
                              } else {
                                setCurrentHobbyAnswers([...currentHobbyAnswers, key]);
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
                  {currentHobbyAnswers.length > 0 && (
                    <p className="text-sm text-slate-400 mt-2">
                      {currentHobbyAnswers.length} réponse{currentHobbyAnswers.length > 1 ? 's' : ''} sélectionnée{currentHobbyAnswers.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4 flex gap-3">
              <Button
                onClick={async () => {
                  const hasAnswer = currentHobbyQuestion.question_type === "multiple_choice" 
                    ? currentHobbyAnswers.length > 0 
                    : currentHobbyAnswer !== null && currentHobbyAnswer !== '';
                  
                  if (!hasAnswer) {
                    toast.error("Veuillez répondre à la question");
                    return;
                  }

                  if (!hobbySessionId || !currentHobbyQuestion?.id) {
                    toast.error("Session ou question manquante");
                    return;
                  }

                  setSubmittingHobbyAnswer(true);
                  
                  const answerJson = currentHobbyQuestion.question_type === "multiple_choice" && currentHobbyAnswers.length > 0
                    ? { answers: currentHobbyAnswers }
                    : null;
                  
                  const answerValue = currentHobbyQuestion.question_type === "multiple_choice"
                    ? null
                    : currentHobbyAnswer;

                  const result = await submitHobbyAnswer(
                    hobbySessionId,
                    currentHobbyQuestion.id,
                    answerValue,
                    answerJson
                  );

                  if (result.success) {
                    if (result.is_complete) {
                      // All questions answered, get GPT recommendation
                      setGettingHobbyRecommendation(true);
                      const recResult = await getHobbyRecommendation(hobbySessionId);
                      if (recResult.success && recResult.profile) {
                        setHobbyProfile(recResult.profile);
                        setCurrentHobbyQuestion(null);
                        toast.success("Recommandation générée avec succès !");
                      } else {
                        toast.error(recResult.error || "Erreur lors de la génération");
                      }
                      setGettingHobbyRecommendation(false);
                    } else {
                      // Next question
                      setCurrentHobbyQuestion(result.next_question);
                      setCurrentHobbyAnswer(null);
                      setCurrentHobbyAnswers([]);
                    }
                  } else {
                    toast.error(result.error || "Erreur lors de l'envoi de la réponse");
                  }
                  
                  setSubmittingHobbyAnswer(false);
                }}
                className="flex-1"
                size="lg"
                disabled={submittingHobbyAnswer || gettingHobbyRecommendation || ((currentHobbyAnswer === null || currentHobbyAnswer === '') && (currentHobbyQuestion?.question_type !== "multiple_choice" || currentHobbyAnswers.length === 0))}
              >
                {submittingHobbyAnswer ? "Envoi..." : gettingHobbyRecommendation ? "Génération..." : "Suivant"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hobby Results */}
      {hobbyProfile && computedProfile && (
        <Card className="bg-slate-900/60 border-slate-800 mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              {selectedHobby && HOBBIES.find(h => h.name === selectedHobby)?.emoji && (
                <span className="text-3xl">{HOBBIES.find(h => h.name === selectedHobby)?.emoji}</span>
              )}
              <div className="flex-1">
                <CardTitle className="text-2xl text-white">
                  {selectedHobby} - Ton Rôle Idéal
                </CardTitle>
                {computedProfile.dominant_color && DISC_ELEMENTS[computedProfile.dominant_color] && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg">{DISC_ELEMENTS[computedProfile.dominant_color].icon}</span>
                    <span className="text-sm text-slate-400">
                      Énergie {DISC_ELEMENTS[computedProfile.dominant_color].elementFr}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <CardDescription className="text-slate-400 mt-2">
              Recommandation basée sur ton profil DISC
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Fit Score */}
              {hobbyProfile.fit_score !== null && (
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-400">Score de compatibilité</p>
                    <p className="text-2xl font-bold text-white">{hobbyProfile.fit_score}%</p>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        hobbyProfile.fit_score >= 80 ? 'bg-green-500' :
                        hobbyProfile.fit_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${hobbyProfile.fit_score}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Recommended Role */}
              {hobbyProfile.recommended_role && (
                <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 rounded-lg border border-indigo-500/30">
                  <p className="text-sm text-indigo-300 mb-2">Rôle Recommandé</p>
                  <p className="text-2xl font-bold text-white">{hobbyProfile.recommended_role}</p>
                </div>
              )}

              {/* Description */}
              {hobbyProfile.description && (
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <h4 className="text-lg font-semibold text-white mb-2">Description</h4>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-line">
                    {hobbyProfile.description}
                  </p>
                </div>
              )}

              {/* Development Tips */}
              {hobbyProfile.development_tips && (
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <h4 className="text-lg font-semibold text-white mb-3">💡 Conseils de développement</h4>
                  <div className="space-y-2">
                    {hobbyProfile.development_tips.split('\n').filter(tip => tip.trim()).map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-slate-300">
                        <span className="text-indigo-400 mt-0.5">•</span>
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
    </>
  );
}


