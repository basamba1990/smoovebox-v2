import React, { useState, useEffect } from 'react';
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

  const analysisSteps = [
    { id: 'transcription', label: 'Transcription automatique', progress: 20 },
    { id: 'linguistic', label: 'Analyse linguistique', progress: 40 },
    { id: 'emotional', label: 'Analyse émotionnelle', progress: 60 },
    { id: 'structure', label: 'Évaluation de la structure', progress: 80 },
    { id: 'recommendations', label: 'Génération des conseils', progress: 100 }
  ];

  // Simulation de l'analyse IA
  useEffect(() => {
    if (!isVisible || !isAnalyzing) return;

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < analysisSteps.length) {
        setCurrentAnalysis(analysisSteps[currentStep].label);
        setAnalysisProgress(analysisSteps[currentStep].progress);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsAnalyzing(false);
        generateFeedback();
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isVisible, isAnalyzing]);

  const generateFeedback = () => {
    // Simulation d'une analyse IA basée sur la transcription
    const mockFeedback = {
      overallScore: 78,
      duration: videoData?.duration || 90,
      wordCount: transcription?.split(' ').length || 120,
      categories: {
        clarity: {
          score: 82,
          level: 'Bon',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          feedback: 'Ton discours est clair et bien articulé. Continue à parler avec cette assurance.',
          tips: [
            'Maintiens ce rythme de parole',
            'Tes idées sont bien exprimées',
            'Bonne articulation générale'
          ]
        },
        structure: {
          score: 75,
          level: 'Bien',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          feedback: 'Ta structure est correcte mais pourrait être renforcée avec une conclusion plus marquée.',
          tips: [
            'Annonce ton idée principale dès le début',
            'Ajoute une transition claire entre tes idées',
            'Termine par un message fort et mémorable'
          ]
        },
        confidence: {
          score: 70,
          level: 'À améliorer',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          feedback: 'Tu peux gagner en confiance en regardant plus souvent la caméra et en souriant davantage.',
          tips: [
            'Regarde la caméra pour créer un lien',
            'Souris naturellement pendant ton discours',
            'Utilise tes mains pour accompagner tes propos'
          ]
        },
        creativity: {
          score: 85,
          level: 'Excellent',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          feedback: 'Ton approche créative rend ton pitch unique et mémorable. Bravo !',
          tips: [
            'Continue à utiliser des exemples personnels',
            'Tes métaphores sportives sont efficaces',
            'Ton originalité te démarque'
          ]
        },
        timing: {
          score: 88,
          level: 'Excellent',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          feedback: 'Parfait ! Tu respectes bien le temps imparti.',
          tips: [
            'Timing idéal pour ce format',
            'Bon équilibre entre les parties',
            'Rythme adapté au message'
          ]
        }
      },
      strengths: [
        'Passion authentique pour le sport',
        'Exemples concrets et personnels',
        'Énergie communicative',
        'Message inspirant'
      ],
      improvements: [
        'Regarder plus souvent la caméra',
        'Ajouter une conclusion plus percutante',
        'Utiliser plus de gestes expressifs',
        'Varier l\'intonation pour plus de dynamisme'
      ],
      nextSteps: [
        'Entraîne-toi devant un miroir pour travailler ton regard',
        'Prépare 2-3 phrases de conclusion différentes',
        'Filme-toi en mode entraînement pour voir tes progrès',
        'Demande des retours à tes coéquipiers'
      ]
    };

    setFeedback(mockFeedback);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bien';
    return 'À améliorer';
  };

  if (!isVisible) return null;

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
                {getScoreLabel(feedback.overallScore)}
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

      {/* Statistiques détaillées */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">Statistiques de ton pitch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="h-4 w-4 text-gray-600" />
              </div>
              <div className="text-xl font-bold text-gray-800">{feedback.duration}s</div>
              <p className="text-xs text-gray-600">Durée</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <MessageSquare className="h-4 w-4 text-gray-600" />
              </div>
              <div className="text-xl font-bold text-gray-800">{feedback.wordCount}</div>
              <p className="text-xs text-gray-600">Mots</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Volume2 className="h-4 w-4 text-gray-600" />
              </div>
              <div className="text-xl font-bold text-gray-800">
                {Math.round(feedback.wordCount / (feedback.duration / 60))}
              </div>
              <p className="text-xs text-gray-600">Mots/min</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="h-4 w-4 text-gray-600" />
              </div>
              <div className="text-xl font-bold text-gray-800">{feedback.overallScore}%</div>
              <p className="text-xs text-gray-600">Score global</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Boutons d'action */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          variant="outline"
          onClick={onRetakeVideo}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Refaire mon pitch
        </Button>
        
        <Button
          onClick={onAcceptVideo}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Valider ce pitch
        </Button>
      </div>
    </div>
  );
};

export default AIFeedbackAnalysis;

