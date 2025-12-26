// src/hooks/useFutureJobVideo.js
import { useState, useEffect, useCallback } from 'react';
import { futureJobsVideoService } from '../services/futureJobsVideoService';
import { useAuth } from '../contexts/AuthContext';

export function useFutureJobVideo(jobId) {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  // Charger l'historique
  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user, jobId]);

  const loadHistory = async () => {
    const result = await futureJobsVideoService.getUserVideos(user.id);
    if (result.success) {
      setHistory(result.videos);
    }
  };

  const generateVideo = useCallback(async ({
    promptText,
    generator = 'Sora',
    style = 'futuristic',
    duration = 30,
    jobTitle,
    jobYear
  }) => {
    if (!user) {
      setError('Utilisateur non connecté');
      return null;
    }

    setIsGenerating(true);
    setError(null);
    setStatus('Démarrage de la génération...');

    try {
      const result = await futureJobsVideoService.generateJobVideo({
        jobId,
        promptText,
        generator,
        style,
        duration,
        userId: user.id,
        jobTitle,
        jobYear
      });

      if (result.success) {
        setVideoUrl(result.videoUrl);
        setStatus('Génération réussie');
        
        // Recharger l'historique
        await loadHistory();
        
        return {
          videoUrl: result.videoUrl,
          videoId: result.videoId,
          metadata: result.metadata
        };
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message);
      setStatus('Échec de la génération');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [user, jobId]);

  const cancelGeneration = useCallback(async (videoId) => {
    if (videoId) {
      await futureJobsVideoService.cancelVideoGeneration(videoId);
      setIsGenerating(false);
      setStatus('Génération annulée');
    }
  }, []);

  const clearVideo = useCallback(() => {
    setVideoUrl(null);
    setStatus(null);
    setError(null);
  }, []);

  return {
    // États
    isGenerating,
    videoUrl,
    status,
    error,
    history,
    
    // Actions
    generateVideo,
    cancelGeneration,
    clearVideo,
    refreshHistory: loadHistory,
    
    // Utilitaire
    hasHistory: history.length > 0,
    canGenerate: !!user
  };
}
