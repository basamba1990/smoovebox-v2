import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useRouter } from 'next/router';

const WelcomeAgent = ({ onOpenAuthModal }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const { user, loading } = useAuth();
  const router = useRouter();

  // Message d'accueil avec ton "plateau télé"
  const welcomeMessage = `
    Bonjour et bienvenue sous le dôme SpotBulle ! 
    Ici, vous allez vivre une expérience unique autour de la passion du sport et des valeurs de la Coupe d'Afrique des Nations.
    Installez-vous confortablement, exprimez votre passion ou votre besoin devant la caméra,
    et votre vidéo sera analysée par notre intelligence artificielle pour vous offrir une expérience personnalisée.
    Prêt à commencer ? L'aventure vous attend !
  `;

  // Génération audio via OpenAI TTS
  const generateSpeech = async () => {
    try {
      setIsLoading(true);
      setIsPlaying(true);
      // Logique existante pour TTS...
    } catch (error) {
      console.error('Erreur TTS:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Gestion du clic sur "Démarrer l'expérience"
  const handleStartExperience = async () => {
    if (loading) return; // Éviter les clics pendant le chargement

    if (!user) {
      // Si pas authentifié, ouvrir le modal d'authentification
      onOpenAuthModal();
    } else {
      // Si authentifié, rediriger vers la page d'enregistrement
      router.push('/record-video');
    }
  };

  // Nettoyer l'URL objet lorsque le composant est démonté
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-900 to-red-700 overflow-hidden">
      {/* Fond animé CAN */}
      <div className="absolute inset-0 bg-[url('/images/can-bg.jpg')] bg-cover bg-center opacity-20 animate-pulse-slow" />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-white px-4">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-center">
          Bienvenue sous le Dôme SpotBulle
        </h1>
        <p className="text-lg md:text-xl text-center max-w-2xl mb-8">
          {welcomeMessage}
        </p>
        <Button
          onClick={handleStartExperience}
          disabled={isLoading || loading}
          className="bg-turquoise-500 hover:bg-turquoise-600 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 text-lg"
        >
          <span>🎤</span>
          <span>{isLoading || loading ? 'Chargement...' : "Démarrer l'expérience"}</span>
        </Button>
      </div>
    </div>
  );
};

export default WelcomeAgent;
