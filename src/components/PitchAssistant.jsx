import React, { useState, useEffect } from 'react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Progress } from './ui/progress.jsx';
import { MessageCircle, Clock, User, Trophy, Heart, Users, CheckCircle, ArrowRight, Lightbulb } from 'lucide-react';

const PitchAssistant = ({ onComplete, onSkip, isVisible = true }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(60); // 1 minute par défaut
  const [isCompleted, setIsCompleted] = useState(false);

  const questions = [
    {
      id: 'identity',
      icon: User,
      title: 'Qui es-tu ?',
      subtitle: 'Présente-toi brièvement',
      placeholder: 'Ex: Je suis Marie, 16 ans, passionnée de basketball...',
      tips: ['Dis ton prénom et ton âge', 'Mentionne ton sport favori', 'Reste naturel et souriant'],
      category: 'Présentation'
    },
    {
      id: 'passion',
      icon: Heart,
      title: 'Quel sport te passionne ?',
      subtitle: 'Parle de ta passion sportive',
      placeholder: 'Ex: Le football me passionne depuis que j\'ai 8 ans...',
      tips: ['Explique pourquoi tu aimes ce sport', 'Raconte depuis quand tu le pratiques', 'Partage une émotion forte'],
      category: 'Passion'
    },
    {
      id: 'dream',
      icon: Trophy,
      title: 'Quel est ton rêve ?',
      subtitle: 'Partage ton objectif ou ton rêve sportif',
      placeholder: 'Ex: Mon rêve est de jouer en équipe nationale...',
      tips: ['Sois ambitieux mais réaliste', 'Explique pourquoi c\'est important', 'Montre ta détermination'],
      category: 'Ambition'
    },
    {
      id: 'impact',
      icon: Users,
      title: 'Quel impact ton club a-t-il ?',
      subtitle: 'Décris l\'influence de ton club ou équipe',
      placeholder: 'Ex: Mon club aide les jeunes de mon quartier à...',
      tips: ['Parle de l\'esprit d\'équipe', 'Mentionne l\'impact social', 'Évoque la solidarité'],
      category: 'Collectif'
    }
  ];

  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, currentStep]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
      setTimeRemaining(60); // Reset timer pour la question suivante
    } else {
      setIsCompleted(true);
      setTimeout(() => {
        onComplete(answers);
      }, 1500);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const progress = ((currentStep + 1) / questions.length) * 100;
  const currentQuestion = questions[currentStep];
  const currentAnswer = answers[currentQuestion?.id] || '';

  if (!isVisible) return null;

  if (isCompleted) {
    return (
      <Card className="w-full max-w-2xl mx-auto bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-green-800 mb-2">
            Parfait ! Tu es prêt(e) à enregistrer
          </h3>
          <p className="text-green-600">
            Tes réponses vont t'aider à structurer ton pitch. C'est parti !
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* En-tête avec progression */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-lg text-blue-800">Assistant de Pitch</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-gray-600 mt-2">
            Question {currentStep + 1} sur {questions.length}
          </p>
        </CardHeader>
      </Card>

      {/* Question actuelle */}
      <Card className="bg-white shadow-lg border-0">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <currentQuestion.icon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">
                  {currentQuestion.category}
                </Badge>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {currentQuestion.title}
              </h3>
              <p className="text-gray-600">
                {currentQuestion.subtitle}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Zone de réponse */}
          <div>
            <textarea
              value={currentAnswer}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              placeholder={currentQuestion.placeholder}
              className="w-full h-32 p-4 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={200}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                {currentAnswer.length}/200 caractères
              </span>
            </div>
          </div>

          {/* Conseils */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 mb-2">Conseils pour répondre :</h4>
                <ul className="space-y-1">
                  {currentQuestion.tips.map((tip, index) => (
                    <li key={index} className="text-sm text-yellow-700 flex items-start gap-1">
                      <span className="text-yellow-500 mt-1">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="text-gray-600 hover:text-gray-800"
            >
              Passer l'assistant
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={!currentAnswer.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
            >
              {currentStep < questions.length - 1 ? (
                <>
                  Suivant
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Terminer
                  <CheckCircle className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Résumé des réponses précédentes */}
      {currentStep > 0 && (
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-700">Tes réponses précédentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {questions.slice(0, currentStep).map((question, index) => (
              <div key={question.id} className="flex items-start gap-3">
                <question.icon className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    {question.title}
                  </p>
                  <p className="text-sm text-gray-800 truncate">
                    {answers[question.id] || 'Pas de réponse'}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PitchAssistant;
