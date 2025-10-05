import React, { useState, useEffect } from 'react';
import { Button } from './ui/button-enhanced.jsx';

const ImmersionSimulator = ({ activity, onComplete, onBack }) => {
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval = null;
    
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft => {
          const newTime = timeLeft - 1;
          setProgress(((180 - newTime) / 180) * 100);
          return newTime;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      onComplete();
    }
    
    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startSimulator = () => {
    setIsActive(true);
  };

  const pauseSimulator = () => {
    setIsActive(false);
  };

  const resetSimulator = () => {
    setIsActive(false);
    setTimeLeft(180);
    setProgress(0);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-french font-bold text-white">{activity.name}</h2>
          <p className="text-gray-300">{activity.description}</p>
        </div>
        <Button
          onClick={onBack}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          ← Retour
        </Button>
      </div>

      {/* Zone de simulation */}
      <div className="card-spotbulle-dark p-8 bg-gray-800 border-gray-700 text-center">
        <div className="max-w-2xl mx-auto">
          {/* Indicateur de temps */}
          <div className="mb-8">
            <div className="text-6xl font-mono text-white mb-4">
              {formatTime(timeLeft)}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Zone d'action */}
          <div className="bg-gray-900 rounded-2xl p-8 mb-8 border border-gray-600">
            <div className="text-8xl mb-6">
              {activity.name.split(' ')[0]}
            </div>
            <p className="text-gray-300 text-lg mb-4">
              {isActive ? 'En cours... Concentrez-vous sur votre geste technique' : 'Prêt à commencer ?'}
            </p>
            
            {!isActive && timeLeft === 180 && (
              <div className="space-y-3 text-sm text-gray-400">
                <p>🎯 Objectif : Améliorer votre concentration et votre geste technique</p>
                <p>⏱️ Durée : 3 minutes d'immersion complète</p>
                <p>💡 Conseil : Visualisez votre mouvement avant de commencer</p>
              </div>
            )}
          </div>

          {/* Contrôles */}
          <div className="flex gap-4 justify-center">
            {!isActive && timeLeft === 180 ? (
              <Button
                onClick={startSimulator}
                className="btn-spotbulle-dark bg-green-600 hover:bg-green-700 text-lg px-8 py-3"
              >
                🚀 Démarrer l'immersion
              </Button>
                        ) : isActive ? (
              <Button
                onClick={pauseSimulator}
                className="btn-spotbulle-dark bg-yellow-600 hover:bg-yellow-700 text-lg px-8 py-3"
              >
                ⏸️ Pause
              </Button>
            ) : (
              <Button
                onClick={startSimulator}
                className="btn-spotbulle-dark bg-green-600 hover:bg-green-700 text-lg px-8 py-3"
              >
                ▶️ Reprendre
              </Button>
            )}
            
            <Button
              onClick={resetSimulator}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700 text-lg px-8 py-3"
            >
              🔄 Réinitialiser
            </Button>
          </div>

          {/* Instructions dynamiques */}
          {isActive && (
            <div className="mt-8 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <h4 className="text-blue-300 font-semibold mb-2">💡 Instructions en cours :</h4>
              <div className="space-y-2 text-sm text-blue-200">
                {timeLeft > 120 && (
                  <p>• Concentrez-vous sur votre posture et votre équilibre</p>
                )}
                {timeLeft > 60 && timeLeft <= 120 && (
                  <p>• Visualisez le mouvement parfait dans votre esprit</p>
                )}
                {timeLeft > 30 && timeLeft <= 60 && (
                  <p>• Respirez profondément et relâchez les tensions</p>
                )}
                {timeLeft <= 30 && (
                  <p>• Maintenez la concentration jusqu'au dernier moment</p>
                )}
              </div>
            </div>
          )}

          {/* Feedback de performance */}
          {!isActive && timeLeft < 180 && timeLeft > 0 && (
            <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
              <h4 className="text-white font-semibold mb-2">📊 Votre progression :</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl text-blue-400">{Math.round(progress)}%</div>
                  <div className="text-xs text-gray-400">Complétion</div>
                </div>
                <div>
                  <div className="text-2xl text-green-400">{formatTime(180 - timeLeft)}</div>
                  <div className="text-xs text-gray-400">Temps écoulé</div>
                </div>
                <div>
                  <div className="text-2xl text-yellow-400">{formatTime(timeLeft)}</div>
                  <div className="text-xs text-gray-400">Temps restant</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section préparation expression orale */}
      {timeLeft === 0 && (
        <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
          <h3 className="text-xl font-french font-bold text-white mb-4">
            🎤 Prêt pour l'expression orale !
          </h3>
          <div className="space-y-4">
            <p className="text-gray-300">
              Votre immersion {activity.name.toLowerCase()} est terminée. Maintenant, transformez cette énergie en parole !
            </p>
            
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2">💫 Transition recommandée :</h4>
              <p className="text-white/90 text-sm">
                Passez directement à l'enregistrement vidéo pour capitaliser sur l'état de flow acquis pendant l'immersion.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => window.location.href = '/record-video'}
                className="btn-spotbulle-dark bg-purple-600 hover:bg-purple-700 flex-1"
              >
                🎥 Commencer l'enregistrement
              </Button>
              <Button
                onClick={resetSimulator}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                🔄 Refaire l'immersion
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conseils selon l'activité */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-3">🎯 Conseils techniques</h4>
          <div className="space-y-2 text-sm text-gray-300">
            {activity.id === 'football' && (
              <>
                <p>• Gardez les yeux sur la balle virtuelle</p>
                <p>• Contrôlez votre respiration pendant les tirs</p>
                <p>• Visualisez la trajectoire avant de frapper</p>
              </>
            )}
            {activity.id === 'golf' && (
              <>
                <p>• Maintenez une posture stable et équilibrée</p>
                <p>• Synchronisez votre swing avec votre respiration</p>
                <p>• Visualisez le parcours de la balle</p>
              </>
            )}
            {activity.id === 'tennis' && (
              <>
                <p>• Anticipez les mouvements de l'adversaire virtuel</p>
                <p>• Travaillez votre timing sur les retours</p>
                <p>• Gardez une position prête à chaque instant</p>
              </>
            )}
            {activity.id === 'basketball' && (
              <>
                <p>• Concentrez-vous sur la fluidité du geste</p>
                <p>• Visualisez la trajectoire parabolique</p>
                <p>• Maintenez un rythme régulier</p>
              </>
            )}
          </div>
        </div>

        <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-3">🧠 Bénéfices cognitifs</h4>
          <div className="space-y-2 text-sm text-gray-300">
            <p>• 🎯 Amélioration de la concentration</p>
            <p>• 💪 Développement de la coordination</p>
            <p>• 🧘 Renforcement de la conscience corporelle</p>
            <p>• ⚡ Augmentation des réflexes</p>
            <p>• 🎨 Stimulation de la visualisation spatiale</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImmersionSimulator;
