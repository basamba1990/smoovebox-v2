import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, BarChart, TrendingUp, Lightbulb, Target, RefreshCw, Volume2, Zap, Users, MessageCircle } from 'lucide-react';

const VideoAnalysisResults = ({ video }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

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

      let analysisData = null;

      // Essayer différents formats de données d'analyse
      if (video.analysis_result && typeof video.analysis_result === 'object') {
        analysisData = video.analysis_result;
      } else if (video.analysis && typeof video.analysis === 'object') {
        analysisData = video.analysis;
      } else if (video.ai_result && typeof video.ai_result === 'object') {
        analysisData = video.ai_result;
      } else if (video.transcription_data && video.transcription_data.analysis) {
        analysisData = video.transcription_data.analysis;
      }

      if (analysisData) {
        setAnalysis(analysisData);
      } else {
        setError('Aucune donnée d\'analyse disponible pour cette vidéo');
      }
    } catch (err) {
      console.error('Erreur extraction analyse:', err);
      setError('Erreur lors du chargement de l\'analyse');
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
    if (score >= 60) return 'Bon';
    return 'À améliorer';
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Score général */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${getScoreBgColor(analysis?.ai_score * 10 || 70)} p-4 rounded-lg border text-center`}>
          <div className="text-2xl font-bold mb-2">
            <span className={getScoreColor(analysis?.ai_score * 10 || 70)}>
              {analysis?.ai_score ? (analysis.ai_score * 10).toFixed(1) : '7.0'}/10
            </span>
          </div>
          <div className="text-sm text-gray-600">Score global</div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold text-blue-600 mb-2">
            {analysis?.sentiment_score ? (analysis.sentiment_score * 100).toFixed(0) : '75'}%
          </div>
          <div className="text-sm text-gray-600">Sentiment positif</div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold text-purple-600 mb-2">
            {analysis?.tone_analysis?.confidence_level ? (analysis.tone_analysis.confidence_level * 100).toFixed(0) : '70'}%
          </div>
          <div className="text-sm text-gray-600">Confiance</div>
        </div>
      </div>

      {/* Résumé */}
      {analysis?.summary && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Résumé
          </h4>
          <p className="text-gray-600 text-sm leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Analyse de tonalité */}
      {analysis?.tone_analysis && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Analyse de Tonalité
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700">Émotion</div>
              <div className="text-sm text-france-600 capitalize">{analysis.tone_analysis.emotion || 'neutre'}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700">Débit</div>
              <div className="text-sm text-france-600 capitalize">{analysis.tone_analysis.pace || 'modéré'}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700">Clarté</div>
              <div className="text-sm text-france-600 capitalize">{analysis.tone_analysis.clarity || 'bonne'}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700">Confiance</div>
              <div className="text-sm text-france-600">
                {analysis.tone_analysis.confidence_level ? (analysis.tone_analysis.confidence_level * 100).toFixed(0) + '%' : '70%'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStructure = () => (
    <div className="space-y-4">
      {analysis?.structure_analysis && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="font-semibold text-gray-700 mb-2">Introduction</div>
              <div className={`text-sm px-3 py-1 rounded-full ${
                analysis.structure_analysis.introduction === 'excellent' ? 'bg-green-100 text-green-800' :
                analysis.structure_analysis.introduction === 'bon' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {analysis.structure_analysis.introduction || 'bon'}
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="font-semibold text-gray-700 mb-2">Développement</div>
              <div className={`text-sm px-3 py-1 rounded-full ${
                analysis.structure_analysis.development === 'excellent' ? 'bg-green-100 text-green-800' :
                analysis.structure_analysis.development === 'bon' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {analysis.structure_analysis.development || 'bon'}
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="font-semibold text-gray-700 mb-2">Conclusion</div>
              <div className={`text-sm px-3 py-1 rounded-full ${
                analysis.structure_analysis.conclusion === 'excellent' ? 'bg-green-100 text-green-800' :
                analysis.structure_analysis.conclusion === 'bon' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {analysis.structure_analysis.conclusion || 'bon'}
              </div>
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="font-semibold text-gray-700 mb-2">Structure Globale</div>
            <div className={`text-lg font-bold ${
              analysis.structure_analysis.overall_structure === 'excellent' ? 'text-green-600' :
              analysis.structure_analysis.overall_structure === 'bon' ? 'text-blue-600' :
              'text-yellow-600'
            }`}>
              {analysis.structure_analysis.overall_structure?.toUpperCase() || 'BON'}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderRecommendations = () => (
    <div className="space-y-4">
      {/* Conseils de communication */}
      {analysis?.communication_advice && analysis.communication_advice.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Conseils de Communication
          </h4>
          <div className="space-y-2">
            {analysis.communication_advice.map((advice, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{advice}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public cible */}
      {analysis?.target_audience && analysis.target_audience.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Public Cible
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.target_audience.map((audience, index) => (
              <span key={index} className="px-3 py-1 bg-france-100 text-france-800 rounded-full text-sm">
                {audience}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions visuelles */}
      {analysis?.visual_suggestions && analysis.visual_suggestions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Suggestions Visuelles
          </h4>
          <div className="space-y-2">
            {analysis.visual_suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
                <span className="text-sm text-gray-700">{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (!video) {
    return null;
  }

  if (loading) {
    return (
      <div className="card-spotbulle p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Analyse IA Avancée
        </h3>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-france-500 mr-2" />
          <p className="text-gray-600">Chargement de l'analyse avancée...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-spotbulle p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Analyse IA Avancée
        </h3>
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
      <div className="card-spotbulle p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Analyse IA Avancée
        </h3>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">Aucune analyse avancée disponible pour cette vidéo.</p>
          <button 
            onClick={() => extractAnalysisData(video)}
            className="px-4 py-2 bg-france-500 text-white rounded-lg hover:bg-france-600 transition-colors"
          >
            Actualiser l'analyse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-spotbulle p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Analyse IA Avancée
        </h3>
        <button 
          onClick={() => extractAnalysisData(video)}
          className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200 transition-colors flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      {/* Navigation par onglets */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Vue d\'ensemble', icon: TrendingUp },
            { id: 'structure', name: 'Structure', icon: Target },
            { id: 'recommendations', name: 'Recommandations', icon: Lightbulb }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-france-500 text-france-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="min-h-[200px]">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'structure' && renderStructure()}
        {activeTab === 'recommendations' && renderRecommendations()}
      </div>

      {/* Thèmes principaux */}
      {analysis.key_topics && analysis.key_topics.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3">Thèmes Principaux</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.key_topics.map((topic, index) => (
              <span key={index} className="px-3 py-1 bg-gradient-to-r from-france-500 to-maroc-500 text-white rounded-full text-sm">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoAnalysisResults;
