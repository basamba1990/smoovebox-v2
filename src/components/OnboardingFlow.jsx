import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Upload, 
  BarChart3, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  Video,
  Brain,
  Target
} from 'lucide-react';
import { Button } from './ui/button-enhanced';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card-enhanced';
import { Progress } from './ui/progress';

const onboardingSteps = [
  {
    id: 'welcome',
    title: 'Bienvenue sur SpotBulle !',
    description: 'Votre plateforme d\'analyse IA pour perfectionner vos pitchs vidéo',
    icon: Sparkles,
    content: {
      type: 'welcome',
      features: [
        { icon: Video, title: 'Upload facile', description: 'Téléchargez vos vidéos en quelques clics' },
        { icon: Brain, title: 'Analyse IA', description: 'Intelligence artificielle avancée pour analyser votre performance' },
        { icon: Target, title: 'Amélioration', description: 'Conseils personnalisés pour perfectionner vos pitchs' }
      ]
    }
  },
  {
    id: 'upload',
    title: 'Téléchargez votre première vidéo',
    description: 'Commencez par uploader une vidéo de pitch pour découvrir nos analyses',
    icon: Upload,
    content: {
      type: 'demo',
      steps: [
        'Cliquez sur "Télécharger une vidéo"',
        'Sélectionnez votre fichier vidéo',
        'Ajoutez un titre et une description',
        'Lancez l\'upload et l\'analyse'
      ]
    }
  },
  {
    id: 'analysis',
    title: 'Découvrez l\'analyse IA',
    description: 'Notre IA analyse votre élocution, votre gestuelle et votre contenu',
    icon: BarChart3,
    content: {
      type: 'features',
      analyses: [
        { 
          title: 'Analyse vocale', 
          description: 'Débit, intonation, pauses et clarté de l\'élocution',
          metrics: ['Débit de parole', 'Variations tonales', 'Pauses efficaces']
        },
        { 
          title: 'Analyse gestuelle', 
          description: 'Langage corporel, contact visuel et expressions faciales',
          metrics: ['Contact visuel', 'Gestuelle', 'Expressions']
        },
        { 
          title: 'Analyse du contenu', 
          description: 'Structure du pitch, clarté du message et impact',
          metrics: ['Structure', 'Clarté', 'Impact émotionnel']
        }
      ]
    }
  },
  {
    id: 'dashboard',
    title: 'Suivez vos progrès',
    description: 'Utilisez le dashboard pour suivre votre évolution et vos performances',
    icon: Play,
    content: {
      type: 'dashboard',
      features: [
        'Statistiques de performance en temps réel',
        'Historique de vos vidéos et analyses',
        'Recommandations personnalisées',
        'Suivi de progression dans le temps'
      ]
    }
  }
];

const OnboardingFlow = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const currentStepData = onboardingSteps[currentStep];
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  const handleNext = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete?.();
    }, 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(() => {
      onSkip?.();
    }, 300);
  };

  const renderStepContent = () => {
    const { content } = currentStepData;

    switch (content.type) {
      case 'welcome':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {currentStepData.title}
              </h2>
              <p className="text-muted-foreground">
                {currentStepData.description}
              </p>
            </div>
            
            <div className="grid gap-4">
              {content.features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-4 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg"
                >
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'demo':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {currentStepData.title}
              </h2>
              <p className="text-muted-foreground">
                {currentStepData.description}
              </p>
            </div>

            <div className="space-y-3">
              {content.steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg"
                >
                  <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <span className="text-foreground">{step}</span>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {currentStepData.title}
              </h2>
              <p className="text-muted-foreground">
                {currentStepData.description}
              </p>
            </div>

            <div className="space-y-4">
              {content.analyses.map((analysis, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border border-primary-200 rounded-lg bg-gradient-to-r from-primary-50/50 to-secondary-50/50"
                >
                  <h3 className="font-semibold text-foreground mb-2">{analysis.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{analysis.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.metrics.map((metric, metricIndex) => (
                      <span
                        key={metricIndex}
                        className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {currentStepData.title}
              </h2>
              <p className="text-muted-foreground">
                {currentStepData.description}
              </p>
            </div>

            <div className="space-y-3">
              {content.features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-success-50 rounded-lg border border-success-200"
                >
                  <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl"
        >
          <Card variant="elevated" className="relative overflow-hidden">
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-200">
              <motion.div
                className="h-full bg-gradient-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Étape {currentStep + 1} sur {onboardingSteps.length}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Passer
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-8 mt-8 border-t border-border">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  icon={<ArrowLeft className="w-4 h-4" />}
                  iconPosition="left"
                >
                  Précédent
                </Button>

                <div className="flex gap-2">
                  {onboardingSteps.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentStep
                          ? 'bg-primary-600'
                          : completedSteps.has(index)
                          ? 'bg-success-500'
                          : 'bg-neutral-300'
                      }`}
                    />
                  ))}
                </div>

                <Button
                  variant="default"
                  onClick={handleNext}
                  icon={currentStep === onboardingSteps.length - 1 ? <CheckCircle className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                >
                  {currentStep === onboardingSteps.length - 1 ? 'Commencer' : 'Suivant'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingFlow;

