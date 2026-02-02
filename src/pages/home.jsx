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

// ✅ AJOUT : Import du sélecteur de langue
import LanguageSelector from '../components/LanguageSelector.jsx';

// Composants temporaires pour les pages en développement
const SeminarsList = ({ user, setActiveTab }) => (
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

const Certification = ({ user, setActiveTab }) => (
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

// Import du vrai composant Questionnaire
import Questionnaire from '../components/Questionnaire.jsx';

// ✅ NOUVEAU: Navigation simplifiée
const simplifiedTabs = [
  { id: 'record', name: '🎥 Enregistrer', icon: '🎥', priority: 1, description: 'Créer une nouvelle vidéo' },
  { id: 'vault', name: '📁 Mes Vidéos', icon: '📁', priority: 2, description: 'Gérer toutes mes vidéos' },
  { id: 'dashboard', name: '📊 Tableau de bord', icon: '📊', priority: 3, description: 'Voir mes statistiques' },
  { id: 'profile', name: '👤 Profil', icon: '👤', priority: 4, description: 'Gérer mon compte' }
];

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
  const [activeTab, setActiveTab] = useState('record'); // ✅ CHANGEMENT: Par défaut sur l'enregistrement
  const [activeImmersionTab, setActiveImmersionTab] = useState('parcours');
  const [profileUpdated, setProfileUpdated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [hasCompletedQuestionnaire, setHasCompletedQuestionnaire] = useState(false);
  const [userJourney, setUserJourney] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  // ✅ NOUVEL ÉTAT : Langue sélectionnée
  const [selectedLanguage, setSelectedLanguage] = useState(null);

  const supabase = useSupabaseClient();
  const currentUser = useUser();

  // ✅ CORRECTION : Parcours utilisateur avec gestion robuste
  const userJourneySteps = [
    { id: 'profile', name: 'Compléter le profil', completed: false, priority: 1, section: 'profile' },
    { id: 'personality', name: 'Test personnalité', completed: false, priority: 2, section: 'personality' },
    { id: 'record', name: 'Enregistrer une vidéo', completed: false, priority: 3, section: 'record' },
    { id: 'vault', name: 'Coffre-fort vidéo', completed: false, priority: 4, section: 'vault' },
    { id: 'dashboard', name: 'Tableau de bord', completed: false, priority: 5, section: 'dashboard' }
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

  // ✅ Gestionnaire de changement de langue
  const handleLanguageChange = (languageCode) => {
    setSelectedLanguage(languageCode);
    toast.success(`Langue sélectionnée: ${languageCode || 'Détection automatique'}`);
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
    
    updateUserJourney('record', true);
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

  // ✅ CORRECTION : Utilisation de dominant_color comme il se doit
  const checkQuestionnaireStatus = async () => {
    if (!currentUser) return;

    try {
      console.log('🔍 Vérification du statut questionnaire pour:', currentUser.id);
      
      // ✅ CORRECTION : Utilisation de dominant_color uniquement
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('id, completed_at, dominant_color')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === '406' || error.message?.includes('406')) {
          console.log('ℹ️ Aucune réponse au questionnaire trouvée (erreur 406 normale)');
          setHasCompletedQuestionnaire(false);
          updateUserJourney('personality', false);
          return;
        }
        console.warn('⚠️ Avertissement vérification questionnaire:', error);
        return;
      }

      const hasCompleted = !!data?.completed_at;
      const dominantColor = data?.dominant_color;
      
      console.log('✅ Statut questionnaire:', hasCompleted ? 'Complété' : 'Non complété', 'Couleur:', dominantColor);
      
      setHasCompletedQuestionnaire(hasCompleted);
      updateUserJourney('personality', hasCompleted);
      
      // Stocker la couleur pour usage futur
      if (dominantColor) {
        localStorage.setItem('user_dominant_color', dominantColor);
      }
      
      if (!hasCompleted && !localStorage.getItem('questionnaire_shown')) {
        console.log('🎯 Affichage automatique du questionnaire dans 3 secondes');
        setTimeout(() => {
          setShowQuestionnaire(true);
          localStorage.setItem('questionnaire_shown', 'true');
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Erreur checkQuestionnaireStatus:', error);
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
      
      // ✅ CORRECTION : Vérification robuste du statut du coffre-fort
      const checkVaultStatus = async () => {
        try {
          const { data: videos, error } = await supabase
            .from('videos')
            .select('id')
            .eq('user_id', currentUser.id)
            .limit(1);
          
          if (error) {
            console.log('⚠️ Erreur vérification coffre-fort:', error);
            return;
          }
          
          if (videos && videos.length > 0) {
            updateUserJourney('vault', true);
            updateUserJourney('record', true);
          }
        } catch (error) {
          console.log('❌ Erreur vérification coffre-fort:', error);
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
                        {step.id === 'record' && 'Enregistrez votre première vidéo d\'expression'}
                        {step.id === 'vault' && 'Gérez et consultez toutes vos vidéos'}
                        {step.id === 'dashboard' && 'Suivez votre progression et statistiques'}
                      </p>
                    </div>
                    <div className="text-gray-400 text-sm">
                      {['profile', 'personality'].includes(step.id) && '3 min'}
                      {step.id === 'record' && '2 min'}
                      {['vault', 'dashboard'].includes(step.id) && '1 min'}
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

  // ✅ NOUVEAU: Navigation par actions rapides
  const renderQuickActions = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {simplifiedTabs
        .sort((a, b) => a.priority - b.priority)
        .map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg border-2 ${
              activeTab === tab.id ? 'border-blue-500 shadow-blue-500/20' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="text-3xl mb-3">{tab.icon}</div>
            <h3 className="text-xl font-bold mb-2">{tab.name}</h3>
            <p className="text-gray-300 text-sm">{tab.description}</p>
            {activeTab === tab.id && (
              <div className="mt-3 w-full bg-blue-500 h-1 rounded-full"></div>
            )}
          </div>
        ))}
    </div>
  );

  // ✅ CORRECTION : Contenu des onglets avec gestion robuste et intégration langue
  const renderTabContent = () => {
    switch (activeTab) {
      case 'record':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🎥 Enregistrer une Vidéo</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate('/personality-test')}
                  variant="outline"
                  className="flex items-center gap-2 border-cyan-500 text-cyan-300 hover:bg-cyan-900"
                >
                  🌐 Langue: {selectedLanguage || 'Auto'}
                </Button>
              </div>
            </div>
            
            {/* ✅ AFFICHAGE DU SÉLECTEUR DE LANGUE DANS L'ENREGISTREMENT */}
            <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
              <LanguageSelector 
                selectedLanguage={selectedLanguage}
                onLanguageChange={handleLanguageChange}
                showAutoDetect={true}
              />
            </div>

            <RecordVideo 
              user={user}
              onVideoUploaded={handleVideoUploaded}
              scenarios={recordingScenarios}
              selectedLanguage={selectedLanguage} // ✅ PASSAGE DE LA LANGUE SÉLECTIONNÉE
            />
          </div>
        );
      
      case 'vault':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">📁 Mon Coffre-fort Vidéo</h2>
              <Button
                onClick={() => setActiveTab('record')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                🎥 Nouvelle Vidéo
              </Button>
            </div>
            <VideoVault 
              user={user}
              profile={profile}
              onSignOut={onSignOut}
              onVideoAdded={handleVaultVideoAdded}
            />
          </div>
        );
      
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">📊 Tableau de Bord</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setActiveTab('record')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  🎥 Nouvelle Vidéo
                </Button>
                <Button
                  onClick={() => setActiveTab('vault')}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  📁 Mes Vidéos
                </Button>
              </div>
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
        return <SeminarsList user={user} setActiveTab={setActiveTab} />;
      
      case 'certification':
        return <Certification user={user} setActiveTab={setActiveTab} />;
      
      default:
        return (
          <RecordVideo 
            user={user}
            onVideoUploaded={handleVideoUploaded}
            scenarios={recordingScenarios}
            selectedLanguage={selectedLanguage} // ✅ PASSAGE DE LA LANGUE SÉLECTIONNÉE
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
        {/* ✅ NOUVEAU: Navigation par actions rapides */}
        {renderQuickActions()}

        {/* Indicateur d'étape suivante */}
        {nextStep && !nextStep.completed && activeTab !== nextStep.section && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg mb-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="font-semibold">Prochaine étape : {nextStep.name}</p>
                  <p className="text-sm opacity-90">
                    {nextStep.id === 'profile' && 'Complétez vos informations pour personnaliser votre expérience'}
                    {nextStep.id === 'personality' && 'Découvrez votre profil unique en 3 minutes'}
                    {nextStep.id === 'record' && 'Exprimez-vous devant la caméra avec nos scénarios guidés'}
                    {nextStep.id === 'vault' && 'Consultez et gérez toutes vos vidéos d\'expression'}
                    {nextStep.id === 'dashboard' && 'Suivez votre progression et obtenez des insights'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setActiveTab(nextStep.section)}
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
      </main>

      {/* ✅ NOUVEAU: Bouton d'action rapide flottant */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setActiveTab('record')}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg animate-pulse text-lg py-4 px-6 rounded-full flex items-center gap-2"
        >
          🎥 Nouvelle Vidéo
        </Button>
      </div>

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
