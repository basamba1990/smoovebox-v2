import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, BarChart, TrendingUp, Lightbulb, Target, RefreshCw } from 'lucide-react';

const VideoAnalysisResults = ({ video }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (video) {
      extractAnalysisData(video);
    } else {
      setAnalysis(null);
    }
  }, [video]);

  const extractAnalysisData = (video) => {
    try {
      setLoading(true);
      setError(null);
      
      // Utiliser analysis_result (qui contient maintenant les données de la colonne analysis)
      let analysisData = video.analysis_result || video.analysis || {};
      
      // Si analysis_result est vide mais ai_result existe, essayer de le parser
      if ((!analysisData || Object.keys(analysisData).length === 0) && video.ai_result) {
        try {
          analysisData = JSON.parse(video.ai_result);
        } catch (e) {
          analysisData = { summary: video.ai_result };
        }
      }
      
      // Vérifier s'il y a des analyses liées
      if ((!analysisData || Object.keys(analysisData).length === 0) && 
          video.transcriptions && video.transcriptions.length > 0) {
        const transcriptionRecord = video.transcriptions[0];
        if (transcriptionRecord.analysis_result) {
          try {
            analysisData = typeof transcriptionRecord.analysis_result === 'string' 
              ? JSON.parse(transcriptionRecord.analysis_result) 
              : transcriptionRecord.analysis_result;
          } catch (e) {
            console.error("Erreur lors du parsing de analysis_result:", e);
          }
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
        
        {analysis.sentiment && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Sentiment</h4>
            <p className="text-gray-600 bg-gray-50 p-3 rounded-lg capitalize">{analysis.sentiment}</p>
          </div>
        )}
        
        {analysis.key_topics && analysis.key_topics.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
              Sujets clés
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.key_topics.map((topic, index) => (
                <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {analysis.action_items && analysis.action_items.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center">
              <Target className="h-5 w-5 mr-2 text-green-500" />
              Actions recommandées
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              {analysis.action_items.map((item, index) => (
                <li key={index} className="text-gray-600">{item}</li>
              ))}
            </ul>
          </div>
        )}
        
        {analysis.important_entities && analysis.important_entities.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Entités importantes</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.important_entities.map((entity, index) => (
                <span key={index} className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  {entity}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {analysis.evaluation && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center">
              <BarChart className="h-5 w-5 mr-2 text-indigo-500" />
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
            <h4 className="font-medium text-gray-700 mb-2">Suggestions d'amélioration</h4>
            <ul className="list-disc pl-5 space-y-1">
              {analysis.suggestions.map((suggestion, index) => (
                <li key={index} className="text-gray-600">{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
        
        {analysis.insights_supplementaires && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Insights supplémentaires</h4>
            <div className="space-y-4">
              {analysis.insights_supplementaires.public_cible && (
                <div>
                  <h5 className="text-sm font-medium text-gray-600">Public cible</h5>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {analysis.insights_supplementaires.public_cible.map((targetAudience, index) => (
                      <span key={index} className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {targetAudience}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {analysis.insights_supplementaires.niveau_expertise && (
                <div>
                  <h5 className="text-sm font-medium text-gray-600">Niveau d'expertise</h5>
                  <p className="text-gray-600">{analysis.insights_supplementaires.niveau_expertise}</p>
                </div>
              )}
              
              {analysis.insights_supplementaires.engagement_emotionnel && (
                <div>
                  <h5 className="text-sm font-medium text-gray-600">Engagement émotionnel</h5>
                  <p className="text-gray-600">
                    Type: {analysis.insights_supplementaires.engagement_emotionnel.type}, 
                    Niveau: {analysis.insights_supplementaires.engagement_emotionnel.niveau}/10
                  </p>
                </div>
              )}
              
              {analysis.insights_supplementaires.formats_visuels_suggeres && (
                <div>
                  <h5 className="text-sm font-medium text-gray-600">Formats visuels suggérés</h5>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {analysis.insights_supplementaires.formats_visuels_suggeres.map((format, index) => (
                      <span key={index} className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAnalysisResults;
