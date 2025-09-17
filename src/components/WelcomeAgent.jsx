// src/components/WelcomeAgent.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button-enhanced.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

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

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Session non valide, veuillez vous reconnecter');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: welcomeMessage.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('Content-Type de l\'audio:', contentType);
      if (!contentType?.includes('audio')) {
        throw new Error('Réponse non audio reçue');
      }

      const audioBlob = await response.blob();
      console.log('Taille du blob audio:', audioBlob.size);
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch((err) => {
          console.error('Erreur de lecture audio:', err);
          toast.error('Erreur de lecture audio. Veuillez cliquer à nouveau.');
          setIsPlaying(false);
        });
      }
    } catch (err) {
      console.error('Erreur TTS:', err);
      toast.error(`Erreur lors de la génération audio: ${err.message}`);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExperience = async () => {
    console.log('handleStartExperience - user:', user, 'loading:', loading);
    if (loading) {
      toast.info('Veuillez attendre que la session soit chargée.');
      return;
    }
    if (!user) {
      console.log('Utilisateur non connecté, ouverture du modal d\'authentification');
      onOpenAuthModal();
    } else {
      console.log('Génération de l\'audio et redirection vers /record-video');
      await generateSpeech();
      navigate('/record-video');
    }
  };

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white bg-black p-8">
      <div className="max-w-4xl bg-black/50 backdrop-blur-md rounded-3xl p-8 md:p-12 border-2 border-gold shadow-2xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gold animate-bounce">🌟 Bienvenue à SpotBulle 🌟</h1>
        <div className="text-lg md:text-xl mb-8 leading-relaxed bg-white/10 p-6 rounded-xl">{welcomeMessage}</div>
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
        <audio ref={audioRef} onEnded={() => setIsPlaying(false)} onError={() => setIsPlaying(false)} />
      </div>
    </div>
  );
};

export default WelcomeAgent;
