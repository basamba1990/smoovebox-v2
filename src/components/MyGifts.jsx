// src/components/MyGifts.jsx
import React from 'react';
import { Button } from './ui/button-enhanced.jsx';

const MyGifts = ({ userGifts = [] }) => {
  const availableGifts = [
    {
      id: 'ikigai',
      title: "Voyage Ikigaï",
      description: "Découvrez votre raison d'être",
      icon: "🌸",
      status: userGifts.includes('ikigai_used') ? 'utilisé' : 'disponible'
    },
    {
      id: 'cerveau-pele', 
      title: "Cerveau de Pelé",
      description: "Développez votre mindset de champion",
      icon: "⚽",
      status: userGifts.includes('cerveau_pele_used') ? 'utilisé' : 'disponible'
    }
  ];

  return (
    <div className="card-spotbulle p-6">
      <h2 className="text-xl font-french font-bold text-gray-900 mb-4">
        🎁 Mes Expériences Offerte
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableGifts.map((gift) => (
          <div key={gift.id} className={`border rounded-lg p-4 ${
            gift.status === 'utilisé' 
              ? 'bg-gray-50 border-gray-200' 
              : 'bg-gradient-to-r from-france-50 to-maroc-50 border-france-200'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-2xl">{gift.icon}</div>
              <div>
                <h3 className="font-semibold text-gray-900">{gift.title}</h3>
                <p className="text-sm text-gray-600">{gift.description}</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className={`text-xs px-2 py-1 rounded-full ${
                gift.status === 'utilisé' 
                  ? 'bg-gray-200 text-gray-600' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {gift.status === 'utilisé' ? '✓ Déjà utilisé' : '✨ Disponible'}
              </span>
              
              {gift.status !== 'utilisé' && (
                <Button 
                  size="sm"
                  className="btn-spotbulle text-xs"
                  onClick={() => window.open(
                    gift.id === 'ikigai' 
                      ? 'https://chatgpt.com/g/g-67c539312ea881919f8fc7a36f52fab4-mikigai'
                      : 'https://chatgpt.com/g/g-68bc4c1321208191a7b4d5a3920b56b7-edson',
                    '_blank'
                  )}
                >
                  Découvrir
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-700">
          💫 <strong>Les cadeaux apparaissent magiquement</strong> lors de vos moments clés sur SpotBulle
        </p>
      </div>
    </div>
  );
};

export default MyGifts;
