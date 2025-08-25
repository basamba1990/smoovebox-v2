// src/components/TranscriptionViewer.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

const TranscriptionViewer = ({ video, onTranscriptionUpdate }) => {
  const [transcriptionData, setTranscriptionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFullText, setShowFullText] = useState(false);
  const [pollingIntervalId, setPollingIntervalId] = useState(null);

  const fetchTranscription = useCallback(async (silent = false) => {
    if (!video || !video.id) return;

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('id, status, transcription_text, transcription_data, error_message')
        .eq('id', video.id)
        .single();

      if (fetchError) {
        throw new Error(`Erreur lors de la récupération de la transcription: ${fetchError.message}`);
      }

      if (data) {
        let text = data.transcription_text;
        let segments = [];
        let language = 'fr';

        if (data.transcription_data) {
          try {
            const parsedData = typeof data.transcription_data === 'string' 
              ? JSON.parse(data.transcription_data) 
              : data.transcription_data;
            
            text = parsedData.text || text;
            segments = parsedData.segments || [];
            language = parsedData.language || 'fr';
          } catch (e) {
            console.warn("Erreur de parsing transcription_data:", e);
          }
        }

        setTranscriptionData({
          text: text,
          segments: segments,
          language: language,
          status: data.status,
          error_message: data.error_message
        });

        // Notifier le parent d'une mise à jour du statut de la vidéo
        if (onTranscriptionUpdate) {
          onTranscriptionUpdate(data.status, data.error_message);
        }

        // Arrêter le polling si la transcription est terminée ou a échoué
        if (data.status === 'transcribed' || data.status === 'analyzed' || data.status === 'failed') {
          stopPolling();
        }

      } else {
        setTranscriptionData(null);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération de la transcription:', err);
      setError(err.message);
      if (onTranscriptionUpdate) {
        onTranscriptionUpdate('failed', err.message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [video, onTranscriptionUpdate]);

  const startPolling = useCallback(() => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }
    const interval = setInterval(() => {
      fetchTranscription(true);
    }, 10000); // Poll toutes les 10 secondes
    setPollingIntervalId(interval);
  }, [fetchTranscription, pollingIntervalId]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
    }
  }, [pollingIntervalId]);

  useEffect(() => {
    if (video && video.id) {
      fetchTranscription();
      if (video.status === 'processing' || video.status === 'transcribing' || video.status === 'analyzing') {
        startPolling();
      } else {
        stopPolling();
      }
    } else {
      setTranscriptionData(null);
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [video, fetchTranscription, startPolling, stopPolling]);

  const startTranscription = async () => {
    if (!video || !video.id) return;

    try {
      setLoading(true);
      setError(null);
      setTranscriptionData({ text: "Transcription en cours...", segments: [], status: 'processing' });

      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;

      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId: video.id, videoUrl: video.public_url || video.file_path })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur ${response.status}`);
      }

      startPolling();
      if (onTranscriptionUpdate) {
        onTranscriptionUpdate('processing');
      }

    } catch (err) {
      console.error('Erreur lors du démarrage de la transcription:', err);
      setError(err.message);
      setTranscriptionData(prev => ({ ...prev, status: 'failed', error_message: err.message }));
      if (onTranscriptionUpdate) {
        onTranscriptionUpdate('failed', err.message);
      }
    } finally {
      setLoading(false);
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

  const currentStatus = transcriptionData?.status || video.status;
  const currentErrorMessage = transcriptionData?.error_message || video.error_message;

  if (!video) {
    return null;
  }

  if (loading && !transcriptionData) {
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

  if (error) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p>{error}</p>
          <button 
            onClick={() => fetchTranscription()}
            className="mt-2 px-3 py-1 bg-white border border-red-300 rounded text-sm hover:bg-red-50"
          >
            <RefreshCw className="h-4 w-4 inline mr-1" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (currentStatus === 'processing' || currentStatus === 'transcribing' || currentStatus === 'analyzing') {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="flex flex-col items-center justify-center p-8 bg-blue-50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-blue-700 font-medium">{transcriptionData?.text || "Traitement en cours..."}</p>
          <p className="text-blue-600 text-sm mt-2">
            Ce processus peut prendre quelques minutes selon la durée de la vidéo.
          </p>
          <button 
            onClick={() => fetchTranscription()}
            className="mt-4 px-4 py-2 bg-white border border-blue-300 rounded text-sm hover:bg-blue-50"
          >
            <RefreshCw className="h-4 w-4 inline mr-1" />
            Actualiser
          </button>
        </div>
      </div>
    );
  }

  if (currentStatus === 'failed') {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
            <div>
              <p className="font-medium">La transcription a échoué</p>
              <p className="text-sm mt-1">
                {currentErrorMessage || "Une erreur s'est produite lors de la transcription de cette vidéo."}
              </p>
            </div>
          </div>
          <button 
            onClick={startTranscription}
            className="mt-4 px-4 py-2 bg-white border border-red-300 rounded text-sm hover:bg-red-50"
          >
            Réessayer la transcription
          </button>
        </div>
      </div>
    );
  }

  if (!transcriptionData || !transcriptionData.text) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">Aucune transcription disponible pour cette vidéo.</p>
          <button 
            onClick={startTranscription}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Transcrire cette vidéo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Transcription</h2>
        <div className="flex gap-2">
          <button
            onClick={() => fetchTranscription()}
            className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200"
          >
            <RefreshCw className="h-4 w-4 inline mr-1" />
            Actualiser
          </button>
          <button
            onClick={() => setShowFullText(!showFullText)}
            className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200"
          >
            {showFullText ? 'Afficher par segments' : 'Afficher texte complet'}
          </button>
        </div>
      </div>
      
      {showFullText ? (
        <div className="prose max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap">{transcriptionData.text}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transcriptionData.segments && transcriptionData.segments.length > 0 ? (
            transcriptionData.segments.map((segment, index) => (
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
              <p className="text-gray-700 whitespace-pre-wrap">{transcriptionData.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionViewer;
