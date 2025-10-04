// src/pages/home.jsx
import React, { useState, useEffect } from 'react';
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import ProfileForm from "../components/ProfileForm.jsx";
import SeminarsList from "../components/SeminarsList.jsx";
import Certification from "../components/Certification.jsx";
import Questionnaire from "../components/Questionnaire.jsx";
import GiftExperience from '../components/GiftExperience';
import { Button } from "../components/ui/button-enhanced.jsx";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useGiftMoments } from '../hooks/useGiftMoments';

export default function Home({ 
  user, 
  profile, 
  connectionStatus, 
  onSignOut, 
  dashboardData, 
  dashboardLoading, 
  dashboardError, 
  loadDashboardData 
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profileUpdated, setProfileUpdated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [hasCompletedQuestionnaire, setHasCompletedQuestionnaire] = useState(false);
  const [userJourney, setUserJourney] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true); // ✅ FORCER LE MODE SOMBRE

  const supabase = useSupabaseClient();
  const currentUser = useUser();

  // Système de cadeaux
  const { 
    showGift, 
    giftTrigger, 
    setShowGift, 
    markGiftAsReceived 
  } = useGiftMoments();

  // Parcours utilisateur guidé
  const userJourneySteps = [
    { id: 'profile', name: 'Compléter le profil', completed: false, priority: 1 },
    { id: 'questionnaire', name: 'Questionnaire personnalité', completed: false, priority: 2 },
    { id: 'first-video', name: 'Première vidéo', completed: false, priority: 3 },
    { id: 'first-connection', name: 'Première connexion', completed: false, priority: 4 },
    { id: 'community', name: 'Explorer la communauté', completed: false, priority: 5 }
  ];

  const handleNavigateToDirectory = () => {
    navigate('/directory');
  };

  const handleProfileUpdated = () => {
    setProfileUpdated(true);
    toast.success('Profil mis à jour avec succès !');
    if (loadDashboardData) {
      loadDashboardData();
    }
    updateUserJourney('profile', true);
  };

  // CORRECTION : Fonction améliorée pour le rechargement des vidéos
  const handleVideoUploaded = () => {
    console.log('🔄 Home: Vidéo uploadée, rechargement des données');
    setRefreshKey(prev => prev + 1);
    toast.success('Vidéo uploadée avec succès !');
    
    // Recharger les données du dashboard
    if (loadDashboardData) {
      loadDashboardData();
    }
    
    updateUserJourney('first-video', true);
  };

  // Vérifier si le profil est complet
  const isProfileComplete = profile && 
    profile.sex && 
    profile.is_major !== null && 
    profile.passions && 
    profile.passions.length > 0;

  // CORRECTION : Fonction checkQuestionnaireStatus améliorée avec maybeSingle()
  const checkQuestionnaireStatus = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('id, completed_at')
        .eq('user_id', currentUser.id)
        .maybeSingle(); // Utilisation de maybeSingle() au lieu de single()

      const hasCompleted = !!data;
      setHasCompletedQuestionnaire(hasCompleted);
      updateUserJourney('questionnaire', hasCompleted);
      
      if (!data && !localStorage.getItem('questionnaire_shown')) {
        setTimeout(() => {
          setShowQuestionnaire(true);
          localStorage.setItem('questionnaire_shown', 'true');
        }, 3000);
      }
    } catch (error) {
      console.error('Erreur checkQuestionnaireStatus:', error);
      setHasCompletedQuestionnaire(false);
      updateUserJourney('questionnaire', false);
    }
  };

  // Mettre à jour le parcours utilisateur
  const updateUserJourney = (stepId, completed) => {
    setUserJourney(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, completed } : step
      )
    );
  };

  // Vérifier les connexions existantes
  const checkUserConnections = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('connections')
        .select('id')
        .eq('requester_id', currentUser.id)
        .limit(1);

      updateUserJourney('first-connection', !!data && data.length > 0);
    } catch (error) {
      console.error('Erreur vérification connexions:', error);
    }
  };

  useEffect(() => {
    setUserJourney(userJourneySteps);
  }, []);

  useEffect(() => {
    if (currentUser) {
      checkQuestionnaireStatus();
      checkUserConnections();
      updateUserJourney('profile', isProfileComplete);
    }
  }, [currentUser, isProfileComplete]);

  useEffect(() => {
    if (user && profile && !isProfileComplete) {
      toast.info('Complétez votre profil pour une meilleure expérience', {
        duration: 5000,
      });
    }
  }, [user, profile, isProfileComplete]);

  const handleQuestionnaireComplete = () => {
    setShowQuestionnaire(false);
    setHasCompletedQuestionnaire(true);
    updateUserJourney('questionnaire', true);
    toast.success('Questionnaire complété ! Votre profil est maintenant enrichi.');
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  const getNextStep = () => {
    return userJourney.find(step => !step.completed) || userJourney[userJourney.length - 1];
  };

  const nextStep = getNextStep();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Parcours utilisateur */}
            <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
              <h2 className="text-2xl font-french font-bold text-white mb-4">
                🗺️ Votre Aventure SpotBulle
              </h2>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-200">Progression</h3>
                  <span className="text-sm text-gray-400">
                    {userJourney.filter(s => s.completed).length} / {userJourney.length} étapes
                  </span>
                </div>
                
                <div className="space-y-3">
                  {userJourney.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 bg-gray-900">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        step.completed 
                          ? 'bg-green-500 text-white' 
                          : step.id === nextStep?.id
                            ? 'bg-blue-500 text-white animate-pulse'
                            : 'bg-gray-700 text-gray-300'
                      }`}>
                        {step.completed ? '✓' : index + 1}
                      </div>
                      <span className={`flex-1 ${step.completed ? 'text-gray-400' : 'text-gray-200'}`}>
                        {step.name}
                      </span>
                      {step.id === nextStep?.id && !step.completed && (
                        <Button 
                          size="sm"
                          onClick={() => {
                            if (step.id === 'profile') setActiveTab('profile');
                            if (step.id === 'questionnaire') setShowQuestionnaire(true);
                            if (step.id === 'first-video') navigate('/record-video');
                            if (step.id === 'first-connection' || step.id === 'community') navigate('/directory');
                          }}
                          className="btn-spotbulle-dark text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Commencer
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {!isProfileComplete && (
                <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
                  <p className="text-yellow-200 text-sm">
                    📝 <strong>Profil incomplet</strong> - Complétez votre profil pour accéder à toutes les fonctionnalités.
                  </p>
                </div>
              )}
              
              {!hasCompletedQuestionnaire && (
                <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-200 text-sm">
                        🎯 <strong>Questionnaire de personnalité</strong> - Complétez le questionnaire pour améliorer vos connexions.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowQuestionnaire(true)}
                      className="btn-spotbulle-dark bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      Commencer le questionnaire
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* CORRECTION : Dashboard avec lecture vidéo */}
            <Dashboard 
              data={dashboardData}
              loading={dashboardLoading}
              error={dashboardError}
              refreshKey={refreshKey}
              onVideoUploaded={handleVideoUploaded}
            />
          </div>
        );
      
      case 'record':
        return (
          <RecordVideo 
            user={user}
            onVideoUploaded={handleVideoUploaded}
          />
        );
      
      case 'profile':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">👤 Mon Profil</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowQuestionnaire(true)}
                  variant="outline"
                  className="flex items-center gap-2 border-blue-400 text-blue-300 hover:bg-blue-900"
                >
                  📝 Questionnaire
                </Button>
                <Button
                  onClick={() => setActiveTab('dashboard')}
                  variant="outline"
                  className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  ← Retour
                </Button>
              </div>
            </div>
            <ProfileForm 
              user={user}
              profile={profile}
              onProfileUpdated={handleProfileUpdated}
            />
          </div>
        );
      
      case 'seminars':
        return <SeminarsList user={user} />;
      
      case 'certification':
        return <Certification user={user} />;
      
      default:
        return (
          <Dashboard 
            data={dashboardData}
            loading={dashboardLoading}
            error={dashboardError}
            refreshKey={refreshKey}
          />
        );
    }
  };

  return (
    <div className="app-container min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <ProfessionalHeader 
        user={user}
        profile={profile}
        connectionStatus={connectionStatus}
        onSignOut={onSignOut}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'outline'}
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 btn-spotbulle-dark bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
            >
              📊 Tableau de bord
            </Button>
            
            <Button
              variant={activeTab === 'record' ? 'default' : 'outline'}
              onClick={() => setActiveTab('record')}
              className="flex items-center gap-2 btn-spotbulle-dark bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
            >
              🎥 Enregistrer une vidéo
            </Button>
            
            <Button
              variant={activeTab === 'profile' ? 'default' : 'outline'}
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 btn-spotbulle-dark bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
            >
              👤 Mon profil
            </Button>
            
            <Button
              variant={activeTab === 'seminars' ? 'default' : 'outline'}
              onClick={() => setActiveTab('seminars')}
              className="flex items-center gap-2 btn-spotbulle-dark bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
            >
              🎓 Séminaires
            </Button>
            
            <Button
              variant={activeTab === 'certification' ? 'default' : 'outline'}
              onClick={() => setActiveTab('certification')}
              className="flex items-center gap-2 btn-spotbulle-dark bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
            >
              📜 Certification
            </Button>
            
            <Button
              onClick={handleNavigateToDirectory}
              className="flex items-center gap-2 ml-auto bg-gray-800 text-blue-400 border border-blue-500 hover:bg-blue-600 hover:text-white transition-all font-medium py-2 px-4 rounded-lg"
            >
              👥 Explorer l'annuaire
            </Button>
          </div>

          {/* Indicateur d'étape suivante */}
          {nextStep && !nextStep.completed && (
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg mb-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🎯</span>
                  <div>
                    <p className="font-semibold">Prochaine étape : {nextStep.name}</p>
                    <p className="text-sm opacity-90">Continuez votre aventure SpotBulle</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (nextStep.id === 'profile') setActiveTab('profile');
                    if (nextStep.id === 'questionnaire') setShowQuestionnaire(true);
                    if (nextStep.id === 'first-video') navigate('/record-video');
                    if (nextStep.id === 'first-connection' || nextStep.id === 'community') navigate('/directory');
                  }}
                  className="bg-white text-blue-600 hover:bg-gray-100 border-0"
                >
                  Commencer
                </Button>
              </div>
            </div>
          )}

          {/* Tab Content */}
          <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
            {renderTabContent()}
          </div>
        </div>
      </main>

      {/* Modal Questionnaire */}
      {showQuestionnaire && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700">
            <div className="p-6">
              <Questionnaire 
                onComplete={handleQuestionnaireComplete}
                showSkip={true}
                isModal={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Composant GiftExperience */}
      {showGift && (
        <GiftExperience 
          trigger={giftTrigger}
          user={user}
          onClose={() => setShowGift(false)}
          onGiftReceived={markGiftAsReceived}
        />
      )}

      {/* Loading State */}
      {dashboardLoading && activeTab === 'dashboard' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 flex items-center gap-3 shadow-2xl border border-gray-700">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="text-gray-300">Chargement de vos données...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {dashboardError && activeTab === 'dashboard' && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-200">
            <span>⚠️</span>
            <div>
              <strong>Erreur lors du chargement :</strong>
              <p className="text-sm">{dashboardError}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadDashboardData}
              className="ml-auto border-red-600 text-red-300 hover:bg-red-800"
            >
              Réessayer
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-700/50 bg-gradient-to-r from-gray-800 to-gray-900">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center items-center gap-4 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-full shadow-lg"></div>
            <div className="w-8 h-8 bg-gray-700 border border-gray-600 rounded-full shadow-lg"></div>
            <div className="w-8 h-8 bg-purple-600 rounded-full shadow-lg"></div>
          </div>
          <p className="text-gray-300 text-sm font-medium">
            <span className="gradient-text-dark font-french">SpotBulle</span> - Communauté • Partager, inspirer, connecter
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Votre plateforme pour des connexions authentiques
          </p>
        </div>
      </footer>
    </div>
  );
}
