// src/components/WelcomeAgent.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button-enhanced.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import UserJourneyOnboarding from './UserJourneyOnboarding.jsx';

const WelcomeAgent = ({ onOpenAuthModal }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const audioRef = useRef(null);
  const navigate = useNavigate();

  const welcomeMessage = `Bienvenue sur SpotBulle - Votre plateforme de connexion France-Maroc !

Ici, vous allez :
• Rencontrer des passionnés partageant vos centres d'intérêt
• Améliorer votre communication grâce à des retours personnalisés
• Créer des liens authentiques au sein de notre communauté
• Développer vos compétences avec des analyses vidéo avancées

Prêt à commencer votre aventure ?`;

  const features = [
    {
      icon: '🎯',
      title: 'Trouvez votre communauté',
      description: 'Connectez-vous avec des passionnés France-Maroc'
    },
    {
      icon: '🎥',
      title: 'Exprimez-vous en vidéo',
      description: 'Partagez vos passions avec authenticité'
    },
    {
      icon: '📊',
      title: 'Analyse avancée',
      description: 'Recevez des retours sur votre communication'
    },
    {
      icon: '🤝',
      title: 'Réseau qualité',
      description: 'Créez des connexions significatives'
    }
  ];

  const generateSpeech = async () => {
    try {
      setIsLoading(true);
      setIsPlaying(true);

      const response = await fetch('/functions/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: welcomeMessage,
          voice: 'alloy'
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération audio');
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Erreur génération audio:', error);
      toast.error('Erreur lors de la génération audio');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExperience = async () => {
    if (!showFeatures) {
      setShowFeatures(true);
      await generateSpeech();
    } else {
      navigate('/record-video');
    }
  };

  const handleSkipToAuth = () => {
    onOpenAuthModal();
  };

  const handleDiscoverPlatform = () => {
    setShowOnboarding(true);
  };

  const handleGoBack = () => {
    if (showFeatures) {
      setShowFeatures(false);
    } else if (showOnboarding) {
      setShowOnboarding(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-gray-900 bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-8">
      {/* Background Pattern léger */}
      <div className="absolute inset-0 bg-white/60"></div>
      
      <div className="relative max-w-6xl w-full bg-white/80 backdrop-blur-md rounded-3xl p-8 md:p-12 border-2 border-white shadow-2xl text-center">
        
        {/* ✅ CORRIGÉ : Bouton retour visible */}
        {(showFeatures || showOnboarding) && (
          <button 
            onClick={handleGoBack}
            className="absolute top-6 left-6 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2 bg-white/80 rounded-full px-4 py-2 shadow-sm border border-gray-200"
          >
            ← Retour
          </button>
        )}

        {!showFeatures && !showOnboarding ? (
          // Écran d'accueil initial - ✅ CORRIGÉ : Couleurs claires
          <>
            <div className="mb-8">
              <div className="flex justify-center items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-500 rounded-full shadow-md"></div>
                <div className="w-12 h-12 bg-white rounded-full border-2 border-yellow-400 shadow-md"></div>
                <div className="w-12 h-12 bg-indigo-500 rounded-full shadow-md"></div>
              </div>
              <h1 className="text-5xl md:text-6xl font-french font-bold mb-6 text-gray-900">
                🇫🇷🇲🇦 SpotBulle
              </h1>
              <p className="text-xl md:text-2xl text-blue-600 mb-4 font-medium">
                La communauté qui connecte la France et le Maroc
              </p>
            </div>

            <div className="text-lg md:text-xl mb-8 leading-relaxed bg-white/60 p-8 rounded-2xl border border-gray-200 shadow-sm">
              <p className="mb-4">🎉 <strong>Bienvenue sous le dôme SpotBulle !</strong></p>
              <p className="mb-4 text-gray-700">
                Votre plateforme pour rencontrer des passionnés, partager vos talents 
                et développer votre réseau au sein de la communauté France-Maroc.
              </p>
              <p className="text-blue-600 font-semibold">
                Prêt à découvrir une nouvelle façon de vous connecter ?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={handleDiscoverPlatform}
                className="btn-spotbulle text-lg py-4 px-8 rounded-full group relative overflow-hidden bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                <span className="relative z-10 flex items-center justify-center">
                  🚀 Découvrir SpotBulle
                </span>
              </Button>

              <Button 
                onClick={handleStartExperience}
                disabled={isLoading}
                className="bg-white text-blue-600 hover:bg-blue-50 border border-blue-600 text-lg py-4 px-8 rounded-full transition-all duration-300"
              >
                🎤 Démarrer l'expérience
              </Button>

              <Button 
                onClick={handleSkipToAuth}
                className="bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 text-lg py-4 px-8 rounded-full transition-all duration-300"
              >
                Se connecter
              </Button>
              <Button 
                onClick={() => navigate('/psg-signup')}
                className="bg-[#0A122A] text-white hover:bg-[#11183a] border border-[#DA291C]/40 text-lg py-4 px-8 rounded-full transition-all duration-300"
              >
                🔵🔴 Inscription PSG
              </Button>
            </div>

            <div className="mt-8 text-gray-600 text-sm">
              <p>Déjà membre ? Connectez-vous pour accéder à votre espace personnel</p>
            </div>
          </>
        ) : showOnboarding ? (
          // Onboarding
          <UserJourneyOnboarding 
            onComplete={() => setShowOnboarding(false)}
            currentStep={0}
          />
        ) : (
          // Écran des fonctionnalités - ✅ CORRIGÉ : Navigation claire
          <>
            <h2 className="text-3xl md:text-4xl font-french font-bold mb-8 text-gray-900">
              Découvrez SpotBulle
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-6 mb-8 border border-gray-200 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">🎙️ Votre accueil personnalisé</h3>
              <p className="text-gray-600 mb-4">
                Écoutez le message de bienvenue généré spécialement pour vous !
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={generateSpeech}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                >
                  {isPlaying ? '🎵 En cours...' : '🔊 Réécouter'}
                </Button>
                {isPlaying && (
                  <span className="text-blue-600 animate-pulse">Lecture en cours...</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/record-video')}
                className="btn-spotbulle text-lg py-4 px-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                🚀 Commencer mon aventure
              </Button>
              
              <Button 
                onClick={onOpenAuthModal}
                className="bg-white text-blue-600 hover:bg-blue-50 border border-blue-600 text-lg py-4 px-8 rounded-full"
              >
                📝 Créer mon profil
              </Button>
            </div>
          </>
        )}
      </div>

      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        onError={(e) => {
          console.error('Erreur lecture audio:', e);
          setIsPlaying(false);
          toast.error('Erreur de lecture audio.');
        }}
      />

      {/* Footer */}
      <div className="absolute bottom-4 text-center text-gray-600 text-sm">
        <p>SpotBulle - Connecter, Partager, Grandir ensemble 🇫🇷🇲🇦</p>
      </div>
    </div>
  );
};

export default WelcomeAgent;
