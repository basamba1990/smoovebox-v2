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

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white bg-gradient-to-br from-france-600 via-france-500 to-maroc-600 p-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-black/20"></div>
      
      <div className="relative max-w-6xl w-full bg-white/10 backdrop-blur-md rounded-3xl p-8 md:p-12 border-2 border-white/30 shadow-2xl text-center">
        {!showFeatures ? (
          // Écran d'accueil initial
          <>
            <div className="mb-8">
              <div className="flex justify-center items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-france-600 rounded-full"></div>
                <div className="w-12 h-12 bg-white rounded-full border-2 border-gold"></div>
                <div className="w-12 h-12 bg-maroc-600 rounded-full"></div>
              </div>
              <h1 className="text-5xl md:text-6xl font-french font-bold mb-6 text-white">
                🇫🇷🇲🇦 SpotBulle
              </h1>
              <p className="text-xl md:text-2xl text-gold mb-4 font-medium">
                La communauté qui connecte la France et le Maroc
              </p>
            </div>

            <div className="text-lg md:text-xl mb-8 leading-relaxed bg-white/10 p-8 rounded-2xl border border-white/20">
              <p className="mb-4">🎉 <strong>Bienvenue sous le dôme SpotBulle !</strong></p>
              <p className="mb-4">
                Votre plateforme pour rencontrer des passionnés, partager vos talents 
                et développer votre réseau au sein de la communauté France-Maroc.
              </p>
              <p className="text-gold font-semibold">
                Prêt à découvrir une nouvelle façon de vous connecter ?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={handleDiscoverPlatform}
                className="btn-spotbulle text-lg py-4 px-8 rounded-full group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center">
                  🚀 Découvrir SpotBulle
                </span>
              </Button>

              <Button 
                onClick={handleStartExperience}
                disabled={isLoading}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/40 text-lg py-4 px-8 rounded-full transition-all duration-300"
              >
                🎤 Démarrer l'expérience
              </Button>

              <Button 
                onClick={handleSkipToAuth}
                className="bg-transparent hover:bg-white/10 text-white border border-white/40 text-lg py-4 px-8 rounded-full transition-all duration-300"
              >
                Se connecter
              </Button>
            </div>

            <div className="mt-8 text-white/70 text-sm">
              <p>Déjà membre ? Connectez-vous pour accéder à votre espace personnel</p>
            </div>
          </>
        ) : (
          // Écran des fonctionnalités
          <>
            <button 
              onClick={() => setShowFeatures(false)}
              className="absolute top-4 left-4 text-white/70 hover:text-white transition-colors"
            >
              ← Retour
            </button>

            <h2 className="text-3xl md:text-4xl font-french font-bold mb-8 text-white">
              Découvrez SpotBulle
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-white/40 transition-all duration-300">
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-white/80">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/10 rounded-xl p-6 mb-8 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">🎙️ Votre accueil personnalisé</h3>
              <p className="text-white/80 mb-4">
                Écoutez le message de bienvenue généré spécialement pour vous !
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={generateSpeech}
                  disabled={isLoading}
                  className="bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  {isPlaying ? '🎵 En cours...' : '🔊 Réécouter'}
                </Button>
                {isPlaying && (
                  <span className="text-gold animate-pulse">Lecture en cours...</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/record-video')}
                className="btn-spotbulle text-lg py-4 px-8 rounded-full"
              >
                🚀 Commencer mon aventure
              </Button>
              
              <Button 
                onClick={onOpenAuthModal}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/40 text-lg py-4 px-8 rounded-full"
              >
                📝 Créer mon profil
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Composant d'onboarding */}
      {showOnboarding && (
        <UserJourneyOnboarding 
          onComplete={() => setShowOnboarding(false)}
          currentStep={0}
        />
      )}

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
      <div className="absolute bottom-4 text-center text-white/60 text-sm">
        <p>SpotBulle - Connecter, Partager, Grandir ensemble 🇫🇷🇲🇦</p>
      </div>
    </div>
  );
};

export default WelcomeAgent;
