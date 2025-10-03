// src/components/GiftExperience.jsx
import React, { useState } from 'react';
import { Button } from './ui/button-enhanced.jsx';
import { useNavigate } from 'react-router-dom';

const GiftExperience = ({ trigger = "achievement", user, onClose }) => {
  const [selectedGift, setSelectedGift] = useState(null);
  const navigate = useNavigate();

  const gifts = [
    {
      id: 'ikigai',
      title: "🎯 Votre Voyage Ikigaï",
      description: "Découvrez votre raison d'être et alignez vos passions avec votre mission de vie",
      icon: "🌸",
      duration: "30-45 min",
      benefits: [
        "Clarifier vos aspirations profondes",
        "Identifier ce qui vous rend vraiment heureux",
        "Trouver l'équilibre entre passion, mission, vocation et profession"
      ],
      url: "https://chatgpt.com/g/g-67c539312ea881919f8fc7a36f52fab4-mikigai",
      when: "Quand vous vous questionnez sur votre direction de vie"
    },
    {
      id: 'cerveau-pele',
      title: "🧠 Le Cerveau de Pelé",
      description: "Développez votre mindset de champion et votre intelligence émotionnelle",
      icon: "⚽",
      duration: "20-30 min",
      benefits: [
        "Renforcer votre confiance en vous",
        "Développer la mentalité des grands champions",
        "Améliorer votre intelligence situationnelle"
      ],
      url: "https://chatgpt.com/g/g-68bc4c1321208191a7b4d5a3920b56b7-edson",
      when: "Quand vous avez besoin d'un boost de motivation"
    }
  ];

  const triggerMessages = {
    achievement: "🎉 Félicitations pour votre progression !",
    milestone: "🏆 Objectif atteint !",
    surprise: "🎁 Petit cadeau pour vous !",
    reflection: "🤔 Moment de réflexion ?"
  };

  const handleGiftSelection = (gift) => {
    setSelectedGift(gift);
  };

  const startGiftExperience = () => {
    if (selectedGift) {
      // Ouvrir dans un nouvel onglet
      window.open(selectedGift.url, '_blank', 'noopener,noreferrer');
      
      // Marquer comme offert dans le profil utilisateur
      if (user) {
        // TODO: Appeler une fonction pour enregistrer le cadeau utilisé
        console.log(`Cadeau ${selectedGift.id} offert à ${user.id}`);
      }
      
      onClose?.();
    }
  };

  if (selectedGift) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl">
          <div className="text-6xl mb-4">{selectedGift.icon}</div>
          <h2 className="text-2xl font-french font-bold text-gray-900 mb-4">
            {selectedGift.title}
          </h2>
          <p className="text-gray-600 mb-6">{selectedGift.description}</p>
          
          <div className="bg-gradient-to-r from-france-50 to-maroc-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-700">
              <strong>💡 Conseil :</strong> {selectedGift.when}
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={() => setSelectedGift(null)}
              className="flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              ← Retour
            </Button>
            <Button
              onClick={startGiftExperience}
              className="flex-1 btn-spotbulle"
            >
              Commencer l'expérience
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl">
        {/* En-tête cadeau */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎁</div>
          <h2 className="text-3xl font-french font-bold text-gray-900 mb-2">
            Un cadeau pour vous
          </h2>
          <p className="text-gray-600">
            {triggerMessages[trigger]} Choisissez une expérience qui vous ressemble
          </p>
        </div>

        {/* Sélection des cadeaux */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {gifts.map((gift) => (
            <div
              key={gift.id}
              onClick={() => handleGiftSelection(gift)}
              className="border-2 border-gray-200 rounded-xl p-6 hover:border-france-400 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{gift.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">
                    {gift.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {gift.description}
                  </p>
                  <div className="space-y-1">
                    {gift.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="w-1 h-1 bg-france-400 rounded-full"></div>
                        {benefit}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-400">
                    ⏱️ {gift.duration}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-4">
            Ces expériences sont offertes pour enrichir votre aventure SpotBulle
          </p>
          <Button
            onClick={onClose}
            className="bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            Peut-être plus tard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GiftExperience;
