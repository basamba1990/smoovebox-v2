// src/components/WelcomeAgent.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

export default function WelcomeAgent() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: welcomeMessage }),
      });
      
      if (response.ok) {
        const audioBlob = await response.blob();
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Lecture automatique
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(error => {
            console.error("Erreur de lecture audio:", error);
            setIsPlaying(false);
          });
        }
      } else {
        console.error('Erreur lors de la génération audio');
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Erreur TTS:', error);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
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
      <div className="absolute inset-0 bg-[url('/images/can-bg.jpg')] bg-cover bg-center opacity-20 animate-pulse-slow"/>
      
      {/* Éléments décoratifs flottants */}
      <div className="absolute top-10 left-10 w-24 h-24 opacity-60 animate-float">
        ⚽
      </div>
      <div className="absolute bottom-10 right-10 w-24 h-24 opacity-60 animate-float" style={{animationDelay: '2s'}}>
        🏆
      </div>
      <div className="absolute top-1/3 right-1/4 w-16 h-16 opacity-40 animate-float" style={{animationDelay: '4s'}}>
        🌟
      </div>
      
      {/* Contenu principal */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center text-white p-8">
        <div className="max-w-4xl bg-black/50 backdrop-blur-md rounded-3xl p-8 md:p-12 border-2 border-gold shadow-2xl">
          {/* Logo CAN */}
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

          <button
            onClick={generateSpeech}
            disabled={isLoading || isPlaying}
            className="relative bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white text-xl font-bold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-lg hover:shadow-xl overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center">
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Génération de l'audio...
                </>
              ) : isPlaying ? (
                '🎤 Écoutez votre accueil...'
              ) : (
                '🎤 Démarrer l\'expérience'
              )}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 group-hover:from-white/10 group-hover:to-white/30 transform group-hover:scale-110 transition-transform duration-300"></div>
          </button>

          {/* Indicateur de chargement */}
          {(isLoading || isPlaying) && (
            <div className="mt-8 flex flex-col items-center space-y-4">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
              </div>
              <p className="text-sm text-blue-200">
                {isPlaying ? "Expérience d'accueil en cours..." : "Préparation de votre accueil..."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Élément audio caché */}
      <audio 
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
    </div>
  );
}
