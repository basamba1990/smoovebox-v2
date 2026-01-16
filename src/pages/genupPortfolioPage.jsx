import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoTypeSelector from '../components/VideoTypeSelector';
import PitchRecording from '../components/PitchRecording';
import TransformationJournal from '../components/TransformationJournal';
import { useTransformationSession } from '../hooks/useTransformationSession';
import { useAuth } from '../context/AuthContext';

/**
 * Page principale du Portfolio Vidéo GENUP
 * Permet de :
 * 1. Créer une nouvelle session de transformation
 * 2. Sélectionner le type de vidéo (Pitch, Réflexion, Trace d'action)
 * 3. Enregistrer un audio/vidéo
 * 4. Visualiser le journal de transformation
 */
export default function GenupPortfolioPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessionId, setSessionId, createSession, loading: sessionLoading } = useTransformationSession();
  const [currentStep, setCurrentStep] = useState('view-journal'); // 'view-journal', 'select-type', 'record'
  const [selectedVideoType, setSelectedVideoType] = useState('pitch');
  const [videoRecorded, setVideoRecorded] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleStartNewVideo = async () => {
    if (!sessionId) {
      // Créer une nouvelle session si elle n'existe pas
      const newSessionId = await createSession();
      if (newSessionId) {
        setCurrentStep('select-type');
      }
    } else {
      setCurrentStep('select-type');
    }
  };

  const handleTypeSelected = (type) => {
    setSelectedVideoType(type);
    setCurrentStep('record');
  };

  const handleVideoRecorded = () => {
    setVideoRecorded(true);
    // Retourner à la vue du journal après un délai pour laisser l'utilisateur voir le succès
    setTimeout(() => {
      setCurrentStep('view-journal');
      setVideoRecorded(false);
    }, 3000);
  };

  const handleBackToJournal = () => {
    setCurrentStep('view-journal');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            ← Retour
          </button>

          <h1 className="text-4xl font-bold mb-2">
            📚 Portfolio GENUP
          </h1>
          <p className="text-gray-400 text-lg">
            Votre journal de transformation personnel. Documentez votre évolution à travers des vidéos, réflexions et actions.
          </p>
        </div>

        {/* Contenu principal */}
        {currentStep === 'view-journal' && (
          <div>
            <div className="mb-8 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Journal de Transformation</h2>
              <button
                onClick={handleStartNewVideo}
                disabled={sessionLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {sessionLoading ? '⏳ Chargement...' : '+ Ajouter un enregistrement'}
              </button>
            </div>
            {sessionId ? (
              <TransformationJournal sessionId={sessionId} />
            ) : (
              <div className="bg-slate-800 rounded-lg p-12 text-center border border-slate-700">
                <div className="text-6xl mb-4">🚀</div>
                <h2 className="text-2xl font-bold mb-2">Commencez votre parcours</h2>
                <p className="text-gray-400 mb-8">
                  Créez votre première session pour documenter votre évolution.
                </p>
                <button
                  onClick={handleStartNewVideo}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
                >
                  Démarrer maintenant
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'select-type' && (
          <div>
            <button
              onClick={handleBackToJournal}
              className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Retour au journal
            </button>
            <VideoTypeSelector
              selectedType={selectedVideoType}
              onTypeChange={handleTypeSelected}
            />
          </div>
        )}

        {currentStep === 'record' && (
          <div>
            <button
              onClick={handleBackToJournal}
              className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Retour au journal
            </button>
            <PitchRecording
              videoType={selectedVideoType}
              sessionId={sessionId}
              onVideoRecorded={handleVideoRecorded}
              user={user}
            />
          </div>
        )}
      </div>
    </div>
  );
}
