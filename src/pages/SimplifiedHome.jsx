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

// ✅ Navigation simplifiée
const simplifiedTabs = [
  { id: 'record', name: '🎥 Enregistrer', icon: '🎥', priority: 1, description: 'Créer une nouvelle vidéo' },
  { id: 'vault', name: '📁 Mes Vidéos', icon: '📁', priority: 2, description: 'Gérer toutes mes vidéos' },
  { id: 'dashboard', name: '📊 Tableau de bord', icon: '📊', priority: 3, description: 'Voir mes statistiques' },
  { id: 'profile', name: '👤 Profil', icon: '👤', priority: 4, description: 'Gérer mon compte' }
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
  const [activeTab, setActiveTab] = useState('record'); // ✅ Par défaut sur l'enregistrement
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [userStats, setUserStats] = useState(null);

  const supabase = useSupabaseClient();

  // ✅ Chargement des statistiques utilisateur
  useEffect(() => {
    const loadUserStats = async () => {
      if (!user) return;

      try {
        const { data: videos, error } = await supabase
          .from('videos')
          .select('id, status, created_at')
          .eq('user_id', user.id);

        if (error) throw error;

        const stats = {
          totalVideos: videos?.length || 0,
          recentVideos: videos?.slice(0, 3) || [],
          completedVideos: videos?.filter(v => v.status === 'analyzed').length || 0
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

  // ✅ Navigation par actions rapides
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

  // ✅ Statistiques rapides
  const renderQuickStats = () => {
    if (!userStats) return null;

    return (
      <div className="grid grid-cols-3 gap-4 mb-6">
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
      </div>
    );
  };

  // ✅ Contenu des onglets
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
