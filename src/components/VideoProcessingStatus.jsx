// src/components/VideoProcessingStatus.jsx
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VIDEO_STATUS, getStatusLabel, isProcessingStatus, isCompletedStatus, isErrorStatus } from '../constants/videoStatus';

const VideoProcessingStatus = ({ videoId, initialStatus }) => {
  const [status, setStatus] = useState(initialStatus || 'processing');
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Mettre à jour le statut si initialStatus change
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  useEffect(() => {
    if (!videoId) return;
    
    // Configurer la surveillance en temps réel
    console.log(`Configuration de la surveillance pour la vidéo ${videoId}`);
    
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
          console.log(`Mise à jour du statut de la vidéo ${videoId}:`, payload.new.status);
          setStatus(payload.new.status);
          
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
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('status')
          .eq('id', videoId)
          .single();
          
        if (error) throw error;
        if (data && isMounted) {
          setStatus(data.status);
          
          // Si le statut est terminal, arrêter le polling
          if (isCompletedStatus(data.status) || isErrorStatus(data.status)) {
            setIsPolling(false);
          }
        }
      } catch (err) {
        console.error(`Erreur lors du polling de la vidéo ${videoId}:`, err);
        if (isMounted) {
          setError(err.message);
        }
      }
    }, 5000); // Vérifier toutes les 5 secondes
    
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [videoId, isPolling]);

  // Rendu du statut
  const renderStatus = () => {
    if (isCompletedStatus(status)) {
      return (
        <div className="flex items-center text-green-600">
          <CheckCircle className="w-4 h-4 mr-1" />
          <span>{getStatusLabel(status)}</span>
        </div>
      );
    } else if (isErrorStatus(status)) {
      return (
        <div className="flex items-center text-red-600">
          <AlertCircle className="w-4 h-4 mr-1" />
          <span>{getStatusLabel(status)}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-amber-600">
          {isPolling ? (
            <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Clock className="w-4 h-4 mr-1" />
          )}
          <span>{getStatusLabel(status)}</span>
        </div>
      );
    }
  };

  return (
    <div className="video-status">
      {renderStatus()}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default VideoProcessingStatus;
