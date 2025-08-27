import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  Upload, 
  Brain, 
  BarChart3, 
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/button-enhanced';
import { Card, CardContent } from './ui/card-enhanced';
import { Progress } from './ui/progress';

const loadingStages = [
  { id: 'upload', label: 'Téléchargement', icon: Upload, duration: 2000 },
  { id: 'processing', label: 'Traitement', icon: Brain, duration: 3000 },
  { id: 'analysis', label: 'Analyse IA', icon: BarChart3, duration: 4000 },
  { id: 'complete', label: 'Terminé', icon: CheckCircle, duration: 500 }
];

const loadingMessages = [
  "Analyse de votre élocution en cours...",
  "Détection des gestes et expressions...",
  "Évaluation de la structure du pitch...",
  "Génération des recommandations...",
  "Calcul du score de performance...",
  "Finalisation de l'analyse..."
];

const LoadingScreenEnhanced = ({ 
  type = 'general',
  message = 'Chargement en cours...',
  progress = null,
  stage = null,
  onCancel = null,
  showReloadButton = false,
  error = null,
  timeout = 30000
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);

  // Gestion du timeout
  useEffect(() => {
    if (timeout > 0) {
      const timer = setTimeout(() => {
        setIsTimeout(true);
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [timeout]);

  // Gestion du temps écoulé
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1000);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Rotation des messages pour les analyses longues
  useEffect(() => {
    if (type === 'analysis' || type === 'processing') {
      const messageTimer = setInterval(() => {
        setCurrentMessage(prev => (prev + 1) % loadingMessages.length);
      }, 2000);

      return () => clearInterval(messageTimer);
    }
  }, [type]);

  // Progression automatique des étapes pour les analyses
  useEffect(() => {
    if (type === 'analysis' && !stage) {
      const stageTimer = setInterval(() => {
        setCurrentStage(prev => {
          if (prev < loadingStages.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 3000);

      return () => clearInterval(stageTimer);
    }
  }, [type, stage]);

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  const getProgressValue = () => {
    if (progress !== null) return progress;
    if (type === 'analysis') {
      return ((currentStage + 1) / loadingStages.length) * 100;
    }
    return null;
  };

  const getCurrentMessage = () => {
    if (error) return error;
    if (isTimeout) return "L'opération prend plus de temps que prévu...";
    if (type === 'analysis' || type === 'processing') {
      return loadingMessages[currentMessage];
    }
    return message;
  };

  const renderLoadingIcon = () => {
    if (error) {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center"
        >
          <AlertCircle className="w-8 h-8 text-error-600" />
        </motion.div>
      );
    }

    if (type === 'analysis') {
      const currentStageData = loadingStages[currentStage];
      const IconComponent = currentStageData.icon;
      
      return (
        <motion.div
          key={currentStage}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center"
        >
          <IconComponent className="w-8 h-8 text-white" />
        </motion.div>
      );
    }

    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center"
      >
        <Loader2 className="w-8 h-8 text-white" />
      </motion.div>
    );
  };

  const renderStageIndicators = () => {
    if (type !== 'analysis') return null;

    return (
      <div className="flex justify-center gap-4 mt-6">
        {loadingStages.map((stageData, index) => {
          const isActive = index === currentStage;
          const isCompleted = index < currentStage;
          const IconComponent = stageData.icon;

          return (
            <motion.div
              key={stageData.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-success-500 text-white'
                    : isActive
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <IconComponent className="w-5 h-5" />
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive ? 'text-primary-600' : 'text-muted-foreground'
                }`}
              >
                {stageData.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gradient-background flex items-center justify-center p-4 z-50"
      >
        <Card variant="elevated" className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            {/* Loading Icon */}
            <div className="flex justify-center mb-6">
              {renderLoadingIcon()}
            </div>

            {/* Main Message */}
            <motion.h2
              key={getCurrentMessage()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold text-foreground mb-2"
            >
              {error ? 'Erreur' : isTimeout ? 'Patience...' : 'Chargement'}
            </motion.h2>

            <motion.p
              key={getCurrentMessage()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-sm mb-6 ${
                error ? 'text-error-600' : 'text-muted-foreground'
              }`}
            >
              {getCurrentMessage()}
            </motion.p>

            {/* Progress Bar */}
            {getProgressValue() !== null && (
              <div className="mb-6">
                <Progress 
                  value={getProgressValue()} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {Math.round(getProgressValue())}% terminé
                </p>
              </div>
            )}

            {/* Stage Indicators */}
            {renderStageIndicators()}

            {/* Time Elapsed */}
            <div className="mt-6 text-xs text-muted-foreground">
              Temps écoulé: {formatTime(elapsedTime)}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {onCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  className="flex-1"
                >
                  Annuler
                </Button>
              )}

              {(showReloadButton || error || isTimeout) && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => window.location.reload()}
                  icon={<RefreshCw className="w-4 h-4" />}
                  className="flex-1"
                >
                  Recharger
                </Button>
              )}
            </div>

            {/* Tips for long operations */}
            {elapsedTime > 10000 && !error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-primary-50 rounded-lg border border-primary-200"
              >
                <p className="text-xs text-primary-700">
                  💡 L'analyse peut prendre quelques minutes selon la taille de votre vidéo
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

// Composant simplifié pour les chargements rapides
export const SimpleLoader = ({ message = 'Chargement...', size = 'default' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex items-center gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className={`${sizeClasses[size]} text-primary-600`} />
      </motion.div>
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
};

// Composant pour les skeleton loaders inline
export const InlineLoader = ({ width = 'w-full', height = 'h-4' }) => (
  <motion.div
    className={`${width} ${height} bg-neutral-200 rounded animate-pulse`}
    initial={{ opacity: 0.6 }}
    animate={{ opacity: [0.6, 1, 0.6] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  />
);

export default LoadingScreenEnhanced;

