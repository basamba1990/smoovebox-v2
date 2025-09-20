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
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
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
    setIsLoading(true);
    setIsPlaying(false);
    setNeedsManualPlay(false);

    try {
      const isSessionValid = await refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!isSessionValid || !session) throw new Error('Session invalide, authentification requise');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      };

      const response = await retryOperation(() =>
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: welcomeMessage.trim(), voice: 'alloy', speed: 1.0 }),
        }),
        3,
        1000
      );

      if (!response.ok) throw new Error(`Erreur HTTP ${response.status}: ${await response.text()}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('audio')) throw new Error(`Réponse non audio: ${await response.text()}`);

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: contentType || 'audio/mpeg' });

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          setNeedsManualPlay(true);
          toast.info('Appuyez sur “Écouter l’accueil” pour lancer l’audio.');
        }
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
    // Générer l'audio, puis vérifier la session
    try {
      await generateSpeech();

      if (!user) {
        toast.info('Veuillez vous connecter pour démarrer l’expérience.');
        onOpenAuthModal();
        return;
      }

      navigate('/record-video');
    } catch (err) {
      console.error('Erreur handleStartExperience:', err);
      if (!user) onOpenAuthModal();
      else navigate('/record-video');
    }
  };

  const handleGoDashboard = () => {
    if (user) navigate('/dashboard');
    else toast.info('Connectez-vous pour accéder au dashboard.');
  };

  const handleManualPlay = async () => {
    if (audioRef.current && audioUrl) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setNeedsManualPlay(false);
      } catch {
        toast.error('Impossible de lire l’audio.');
      }
    }
  };

  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
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
            className="relative bg-gradient-to-r from-blue-600 to-red-600 text-white text-xl font-bold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            {isLoading ? 'Génération de l’audio...' : '🎤 Démarrer l’expérience'}
          </Button>

          {needsManualPlay && (
            <Button
              onClick={handleManualPlay}
              className="bg-gradient-to-r from-yellow-600 to-yellow-800 text-white font-bold py-4 px-8 rounded-full"
            >
              ▶️ Écouter l’accueil
            </Button>
          )}

          <Button
            onClick={handleGoDashboard}
            className="bg-gradient-to-r from-green-600 to-green-800 text-white font-bold py-4 px-8 rounded-full"
          >
            📊 Aller au dashboard
          </Button>

          <Button
            onClick={onOpenAuthModal}
            className="bg-gradient-to-r from-purple-600 to-purple-800 text-white font-bold py-4 px-8 rounded-full"
          >
            Se connecter
          </Button>
        </div>

        <audio
          ref={audioRef}
          onEnded={() => setIsPlaying(false)}
          onError={() => setIsPlaying(false)}
        />
      </div>
    </div>
  );
};

export default WelcomeAgent;
