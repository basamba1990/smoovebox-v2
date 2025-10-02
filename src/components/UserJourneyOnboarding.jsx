// src/components/UserJourneyOnboarding.jsx
import React, { useState } from 'react';
import { Button } from './ui/button-enhanced';
import { useNavigate } from 'react-router-dom';

const UserJourneyOnboarding = ({ onComplete, currentStep = 0 }) => {
  const [step, setStep] = useState(currentStep);
  const navigate = useNavigate();

  const steps = [
    {
      title: "🎯 Bienvenue sur SpotBulle",
      content: "Découvrez comment connecter avec la communauté France-Maroc et améliorer votre communication",
      image: "🇫🇷🇲🇦",
      actions: [
        { text: "Commencer l'aventure", action: "next" }
      ]
    },
    {
      title: "🎥 Exprimez-vous en vidéo",
      content: "Enregistrez vos passions et centres d'intérêt. Notre IA analyse votre communication pour vous aider à progresser",
      image: "📹",
      actions: [
        { text: "Commencer l'enregistrement", action: "record" },
        { text: "Voir un exemple", action: "example" }
      ]
    },
    {
      title: "📊 Recevez des analyses détaillées",
      content: "Obtenez des retours sur votre tonalité, structure de discours et émotions pour améliorer votre communication",
      image: "📈",
      actions: [
        { text: "Voir une analyse", action: "analysis" },
        { text: "Comprendre les scores", action: "scores" }
      ]
    },
    {
      title: "👥 Rencontrez votre communauté",
      content: "Connectez-vous avec des passionnés partageant vos centres d'intérêt au sein de la communauté France-Maroc",
      image: "🤝",
      actions: [
        { text: "Explorer l'annuaire", action: "directory" },
        { text: "Compléter mon profil", action: "profile" }
      ]
    }
  ];

  const currentStepData = steps[step];

  const handleAction = (actionType) => {
    switch (actionType) {
      case 'next':
        if (step < steps.length - 1) {
          setStep(step + 1);
        } else {
          onComplete();
        }
        break;
      case 'record':
        onComplete();
        navigate('/record-video');
        break;
      case 'directory':
        onComplete();
        navigate('/directory');
        break;
      case 'profile':
        onComplete();
        navigate('/');
        break;
      default:
        onComplete();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-france-600 to-maroc-600 p-6 text-white text-center">
          <div className="text-6xl mb-4">{currentStepData.image}</div>
          <h2 className="text-2xl font-french font-bold">{currentStepData.title}</h2>
        </div>

        {/* Contenu */}
        <div className="p-8">
          <p className="text-lg text-gray-700 text-center mb-8 leading-relaxed">
            {currentStepData.content}
          </p>

          {/* Indicateur de progression */}
          <div className="flex justify-center space-x-2 mb-8">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index === step ? 'bg-france-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {currentStepData.actions.map((action, index) => (
              <Button
                key={index}
                onClick={() => handleAction(action.action)}
                className={index === 0 ? "btn-spotbulle flex-1" : "bg-white text-france-600 border border-france-600 hover:bg-france-50 flex-1"}
              >
                {action.text}
              </Button>
            ))}
          </div>

          {/* Skip */}
          <div className="text-center mt-6">
            <button
              onClick={onComplete}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Passer la découverte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserJourneyOnboarding;
