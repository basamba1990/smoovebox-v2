import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const TranscriptionViewer = ({ video }) => {
  const [transcription, setTranscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFullText, setShowFullText] = useState(false);

  useEffect(() => {
    if (video) {
      extractTranscriptionData(video);
    }
  }, [video]);

  const extractTranscriptionData = (video) => {
    try {
      setLoading(true);
      setError(null);
      
      let transcriptionData = null;
      let transcriptionText = "";
      let segments = [];
      
      // Essayer de récupérer les données de transcription depuis différentes sources
      if (video.transcription_data) {
        if (typeof video.transcription_data === 'string') {
          try {
            transcriptionData = JSON.parse(video.transcription_data);
          } catch (e) {
            transcriptionData = { text: video.transcription_data };
          }
        } else {
          transcriptionData = video.transcription_data;
        }
        
        if (transcriptionData) {
          transcriptionText = transcriptionData.text || transcriptionData.full_text || "";
          segments = transcriptionData.segments || [];
        }
      }
      
      // Fallback sur transcription_text si disponible
      if (!transcriptionText && video.transcription_text) {
        transcriptionText = video.transcription_text;
      }
      
      // Vérifier s'il y a des transcriptions liées
      if (!transcriptionText && video.transcriptions && video.transcriptions.length > 0) {
        const transcriptionRecord = video.transcriptions[0];
        transcriptionText = transcriptionRecord.transcription_text || transcriptionRecord.full_text || "";
        
        if (transcriptionRecord.segments) {
          try {
            segments = typeof transcriptionRecord.segments === 'string' 
              ? JSON.parse(transcriptionRecord.segments) 
              : transcriptionRecord.segments;
          } catch (e) {
            console.error("Erreur lors du parsing des segments:", e);
          }
        }
      }
      
      if (transcriptionText || segments.length > 0) {
        setTranscription({
          text: transcriptionText,
          segments: segments,
          language: transcriptionData?.language || 'fr',
          status: video.status,
          error_message: video.error_message
        });
      } else {
        setTranscription(null);
      }
    } catch (err) {
      console.error('Erreur lors de l\'extraction de la transcription:', err);
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

  if (!video) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-4">Transcription</h3>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-2" />
          <p className="text-gray-600">Chargement de la transcription...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-4">Transcription</h3>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!transcription) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-4">Transcription</h3>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">Aucune transcription disponible pour cette vidéo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Transcription</h3>
        <div className="flex gap-2">
          <button
            onClick={() => extractTranscriptionData(video)}
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
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-700 whitespace-pre-wrap">{transcription.text}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {transcription.segments && transcription.segments.length > 0 ? (
            transcription.segments.map((segment, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">
                  {formatTime(segment.start)} - {formatTime(segment.end)}
                </p>
                <p className="text-gray-700">{segment.text}</p>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 whitespace-pre-wrap">{transcription.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionViewer;
