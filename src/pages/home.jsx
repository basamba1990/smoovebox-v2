// src/pages/home.jsx
import React, { useState, useEffect } from 'react';
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import ProfileForm from "../components/ProfileForm.jsx";
import SeminarsList from "../components/SeminarsList.jsx";
import Certification from "../components/Certification.jsx";
import Questionnaire from "../components/Questionnaire.jsx";
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
  const [profileUpdated, setProfileUpdated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [hasCompletedQuestionnaire, setHasCompletedQuestionnaire] = useState(false);

  const supabase = useSupabaseClient();
  const currentUser = useUser();

  const handleNavigateToDirectory = () => {
    navigate('/directory');
  };

  const handleProfileUpdated = () => {
    setProfileUpdated(true);
    toast.success('Profil mis à jour avec succès !');
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  // CORRECTION : Fonction améliorée pour le rechargement après upload
  const handleVideoUploaded = () => {
    console.log('🔄 Home: Vidéo uploadée, incrémentation refreshKey');
    setRefreshKey(prev => prev + 1);
    toast.success('Vidéo uploadée avec succès !');
  };

  // Vérifier si le profil est complet
  const isProfileComplete = profile && 
    profile.sex && 
    profile.is_major !== null && 
    profile.passions && 
    profile.passions.length > 0;

  // Vérifier si le questionnaire est complété
  const checkQuestionnaireStatus = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('id, completed_at')
        .eq('user_id', currentUser.id)
        .single();

      setHasCompletedQuestionnaire(!!data);
      
      // Afficher le questionnaire si pas complété et c'est la première visite
      if (!data && !localStorage.getItem('questionnaire_shown')) {
        setTimeout(() => {
          setShowQuestionnaire(true);
          localStorage.setItem('questionnaire_shown', 'true');
        }, 3000);
      }
    } catch (error) {
      setHasCompletedQuestionnaire(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      checkQuestionnaireStatus();
    }
  }, [currentUser]);

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
    toast.success('Questionnaire complété ! Votre profil est maintenant enrichi.');
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {!isProfileComplete && (
              <div className="bg-yellow-2 border border-yellow-4 rounded-lg p-4 mb-6">
                <p className="text-yellow-11 text-sm">
                  📝 <strong>Profil incomplet</strong> - Complétez votre profil pour accéder à toutes les fonctionnalités.
                </p>
              </div>
            )}
            
            {!hasCompletedQuestionnaire && (
              <div className="bg-france-2 border border-france-4 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-france-11 text-sm">
                      🎯 <strong>Questionnaire de personnalité</strong> - Complétez le questionnaire pour améliorer vos connexions.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowQuestionnaire(true)}
                    className="btn-spotbulle"
                    size="sm"
                  >
                    Commencer le questionnaire
                  </Button>
                </div>
              </div>
            )}
            
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
              <h2 className="text-2xl font-bold text-gray-11 font-french">Mon Profil</h2>
              <Button
                onClick={() => setShowQuestionnaire(true)}
                variant="outline"
                className="flex items-center gap-2 border-france-5 text-france-11 hover:bg-france-3"
              >
                📝 Questionnaire de personnalité
              </Button>
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
    <div className="app-container min-h-screen bg-gradient-to-br from-france-2 via-white to-maroc-2 dark:from-gray-11 dark:via-gray-10 dark:to-gray-11">
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
              className="flex items-center gap-2 btn-spotbulle"
            >
              📊 Tableau de bord
            </Button>
            
            <Button
              variant={activeTab === 'record' ? 'default' : 'outline'}
              onClick={() => setActiveTab('record')}
              className="flex items-center gap-2 btn-spotbulle"
            >
              🎥 Enregistrer une vidéo
            </Button>
            
            <Button
              variant={activeTab === 'profile' ? 'default' : 'outline'}
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 btn-spotbulle"
            >
              👤 Mon profil
            </Button>
            
            <Button
              variant={activeTab === 'seminars' ? 'default' : 'outline'}
              onClick={() => setActiveTab('seminars')}
              className="flex items-center gap-2 btn-spotbulle"
            >
              🎓 Séminaires
            </Button>
            
            <Button
              variant={activeTab === 'certification' ? 'default' : 'outline'}
              onClick={() => setActiveTab('certification')}
              className="flex items-center gap-2 btn-spotbulle"
            >
              📜 Certification
            </Button>
            
            <Button
              onClick={handleNavigateToDirectory}
              className="flex items-center gap-2 ml-auto bg-white text-france-11 border border-france-11 hover:bg-france-11 hover:text-white transition-all font-medium py-2 px-4 rounded-lg"
            >
              👥 Annuaire
            </Button>
          </div>

          {/* Tab Content */}
          <div className="card-spotbulle p-6">
            {renderTabContent()}
          </div>
        </div>
      </main>

      {/* Modal Questionnaire */}
      {showQuestionnaire && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-4">
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

      {/* Loading State */}
      {dashboardLoading && activeTab === 'dashboard' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-2xl border border-gray-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-france-11"></div>
            <span className="text-gray-11">Chargement des données...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {dashboardError && activeTab === 'dashboard' && (
        <div className="bg-red-2 border border-red-4 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-11">
            <span>⚠️</span>
            <div>
              <strong>Erreur lors du chargement :</strong>
              <p className="text-sm">{dashboardError}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadDashboardData}
              className="ml-auto border-red-5 text-red-11 hover:bg-red-3"
            >
              Réessayer
            </Button>
          </div>
        </div>
      )}

      {/* Footer avec thème France-Maroc */}
      <footer className="mt-12 py-6 border-t border-gray-4/50 dark:border-gray-9/50 bg-gradient-to-r from-france-2 to-maroc-2">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center items-center gap-4 mb-4">
            <div className="w-8 h-8 bg-france-11 rounded-full shadow-france"></div>
            <div className="w-8 h-8 bg-white border border-gray-5 rounded-full shadow-lg"></div>
            <div className="w-8 h-8 bg-maroc-11 rounded-full shadow-maroc"></div>
          </div>
          <p className="text-gray-11 dark:text-gray-4 text-sm font-medium">
            <span className="gradient-text-france-maroc font-french">SpotBulle</span> - Communauté France-Maroc • Partager, inspirer, connecter
          </p>
          <p className="text-gray-10 dark:text-gray-5 text-xs mt-2">
            🇫🇷🇲🇦 Rejoignez la communauté franco-marocaine des passionnés
          </p>
        </div>
      </footer>
    </div>
  );
}
