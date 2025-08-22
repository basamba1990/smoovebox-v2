import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { RefreshCw, FileText, AlertCircle, Loader2, BarChart } from 'lucide-react';

const AnalysisViewer = ({ video }) => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (video && video.id) {
      fetchAnalysis();
    } else {
      setAnalysis(null);
    }
  }, [video]);

  const fetchAnalysis = async () => {
    if (!video || !video.id) return;
    
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('analysis, status')
        .eq('id', video.id)
        .single();

      if (fetchError) {
        throw new Error(`Erreur lors de la récupération de l'analyse: ${fetchError.message}`);
      }

      if (data && data.analysis) {
        setAnalysis(data.analysis);
      } else {
        setAnalysis(null);
      }
      
      // Si la vidéo est en cours d'analyse
      if (data.status === 'analyzing') {
        setAnalyzing(true);
        // Configurer un polling pour vérifier l'état de l'analyse
        const interval = setInterval(async () => {
          const { data: updatedData, error: pollError } = await supabase
            .from('videos')
            .select('analysis, status')
            .eq('id', video.id)
            .single();
            
          if (pollError) {
            clearInterval(interval);
            setError(`Erreur lors du suivi de l'analyse: ${pollError.message}`);
            setAnalyzing(false);
            return;
          }

          if (updatedData && updatedData.status !== 'analyzing') {
            clearInterval(interval);
            setAnalyzing(false);
            
            if (updatedData.analysis) {
              setAnalysis(updatedData.analysis);
            }
          }
        }, 5000); // Vérifier toutes les 5 secondes

        const timeout = setTimeout(() => {
          clearInterval(interval);
          if (analyzing) {
            setError("L'analyse prend plus de temps que prévu. Veuillez actualiser la page plus tard.");
            setAnalyzing(false);
          }
        }, 120000); // 2 minutes
        
        // Nettoyer l'intervalle et le timeout lors du démontage
        return () => { clearInterval(interval); clearTimeout(timeout); };
      } else {
        setAnalyzing(false);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération de l'analyse:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateAnalysis = async () => {
    if (!video || !video.id) return;
    
    try {
      setAnalyzing(true);
      setError(null);
      
      // Obtenir le token d'authentification
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Vous devez être connecté pour analyser une vidéo");
      }
      
      // Appeler directement la fonction Edge
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ videoId: video.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur ${response.status}`);
      }
      
      const result = await response.json();
      console.log("Réponse de l'analyse:", result);
      
      // Configurer un polling pour suivre l'avancement
      const checkInterval = setInterval(async () => {
        const { data: videoCheck, error: checkError } = await supabase
          .from('videos')
          .select('analysis, status')
          .eq('id', video.id)
          .single();
          
        if (checkError) {
          clearInterval(checkInterval);
          setError(`Erreur lors du suivi de l'analyse: ${checkError.message}`);
          setAnalyzing(false);
          return;
        }
        
        if (videoCheck.analysis && videoCheck.status === 'published') {
          clearInterval(checkInterval);
          setAnalysis(videoCheck.analysis);
          setAnalyzing(false);
        }
      }, 5000); // Vérifier toutes les 5 secondes
      
      // Arrêter le polling après 2 minutes maximum
      setTimeout(() => {
        clearInterval(checkInterval);
        if (analyzing) {
          setError("L'analyse prend plus de temps que prévu. Veuillez actualiser la page plus tard.");
          setAnalyzing(false);
        }
      }, 120000); // 2 minutes
      
    } catch (err) {
      console.error('Erreur lors de la génération de l'analyse:', err);
      setError(err.message);
      setAnalyzing(false);
    }
  };

  // Si aucune vidéo n'est sélectionnée
  if (!video) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Analyse IA</h2>
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">Veuillez sélectionner une vidéo pour voir son analyse.</p>
        </div>
      </div>
    );
  }

  // Si l'analyse est en cours de chargement
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

  // Si l'analyse est en cours de génération
  if (analyzing) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Analyse IA</h2>
        <div className="flex flex-col items-center justify-center p-8 bg-blue-50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-blue-700 font-medium">Analyse en cours...</p>
          <p className="text-blue-600 text-sm mt-2">
            L'IA analyse votre transcription pour en extraire les points clés.
          </p>
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchAnalysis()}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
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
          <Button 
            onClick={generateAnalysis}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <BarChart className="h-4 w-4 mr-2" />
            Générer une analyse
          </Button>
        </div>
      </div>
    );
  }

  // Affichage normal de l'analyse
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Analyse IA</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAnalysis()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>
      
      <Tabs defaultValue="resume" className="w-full">
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="resume">Résumé</TabsTrigger>
          <TabsTrigger value="points">Points clés</TabsTrigger>
          <TabsTrigger value="evaluation">Évaluation</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="strengths">Points forts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="resume" className="p-4 bg-white rounded-lg shadow-sm">
          <h3 className="font-semibold text-lg mb-2">Résumé</h3>
          <p className="text-gray-700">{analysis.resume}</p>
        </TabsContent>
        
        <TabsContent value="points" className="p-4 bg-white rounded-lg shadow-sm">
          <h3 className="font-semibold text-lg mb-2">Points clés</h3>
          <ul className="list-disc pl-5 space-y-2">
            {analysis.points_cles && analysis.points_cles.map((point, index) => (
              <li key={index} className="text-gray-700">{point}</li>
            ))}
          </ul>
        </TabsContent>
        
        <TabsContent value="evaluation" className="p-4 bg-white rounded-lg shadow-sm">
          <h3 className="font-semibold text-lg mb-2">Évaluation</h3>
          {analysis.evaluation && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Clarté</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${analysis.evaluation.clarte * 10}%` }}
                  ></div>
                </div>
                <p className="text-right text-sm text-gray-500 mt-1">{analysis.evaluation.clarte}/10</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Structure</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full" 
                    style={{ width: `${analysis.evaluation.structure * 10}%` }}
                  ></div>
                </div>
                <p className="text-right text-sm text-gray-500 mt-1">{analysis.evaluation.structure}/10</p>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="suggestions" className="p-4 bg-white rounded-lg shadow-sm">
          <h3 className="font-semibold text-lg mb-2">Suggestions d'amélioration</h3>
          <ul className="list-disc pl-5 space-y-2">
            {analysis.suggestions && analysis.suggestions.map((suggestion, index) => (
              <li key={index} className="text-gray-700">{suggestion}</li>
            ))}
          </ul>
        </TabsContent>
        
        <TabsContent value="strengths" className="p-4 bg-white rounded-lg shadow-sm">
          <h3 className="font-semibold text-lg mb-2">Points forts</h3>
          <ul className="list-disc pl-5 space-y-2">
            {analysis.strengths && analysis.strengths.map((strength, index) => (
              <li key={index} className="text-gray-700">{strength}</li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalysisViewer;
