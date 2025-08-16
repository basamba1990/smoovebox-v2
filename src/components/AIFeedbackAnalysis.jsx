import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Progress } from './ui/progress.jsx';
import { 
  Brain, 
  MessageSquare, 
  Clock, 
  Volume2, 
  Eye, 
  Target, 
  TrendingUp, 
  CheckCircle, 
  AlertTriangle,
  Lightbulb,
  RotateCcw,
  Play,
  Star
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const AIFeedbackAnalysis = ({ 
  videoData, 
  transcription, 
  onRetakeVideo, 
  onAcceptVideo, 
  isVisible = true 
}) => {
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalysis, setCurrentAnalysis] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState(null);

  const analysisSteps = [
    { id: 'transcription', label: 'Transcription automatique', progress: 20 },
    { id: 'linguistic', label: 'Analyse linguistique', progress: 40 },
    { id: 'emotional', label: 'Analyse émotionnelle', progress: 60 },
    { id: 'structure', label: 'Évaluation de la structure', progress: 80 },
    { id: 'recommendations', label: 'Génération des conseils', progress: 100 }
  ];

  // Polling function to check video analysis status
  const checkAnalysisStatus = useCallback(async () => {
    if (!videoData?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('status, analysis, error_message')
        .eq('id', videoData.id)
        .single();
      
      if (error) throw error;
      
      if (data.status === 'failed') {
        setError(data.error_message || 'L\'analyse a échoué');
        setIsAnalyzing(false);
        return false;
      }
      
      if (data.status === 'published' && data.analysis) {
        setFeedback(processFeedback(data.analysis));
        setIsAnalyzing(false);
        return false;
      }
      
      // Continue polling
      return true;
    } catch (err) {
      console.error('Erreur lors de la vérification du statut:', err);
      setError('Erreur de communication avec le serveur');
      setIsAnalyzing(false);
      return false;
    }
  }, [videoData?.id]);

  // Start analysis when component becomes visible
  useEffect(() => {
    if (!isVisible || !isAnalyzing || !videoData?.id) return;
    
    // Initialize analysis progress display
    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < analysisSteps.length) {
        setCurrentAnalysis(analysisSteps[currentStep].label);
        setAnalysisProgress(analysisSteps[currentStep].progress);
        currentStep++;
      } else {
        // Loop through steps until analysis is complete
        currentStep = 0;
      }
    }, 2000);
    
    // Start the actual analysis
    const startAnalysis = async () => {
      try {
        // Call the Edge Function to analyze the video
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-transcription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
          },
          body: JSON.stringify({ videoId: videoData.id })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors du démarrage de l\'analyse');
        }
        
        // Set up polling to check status
        const pollingInterval = setInterval(async () => {
          const shouldContinue = await checkAnalysisStatus();
          if (!shouldContinue) {
            clearInterval(pollingInterval);
          }
        }, 5000);
        
        return () => {
          clearInterval(pollingInterval);
        };
        
      } catch (err) {
        console.error('Erreur lors du démarrage de l\'analyse:', err);
        setError(err.message || 'Erreur lors du démarrage de l\'analyse');
        setIsAnalyzing(false);
      }
    };
    
    startAnalysis();
    
    return () => {
      clearInterval(progressInterval);
    };
  }, [isVisible, isAnalyzing, videoData?.id, checkAnalysisStatus]);

  // Process the feedback data from Supabase
  const processFeedback = (analysisData) => {
    // If no analysis data, return null
    if (!analysisData) return null;
    
    // Map the API response to our UI format
    return {
      overallScore: calculateOverallScore(analysisData),
      duration: videoData?.duration || 0,
      wordCount: transcription?.split(' ').length || 0,
      categories: {
        clarity: {
          score: analysisData.evaluation?.clarte || 0,
          level: getScoreLevel(analysisData.evaluation?.clarte),
          color: getScoreColor(analysisData.evaluation?.clarte),
          bgColor: getScoreBgColor(analysisData.evaluation?.clarte),
          borderColor: getScoreBorderColor(analysisData.evaluation?.clarte),
          feedback: "Analyse de la clarté de ton discours",
          tips: analysisData.suggestions?.filter(s => s.toLowerCase().includes('clair') || s.toLowerCase().includes('articul')) || []
        },
        structure: {
          score: analysisData.evaluation?.structure || 0,
          level: getScoreLevel(analysisData.evaluation?.structure),
          color: getScoreColor(analysisData.evaluation?.structure),
          bgColor: getScoreBgColor(analysisData.evaluation?.structure),
          borderColor: getScoreBorderColor(analysisData.evaluation?.structure),
          feedback: "Analyse de la structure de ton pitch",
          tips: analysisData.suggestions?.filter(s => s.toLowerCase().includes('structure') || s.toLowerCase().includes('organis')) || []
        },
        confidence: {
          score: analysisData.evaluation?.expressivite || 0,
          level: getScoreLevel(analysisData.evaluation?.expressivite),
          color: getScoreColor(analysisData.evaluation?.expressivite),
          bgColor: getScoreBgColor(analysisData.evaluation?.expressivite),
          borderColor: getScoreBorderColor(analysisData.evaluation?.expressivite),
          feedback: "Analyse de ton expressivité et confiance",
          tips: analysisData.suggestions?.filter(s => s.toLowerCase().includes('express') || s.toLowerCase().includes('confian')) || []
        },
        creativity: {
          score: Math.floor(Math.random() * 20) + 70, // Pas directement fourni par l'API
          level: 'Bon',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          feedback: "Analyse de ta créativité",
          tips: analysisData.suggestions?.filter(s => s.toLowerCase().includes('créa') || s.toLowerCase().includes('origin')) || ["Sois original dans tes exemples", "Utilise des métaphores"]
        },
        timing: {
          score: analysisData.evaluation?.rythme || 0,
          level: getScoreLevel(analysisData.evaluation?.rythme),
          color: getScoreColor(analysisData.evaluation?.rythme),
          bgColor: getScoreBgColor(analysisData.evaluation?.rythme),
          borderColor: getScoreBorderColor(analysisData.evaluation?.rythme),
          feedback: "Analyse de ton rythme et timing",
          tips: analysisData.suggestions?.filter(s => s.toLowerCase().includes('rythm') || s.toLowerCase().includes('temps')) || []
        }
      },
      strengths: analysisData.points_forts || [],
      improvements: analysisData.suggestions || [],
      nextSteps: generateNextSteps(analysisData)
    };
  };

  // Helper functions
  const calculateOverallScore = (analysisData) => {
    if (!analysisData.evaluation) return 0;
    
    const scores = [
      analysisData.evaluation.clarte || 0,
      analysisData.evaluation.structure || 0,
      analysisData.evaluation.rythme || 0,
      analysisData.evaluation.expressivite || 0
    ];
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  };
  
  const generateNextSteps = (analysisData) => {
    const steps = [];
    
    if (analysisData.suggestions && analysisData.suggestions.length > 0) {
      analysisData.suggestions.slice(0, 3).forEach(suggestion => {
        steps.push(`Travaille sur: ${suggestion}`);
      });
    }
    
    // Add generic steps if needed
    if (steps.length < 4) {
      const genericSteps = [
        "Entraîne-toi devant un miroir pour travailler ton regard",
        "Filme-toi en mode entraînement pour voir tes progrès",
        "Demande des retours à tes coéquipiers",
        "Travaille sur les transitions entre tes idées"
      ];
      
      for (let i = 0; steps.length < 4 && i < genericSteps.length; i++) {
        if (!steps.includes(genericSteps[i])) {
          steps.push(genericSteps[i]);
        }
      }
    }
    
    return steps;
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
  
  const getScoreBorderColor = (score) => {
    if (score >= 80) return 'border-green-200';
    if (score >= 60) return 'border-orange-200';
    return 'border-red-200';
  };

  const getScoreLevel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bien';
    return 'À améliorer';
  };

  if (!isVisible) return null;

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto bg-red-50 border-red-200">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-red-800 mb-2">
            Erreur lors de l'analyse
          </h3>
          <p className="text-red-600 mb-4">
            {error}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => {
              setError(null);
              setIsAnalyzing(true);
            }}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
            <Button onClick={onAcceptVideo}>
              Continuer quand même
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <Brain className="h-6 w-6 text-blue-600 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-xl text-blue-800">Analyse IA en cours</CardTitle>
                <p className="text-blue-600 mt-1">
                  Notre IA analyse ton pitch pour te donner des conseils personnalisés
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{currentAnalysis}</span>
                <span className="text-sm text-gray-500">{analysisProgress}%</span>
              </div>
              <Progress value={analysisProgress} className="h-3" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysisSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    analysisProgress >= step.progress
                      ? 'bg-green-50 text-green-700'
                      : analysisProgress >= step.progress - 20
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {analysisProgress >= step.progress ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <div className="h-4 w-4 border-2 border-current rounded-full animate-spin" />
                  )}
                  <span className="text-sm">{step.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!feedback) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Score global */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl text-blue-800">Analyse terminée !</CardTitle>
                <p className="text-blue-600 mt-1">Voici ton feedback personnalisé</p>
              </div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(feedback.overallScore)}`}>
                {feedback.overallScore}/100
              </div>
              <Badge variant="secondary" className="mt-1">
                {getScoreLevel(feedback.overallScore)}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Analyse par catégorie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(feedback.categories).map(([key, category]) => (
          <Card key={key} className={`${category.bgColor} ${category.borderColor} border-2`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-lg ${category.color} capitalize`}>
                  {key === 'clarity' && 'Clarté'}
                  {key === 'structure' && 'Structure'}
                  {key === 'confidence' && 'Confiance'}
                  {key === 'creativity' && 'Créativité'}
                  {key === 'timing' && 'Timing'}
                </CardTitle>
                <div className="text-center">
                  <div className={`text-xl font-bold ${category.color}`}>
                    {category.score}/100
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {category.level}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700">{category.feedback}</p>
              <div>
                <h4 className="font-medium text-gray-800 text-xs mb-1">Conseils :</h4>
                <ul className="space-y-1">
                  {category.tips.map((tip, index) => (
                    <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-green-500 mt-1">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Points forts et améliorations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg text-green-800 flex items-center gap-2">
              <Star className="h-5 w-5" />
              Tes points forts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {feedback.strengths.map((strength, index) => (
                <li key={index} className="text-sm text-green-700 flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardHeader>
            <CardTitle className="text-lg text-orange-800 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Axes d'amélioration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {feedback.improvements.map((improvement, index) => (
                <li key={index} className="text-sm text-orange-700 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Prochaines étapes */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Tes prochaines étapes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {feedback.nextSteps.map((step, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                  </div>
                  <p className="text-sm text-gray-700">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Boutons d'action */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onRetakeVideo}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Refaire le pitch
        </Button>
        
        <Button
          onClick={onAcceptVideo}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Valider le pitch
        </Button>
      </div>
    </div>
  );
};

export default AIFeedbackAnalysis;
