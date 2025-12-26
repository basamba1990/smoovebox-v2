// src/components/VideoGenerationPanel.jsx
import React, { useState, useEffect } from 'react';
import { Play, Loader2, CheckCircle, XCircle, RefreshCw, Download, Copy } from 'lucide-react';
import { futureJobsVideoService } from '../services/futureJobsVideoService';
import { useAuth } from '../contexts/AuthContext';

export default function VideoGenerationPanel({
  jobId,
  jobTitle,
  jobYear,
  generatedPrompt,
  onGenerationComplete,
  onError
}) {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [generationTime, setGenerationTime] = useState(null);
  const [selectedGenerator, setSelectedGenerator] = useState('Sora');
  const [selectedStyle, setSelectedStyle] = useState('futuristic');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [pollingInterval, setPollingInterval] = useState(null);

  // Options disponibles
  const generators = [
    { id: 'Sora', name: 'OpenAI Sora', icon: '🤖', color: 'bg-green-500' },
    { id: 'Runway', name: 'RunwayML', icon: '🎬', color: 'bg-purple-500' },
    { id: 'Pika', name: 'Pika Labs', icon: '⚡', color: 'bg-blue-500' }
  ];

  const styles = [
    { id: 'futuristic', name: 'Futuriste', desc: 'Néon, hologrammes, lumière froide' },
    { id: 'semi-realistic', name: 'Semi-réaliste', desc: 'Haute définition, lumière naturelle' },
    { id: 'cinematic', name: 'Cinématique', desc: 'Cinéma 4K, couleurs saturées' },
    { id: 'documentary', name: 'Documentaire', desc: 'Réaliste, lumière naturelle' },
    { id: 'abstract', name: 'Abstrait', desc: 'Symbolique, effets visuels' }
  ];

  const durations = [15, 20, 25, 30, 45, 60];

  // Nettoyer l'intervalle de polling
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Fonction pour démarrer la génération
  const handleGenerateVideo = async () => {
    if (!user) {
      onError?.('Vous devez être connecté pour générer une vidéo');
      return;
    }

    if (!generatedPrompt) {
      onError?.('Veuillez d\'abord générer un prompt');
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('Démarrage de la génération...');
    setGenerationTime(Date.now());

    try {
      const result = await futureJobsVideoService.generateJobVideo({
        jobId,
        promptText: generatedPrompt.prompt || generatedPrompt,
        generator: selectedGenerator,
        style: selectedStyle,
        duration: selectedDuration,
        userId: user.id,
        jobTitle,
        jobYear
      });

      if (result.success) {
        setVideoId(result.videoId);
        setVideoUrl(result.videoUrl);
        setGenerationStatus(result.message);
        
        if (result.videoUrl) {
          onGenerationComplete?.({
            videoUrl: result.videoUrl,
            videoId: result.videoId,
            metadata: result.metadata
          });
        } else {
          // Si pas d'URL immédiate, démarrer le polling
          startPolling(result.videoId);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Erreur génération:', error);
      setGenerationStatus(`Erreur: ${error.message}`);
      onError?.(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Fonction pour vérifier le statut périodiquement
  const startPolling = (vidId) => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(async () => {
      const result = await futureJobsVideoService.checkVideoStatus(vidId);
      
      if (result.success) {
        switch (result.status) {
          case 'done':
            setVideoUrl(result.videoUrl);
            setGenerationStatus('Vidéo générée avec succès !');
            clearInterval(interval);
            setPollingInterval(null);
            onGenerationComplete?.({
              videoUrl: result.videoUrl,
              videoId: vidId,
              metadata: result.metadata
            });
            break;
          
          case 'error':
            setGenerationStatus(`Erreur: ${result.errorMessage}`);
            clearInterval(interval);
            setPollingInterval(null);
            onError?.(result.errorMessage);
            break;
          
          case 'generating':
            setGenerationStatus('Génération en cours...');
            break;
          
          default:
            setGenerationStatus(`Statut: ${result.status}`);
        }
      }
    }, 5000); // Vérifier toutes les 5 secondes

    setPollingInterval(interval);
  };

  // Fonction pour annuler la génération
  const handleCancelGeneration = async () => {
    if (videoId && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      await futureJobsVideoService.cancelVideoGeneration(videoId);
      setIsGenerating(false);
      setGenerationStatus('Génération annulée');
    }
  };

  // Fonction pour télécharger la vidéo
  const handleDownloadVideo = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `${jobTitle.replace(/\s+/g, '-')}-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Calcul du temps écoulé
  const getElapsedTime = () => {
    if (!generationTime) return '0s';
    const seconds = Math.floor((Date.now() - generationTime) / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6 space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">🎬 Génération Vidéo</h3>

      {/* Options de génération */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sélecteur de générateur */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Générateur
          </label>
          <div className="flex gap-2">
            {generators.map((gen) => (
              <button
                key={gen.id}
                onClick={() => setSelectedGenerator(gen.id)}
                disabled={isGenerating}
                className={`flex-1 p-3 rounded-lg border ${
                  selectedGenerator === gen.id
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full ${gen.color} flex items-center justify-center mx-auto mb-2`}>
                  <span className="text-lg">{gen.icon}</span>
                </div>
                <span className="text-sm text-gray-200">{gen.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sélecteur de style */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Style
          </label>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            disabled={isGenerating}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            {styles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.name} - {style.desc}
              </option>
            ))}
          </select>
        </div>

        {/* Sélecteur de durée */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Durée (secondes)
          </label>
          <select
            value={selectedDuration}
            onChange={(e) => setSelectedDuration(Number(e.target.value))}
            disabled={isGenerating}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            {durations.map((dur) => (
              <option key={dur} value={dur}>
                {dur}s
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bouton de génération */}
      <div className="flex gap-3">
        <button
          onClick={handleGenerateVideo}
          disabled={isGenerating || !user || !generatedPrompt}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Générer la vidéo
            </>
          )}
        </button>

        {isGenerating && (
          <button
            onClick={handleCancelGeneration}
            className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
          >
            <XCircle className="w-5 h-5" />
            Annuler
          </button>
        )}
      </div>

      {/* Statut de génération */}
      {generationStatus && (
        <div className={`p-4 rounded-lg ${
          generationStatus.includes('Erreur') 
            ? 'bg-red-900/20 border border-red-700' 
            : 'bg-gray-700/50 border border-gray-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              ) : generationStatus.includes('succès') ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-400"></div>
              )}
              <div>
                <p className="font-medium text-white">{generationStatus}</p>
                {isGenerating && (
                  <p className="text-sm text-gray-400">
                    Temps écoulé: {getElapsedTime()}
                  </p>
                )}
              </div>
            </div>
            
            {isGenerating && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                <span className="text-sm text-blue-400">En cours...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vidéo générée */}
      {videoUrl && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">🎥 Vidéo Générée</h4>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadVideo}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(videoUrl)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copier l'URL
              </button>
            </div>
          </div>
          
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              poster="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800"
            >
              Votre navigateur ne supporte pas la lecture de vidéos.
            </video>
          </div>
          
          <div className="text-sm text-gray-400">
            <p>Généré avec {selectedGenerator} • Style: {selectedStyle} • Durée: {selectedDuration}s</p>
          </div>
        </div>
      )}

      {/* Informations pour utilisateur non connecté */}
      {!user && (
        <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-200">
            ⚠️ Connectez-vous pour générer des vidéos. La génération vidéo nécessite un compte.
          </p>
        </div>
      )}
    </div>
  );
}
