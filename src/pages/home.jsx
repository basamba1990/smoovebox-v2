// src/pages/home.jsx
import React, { useState, useEffect } from 'react';
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import ProfileForm from "../components/ProfileForm.jsx";
import ImmersionSimulator from '../components/ImmersionSimulator.jsx';
import VideoVault from './video-vault.jsx';
import { Button } from "../components/ui/button-enhanced.jsx";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

// Composants temporaires pour les pages en développement
const SeminarsList = ({ user }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-french font-bold text-white">🎓 Séminaires & Formations</h2>
      <Button
        onClick={() => setActiveTab('dashboard')}
        variant="outline"
        className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700"
      >
        ← Retour
      </Button>
    </div>
    <div className="card-spotbulle-dark p-8 text-center">
      <div className="text-6xl mb-4">🎓</div>
      <h3 className="text-xl font-semibold text-white mb-2">Séminaires SpotBulle</h3>
      <p className="text-gray-300 mb-4">
        Nos programmes de formation arrivent bientôt. Soyez prêt à développer vos compétences d'expression orale.
      </p>
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 inline-block">
        <p className="text-blue-300 text-sm">📅 Disponible prochainement</p>
      </div>
    </div>
  </div>
);

const Certification = ({ user }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-french font-bold text-white">🏆 Certification</h2>
      <Button
        onClick={() => setActiveTab('dashboard')}
        variant="outline"
        className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700"
      >
        ← Retour
      </Button>
    </div>
    <div className="card-spotbulle-dark p-8 text-center">
      <div className="text-6xl mb-4">🏆</div>
      <h3 className="text-xl font-semibold text-white mb-2">Certification SpotBulle</h3>
      <p className="text-gray-300 mb-4">
        Obtenez votre certification en expression orale et valorisez votre parcours d'apprentissage.
      </p>
      <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 inline-block">
        <p className="text-green-300 text-sm">🎯 Bientôt disponible - En cours de développement</p>
      </div>
    </div>
  </div>
);

// Composant Questionnaire temporaire
const Questionnaire = ({ onComplete, showSkip, isModal }) => (
  <div className="bg-gray-800 rounded-lg p-6">
    <h3 className="text-xl font-bold text-white mb-4">🎨 Test de Personnalité</h3>
    <p className="text-gray-300 mb-4">
      Découvrez votre profil unique pour des recommandations personnalisées.
    </p>
    <Button
      onClick={onComplete}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
    >
      Commencer le test
    </Button>
  </div>
);

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

  const supabase = useSupabaseClient();
  const currentUser = useUser();

  // ✅ CORRECTION : Parcours utilisateur avec gestion robuste
  const userJourneySteps = [
    { id: 'profile', name: 'Compléter le profil', completed: false, priority: 1, section: 'profile' },
    { id: 'personality', name: 'Test personnalité', completed: false, priority: 2, section: 'personality' },
    { id: 'immersion', name: 'Immersion simulateur', completed: false, priority: 3, section: 'immersion' },
    { id: 'expression', name: 'Expression orale', completed: false, priority: 4, section: 'expression' },
    { id: 'vault', name: 'Coffre-fort vidéo', completed: false, priority: 5, section: 'vault' },
    { id: 'restitution', name: 'Restitution & badge', completed: false, priority: 6, section: 'restitution' }
  ];

  // ✅ CORRECTION : Scénarios d'enregistrement
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

  // ✅ CORRECTION : Gestion robuste de l'upload vidéo
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

  // ✅ CORRECTION : Vérification du profil complété avec gestion d'erreur
  const isProfileComplete = profile && 
    profile.full_name && 
    profile.is_major !== null && 
    profile.passions && 
    profile.passions.length > 0;

  // ✅ CORRECTION : Vérification du questionnaire avec gestion robuste
  const checkQuestionnaireStatus = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('id, completed_at')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('Avertissement vérification questionnaire:', error);
        // Continuer sans bloquer
      }

      const hasCompleted = !!data?.completed_at;
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
      
      // Vérification du statut du coffre-fort
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

  // ✅ CORRECTION : Contenu d'immersion avec gestion d'erreur
  const renderImmersionContent = () => {
    switch (activeImmersionTab) {
      case 'parcours':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  id: 'concentration',
                  name: '🧠 Concentration',
                  description: 'Améliore ta capacité de concentration avant l\'enregistrement',
                  duration: '2-3 min',
                  color: 'from-blue-500 to-cyan-600'
                },
                {
                  id: 'confiance',
                  name: '💪 Confiance en soi', 
                  description: 'Développe ta confiance pour une meilleure expression',
                  duration: '2-3 min',
                  color: 'from-green-500 to-emerald-600'
                },
                {
                  id: 'relaxation',
                  name: '🌊 Relaxation',
                  description: 'Détends-toi pour une expression plus naturelle',
                  duration: '2-3 min',
                  color: 'from-purple-500 to-pink-600'
                }
              ].map((activity) => (
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

            <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
              <h3 className="text-xl font-french font-bold text-white mb-4">
                🧭 Votre Parcours SpotBulle
              </h3>
              
              <div className="space-y-4">
                {userJourney.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      step.completed ? 'bg-green-500' : 'bg-blue-500'
                    }`}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{step.name}</h4>
                      <p className="text-gray-300 text-sm">
                        {step.id === 'profile' && 'Complétez vos informations personnelles'}
                        {step.id === 'personality' && 'Découvrez votre profil émotionnel unique'}
                        {step.id === 'immersion' && 'Préparez-vous avec nos exercices d\'immersion'}
                        {step.id === 'expression' && 'Enregistrez votre première vidéo d\'expression'}
                        {step.id === 'vault' && 'Gérez et consultez toutes vos vidéos'}
                        {step.id === 'restitution' && 'Recevez votre analyse personnalisée'}
                      </p>
                    </div>
                    <div className="text-gray-400 text-sm">
                      {['profile', 'personality'].includes(step.id) && '3 min'}
                      {step.id === 'immersion' && '2-3 min'}
                      {step.id === 'expression' && '2 min'}
                      {['vault', 'restitution'].includes(step.id) && '1 min'}
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
              🎬 Scénarios d'Expression Orale
            </h3>
            
            {Object.entries(recordingScenarios).map(([ageGroup, scenarios]) => (
              <div key={ageGroup} className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
                <h4 className="text-lg font-semibold text-white mb-4 capitalize">
                  {ageGroup === 'enfants' ? '👦 Pour les Jeunes (8-12 ans)' : 
                   ageGroup === 'adolescents' ? '👨‍🎓 Pour les Adolescents (13-17 ans)' : 
                   '👨‍💼 Pour les Adultes (18+)'}
                </h4>
                <div className="space-y-3">
                  {scenarios.map((scenario, index) => (
                    <div key={index} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer"
                         onClick={() => {
                           setActiveTab('record');
                           toast.info(`Scénario sélectionné: ${scenario}`);
                         }}>
                      <p className="text-gray-200">{scenario}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-400">⏱️ 2 minutes maximum</span>
                        <Button size="sm" variant="outline" className="border-blue-500 text-blue-300 text-xs">
                          Utiliser ce scénario →
                        </Button>
                      </div>
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
            activity={{
              id: activeImmersionTab,
              name: activeImmersionTab === 'concentration' ? '🧠 Concentration' :
                    activeImmersionTab === 'confiance' ? '💪 Confiance en soi' : '🌊 Relaxation'
            }}
            onComplete={() => handleImmersionCompleted(activeImmersionTab)}
            onBack={() => setActiveImmersionTab('parcours')}
          />
        );
    }
  };

  // ✅ CORRECTION : Contenu des onglets avec gestion robuste
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
              <h2 className="text-2xl font-french font-bold text-white mb-4">
                🗺️ Votre Aventure SpotBulle
              </h2>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-200">Votre Progression</h3>
                  <span className="text-sm text-gray-400">
                    {userJourney.filter(s => s.completed).length} / {userJourney.length} étapes complétées
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
                        🎯 <strong>Test de personnalité</strong> - Découvrez votre profil unique et recevez des scénarios personnalisés.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowQuestionnaire(true)}
                      className="btn-spotbulle-dark bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      Découvrir mon profil
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
              <h2 className="text-2xl font-french font-bold text-white">🎮 Préparation & Immersion</h2>
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
              🎮 Préparation
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

            {/* ✅ CORRECTION : Onglets Certification et Séminaires activés */}
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
              🏆 Certification
            </Button>
            
            <Button
              onClick={handleNavigateToDirectory}
              className="btn-spotbulle-dark ml-auto"
            >
              👥 Explorer la communauté
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
                    <p className="text-sm opacity-90">
                      {nextStep.id === 'profile' && 'Complétez vos informations pour personnaliser votre expérience'}
                      {nextStep.id === 'personality' && 'Découvrez votre profil unique en 3 minutes'}
                      {nextStep.id === 'immersion' && 'Préparez-vous avec nos exercices d\'immersion'}
                      {nextStep.id === 'expression' && 'Exprimez-vous devant la caméra avec nos scénarios guidés'}
                      {nextStep.id === 'vault' && 'Consultez et gérez toutes vos vidéos d\'expression'}
                      {nextStep.id === 'restitution' && 'Recevez votre analyse personnalisée et vos badges'}
                    </p>
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
                  className="bg-white text-blue-600 hover:bg-gray-100 border-0 font-semibold"
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
