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

  // Thème : france ou maroc
  const [theme, setTheme] = useState("france");

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

  const handleVideoUploaded = () => {
    console.log('🔄 Home: Vidéo uploadée, incrémentation refreshKey');
    setRefreshKey(prev => prev + 1);
    toast.success('Vidéo uploadée avec succès !');
  };

  // Vérifier si le profil est complet
  const isProfileComplete =
    profile &&
    profile.genre &&
    profile.statut &&
    profile.centres_interet &&
    profile.centres_interet.length > 0;

  // Vérifier si le questionnaire est complété
  const checkQuestionnaireStatus = async () => {
    if (!currentUser) return;
    // TODO: ajouter la logique pour vérifier l’état du questionnaire
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
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  📝 <strong>Profil incomplet</strong> - Complétez votre profil pour accéder à toutes les fonctionnalités.
                </p>
              </div>
            )}
            <Dashboard
              user={user}
              refreshKey={refreshKey}
              dashboardData={dashboardData}
              dashboardLoading={dashboardLoading}
              dashboardError={dashboardError}
              loadDashboardData={loadDashboardData}
            />
          </div>
        );

      case 'record':
        return <RecordVideo onVideoUploaded={handleVideoUploaded} />;

      case 'profile':
        return <ProfileForm profile={profile} onProfileUpdated={handleProfileUpdated} />;

      case 'seminars':
        return <SeminarsList />;

      case 'certification':
        return <Certification />;

      default:
        return <p className="text-gray-500">Sélectionnez un onglet.</p>;
    }
  };

  // 🎨 Définir la classe du gradient selon le thème choisi
  const themeBackground =
    theme === "france"
      ? "bg-gradient-to-br from-france-50 via-france-200 to-france-300"
      : "bg-gradient-to-br from-maroc-50 via-maroc-300 to-maroc-100";

  return (
    <div className={`app-container min-h-screen ${themeBackground} dark:from-gray-900 dark:to-gray-800`}>
      {/* Header */}
      <ProfessionalHeader
        user={user}
        profile={profile}
        connectionStatus={connectionStatus}
        onSignOut={onSignOut}
      />

      {/* Toggle France / Maroc */}
      <div className="flex justify-center mt-4">
        <Button
          onClick={() => setTheme(theme === "france" ? "maroc" : "france")}
        >
          {theme === "france" ? "🇲🇦 Passer au thème Maroc" : "🇫🇷 Passer au thème France"}
        </Button>
      </div>

      {/* Navigation tabs */}
      <div className="flex justify-center space-x-4 mt-6">
        <Button onClick={() => setActiveTab('dashboard')}>Dashboard</Button>
        <Button onClick={() => setActiveTab('record')}>Enregistrer</Button>
        <Button onClick={() => setActiveTab('profile')}>Profil</Button>
        <Button onClick={() => setActiveTab('seminars')}>Séminaires</Button>
        <Button onClick={() => setActiveTab('certification')}>Certification</Button>
      </div>

      {/* Contenu dynamique */}
      <div className="p-6">{renderTabContent()}</div>

      {/* Bouton annuaire */}
      <div className="fixed bottom-6 right-6">
        <Button onClick={handleNavigateToDirectory}>📖 Annuaire</Button>
      </div>

      {/* Questionnaire modal */}
      {showQuestionnaire && (
        <Questionnaire onComplete={handleQuestionnaireComplete} />
      )}
    </div>
  );
}
