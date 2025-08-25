import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, BarChart, TrendingUp, Lightbulb, Target } from 'lucide-react';

const VideoAnalysisResults = ({ video }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (video && video.analysis_result) {
      extractAnalysisData(video);
    } else {
      setAnalysis(null);
    }
  }, [video]);

  const extractAnalysisData = (video) => {
    try {
      setLoading(true);
      setError(null);
      
      let analysisData = video.analysis_result || video.analysis || {};
      
      // Si analysisData est une chaîne, essayer de la parser
      if (typeof analysisData === 'string') {
        try {
          analysisData = JSON.parse(analysisData);
        } catch (e) {
          console.error("Erreur lors du parsing de analysis_result:", e);
          analysisData = { summary: analysisData };
        }
      }
      
      if (analysisData && Object.keys(analysisData).length > 0) {
        setAnalysis(analysisData);
      } else {
        setAnalysis(null);
      }
    } catch (err) {
      console.error('Erreur lors de l\'extraction de l\'analyse:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return 'bg-green-50';
    if (score >= 60) return 'bg-orange-50';
    return 'bg-red-50';
  };

  const getScoreLevel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bien';
    return 'À améliorer';
  };

  if (!video) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-4">Analyse IA</h3>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-2" />
          <p className="text-gray-600">Chargement de l'analyse...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-4">Analyse IA</h3>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-4">Analyse IA</h3>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">Aucune analyse disponible pour cette vidéo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Analyse IA</h3>
        <button
          onClick={() => extractAnalysisData(video)}
          className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200"
        >
          <RefreshCw className="h-4 w-4 inline mr-1" />
          Actualiser
        </button>
      </div>
      
      <div className="space-y-6">
        {analysis.summary && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center">
              <Lightbulb className="h-5 w-5 mr-2 text-yellow-500" />
              Résumé
            </h4>
            <p className="text-gray-600 bg-yellow-50 p-3 rounded-lg">{analysis.summary}</p>
          </div>
        )}
        
        {analysis.evaluation && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center">
              <BarChart className="h-5 w-5 mr-2 text-blue-500" />
              Évaluation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.evaluation.clarte !== undefined && (
                <div className={`p-3 rounded-lg ${getScoreBgColor(analysis.evaluation.clarte)}`}>
                  <p className="text-sm text-gray-500">Clarté</p>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${getScoreColor(analysis.evaluation.clarte)}`}>
                      {analysis.evaluation.clarte}/10
                    </span>
                    <span className="text-sm text-gray-500">
                      {getScoreLevel(analysis.evaluation.clarte)}
                    </span>
                  </div>
                </div>
              )}
              
              {analysis.evaluation.structure !== undefined && (
                <div className={`p-3 rounded-lg ${getScoreBgColor(analysis.evaluation.structure)}`}>
                  <p className="text-sm text-gray-500">Structure</p>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${getScoreColor(analysis.evaluation.structure)}`}>
                      {analysis.evaluation.structure}/10
                    </span>
                    <span className="text-sm text-gray-500">
                      {getScoreLevel(analysis.evaluation.structure)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {analysis.suggestions && analysis.suggestions.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center">
              <Target className="h-5 w-5 mr-2 text-green-500" />
              Suggestions d'amélioration
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              {analysis.suggestions.map((suggestion, index) => (
                <li key={index} className="text-gray-600">{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAnalysisResults;
