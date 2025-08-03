// src/components/VideoProcessingStatus.jsx
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, FileText, Brain } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VIDEO_STATUS, getStatusLabel, isProcessingStatus, isCompletedStatus, isErrorStatus } from '../constants/videoStatus';

const VideoProcessingStatus = ({ videoId, initialStatus, onStatusChange }) => {
  const [status, setStatus] = useState(initialStatus || 'processing');
  const [transcript, setTranscript] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastChecked, setLastChecked] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mettre à jour le statut si initialStatus change
  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  // Fonction pour récupérer les données complètes de la vidéo
  const fetchVideoData = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('status, transcript, ai_result, error_message, url')
        .eq('id', videoId)
        .single();

      if (error) throw error;
      
      if (data) {
        console.log(`Données récupérées pour la vidéo ${videoId}:`, data);
        setStatus(data.status);
        setTranscript(data.transcript || null);
        setAiResult(data.ai_result || null);
        
        if (data.error_message) {
          setError(data.error_message);
        }
        
        // Notifier le parent du changement de statut si nécessaire
        if (onStatusChange && status !== data.status) {
          onStatusChange({
            status: data.status,
            transcript: data.transcript,
            aiResult: data.ai_result
          });
        }
        
        // Si le statut est terminal, arrêter le polling
        if (isCompletedStatus(data.status) || isErrorStatus(data.status)) {
          setIsPolling(false);
        } else if (isProcessingStatus(data.status)) {
          // Si toujours en traitement, incrémenter le compteur de tentatives
          setRetryCount(prev => prev + 1);
          
          // Arrêter le polling après trop de tentatives
          if (retryCount >= 60) {
            setIsPolling(false);
            setError('Le traitement a pris trop de temps. Merci de réessayer plus tard.');
          }
        }
      }
      
      setLastChecked(new Date());
      setIsLoading(false);
    } catch (err) {
      console.error(`Erreur lors de la récupération des données de la vidéo ${videoId}:`, err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Configurer la surveillance en temps réel
  useEffect(() => {
    if (!videoId) return;

    console.log(`Configuration de la surveillance pour la vidéo ${videoId}`);
    
    // Récupérer les données initiales
    fetchVideoData();
    
    const channel = supabase
      .channel(`video-status-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${videoId}`
        },
        (payload) => {
          console.log(`Mise à jour du statut de la vidéo ${videoId}:`, payload.new);
          
          // Mettre à jour tous les états avec les nouvelles données
          setStatus(payload.new.status);
          
          if (payload.new.transcript) {
            setTranscript(payload.new.transcript);
          }
          
          if (payload.new.ai_result) {
            setAiResult(payload.new.ai_result);
          }
          
          if (payload.new.error_message) {
            setError(payload.new.error_message);
          }
          
          // Notifier le parent du changement de statut si nécessaire
          if (onStatusChange && payload.new.status !== status) {
            onStatusChange({
              status: payload.new.status,
              transcript: payload.new.transcript,
              aiResult: payload.new.ai_result
            });
          }
          
          // Si le statut est terminal, arrêter le polling
          if (isCompletedStatus(payload.new.status) || isErrorStatus(payload.new.status)) {
            setIsPolling(false);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Statut de l'abonnement pour la vidéo ${videoId}:`, status);
        
        // Si l'abonnement échoue, utiliser le polling comme fallback
        if (status !== 'SUBSCRIBED') {
          console.log(`Utilisation du polling comme fallback pour la vidéo ${videoId}`);
          setIsPolling(true);
        }
      });
    
    // Démarrer le polling comme fallback
    setIsPolling(true);
    
    return () => {
      // Nettoyer la surveillance lors du démontage
      supabase.removeChannel(channel);
      setIsPolling(false);
    };
  }, [videoId]);

  // Effet pour le polling comme fallback si realtime ne fonctionne pas
  useEffect(() => {
    if (!videoId || !isPolling) return;

    let isMounted = true;
    
    // Déterminer l'intervalle de polling en fonction du nombre de tentatives
    // Augmenter progressivement l'intervalle pour éviter de surcharger le serveur
    const getPollingInterval = () => {
      if (retryCount < 5) return 5000; // 5 secondes pour les 5 premières tentatives
      if (retryCount < 15) return 10000; // 10 secondes pour les 10 suivantes
      if (retryCount < 30) return 30000; // 30 secondes ensuite
      return 60000; // 1 minute maximum
    };
    
    const pollInterval = setInterval(async () => {
      if (isMounted) {
        await fetchVideoData();
      }
    }, getPollingInterval());
    
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [videoId, isPolling, retryCount]);

  // Fonction pour forcer une actualisation manuelle
  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchVideoData();
  };

  // Rendu du loader initial
  const renderLoader = () => {
    if (!isLoading) return null;
    
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
        <span className="ml-2 text-sm text-gray-600">Chargement...</span>
      </div>
    );
  };

  // Rendu du statut
  const renderStatus = () => {
    if (isLoading) return null;
    
    if (isCompletedStatus(status)) {
      return (
        <div className="flex items-center text-green-600">
          <CheckCircle className="w-5 h-5 mr-1" />
          <span>{getStatusLabel(status)}</span>
        </div>
      );
    } else if (isErrorStatus(status)) {
      return (
        <div className="flex items-center text-red-600">
          <AlertCircle className="w-5 h-5 mr-1" />
          <span>{getStatusLabel(status)}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-amber-600">
          {isPolling ? (
            <RefreshCw className="w-5 h-5 mr-1 animate-spin" />
          ) : (
            <Clock className="w-5 h-5 mr-1" />
          )}
          <span>{getStatusLabel(status)}</span>
          {retryCount > 10 && (
            <span className="ml-2 text-xs text-gray-500">({retryCount})</span>
          )}
        </div>
      );
    }
  };

  // Rendu du temps écoulé depuis la dernière vérification
  const renderLastChecked = () => {
    if (!lastChecked || !isProcessingStatus(status) || isLoading) return null;

    const now = new Date();
    const diffSeconds = Math.floor((now - lastChecked) / 1000);
    
    let timeText = '';
    if (diffSeconds < 60) {
      timeText = `il y a ${diffSeconds} seconde${diffSeconds > 1 ? 's' : ''}`;
    } else {
      const diffMinutes = Math.floor(diffSeconds / 60);
      timeText = `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
    
    return (
      <div className="text-xs text-gray-500 mt-1">
        Dernière vérification : {timeText}
      </div>
    );
  };

  // Rendu du message d'analyse en cours
  const renderProcessingMessage = () => {
    if (!isProcessingStatus(status) || isLoading) return null;
    
    return (
      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-700">
          <span className="font-medium">Analyse en cours...</span> Cela peut prendre quelques minutes selon la longueur de la vidéo.
        </p>
      </div>
    );
  };

  // Rendu des résultats (transcription et analyse IA)
  const renderResults = () => {
    if (status !== 'done' || isLoading) return null;

    return (
      <div className="mt-4 space-y-4">
        {transcript ? (
          <div className="bg-white p-3 rounded-md border border-gray-200">
            <div className="flex items-center mb-2 text-gray-700">
              <FileText className="w-4 h-4 mr-1" />
              <h4 className="font-semibold">Transcription</h4>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line">{transcript}</p>
          </div>
        ) : (
          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <p className="text-sm text-gray-500">Aucune transcription trouvée.</p>
          </div>
        )}
        
        {aiResult ? (
          <div className="bg-white p-3 rounded-md border border-gray-200">
            <div className="flex items-center mb-2 text-gray-700">
              <Brain className="w-4 h-4 mr-1" />
              <h4 className="font-semibold">Analyse IA</h4>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line">{aiResult}</p>
          </div>
        ) : (
          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <p className="text-sm text-gray-500">Aucune analyse IA disponible.</p>
          </div>
        )}
      </div>
    );
  };

  // Rendu des messages d'erreur génériques
  const renderError = () => {
    if (!error || isLoading || error.includes('URL')) return null;

    return (
      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
        <p className="text-xs text-red-600">{error}</p>
        <div className="mt-1 flex justify-end">
          <button 
            onClick={handleRefresh}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Réessayer
          </button>
        </div>
      </div>
    );
  };

  // Nouveau rendu spécifique pour les erreurs d'URL
  const renderUrlError = () => {
    if (status !== 'error' || !error || !error.includes('URL')) return null;
    
    return (
      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
        <p className="text-xs text-red-600">
          <strong>Erreur d'URL :</strong> {error}
        </p>
        <div className="mt-2">
          <p className="text-xs text-gray-600">
            Solutions possibles :
          </p>
          <ul className="text-xs text-gray-600 list-disc pl-4 mt-1">
            <li>Vérifiez que l'URL de la vidéo est correcte</li>
            <li>Réessayez l'upload avec un nouveau fichier</li>
            <li>Contactez le support si le problème persiste</li>
          </ul>
        </div>
        <div className="mt-1 flex justify-end">
          <button 
            onClick={handleRefresh}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Vérifier à nouveau
          </button>
        </div>
      </div>
    );
  };

  // Rendu du message d'attente prolongée
  const renderLongWaitMessage = () => {
    if (!isProcessingStatus(status) || retryCount < 15 || isLoading) return null;

    return (
      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
        <p className="text-xs text-amber-700">
          Le traitement de cette vidéo prend plus de temps que prévu. 
          Cela peut être dû à la longueur de la vidéo ou à une charge importante sur nos serveurs.
        </p>
      </div>
    );
  };

  return (
    <div className="video-processing-status">
      {renderLoader()}
      {renderStatus()}
      {renderLastChecked()}
      {renderProcessingMessage()}
      {renderError()}
      {renderUrlError()} {/* Nouveau rendu spécifique aux erreurs d'URL */}
      {renderLongWaitMessage()}
      {renderResults()}
    </div>
  );
};

export default VideoProcessingStatus;
