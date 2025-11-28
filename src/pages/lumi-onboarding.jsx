// src/pages/lumi-onboarding.jsx
// Lumi Onboarding Page - Quick discovery flow

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.jsx";
import { startLumiSession, submitAnswer, computeProfile } from "../services/lumiService.js";
import { toast } from "sonner";

export default function LumiOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [computingProfile, setComputingProfile] = useState(false);
  const [computedProfile, setComputedProfile] = useState(null);

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

        {/* Welcome Card - Only show when no question */}
        {!currentQuestion && (
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
                      setLoading(true);
                      const result = await startLumiSession("onboarding");
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

                {/* Multiple Choice Question */}
                {currentQuestion.question_type === "multiple_choice" && (
                  <div className="space-y-3">
                    {currentQuestion.options?.options &&
                      typeof currentQuestion.options.options === "object" &&
                      Object.entries(currentQuestion.options.options).map(
                        ([key, value]) => (
                          <button
                            key={key}
                            onClick={() => setCurrentAnswer(key)}
                            className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                              currentAnswer === key
                                ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                                : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                            }`}
                          >
                            {value}
                          </button>
                        )
                      )}
                    {Array.isArray(currentQuestion.options?.options) &&
                      currentQuestion.options.options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentAnswer(option)}
                          className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                            currentAnswer === option
                              ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                              : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-4 flex gap-3">
                  <Button
                    onClick={async () => {
                      if (!currentAnswer) {
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
                      console.log("Submitting answer:", {
                        sessionId,
                        questionId: currentQuestion.id,
                        answer: currentAnswer,
                      });
                      const result = await submitAnswer(
                        sessionId,
                        currentQuestion.id,
                        currentAnswer
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
                        }
                      } else {
                        toast.error(
                          result.error || "Erreur lors de l'envoi de la réponse"
                        );
                      }
                    }}
                    className="flex-1"
                    size="lg"
                    disabled={submitting || !currentAnswer}
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
