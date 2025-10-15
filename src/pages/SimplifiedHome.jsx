// src/pages/SimplifiedHome.jsx
import React, { useState, useEffect } from 'react';
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import ProfileForm from "../components/ProfileForm.jsx";
import VideoVault from './video-vault.jsx';
import { Button } from "../components/ui/button-enhanced.jsx";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

// ✅ AJOUT DES IMPORTS MANQUANTS
import Questionnaire from '../components/Questionnaire.jsx';
import SeminarsList from '../components/SeminarsList.jsx';
import Certification from '../components/Certification.jsx';
import ImmersionSimulator from '../components/ImmersionSimulator.jsx';

// ✅ Navigation simplifiée complète
const simplifiedTabs = [
  { id: 'record', name: '🎥 Enregistrer', icon: '🎥', priority: 1, description: 'Créer une nouvelle vidéo' },
  { id: 'vault', name: '📁 Mes Vidéos', icon: '📁', priority: 2, description: 'Gérer toutes mes vidéos' },
  { id: 'dashboard', name: '📊 Tableau de bord', icon: '📊', priority: 3, description: 'Voir mes statistiques' },
  { id: 'profile', name: '👤 Profil', icon: '👤', priority: 4, description: 'Gérer mon compte' },
  { id: 'more', name: '➕ Plus', icon: '➕', priority: 5, description: 'Autres fonctionnalités' }
];

export default function SimplifiedHome({ 
  user, 
  profile, 
  connectionStatus, 
  onSignOut, 
  dashboardData, 
  loading, 
  error, 
  loadDashboardData,
  onProfileUpdated
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('record');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [userStats, setUserStats] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('main'); // Pour l'onglet "Plus"
  const [activeImmersionTab, setActiveImmersionTab] = useState('parcours');

  const supabase = useSupabaseClient();

  // ✅ Chargement des statistiques utilisateur
  useEffect(() => {
    const loadUserStats = async () => {
      if (!user) return;

      try {
        const { data: videos, error } = await supabase
          .from('videos')
          .select('id, status, created_at, title')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const stats = {
          totalVideos: videos?.length || 0,
          recentVideos: videos?.slice(0, 3) || [],
          completedVideos: videos?.filter(v => v.status === 'analyzed').length || 0,
          processingVideos: videos?.filter(v => v.status === 'processing' || v.status === 'analyzing').length || 0
        };

        setUserStats(stats);
      } catch (err) {
        console.error('❌ Erreur chargement stats:', err);
      }
    };

    loadUserStats();
  }, [user, supabase, refreshKey]);

  const handleVideoUploaded = () => {
    console.log('🔄 Vidéo uploadée, rechargement des données');
    setRefreshKey(prev => prev + 1);
    toast.success('Vidéo uploadée avec succès !');
    
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  const handleProfileUpdated = () => {
    toast.success('Profil mis à jour !');
    if (onProfileUpdated) {
      onProfileUpdated();
    }
  };

  const handleQuestionnaireComplete = () => {
    setShowQuestionnaire(false);
    toast.success('Questionnaire complété ! Votre profil est maintenant enrichi.');
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  // ✅ Scénarios d'enregistrement
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

  // ✅ Navigation par actions rapides
  const renderQuickActions = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {simplifiedTabs
        .sort((a, b) => a.priority - b.priority)
        .map((tab) => (
          <div
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'more') {
                setActiveSubTab('main');
              }
            }}
            className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg border-2 ${
              activeTab === tab.id ? 'border-blue-500 shadow-blue-500/20' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="text-2xl mb-2">{tab.icon}</div>
            <h3 className="text-lg font-bold mb-1">{tab.name}</h3>
            <p className="text-gray-300 text-xs">{tab.description}</p>
            {activeTab === tab.id && (
              <div className="mt-2 w-full bg-blue-500 h-1 rounded-full"></div>
            )}
          </div>
        ))}
    </div>
  );

  // ✅ Statistiques rapides
  const renderQuickStats = () => {
    if (!userStats || userStats.totalVideos === 0) return null;

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-900/30 rounded-lg p-4 text-center border border-blue-700">
          <div className="text-2xl font-bold text-white">{userStats.totalVideos}</div>
          <div className="text-blue-300 text-sm">Total Vidéos</div>
        </div>
        <div className="bg-green-900/30 rounded-lg p-4 text-center border border-green-700">
          <div className="text-2xl font-bold text-white">{userStats.completedVideos}</div>
          <div className="text-green-300 text-sm">Analysées</div>
        </div>
        <div className="bg-purple-900/30 rounded-lg p-4 text-center border border-purple-700">
          <div className="text-2xl font-bold text-white">{userStats.recentVideos.length}</div>
          <div className="text-purple-300 text-sm">Récentes</div>
        </div>
        <div className="bg-yellow-900/30 rounded-lg p-4 text-center border border-yellow-700">
          <div className="text-2xl font-bold text-white">{userStats.processingVideos}</div>
          <div className="text-yellow-300 text-sm">En traitement</div>
        </div>
      </div>
    );
  };

  // ✅ Contenu de l'onglet "Plus"
  const renderMoreContent = () => {
    switch (activeSubTab) {
      case 'seminars':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🎓 Séminaires & Formations</h2>
              <Button
                onClick={() => setActiveSubTab('main')}
                variant="outline"
                className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                ← Retour
              </Button>
            </div>
            <SeminarsList 
              user={user}
              profile={profile}
              onSignOut={onSignOut}
            />
          </div>
        );

      case 'certification':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🏆 Certification</h2>
              <Button
                onClick={() => setActiveSubTab('main')}
                variant="outline"
                className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                ← Retour
              </Button>
            </div>
            <Certification 
              user={user}
              profile={profile}
              onSignOut={onSignOut}
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
                  onClick={() => setActiveSubTab('main')}
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

      default:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">➕ Fonctionnalités Avancées</h2>
              <Button
                onClick={() => setActiveTab('record')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                🎥 Nouvelle Vidéo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div 
                onClick={() => setActiveSubTab('seminars')}
                className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg"
              >
                <div className="text-3xl mb-3">🎓</div>
                <h3 className="text-xl font-bold mb-2">Séminaires</h3>
                <p className="text-white/90 text-sm">Formations et ateliers pour développer vos compétences</p>
              </div>

              <div 
                onClick={() => setActiveSubTab('certification')}
                className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg"
              >
                <div className="text-3xl mb-3">🏆</div>
                <h3 className="text-xl font-bold mb-2">Certification</h3>
                <p className="text-white/90 text-sm">Obtenez votre certification en expression orale</p>
              </div>

              <div 
                onClick={() => setActiveSubTab('immersion')}
                className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg"
              >
                <div className="text-3xl mb-3">🎮</div>
                <h3 className="text-xl font-bold mb-2">Préparation</h3>
                <p className="text-white/90 text-sm">Exercices d'immersion et scénarios guidés</p>
              </div>

              <div 
                onClick={() => navigate('/directory')}
                className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg"
              >
                <div className="text-3xl mb-3">👥</div>
                <h3 className="text-xl font-bold mb-2">Communauté</h3>
                <p className="text-white/90 text-sm">Rencontrez d'autres passionnés</p>
              </div>

              <div 
                onClick={() => setShowQuestionnaire(true)}
                className="bg-gradient-to-br from-pink-600 to-pink-700 rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg"
              >
                <div className="text-3xl mb-3">🎨</div>
                <h3 className="text-xl font-bold mb-2">Test Personnalité</h3>
                <p className="text-white/90 text-sm">Découvrez votre profil unique</p>
              </div>

              <div 
                onClick={() => navigate('/personality-test')}
                className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg"
              >
                <div className="text-3xl mb-3">🌈</div>
                <h3 className="text-xl font-bold mb-2">Test 4 Couleurs</h3>
                <p className="text-white/90 text-sm">Analyse complète de votre personnalité</p>
              </div>
            </div>
          </div>
        );
    }
  };

  // ✅ Contenu de l'immersion
  const renderImmersionContent = () => {
    switch (activeImmersionTab) {
      case 'parcours':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  onClick={() => {
                    // Pour l'instant, on redirige vers l'enregistrement avec un message
                    setActiveTab('record');
                    toast.info(`Activité ${activity.name} sélectionnée`);
                  }}
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
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-white mb-2">Module d'Immersion</h3>
            <p className="text-gray-300 mb-4">
              Préparez-vous à l'enregistrement avec nos exercices d'immersion
            </p>
            <Button
              onClick={() => setActiveImmersionTab('parcours')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Commencer l'immersion
            </Button>
          </div>
        );
    }
  };

  // ✅ Contenu des onglets principaux
  const renderTabContent = () => {
    switch (activeTab) {
      case 'record':
        return (
          <RecordVideo 
            user={user}
            onVideoUploaded={handleVideoUploaded}
          />
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
              onVideoAdded={handleVideoUploaded}
            />
          </div>
        );
      
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">📊 Tableau de Bord Complet</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setActiveTab('record')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  🎥 Nouvelle Vidéo
                </Button>
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  📈 Vue détaillée
                </Button>
              </div>
            </div>
            
            <Dashboard 
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
      
      case 'more':
        return renderMoreContent();
      
      default:
        return (
          <RecordVideo 
            user={user}
            onVideoUploaded={handleVideoUploaded}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
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
        {/* En-tête de bienvenue */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-french font-bold text-white mb-2">
            🎯 Bienvenue{profile?.full_name ? `, ${profile.full_name}` : ''} !
          </h1>
          <p className="text-gray-300 text-lg">
            Que souhaitez-vous faire aujourd'hui ?
          </p>
        </div>

        {/* ✅ Navigation par actions rapides */}
        {renderQuickActions()}

        {/* ✅ Statistiques rapides */}
        {userStats && userStats.totalVideos > 0 && renderQuickStats()}

        {/* ✅ Indicateur pour nouvelle utilisateur */}
        {userStats && userStats.totalVideos === 0 && activeTab !== 'record' && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg mb-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎥</span>
                <div>
                  <p className="font-semibold">Commencez par enregistrer votre première vidéo !</p>
                  <p className="text-sm opacity-90">
                    Exprimez-vous devant la caméra et découvrez l'analyse automatique de votre contenu.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setActiveTab('record')}
                className="bg-white text-blue-600 hover:bg-gray-100 border-0 font-semibold"
              >
                🎥 Commencer
              </Button>
            </div>
          </div>
        )}

        {/* Contenu de l'onglet */}
        <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700 rounded-xl">
          {renderTabContent()}
        </div>
      </main>

      {/* ✅ Bouton d'action rapide flottant */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setActiveTab('record')}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-lg py-4 px-6 rounded-full flex items-center gap-2 animate-bounce"
        >
          🎥 Nouvelle Vidéo
        </Button>
      </div>

      {/* ✅ Modal Questionnaire */}
      {showQuestionnaire && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">🎨 Test de Personnalité</h2>
                <Button
                  onClick={() => setShowQuestionnaire(false)}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  ✕ Fermer
                </Button>
              </div>
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
            <span className="gradient-text-dark font-french">SpotBulle Express</span> - Simple • Rapide • Efficace
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Navigation simplifiée pour une expérience optimale
          </p>
        </div>
      </footer>
    </div>
  );
}
