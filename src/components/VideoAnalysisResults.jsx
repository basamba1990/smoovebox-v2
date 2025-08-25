import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, RefreshCw } from 'lucide-react';

const VideoAnalysisResults = ({ video }) => {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalysis = useCallback(async () => {
    if (!video || !video.id) return;

    try {
      setLoading(true);
      setError(null);

      // Récupérer les données d'analyse directement depuis la table videos
      const { data, error: fetchError } = await supabase
        .from("videos")
        .select("id, status, analysis, ai_result, error_message")
        .eq("id", video.id)
        .single();

      if (fetchError) {
        throw new Error(`Erreur lors de la récupération de l'analyse: ${fetchError.message}`);
      }

      if (data) {
        let parsedAnalysis = null;
        // Prioriser 'analysis' puis 'ai_result'
        if (data.analysis) {
          parsedAnalysis = typeof data.analysis === 'string' ? JSON.parse(data.analysis) : data.analysis;
        } else if (data.ai_result) {
          parsedAnalysis = typeof data.ai_result === 'string' ? JSON.parse(data.ai_result) : data.ai_result;
        }
        setAnalysisData(parsedAnalysis);
      } else {
        setAnalysisData(null);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération de l'analyse:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [video]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const requestAnalysis = async () => {
    if (!video || !video.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-transcription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ videoId: video.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur ${response.status}`);
      }
      
      setAnalysisData({
        summary: "Analyse en cours...",
        key_topics: ["Veuillez patienter pendant que nous analysons votre vidéo"],
        sentiment: "En cours"
      });
      
      setTimeout(fetchAnalysis, 5000);
      
    } catch (err) {
      console.error("Erreur lors de la demande d'analyse:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!video) {
    return null;
  }

  if (loading && !analysisData) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Analyse IA</h2>
        <div className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500 mb-4" />
          <p className="text-gray-500">Chargement de l'analyse...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Analyse IA</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p>{error}</p>
          <button 
            onClick={() => fetchAnalysis()}
            className="mt-2 px-3 py-1 bg-white border border-red-300 rounded text-sm hover:bg-red-50"
          >
            <RefreshCw className="h-4 w-4 inline mr-1" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Si aucune analyse n'est disponible et que la vidéo n'est pas en cours de traitement
  if (!analysisData && video.status !== 'processing' && video.status !== 'analyzing') {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Analyse IA</h2>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">Aucune analyse disponible pour cette vidéo.</p>
          {video.hasTranscription ? (
            <button 
              onClick={requestAnalysis}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Analyser cette vidéo
            </button>
          ) : (
            <p className="text-sm text-gray-500">
              La transcription est nécessaire avant de pouvoir analyser la vidéo.
            </p>
          )}
        </div>
      </div>
    );
  }

  const summary = analysisData?.summary || "";
  const keyTopics = analysisData?.key_topics || [];
  const sentiment = analysisData?.sentiment || "";
  const actionItems = analysisData?.action_items || [];
  const importantEntities = analysisData?.important_entities || [];
  const insightsSupplementaires = analysisData?.insights_supplementaires || {};

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Analyse IA</h2>
        <button
          onClick={() => fetchAnalysis()}
          className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200"
        >
          <RefreshCw className="h-4 w-4 inline mr-1" />
          Actualiser
        </button>
      </div>
      
      <div className="space-y-6">
        {summary && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Résumé</h3>
            <p className="text-gray-600">{summary}</p>
          </div>
        )}
        
        {keyTopics.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Sujets Clés</h3>
            <ul className="list-disc pl-5 space-y-1">
              {keyTopics.map((topic, index) => (
                <li key={index} className="text-gray-600">{topic}</li>
              ))}
            </ul>
          </div>
        )}

        {sentiment && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Sentiment</h3>
            <p className="text-gray-600 capitalize">{sentiment}</p>
          </div>
        )}

        {actionItems.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Actions Suggérées</h3>
            <ul className="list-disc pl-5 space-y-1">
              {actionItems.map((item, index) => (
                <li key={index} className="text-gray-600">{item}</li>
              ))}
            </ul>
          </div>
        )}

        {importantEntities.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Entités Importantes</h3>
            <ul className="list-disc pl-5 space-y-1">
              {importantEntities.map((entity, index) => (
                <li key={index} className="text-gray-600">{entity}</li>
              ))}
            </ul>
          </div>
        )}

        {Object.keys(insightsSupplementaires).length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Insights Supplémentaires</h3>
            <ul className="list-disc pl-5 space-y-1">
              {Object.entries(insightsSupplementaires).map(([key, value], index) => (
                <li key={index} className="text-gray-600">
                  <strong>{key.replace(/_/g, ' ')}:</strong> {typeof value === 'object' ? JSON.stringify(value) : value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAnalysisResults
