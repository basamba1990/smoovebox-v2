import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

const VideoAnalysisResults = ({ video }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (video && video.id) {
      fetchAnalysis();
    } else {
      setAnalysis(null);
    }
  }, [video]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('analysis, transcription')
        .eq('id', video.id)
        .single();

      if (fetchError) {
        throw new Error(`Erreur lors de la récupération de l'analyse: ${fetchError.message}`);
      }

      if (data && data.analysis) {
        setAnalysis(data.analysis);
      } else if (data && data.transcription) {
        setAnalysis({
          resume: "Analyse en cours de génération...",
          points_cles: ["L'analyse sera disponible prochainement"],
          evaluation: {
            clarte: "En attente",
            structure: "En attente"
          },
          suggestions: ["Patientez pendant la génération de l'analyse"]
        });
      } else {
        setAnalysis(null);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération de l\'analyse:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!video || !video.transcription) {
    return null;
  }

  if (loading) {
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
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Analyse IA</h2>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">Aucune analyse disponible pour cette vidéo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
      <h2 className="text-xl font-bold mb-6 text-gray-800">Analyse IA</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Résumé</h3>
          <p className="text-gray-600">{analysis.resume || analysis.summary}</p>
        </div>
        
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Points clés</h3>
          <ul className="list-disc pl-5 space-y-1">
            {(analysis.points_cles || analysis.keywords || []).map((point, index) => (
              <li key={index} className="text-gray-600">{point}</li>
            ))}
          </ul>
        </div>
        
        {(analysis.evaluation || analysis.overall_score) && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Évaluation</h3>
            <div className="grid grid-cols-2 gap-4">
              {analysis.evaluation?.clarte !== undefined && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Clarté</h4>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${typeof analysis.evaluation.clarte === 'number' ? analysis.evaluation.clarte * 10 : 0}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-gray-700">
                      {typeof analysis.evaluation.clarte === 'number' ? analysis.evaluation.clarte : analysis.evaluation.clarte}
                    </span>
                  </div>
                </div>
              )}
              {analysis.evaluation?.structure !== undefined && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Structure</h4>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${typeof analysis.evaluation.structure === 'number' ? analysis.evaluation.structure * 10 : 0}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-gray-700">
                      {typeof analysis.evaluation.structure === 'number' ? analysis.evaluation.structure : analysis.evaluation.structure}
                    </span>
                  </div>
                </div>
              )}
              {analysis.overall_score !== undefined && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Score Global</h4>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${analysis.overall_score}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-gray-700">{analysis.overall_score}/100</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {(analysis.suggestions || analysis.areas_to_improve) && (analysis.suggestions?.length > 0 || analysis.areas_to_improve?.length > 0) && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Suggestions d'amélioration</h3>
            <ul className="list-disc pl-5 space-y-1">
              {(analysis.suggestions || analysis.areas_to_improve || []).map((suggestion, index) => (
                <li key={index} className="text-gray-600">{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
        
        {analysis.strengths && analysis.strengths.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Points forts</h3>
            <ul className="list-disc pl-5 space-y-1">
              {analysis.strengths.map((strength, index) => (
                <li key={index} className="text-gray-600">{strength}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAnalysisResults;
