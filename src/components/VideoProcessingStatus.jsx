// src/components/VideoProcessingStatus.jsx - Adaptation pour gérer les chemins de stockage
import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { VIDEO_STATUS } from '../constants/videoStatus';
import { getBestVideoSource } from '../lib/storageUtils';

const VideoProcessingStatus = ({ video, onStatusChange }) => {
  const [status, setStatus] = useState(video?.status || VIDEO_STATUS.PROCESSING);
  const [message, setMessage] = useState('');
  const [videoSource, setVideoSource] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!video) return;
    
    const checkVideoSource = async () => {
      try {
        // Vérifier si nous avons une source vidéo valide
        const source = await getBestVideoSource({ 
          video, 
          url: video.url, 
          storagePath: video.storage_path 
        });
        
        setVideoSource(source);
        
        // Mettre à jour le statut en fonction de la source
        if (video.status === VIDEO_STATUS.READY) {
          setStatus(VIDEO_STATUS.READY);
          setMessage('Vidéo prête à être visionnée');
        } else if (video.status === VIDEO_STATUS.PROCESSING) {
          setStatus(VIDEO_STATUS.PROCESSING);
          setMessage('Traitement de la vidéo en cours...');
        } else if (video.status === VIDEO_STATUS.ERROR) {
          setStatus(VIDEO_STATUS.ERROR);
          setMessage(video.error_message || 'Une erreur est survenue lors du traitement');
        } else if (!source) {
          // Si pas de source mais statut non ERROR, c'est probablement une erreur
          setStatus(VIDEO_STATUS.ERROR);
          setMessage('Aucune source vidéo valide trouvée');
        }
      } catch (err) {
        console.error('Erreur lors de la vérification de la source vidéo:', err);
        setError(err.message);
      }
    };
    
    checkVideoSource();
  }, [video]);
  
  // Notifier le parent du changement de statut
  useEffect(() => {
    if (onStatusChange && status) {
      onStatusChange(status);
    }
  }, [status, onStatusChange]);
  
  if (!video) {
    return null;
  }
  
  // Afficher le statut approprié
  switch (status) {
    case VIDEO_STATUS.PROCESSING:
      return (
        <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin mr-2" />
          <div>
            <p className="font-medium text-yellow-700">Traitement en cours</p>
            <p className="text-sm text-yellow-600">{message || 'Votre vidéo est en cours de traitement. Cela peut prendre quelques minutes.'}</p>
          </div>
        </div>
      );
      
    case VIDEO_STATUS.ERROR:
      return (
        <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md mb-4">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <div>
            <p className="font-medium text-red-700">Erreur de traitement</p>
            <p className="text-sm text-red-600">{message || 'Une erreur est survenue lors du traitement de la vidéo.'}</p>
          </div>
        </div>
      );
      
    case VIDEO_STATUS.READY:
      if (!videoSource) {
        return (
          <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md mb-4">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <p className="font-medium text-red-700">Vidéo non disponible</p>
              <p className="text-sm text-red-600">La vidéo est marquée comme prête mais aucune source valide n'a été trouvée.</p>
            </div>
          </div>
        );
      }
      
      return (
        <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-md mb-4">
          <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
          <div>
            <p className="font-medium text-green-700">Vidéo prête</p>
            <p className="text-sm text-green-600">{message || 'Votre vidéo est prête à être visionnée.'}</p>
          </div>
        </div>
      );
      
    default:
      return null;
  }
};

export default VideoProcessingStatus;
