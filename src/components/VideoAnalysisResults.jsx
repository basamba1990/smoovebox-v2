// src/components/VideoAnalysisResults.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, RefreshCw } from 'lucide-react';

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
        // Traiter les différents formats possibles de l'analyse
        let analysisData;
        
        if (typeof data.analysis === 'string') {
          try {
            analysisData = JSON.parse(data.analysis);
          } catch (e) {
            // Si le parsing échoue, utiliser le texte brut
            analysisData = { resume: data.analysis };
          }
        } else {
          // Si c'est déjà un objet
          analysisData = data.analysis;
        }
        
        setAnalysis(analysisData);
      } else if (data && data.transcription) {
        // Si la transcription existe mais pas l'analyse, montrer un message d'attente
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

  // Fonction pour demander une analyse
  const requestAnalysis = async () => {
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
      
      // Appeler la fonction Edge pour démarrer l'analyse
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-video`, {
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
      
      // Mettre à jour l'interface pour montrer que l'analyse est en cours
      setAnalysis({
        resume: "Analyse en cours...",
        points_cles: ["Veuillez patienter pendant que nous analysons votre vidéo"],
        evaluation: {
          clarte: "En cours",
          structure: "En cours"
        }
      });
      
      // Attendre un peu puis rafraîchir
      setTimeout(fetchAnalysis, 5000);
      
    } catch (err) {
      console.error('Erreur lors de la demande d\'analyse:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Si aucune vidéo n'est sélectionnée
  if (!video) {
    return null;
  }

  // Si l'analyse est en cours de chargement
  if (loading && !analysis) {
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

  // Si une erreur s'est produite
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

  // Si aucune analyse n'est disponible
  if (!analysis) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Analyse IA</h2>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">Aucune analyse disponible pour cette vidéo.</p>
          {video.transcription || video.transcription_data ? (
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

  // Normaliser les clés d'analyse pour gérer différents formats
  const resume = analysis.resume || analysis.summary || "";
  const pointsCles = analysis.points_cles || analysis.keywords || analysis.key_points || [];
  const suggestions = analysis.suggestions || analysis.areas_to_improve || [];
  const strengths = analysis.strengths || analysis.points_forts || [];
  const evaluation = analysis.evaluation || {};

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
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Résumé</h3>
          <p className="text-gray-600">{resume}</p>
        </div>
        
        {pointsCles.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Points clés</h3>
            <ul className="list-disc pl-5 space-y-1">
              {pointsCles.map((point, index) => (
                <li key={index} className="text-gray-600">{point}</li>
              ))}
            </ul>
          </div>
        )}
        
        {(evaluation.clarte !== undefined || evaluation.structure !== undefined || analysis.overall_score !== undefined) && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Évaluation</h3>
            <div className="grid grid-cols-2 gap-4">
              {evaluation.clarte !== undefined && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Clarté</h4>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${typeof evaluation.clarte === 'number' ? evaluation.clarte * 10 : 0}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-gray-700">
                      {typeof evaluation.clarte === 'number' ? evaluation.clarte : evaluation.clarte}
                    </span>
                  </div>
                </div>
              )}
              {evaluation.structure !== undefined && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Structure</h4>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${typeof evaluation.structure === 'number' ? evaluation.structure * 10 : 0}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-gray-700">
                      {typeof evaluation.structure === 'number' ? evaluation.structure : evaluation.structure}
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
        
        {suggestions.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Suggestions d'amélioration</h3>
            <ul className="list-disc pl-5 space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="text-gray-600">{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
        
        {strengths.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Points forts</h3>
            <ul className="list-disc pl-5 space-y-1">
              {strengths.map((strength, index) => (
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
