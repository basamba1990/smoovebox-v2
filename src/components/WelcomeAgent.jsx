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

  // Génération du TTS
  const generateSpeech = async () => {
    setIsLoading(true);
    setIsPlaying(false);
    setNeedsManualPlay(false);

    try {
      const isSessionValid = await refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!isSessionValid || !session) throw new Error('Session invalide');

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

      if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: response.headers.get('content-type') || 'audio/mpeg' });

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
          toast.info('Appuyez sur le bouton pour écouter l’accueil.');
        }
      }
    } catch (err) {
      console.error('Erreur TTS:', err);
      toast.error(`Erreur audio: ${err.message}`);
      setIsPlaying(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Lecture manuelle
  const handleManualPlay = async () => {
    if (audioRef.current && audioUrl) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setNeedsManualPlay(false);
      } catch (err) {
        console.error('Erreur lecture manuelle:', err);
        toast.error('Impossible de lire l’audio.');
      }
    }
  };

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  // Bouton principal dynamique
  const handleMainButton = async () => {
    try {
      if (user) {
        // Connecté → Dashboard
        navigate('/dashboard');
        return;
      }

      // Non connecté → TTS + record-video
      await generateSpeech();
      const isSessionValid = await refreshSession();
      if (!isSessionValid) {
        toast.error('Veuillez vous connecter pour continuer.');
        onOpenAuthModal();
        return;
      }
      navigate('/record-video');
    } catch {
      if (!user) onOpenAuthModal();
    }
  };

  // Déterminer le texte et l’icône du bouton
  const getButtonContent = () => {
    if (isLoading) return <>⏳ Génération audio...</>;
    if (isPlaying) return <>🎤 Lecture de l’accueil...</>;
    if (user) return <>📊 Accéder au Dashboard</>;
    return <>🎤 Démarrer l’expérience</>;
  };

  // Couleurs dynamiques selon état
  const getButtonClasses = () => {
    if (isLoading) return 'bg-gray-600 cursor-not-allowed';
    if (isPlaying) return 'bg-purple-600 hover:bg-purple-700';
    if (user) return 'bg-blue-600 hover:bg-blue-700';
    return 'bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700';
  };

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
            onClick={handleMainButton}
            disabled={isLoading}
            className={`text-white text-xl font-bold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${getButtonClasses()}`}
          >
            {getButtonContent()}
          </Button>

          {needsManualPlay && (
            <Button
              onClick={handleManualPlay}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              ▶️ Écouter l’accueil
            </Button>
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
      </div>
    </div>
  );
};

export default WelcomeAgent;
