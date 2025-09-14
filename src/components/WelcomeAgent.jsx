import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button-enhanced.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const WelcomeAgent = ({ onOpenAuthModal }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const welcomeMessage = `
    Bonjour et bienvenue sous le dôme SpotBulle ! 
    Ici, vous allez vivre une expérience unique autour de la passion du sport et des valeurs de la Coupe d'Afrique des Nations.
    Installez-vous confortablement, exprimez votre passion ou votre besoin devant la caméra,
    et votre vidéo sera analysée par notre intelligence artificielle pour vous offrir une expérience personnalisée.
    Prêt à commencer ? L'aventure vous attend !
  `;

  const generateSpeech = async () => {
    try {
      setIsLoading(true);
      setIsPlaying(true);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ text: welcomeMessage }),
      });

      if (!response.ok) throw new Error('Erreur lors de la génération audio');
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(error => {
          console.error('Erreur de lecture audio:', error);
          toast.error('Erreur de lecture audio.');
          setIsPlaying(false);
        });
      }
    } catch (error) {
      console.error('Erreur TTS:', error);
      toast.error('Erreur lors de la génération audio.');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateSpeech(); // Jouer le TTS automatiquement au chargement
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleStartExperience = async () => {
    if (loading) return;
    if (!user) {
      onOpenAuthModal();
    } else {
      navigate('/register'); // Rediriger vers l'enregistrement au lieu de record-video
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-900 to-red-700 overflow-hidden">
      <div className="absolute inset-0 bg-[url('/images/can-bg.jpg')] bg-cover bg-center opacity-20 animate-pulse-slow" />
      <div className="absolute top-10 left-10 w-24 h-24 opacity-60 animate-float">⚽</div>
      <div className="absolute bottom-10 right-10 w-24 h-24 opacity-60 animate-float" style={{ animationDelay: '2s' }}>🏆</div>
      <div className="absolute top-1/3 right-1/4 w-16 h-16 opacity-40 animate-float" style={{ animationDelay: '4s' }}>🌟</div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center text-white p-8">
        <div className="max-w-4xl bg-black/50 backdrop-blur-md rounded-3xl p-8 md:p-12 border-2 border-gold shadow-2xl">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center p-4">
              <span className="text-4xl">⚽</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gold animate-bounce">
            🌟 Bienvenue à SpotBulle 🌟
          </h1>

          <div className="text-lg md:text-xl mb-8 leading-relaxed bg-white/10 p-6 rounded-xl">
            {welcomeMessage}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleStartExperience}
              disabled={isLoading || loading}
              className="relative bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white text-xl font-bold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-lg hover:shadow-xl overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center">
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Génération de l’audio...
                  </>
                ) : isPlaying ? (
                  '🎤 Écoutez votre accueil...'
                ) : (
                  '🎤 Démarrer l’expérience'
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 group-hover:from-white/10 group-hover:to-white/30 transform group-hover:scale-110 transition-transform duration-300" />
            </Button>

            <Button
              onClick={onOpenAuthModal}
              className="bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 text-white font-bold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Se connecter
            </Button>
          </div>

          {(isLoading || isPlaying) && (
            <div className="mt-8 flex flex-col items-center space-y-4">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
              <p className="text-sm text-blue-200">
                {isPlaying ? 'Expérience d’accueil en cours...' : 'Préparation de votre accueil...'}
              </p>
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} onError={() => setIsPlaying(false)} />
    </div>
  );
};

export default WelcomeAgent;
