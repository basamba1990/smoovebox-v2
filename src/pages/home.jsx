 // src/pages/home.jsx
import React, { useState, useEffect } from 'react';
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import ProfileForm from "../components/ProfileForm.jsx";
import SeminarsList from "../components/SeminarsList.jsx";
import Certification from "../components/Certification.jsx";
import Questionnaire from "../components/Questionnaire.jsx";
import ImmersionSimulator from '../components/ImmersionSimulator.jsx';
import VideoVault from './video-vault.jsx';
import { Button } from "../components/ui/button-enhanced.jsx";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

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
  const [activeImmersionTab, setActiveImmersionTab] = useState('parcours');
  const [profileUpdated, setProfileUpdated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [hasCompletedQuestionnaire, setHasCompletedQuestionnaire] = useState(false);
  const [userJourney, setUserJourney] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const supabase = useSupabaseClient();
  const currentUser = useUser();

  // Parcours utilisateur guidé - Version simplifiée et fluide
  const userJourneySteps = [
    { id: 'profile', name: 'Compléter le profil', completed: false, priority: 1, section: 'profile' },
    { id: 'personality', name: 'Test personnalité', completed: false, priority: 2, section: 'personality' },
    { id: 'immersion', name: 'Immersion simulateur', completed: false, priority: 3, section: 'immersion' },
    { id: 'expression', name: 'Expression orale', completed: false, priority: 4, section: 'expression' },
    { id: 'vault', name: 'Coffre-fort vidéo', completed: false, priority: 5, section: 'vault' },
    { id: 'restitution', name: 'Restitution & badge', completed: false, priority: 6, section: 'restitution' }
  ];

  const immersionActivities = [
    {
      id: 'football',
      name: '⚽ Football',
      description: 'Améliore ton geste technique et ta concentration',
      duration: '2-3 min',
      color: 'from-green-500 to-emerald-600'
    },
    {
      id: 'golf',
      name: '🏌️ Golf',
      description: 'Travaille ta précision et ton calme intérieur',
      duration: '2-3 min',
      color: 'from-blue-500 to-cyan-600'
    },
    {
      id: 'tennis',
      name: '🎾 Tennis',
      description: 'Développe tes réflexes et ta coordination',
      duration: '2-3 min',
      color: 'from-yellow-500 to-orange-600'
    },
    {
      id: 'basketball',
      name: '🏀 Basketball',
      description: 'Améliore ton adresse et ton esprit d\'équipe',
      duration: '2-3 min',
      color: 'from-orange-500 to-red-600'
    }
  ];

  const recordingScenarios = {
    enfants: [
      "🎙 Dis-moi pourquoi tu aimes ton sport préféré.",
      "🎙 Qu'est-ce que tu ressens quand tu marques un but / réussis ton coup ?",
      "🎙 Si tu devais inventer ton club idéal, à quoi ressemblerait-il ?"
    ],
    adolescents: [
      "🎙 Comment le foot (ou ton sport) t'aide à grandir dans la vie ?",
      "🎙 Raconte un moment où tu as douté, mais où tu t'es relevé.",
      "🎙 Où te vois-tu dans 5 ans grâce à ta passion ?",
      "🎙 Quel joueur ou joueuse t'inspire le plus, et pourquoi ?"
    ],
    adultes: [
      "🎙 Comment ton sport reflète ta personnalité ?",
      "🎙 Quel lien fais-tu entre ton sport et ta vie professionnelle ?",
      "🎙 Que t'apprend ton sport sur la gestion de la pression, de l'échec ou du leadership ?"
    ]
  };

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

  const handleVideoUploaded = () => {
    console.log('🔄 Home: Vidéo uploadée, rechargement des données');
    setRefreshKey(prev => prev + 1);
    toast.success('Vidéo uploadée avec succès !');
    
    if (loadDashboardData) {
      loadDashboardData();
    }
    
    updateUserJourney('expression', true);
    updateUserJourney('vault', true);
  };

  const handleImmersionCompleted = (activityId) => {
    toast.success(`Immersion ${activityId} terminée avec succès !`);
    updateUserJourney('immersion', true);
  };

  const handleVaultVideoAdded = () => {
    toast.success('Vidéo ajoutée au coffre-fort !');
    updateUserJourney('vault', true);
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  const isProfileComplete = profile && 
    profile.sex && 
    profile.is_major !== null && 
    profile.passions && 
    profile.passions.length > 0;

  const checkQuestionnaireStatus = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('id, completed_at')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      const hasCompleted = !!data;
      setHasCompletedQuestionnaire(hasCompleted);
      updateUserJourney('personality', hasCompleted);
      
      if (!data && !localStorage.getItem('questionnaire_shown')) {
        setTimeout(() => {
          setShowQuestionnaire(true);
          localStorage.setItem('questionnaire_shown', 'true');
        }, 3000);
      }
    } catch (error) {
      console.error('Erreur checkQuestionnaireStatus:', error);
      setHasCompletedQuestionnaire(false);
      updateUserJourney('personality', false);
    }
  };

  const updateUserJourney = (stepId, completed) => {
    setUserJourney(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, completed } : step
      )
    );
  };

  useEffect(() => {
    setUserJourney(userJourneySteps);
  }, []);

  useEffect(() => {
    if (currentUser) {
      checkQuestionnaireStatus();
      updateUserJourney('profile', isProfileComplete);
      
      // Vérifier si l'utilisateur a des vidéos dans le coffre-fort
      const checkVaultStatus = async () => {
        try {
          const { data: videos, error } = await supabase
            .from('videos')
            .select('id')
            .eq('user_id', currentUser.id)
            .limit(1);
          
          if (videos && videos.length > 0) {
            updateUserJourney('vault', true);
          }
        } catch (error) {
          console.log('Erreur vérification coffre-fort:', error);
        }
      };
      
      checkVaultStatus();
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
    updateUserJourney('personality', true);
    toast.success('Questionnaire complété ! Votre profil est maintenant enrichi.');
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  const getNextStep = () => {
    return userJourney.find(step => !step.completed) || userJourney[userJourney.length - 1];
  };

  const nextStep = getNextStep();

  const renderImmersionContent = () => {
    switch (activeImmersionTab) {
      case 'parcours':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {immersionActivities.map((activity) => (
                <div 
                  key={activity.id}
                  className={`bg-gradient-to-br ${activity.color} rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg`}
                  onClick={() => setActiveImmersionTab(activity.id)}
                >
                  <div className="text-3xl mb-3">{activity.name.split(' ')[0]}</div>
                  <h3 className="font-bold text-lg mb-2">{activity.name}</h3>
                  <p className="text-white/90 text-sm mb-3">{activity.description}</p>
                  <div className="text-xs bg-white/20 rounded-full px-3 py-1 inline-block">
                    ⏱️ {activity.duration}
                  </div>
                </div>
              ))}
            </div>

            {/* Parcours guidé */}
            <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
              <h3 className="text-xl font-french font-bold text-white mb-4">
                🧭 Parcours SpotBulle Immersion
              </h3>
              
              <div className="space-y-4">
                {[
                  { step: 1, title: "Test de personnalité", description: "Découvre ton profil émotionnel (4 couleurs)", duration: "2-3 min", emoji: "🎨" },
                  { step: 2, title: "Immersion simulateur", description: "Libère tes tensions, active ta concentration", duration: "2-3 min", emoji: "⚽" },
                  { step: 3, title: "Expression orale", description: "Transforme l'émotion en parole", duration: "2 min", emoji: "🎙️" },
                  { step: 4, title: "Coffre-fort vidéo", description: "Stocke et compare tes progrès", duration: "1 min", emoji: "📁" },
                  { step: 5, title: "Restitution & badge", description: "Reçois ton analyse personnalisée", duration: "1 min", emoji: "🏆" }
                ].map((step) => (
                  <div key={step.step} className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {step.emoji}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{step.title}</h4>
                      <p className="text-gray-300 text-sm">{step.description}</p>
                    </div>
                    <div className="text-gray-400 text-sm">
                      {step.duration}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'scenarios':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-french font-bold text-white mb-4">
              🎬 Scénarios d'enregistrement
            </h3>
            
            {Object.entries(recordingScenarios).map(([ageGroup, scenarios]) => (
              <div key={ageGroup} className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
                <h4 className="text-lg font-semibold text-white mb-4 capitalize">
                  {ageGroup === 'enfants' ? '👦 Enfants (8-12 ans)' : 
                   ageGroup === 'adolescents' ? '👨‍🎓 Adolescents (13-17 ans)' : 
                   '👨‍💼 Jeunes adultes (18+)'}
                </h4>
                <div className="space-y-3">
                  {scenarios.map((scenario, index) => (
                    <div key={index} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <p className="text-gray-200">{scenario}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <ImmersionSimulator 
            activity={immersionActivities.find(a => a.id === activeImmersionTab)}
            onComplete={() => handleImmersionCompleted(activeImmersionTab)}
            onBack={() => setActiveImmersionTab('parcours')}
          />
        );
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Parcours utilisateur */}
            <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
              <h2 className="text-2xl font-french font-bold text-white mb-4">
                🗺️ Votre Aventure SpotBulle Immersion
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
                            if (step.id === 'personality') setShowQuestionnaire(true);
                            if (step.id === 'immersion') setActiveTab('immersion');
                            if (step.id === 'expression') navigate('/record-video');
                            if (step.id === 'vault') setActiveTab('vault');
                            if (step.id === 'restitution') navigate('/directory');
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
                        🎯 <strong>Test de personnalité 4 couleurs</strong> - Découvrez votre profil émotionnel.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowQuestionnaire(true)}
                      className="btn-spotbulle-dark bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      Commencer le test
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <Dashboard 
              data={dashboardData}
              loading={dashboardLoading}
              error={dashboardError}
              refreshKey={refreshKey}
              onVideoUploaded={handleVideoUploaded}
            />
          </div>
        );
      
      case 'immersion':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🎮 Immersion Simulateurs</h2>
              <div className="flex gap-2">
                <Button
                  variant={activeImmersionTab === 'parcours' ? 'default' : 'outline'}
                  onClick={() => setActiveImmersionTab('parcours')}
                  className="btn-spotbulle-dark"
                >
                  🧭 Parcours
                </Button>
                <Button
                  variant={activeImmersionTab === 'scenarios' ? 'default' : 'outline'}
                  onClick={() => setActiveImmersionTab('scenarios')}
                  className="btn-spotbulle-dark"
                >
                  🎬 Scénarios
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
            {renderImmersionContent()}
          </div>
        );
      
      case 'record':
        return (
          <RecordVideo 
            user={user}
            onVideoUploaded={handleVideoUploaded}
            scenarios={recordingScenarios}
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
                  🎨 Test personnalité
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
      
      case 'vault':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">📁 Mon Coffre-fort Vidéo</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setActiveTab('dashboard')}
                  variant="outline"
                  className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  ← Retour au tableau de bord
                </Button>
              </div>
            </div>
            <VideoVault 
              user={user}
              profile={profile}
              onSignOut={onSignOut}
              onVideoAdded={handleVaultVideoAdded}
            />
          </div>
        );
      
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
        currentSection={activeTab}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'outline'}
              onClick={() => setActiveTab('dashboard')}
              className="btn-spotbulle-dark"
            >
              📊 Tableau de bord
            </Button>
            
            <Button
              variant={activeTab === 'immersion' ? 'default' : 'outline'}
              onClick={() => setActiveTab('immersion')}
              className="btn-spotbulle-dark"
            >
              🎮 Immersion
            </Button>
            
            <Button
              variant={activeTab === 'record' ? 'default' : 'outline'}
              onClick={() => setActiveTab('record')}
              className="btn-spotbulle-dark"
            >
              🎥 Expression orale
            </Button>
            
            <Button
              variant={activeTab === 'vault' ? 'default' : 'outline'}
              onClick={() => setActiveTab('vault')}
              className="btn-spotbulle-dark"
            >
              📁 Coffre-fort
            </Button>
            
            <Button
              variant={activeTab === 'profile' ? 'default' : 'outline'}
              onClick={() => setActiveTab('profile')}
              className="btn-spotbulle-dark"
            >
              👤 Mon profil
            </Button>
            
            <Button
              variant={activeTab === 'seminars' ? 'default' : 'outline'}
              onClick={() => setActiveTab('seminars')}
              className="btn-spotbulle-dark"
            >
              🎓 Séminaires
            </Button>
            
            <Button
              variant={activeTab === 'certification' ? 'default' : 'outline'}
              onClick={() => setActiveTab('certification')}
              className="btn-spotbulle-dark"
            >
              📜 Certification
            </Button>
            
            <Button
              onClick={handleNavigateToDirectory}
              className="btn-spotbulle-dark ml-auto"
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
                    <p className="text-sm opacity-90">Continuez votre aventure SpotBulle Immersion</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (nextStep.id === 'profile') setActiveTab('profile');
                    if (nextStep.id === 'personality') setShowQuestionnaire(true);
                    if (nextStep.id === 'immersion') setActiveTab('immersion');
                    if (nextStep.id === 'expression') navigate('/record-video');
                    if (nextStep.id === 'vault') setActiveTab('vault');
                    if (nextStep.id === 'restitution') navigate('/directory');
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

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-700/50 bg-gradient-to-r from-gray-800 to-gray-900">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center items-center gap-4 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-full shadow-lg"></div>
            <div className="w-8 h-8 bg-gray-700 border border-gray-600 rounded-full shadow-lg"></div>
            <div className="w-8 h-8 bg-purple-600 rounded-full shadow-lg"></div>
          </div>
          <p className="text-gray-300 text-sm font-medium">
            <span className="gradient-text-dark font-french">SpotBulle Immersion</span> - Expression • Geste technique • Orientation
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Votre plateforme pour des connexions authentiques France-Maroc
          </p>
        </div>
      </footer>
    </div>
  );
}
