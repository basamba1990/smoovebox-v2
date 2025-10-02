// src/pages/enhanced-record-video.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced';
import { supabase } from '../lib/supabase';
import ProfessionalHeader from '../components/ProfessionalHeader';

const EnhancedRecordVideo = ({ user, profile, onSignOut, onVideoUploaded }) => {
  // [Garder toute la logique existante de RecordVideo...]
  // et ajouter les améliorations demandées :

  // État pour l'avatar
  const [useAvatar, setUseAvatar] = useState(false);
  const [avatarType, setAvatarType] = useState('professional');
  
  // État pour l'analyse de tonalité en temps réel
  const [realTimeTone, setRealTimeTone] = useState({
    volume: 0,
    pace: 'modéré',
    confidence: 0,
    suggestions: []
  });

  // Nouvelle fonction pour l'analyse de tonalité
  const analyzeRealTimeTone = (audioData) => {
    // Implémentation de l'analyse basique du volume et du rythme
    const averageVolume = audioData.reduce((a, b) => a + b) / audioData.length;
    const pace = averageVolume > 0.7 ? 'énergique' : averageVolume > 0.4 ? 'modéré' : 'calme';
    
    setRealTimeTone({
      volume: averageVolume,
      pace,
      confidence: Math.min(averageVolume * 1.5, 1),
      suggestions: generateToneSuggestions(averageVolume, pace)
    });
  };

  const generateToneSuggestions = (volume, pace) => {
    const suggestions = [];
    if (volume < 0.3) suggestions.push("Parlez plus fort pour plus d'impact");
    if (volume > 0.8) suggestions.push("Diminuez légèrement le volume pour plus de confort");
    if (pace === 'calme') suggestions.push("Accélérez légèrement le rythme pour maintenir l'attention");
    
    return suggestions;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* En-tête amélioré */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-french font-bold text-gray-900 mb-4">
              🎥 Exprimez Votre Passion
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Partagez ce qui vous anime avec la communauté France-Maroc. 
              Notre IA vous aide à améliorer votre communication.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Options d'enregistrement */}
            <div className="card-spotbulle p-6">
              <h3 className="text-lg font-semibold mb-4">🛠️ Options</h3>
              
              {/* Option Avatar */}
              <div className="mb-6">
                <label className="flex items-center justify-between cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div>
                    <div className="font-medium">Utiliser un avatar</div>
                    <div className="text-sm text-gray-600">Préserve votre anonymat</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useAvatar}
                    onChange={(e) => setUseAvatar(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </label>
                
                {useAvatar && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <label className="block text-sm font-medium mb-2">Type d'avatar :</label>
                    <select
                      value={avatarType}
                      onChange={(e) => setAvatarType(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                    >
                      <option value="professional">Professionnel</option>
                      <option value="friendly">Amical</option>
                      <option value="creative">Créatif</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Analyse de tonalité en temps réel */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-3">🎵 Analyse en Direct</h4>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Volume</span>
                      <span>{Math.round(realTimeTone.volume * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${realTimeTone.volume * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <div><strong>Débit :</strong> {realTimeTone.pace}</div>
                    <div><strong>Confiance :</strong> {Math.round(realTimeTone.confidence * 100)}%</div>
                  </div>

                  {realTimeTone.suggestions.length > 0 && (
                    <div className="text-xs text-purple-700">
                      <strong>Suggestions :</strong>
                      <ul className="mt-1 space-y-1">
                        {realTimeTone.suggestions.map((suggestion, index) => (
                          <li key={index}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Zone d'enregistrement principale */}
            <div className="lg:col-span-2">
              {/* [Garder la logique d'enregistrement vidéo existante...] */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedRecordVideo;
