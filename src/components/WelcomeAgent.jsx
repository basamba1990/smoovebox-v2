// src/components/WelcomeAgent.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button-enhanced.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { retryOperation, refreshSession } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

const WelcomeAgent = ({ onOpenAuthModal }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = useSupabaseClient();

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

      // Vérifier et rafraîchir la session
      const isSessionValid = await refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!isSessionValid || !session) {
        throw new Error('Session invalide, authentification requise');
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-Client-Info': 'spotbulle',
        'Authorization': `Bearer ${session.access_token}`,
      };

      console.log('Envoi requête TTS avec headers:', headers);

      const response = await retryOperation(() =>
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: welcomeMessage.trim(), voice: 'alloy', speed: 1.0 }),
        }),
        3,
        1000
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('Content-Type de l\'audio:', contentType);
      if (!contentType?.includes('audio')) {
        throw new Error('Réponse non audio reçue');
      }

      const audioBlob = new Blob([await response.arrayBuffer()], { type: contentType || 'audio/mpeg' });
      console.log('Taille du blob audio:', audioBlob.size);
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
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
    try {
      await generateSpeech();
      const isSessionValid = await refreshSession();
      if (!isSessionValid) {
        toast.error('Veuillez vous connecter pour continuer.');
        onOpenAuthModal();
        return;
      }
      navigate('/record-video');
    } catch (err) {
      console.error('Erreur dans handleStartExperience:', err);
      toast.error('Erreur lors du démarrage de l\'expérience. Redirection en cours...');
      if (user) {
        navigate('/record-video');
      } else {
        onOpenAuthModal();
      }
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
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gold animate-bounce">
          🌟 Bienvenue à SpotBulle 🌟
        </h1>
        <div className="text-lg md:text-xl mb-8 leading-relaxed bg-white/10 p-6 rounded-xl">
          {welcomeMessage}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleStartExperience}
            disabled={isLoading}
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
        <audio
          ref={audioRef}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            console.error('Erreur lecture audio:', e);
            setIsPlaying(false);
            toast.error('Erreur de lecture audio.');
          }}
        />
      </div>
    </div>
  );
};

export default WelcomeAgent;
