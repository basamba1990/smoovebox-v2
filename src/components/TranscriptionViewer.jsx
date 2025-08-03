// src/components/TranscriptionViewer.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent } from './ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { RefreshCw, FileText, AlertCircle, Loader2 } from 'lucide-react';
import VideoPlayer from './VideoPlayer.jsx';
import { TRANSCRIPTION_STATUS } from '../constants/videoStatus.js';

const TranscriptionViewer = ({ video }) => {
  const { user } = useAuth();
  const [transcription, setTranscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFullText, setShowFullText] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    if (video && video.id) {
      fetchTranscription();
      
      // Si la transcription est en cours de traitement, configurer un polling
      if (video.transcriptions && 
          video.transcriptions.length > 0 && 
          video.transcriptions[0].status === TRANSCRIPTION_STATUS.PROCESSING) {
        startPolling();
      } else {
        stopPolling();
      }
    } else {
      setTranscription(null);
      setTranscriptionStatus(null);
      stopPolling();
    }
    
    // Nettoyage lors du démontage du composant
    return () => {
      stopPolling();
    };
  }, [video]);

  // Démarrer le polling pour les mises à jour de transcription
  const startPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Vérifier toutes les 10 secondes si la transcription est terminée
    const interval = setInterval(() => {
      fetchTranscription(true); // true = polling silencieux (pas d'indicateur de chargement)
    }, 10000);
    
    setPollingInterval(interval);
  };

  // Arrêter le polling
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const fetchTranscription = async (silent = false) => {
    if (!video || !video.id) return;
    
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Récupérer à la fois les données de transcription et le statut actuel
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select(`
          id,
          transcription,
          transcription_data,
          transcriptions (
            id,
            status,
            confidence_score,
            processed_at,
            error_message
          )
        `)
        .eq('id', video.id)
        .single();

      if (fetchError) {
        throw new Error(`Erreur lors de la récupération de la transcription: ${fetchError.message}`);
      }

      // Mettre à jour le statut de la transcription
      if (data.transcriptions && data.transcriptions.length > 0) {
        const currentStatus = data.transcriptions[0].status;
        setTranscriptionStatus(currentStatus);
        
        // Si la transcription est terminée ou a échoué, arrêter le polling
        if (currentStatus === TRANSCRIPTION_STATUS.COMPLETED || 
            currentStatus === TRANSCRIPTION_STATUS.FAILED) {
          stopPolling();
        } else if (currentStatus === TRANSCRIPTION_STATUS.PROCESSING) {
          // S'assurer que le polling est actif si la transcription est en cours
          if (!pollingInterval) {
            startPolling();
          }
        }
      }

      // Traiter les données de transcription
      if (data && (data.transcription || data.transcription_data)) {
        // Utiliser transcription_data s'il existe, sinon utiliser transcription
        const transcriptionText = data.transcription_data?.text || data.transcription;
        const segments = data.transcription_data?.segments || [];
        
        setTranscription({
          text: transcriptionText,
          segments: segments
        });
      } else {
        setTranscription(null);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération de la transcription:', err);
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '0:00';
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Si aucune vidéo n'est sélectionnée
  if (!video) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">Veuillez sélectionner une vidéo pour voir sa transcription.</p>
        </div>
      </div>
    );
  }

  // Si la transcription est en cours de chargement
  if (loading) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500 mb-4" />
          <p className="text-gray-500">Chargement de la transcription...</p>
        </div>
      </div>
    );
  }

  // Si une erreur s'est produite
  if (error) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p>{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchTranscription()}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  // Si la transcription est en cours de traitement
  if (transcriptionStatus === TRANSCRIPTION_STATUS.PROCESSING) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="flex flex-col items-center justify-center p-8 bg-blue-50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-blue-700 font-medium">Transcription en cours...</p>
          <p className="text-blue-600 text-sm mt-2">
            Ce processus peut prendre quelques minutes selon la durée de la vidéo.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchTranscription()}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>
    );
  }

  // Si la transcription a échoué
  if (transcriptionStatus === TRANSCRIPTION_STATUS.FAILED) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
            <div>
              <p className="font-medium">La transcription a échoué</p>
              <p className="text-sm mt-1">
                {video.transcriptions?.[0]?.error_message || 
                 "Une erreur s'est produite lors de la transcription de cette vidéo."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si aucune transcription n'est disponible
  if (!transcription) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">Aucune transcription disponible pour cette vidéo.</p>
        </div>
      </div>
    );
  }

  // Affichage normal de la transcription
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Transcription</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTranscription()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullText(!showFullText)}
          >
            {showFullText ? 'Afficher par segments' : 'Afficher texte complet'}
          </Button>
        </div>
      </div>
      
      {showFullText ? (
        <div className="prose max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap">{transcription.text}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transcription.segments && transcription.segments.length > 0 ? (
            transcription.segments.map((segment, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-medium text-gray-500">
                    {formatTime(segment.start)} - {formatTime(segment.end)}
                  </span>
                  {segment.confidence && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {Math.round(segment.confidence * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-gray-700">{segment.text}</p>
              </div>
            ))
          ) : (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{transcription.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionViewer;
