// src/components/TranscriptionViewer.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

const TranscriptionViewer = ({ video }) => {
  const { user } = useAuth();
  const [transcription, setTranscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFullText, setShowFullText] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    if (video && video.id) {
      fetchTranscription();
      
      // Si la vidéo est en cours de traitement, configurer un polling
      if (video.status === 'processing') {
        startPolling();
      } else {
        stopPolling();
      }
    } else {
      setTranscription(null);
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

      // Récupérer les données de transcription directement depuis la table videos
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('id, transcription, transcription_data, status, error_message')
        .eq('id', video.id)
        .single();

      if (fetchError) {
        throw new Error(`Erreur lors de la récupération de la transcription: ${fetchError.message}`);
      }

      // Traiter les données de transcription
      if (data) {
        let transcriptionText = null;
        let segments = [];
        let language = 'fr';
        
        // Essayer de récupérer le texte de transcription de différentes sources
        if (data.transcription_data) {
          if (typeof data.transcription_data === 'string') {
            try {
              const parsed = JSON.parse(data.transcription_data);
              transcriptionText = parsed.text;
              segments = parsed.segments || [];
              language = parsed.language || 'fr';
            } catch (e) {
              transcriptionText = data.transcription_data;
            }
          } else {
            transcriptionText = data.transcription_data.text;
            segments = data.transcription_data.segments || [];
            language = data.transcription_data.language || 'fr';
          }
        } else if (data.transcription) {
          if (typeof data.transcription === 'string') {
            transcriptionText = data.transcription;
          } else if (typeof data.transcription === 'object') {
            transcriptionText = data.transcription.text || JSON.stringify(data.transcription);
            segments = data.transcription.segments || [];
          }
        }
        
        if (transcriptionText) {
          setTranscription({
            text: transcriptionText,
            segments: segments,
            language: language,
            status: data.status,
            error_message: data.error_message
          });
        } else {
          setTranscription(null);
        }
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

  // Fonction pour lancer manuellement la transcription
  const startTranscription = async () => {
    if (!video || !video.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Récupérer le token d'authentification
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      // Appeler la fonction Edge pour démarrer la transcription
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId: video.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur ${response.status}`);
      }
      
      // Démarrer le polling pour suivre l'avancement
      startPolling();
      
      // Mettre à jour l'interface pour montrer que la transcription est en cours
      setTranscription({
        text: "Transcription en cours...",
        segments: [],
        status: 'processing'
      });
      
    } catch (err) {
      console.error('Erreur lors du démarrage de la transcription:', err);
      setError(err.message);
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

  // Si aucune vidéo n'est sélectionnée
  if (!video) {
    return null;
  }

  // Si la transcription est en cours de chargement
  if (loading && !transcription) {
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

  // Si la transcription est en cours de traitement
  if (video.status === 'processing') {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="flex flex-col items-center justify-center p-8 bg-blue-50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-blue-700 font-medium">Transcription en cours...</p>
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

  // Si la transcription a échoué
  if (video.status === 'failed' || (transcription && transcription.status === 'failed')) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
            <div>
              <p className="font-medium">La transcription a échoué</p>
              <p className="text-sm mt-1">
                {transcription?.error_message || video.error_message || 
                 "Une erreur s'est produite lors de la transcription de cette vidéo."}
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

  // Si aucune transcription n'est disponible
  if (!transcription || !transcription.text) {
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

  // Affichage normal de la transcription
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
