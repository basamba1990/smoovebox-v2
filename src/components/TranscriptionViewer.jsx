import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent } from './ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { RefreshCw, FileText, AlertCircle, Loader2 } from 'lucide-react';
import VideoPlayer from './VideoPlayer.jsx';

const TranscriptionViewer = ({ video }) => {
  const [transcription, setTranscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFullText, setShowFullText] = useState(false);

  useEffect(() => {
    if (video && video.id) {
      fetchTranscription();
    } else {
      setTranscription(null);
    }
  }, [video]);

  const fetchTranscription = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('transcription, transcription_data')
        .eq('id', video.id)
        .single();

      if (fetchError) {
        throw new Error(`Erreur lors de la récupération de la transcription: ${fetchError.message}`);
      }

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
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!video) {
    return null;
  }

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

  if (error) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Transcription</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p>{error}</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Transcription</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFullText(!showFullText)}
        >
          {showFullText ? 'Afficher par segments' : 'Afficher texte complet'}
        </Button>
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
