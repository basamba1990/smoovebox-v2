// src/pages/home.jsx
import React, { useState, useEffect } from 'react';
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import ProfileForm from "../components/ProfileForm.jsx";
import SeminarsList from "../components/SeminarsList.jsx";
import Certification from "../components/Certification.jsx";
import { Button } from "../components/ui/button-enhanced.jsx";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const [activeTab, setActiveTab] = useState('dashboard'); // Par défaut sur dashboard
  const [profileUpdated, setProfileUpdated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNavigateToDirectory = () => {
    navigate('/directory');
  };

  const handleProfileUpdated = () => {
    setProfileUpdated(true);
    toast.success('Profil mis à jour avec succès !');
    // Déclencher un rechargement des données
    setRefreshKey(prev => prev + 1);
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  const handleVideoUploaded = () => {
    // Recharger les données du dashboard après upload vidéo
    setRefreshKey(prev => prev + 1);
    if (loadDashboardData) {
      setTimeout(() => {
        loadDashboardData();
      }, 2000);
    }
    toast.success('Vidéo uploadée avec succès!');
  };

  // Vérifier si le profil est complet
  const isProfileComplete = profile && 
    profile.genre && 
    profile.statut && 
    profile.centres_interet && 
    profile.centres_interet.length > 0;

  // Effet pour basculer vers l'onglet profil si incomplet
  useEffect(() => {
    if (!isProfileComplete && user) {
      setActiveTab('profile');
      toast.info('Veuillez compléter votre profil pour profiter de toutes les fonctionnalités');
    }
  }, [isProfileComplete, user]);

  return (
    <div className="app-container min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <ProfessionalHeader 
        user={user} 
        profile={profile} 
        connectionStatus={connectionStatus} 
        onSignOut={onSignOut} 
      />
      
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Bouton pour l'annuaire */}
        <div className="mb-6 flex justify-end">
          <Button 
            onClick={handleNavigateToDirectory}
            className="bg-primary-600 hover:bg-primary-700 text-white"
          >
            📋 Voir l'Annuaire
          </Button>
        </div>

        {/* Indicateur de profil incomplet */}
        {!isProfileComplete && user && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Profil incomplet
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Complétez votre profil pour accéder à toutes les fonctionnalités de SpotBulle.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onglets */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              {[
                { id: 'dashboard', label: '📊 Tableau de Bord', icon: '📊' },
                { id: 'record', label: '🎥 Enregistrer une vidéo', icon: '🎥' },
                { id: 'profile', label: '👤 Profil', icon: '👤' },
                { id: 'seminars', label: '🎓 Séminaires', icon: '🎓' },
                { id: 'certification', label: '🏆 Certification', icon: '🏆' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'dashboard' && (
              <Dashboard 
                refreshKey={refreshKey}
                onDataUpdate={loadDashboardData}
              />
            )}
            {activeTab === 'record' && (
              <RecordVideo 
                onVideoUploaded={handleVideoUploaded}
                user={user}
                profile={profile}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileForm 
                user={user}
                profile={profile}
                onProfileUpdated={handleProfileUpdated}
              />
            )}
            {activeTab === 'seminars' && (
              <SeminarsList />
            )}
            {activeTab === 'certification' && (
              <Certification />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
