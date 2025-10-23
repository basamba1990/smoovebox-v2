import React, { useState, useEffect } from 'react';
import { 
  Loader2, AlertCircle, BarChart3, TrendingUp, 
  Lightbulb, Target, RefreshCw, Volume2, 
  Zap, Users, MessageCircle, Sparkles 
} from 'lucide-react';

const VideoAnalysisResults = ({ video }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (video) {
      extractAnalysisData(video);
    }
  }, [video]);

  const extractAnalysisData = (video) => {
    try {
      setLoading(true);
      setError(null);

      let analysisData = video.analysis || video.ai_result || video.analysis_result;

      if (analysisData) {
        setAnalysis(analysisData);
      } else {
        setError('Aucune donnée d\'analyse disponible');
      }
    } catch (err) {
      console.error('Erreur extraction analyse:', err);
      setError('Erreur lors du chargement de l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-orange-600';
    return 'text-red-600';
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Score général */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border text-center bg-blue-50">
          <div className="text-2xl font-bold mb-2">
            <span className={getScoreColor(analysis?.ai_score || 7)}>
              {analysis?.ai_score ? analysis.ai_score.toFixed(1) : '7.0'}/10
            </span>
          </div>
          <div className="text-sm text-gray-600">Score global</div>
        </div>
        
        <div className="p-4 rounded-lg border text-center bg-green-50">
          <div className="text-2xl font-bold text-green-600 mb-2">
            {analysis?.sentiment_score ? (analysis.sentiment_score * 100).toFixed(0) : '75'}%
          </div>
          <div className="text-sm text-gray-600">Sentiment positif</div>
        </div>
        
        <div className="p-4 rounded-lg border text-center bg-purple-50">
          <div className="text-2xl font-bold text-purple-600 mb-2">
            {analysis?.tone_analysis?.confidence_level ? (analysis.tone_analysis.confidence_level * 100).toFixed(0) : '70'}%
          </div>
          <div className="text-sm text-gray-600">Confiance vocale</div>
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
              <div className="text-sm text-blue-600 capitalize">{analysis.tone_analysis.emotion || 'neutre'}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700">Débit</div>
              <div className="text-sm text-blue-600 capitalize">{analysis.tone_analysis.pace || 'modéré'}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700">Clarté</div>
              <div className="text-sm text-blue-600 capitalize">{analysis.tone_analysis.clarity || 'bonne'}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700">Énergie</div>
              <div className="text-sm text-blue-600 capitalize">{analysis.tone_analysis.energy || 'moyen'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStructure = () => (
    <div className="space-y-4">
      {analysis?.structure_analysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className="font-semibold text-gray-700 mb-2">Introduction</div>
            <div className="text-sm text-green-600 capitalize">{analysis.structure_analysis.introduction || 'bon'}</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="font-semibold text-gray-700 mb-2">Développement</div>
            <div className="text-sm text-green-600 capitalize">{analysis.structure_analysis.development || 'bon'}</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="font-semibold text-gray-700 mb-2">Conclusion</div>
            <div className="text-sm text-green-600 capitalize">{analysis.structure_analysis.conclusion || 'bon'}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderRecommendations = () => (
    <div className="space-y-6">
      {/* Conseils de communication */}
      {analysis?.communication_advice && analysis.communication_advice.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Conseils de Communication
          </h4>
          <div className="space-y-2">
            {analysis.communication_advice.map((advice, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-gray-700">{advice}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions de tonalité */}
      {analysis?.tone_analysis?.tone_suggestions && analysis.tone_analysis.tone_suggestions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Suggestions pour le Ton
          </h4>
          <div className="space-y-2">
            {analysis.tone_analysis.tone_suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <span className="text-sm text-gray-700">{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-2" />
          <p className="text-gray-600">Chargement de l'analyse...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
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
      <div className="p-6">
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">Aucune analyse disponible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analyse IA
        </h3>
        <button 
          onClick={() => extractAnalysisData(video)}
          className="px-3 py-1 bg-gray-100 border rounded text-sm hover:bg-gray-200 flex items-center gap-1"
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
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500'
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
              <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
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
