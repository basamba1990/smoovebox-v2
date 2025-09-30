// src/pages/home.jsx
import React, { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('record');
  const [profileUpdated, setProfileUpdated] = useState(false);

  const handleNavigateToDirectory = () => {
    navigate('/directory');
  };

  const handleProfileUpdated = () => {
    setProfileUpdated(true);
    toast.success('Profil mis à jour avec succès !');
    // Recharger les données du dashboard si nécessaire
    if (loadDashboardData) {
      loadDashboardData();
    }
  };

  const handleVideoUploaded = () => {
    // Recharger les données du dashboard après upload vidéo
    if (loadDashboardData) {
      setTimeout(() => {
        loadDashboardData();
      }, 2000);
    }
  };

  // Vérifier si le profil est complet
  const isProfileComplete = profile && 
    profile.genre && 
    profile.statut && 
    profile.centres_interet && 
    profile.centres_interet.length > 0;

  return (
    <div className="app-container min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <ProfessionalHeader 
        user={user} 
        profile={profile} 
        connectionStatus={connectionStatus} 
        onSignOut={onSignOut} 
      />

      {/* Bannière d'accueil */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 md:p-8 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                🌟 Bienvenue sur SpotBulle France–Maroc
              </h1>
              <p className="text-sm md:text-base opacity-90">
                Innovation Éducative et Networking Sportif - Révélons vos talents
              </p>
            </div>
            {!isProfileComplete && (
              <div className="bg-yellow-500 text-yellow-900 px-4 py-2 rounded-lg text-sm font-semibold">
                ⚡ Complétez votre profil
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex border-b border-primary-200 dark:border-gray-700 overflow-x-auto">
          <button
            className={`flex-shrink-0 py-3 px-6 font-medium text-sm md:text-base transition-colors whitespace-nowrap ${
              activeTab === 'record'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-primary-500 hover:text-primary-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('record')}
          >
            🎥 Expression sous la bulle
          </button>
          <button
            className={`flex-shrink-0 py-3 px-6 font-medium text-sm md:text-base transition-colors whitespace-nowrap ${
              activeTab === 'profile'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-primary-500 hover:text-primary-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('profile')}
          >
            👤 Carte d'identité SpotBulle
          </button>
          <button
            className={`flex-shrink-0 py-3 px-6 font-medium text-sm md:text-base transition-colors whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-primary-500 hover:text-primary-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Mon portfolio vivant
          </button>
          <button
            className={`flex-shrink-0 py-3 px-6 font-medium text-sm md:text-base transition-colors whitespace-nowrap ${
              activeTab === 'seminars'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-primary-500 hover:text-primary-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('seminars')}
          >
            🎓 Séminaires
          </button>
          <button
            className={`flex-shrink-0 py-3 px-6 font-medium text-sm md:text-base transition-colors whitespace-nowrap ${
              activeTab === 'certification'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-primary-500 hover:text-primary-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('certification')}
          >
            🏆 Certification
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Section d'actions rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-center border border-primary-200 dark:border-gray-700">
            <div className="bg-primary-100 dark:bg-primary-900 p-3 rounded-lg mr-4">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h3 className="font-semibold text-primary-900 dark:text-white">Profil SpotBulle</h3>
              <p className="text-sm text-primary-600 dark:text-primary-400">
                {isProfileComplete ? 'Profil complet ✓' : 'Complétez votre carte d\'identité'}
              </p>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-center border border-primary-200 dark:border-gray-700">
            <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg mr-4">
              <span className="text-2xl">🤝</span>
            </div>
            <div>
              <h3 className="font-semibold text-primary-900 dark:text-white">Réseau France-Maroc</h3>
              <p className="text-sm text-primary-600 dark:text-primary-400">Connectez-vous à la communauté</p>
            </div>
          </div>
          
          <div 
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-center cursor-pointer hover:shadow-lg transition-shadow border border-primary-200 dark:border-gray-700"
            onClick={handleNavigateToDirectory}
          >
            <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg mr-4">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <h3 className="font-semibold text-primary-900 dark:text-white">Annuaire des Talents</h3>
              <p className="text-sm text-primary-600 dark:text-primary-400">Découvrez les participants</p>
            </div>
          </div>
        </div>

        {/* Contenu selon l'onglet actif */}
        {activeTab === 'record' ? (
          <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-4 md:p-6 mb-6 border border-primary-200 dark:border-gray-700">
            <div className="flex items-center mb-6">
              <div className="bg-primary-100 dark:bg-primary-900 p-2 rounded-lg mr-4">
                <span className="text-2xl">🎥</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-900 dark:text-white">
                  Expression sous la bulle - Premier Pitch
                </h2>
                <p className="text-primary-600 dark:text-primary-400">
                  Exprimez vos rêves, besoins et projections "dans 5 ans"
                </p>
              </div>
            </div>
            
            <RecordVideo onVideoUploaded={handleVideoUploaded} />
            
            <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <h3 className="font-semibold mb-2 text-primary-800 dark:text-primary-200">
                💡 Conseil SpotBulle
              </h3>
              <p className="text-sm text-primary-700 dark:text-primary-300">
                Soyez authentique et passionné ! Votre vidéo sera analysée par notre IA pour vous offrir 
                une expérience personnalisée et vous connecter avec la communauté France–Maroc.
                Notre capsule immersive révèle vos talents cachés.
              </p>
            </div>
          </div>
        ) : activeTab === 'profile' ? (
          <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-4 md:p-6 mb-6 border border-primary-200 dark:border-gray-700">
            <div className="flex items-center mb-6">
              <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg mr-4">
                <span className="text-2xl">👤</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-900 dark:text-white">
                  Carte d'identité SpotBulle
                </h2>
                <p className="text-primary-600 dark:text-primary-400">
                  Complétez votre profil pour créer votre portfolio vivant
                </p>
              </div>
            </div>
            
            <ProfileForm onProfileUpdated={handleProfileUpdated} />
            
            {!isProfileComplete && (
              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h3 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                  ⚡ Important pour votre expérience SpotBulle
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Un profil complet vous permet de bénéficier de toutes les fonctionnalités 
                  de la plateforme et d'être correctement référencé dans l'annuaire France-Maroc.
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'dashboard' ? (
          <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-4 md:p-6 mb-6 border border-primary-200 dark:border-gray-700">
            <div className="flex items-center mb-6">
              <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg mr-4">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-900 dark:text-white">
                  Mon Portfolio Vivant SpotBulle
                </h2>
                <p className="text-primary-600 dark:text-primary-400">
                  Suivez votre évolution dans le programme France–Maroc
                </p>
              </div>
            </div>

            {dashboardLoading ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <p className="mt-3 text-primary-600 dark:text-primary-400">Chargement de vos données...</p>
              </div>
            ) : dashboardError ? (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400 mb-3">Erreur : {dashboardError}</p>
                <Button 
                  onClick={loadDashboardData}
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                >
                  Réessayer
                </Button>
              </div>
            ) : !dashboardData || dashboardData.totalVideos === 0 ? (
              <div className="text-center py-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <div className="text-5xl mb-4">🎬</div>
                <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-200 mb-2">
                  Commencez votre aventure SpotBulle
                </h3>
                <p className="text-primary-600 dark:text-primary-400 mb-4">
                  Enregistrez votre première vidéo pour démarrer votre parcours et créer votre portfolio vivant.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button 
                    onClick={() => setActiveTab('record')}
                    className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white"
                  >
                    Première Vidéo
                  </Button>
                  {!isProfileComplete && (
                    <Button 
                      onClick={() => setActiveTab('profile')}
                      className="bg-purple-500 hover:bg-purple-600 text-white"
                    >
                      Compléter le profil
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Dashboard 
                dashboardData={dashboardData}
                loading={dashboardLoading}
                error={dashboardError}
                onRetry={loadDashboardData}
              />
            )}
          </div>
        ) : activeTab === 'seminars' ? (
          <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-4 md:p-6 mb-6 border border-primary-200 dark:border-gray-700">
            <div className="flex items-center mb-6">
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg mr-4">
                <span className="text-2xl">🎓</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-900 dark:text-white">
                  Séminaires SpotBulle
                </h2>
                <p className="text-primary-600 dark:text-primary-400">
                  Participez à nos formations "Citoyen des Deux Rives" et développez vos compétences
                </p>
              </div>
            </div>
            
            <SeminarsList />
          </div>
        ) : activeTab === 'certification' ? (
          <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-4 md:p-6 mb-6 border border-primary-200 dark:border-gray-700">
            <div className="flex items-center mb-6">
              <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-lg mr-4">
                <span className="text-2xl">🏆</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-900 dark:text-white">
                  Certification SpotBulle
                </h2>
                <p className="text-primary-600 dark:text-primary-400">
                  Recevez votre diplôme et rejoignez le réseau international France-Maroc
                </p>
              </div>
            </div>
            
            <Certification />
          </div>
        ) : null}

        {/* Section Programme SpotBulle */}
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-6 mb-6 border border-primary-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-primary-900 dark:text-white mb-4 flex items-center">
            <span className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-2 rounded-lg mr-3">🇫🇷🇲🇦</span>
            Programme SpotBulle France–Maroc - Innovation Éducative
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg border border-primary-200 dark:border-primary-800">
              <h3 className="font-semibold text-primary-800 dark:text-primary-200 mb-2 flex items-center">
                <span className="bg-primary-500 text-white p-1 rounded mr-2">1</span>
                Expression sous la bulle
              </h3>
              <p className="text-sm text-primary-700 dark:text-primary-300">
                Pitch vidéo + questionnaire personnalisé - Créez votre carte d'identité SpotBulle
              </p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center">
                <span className="bg-green-500 text-white p-1 rounded mr-2">2</span>
                Analyse plateforme IA
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Intelligence artificielle + retour expert pour identifier vos forces et talents
              </p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center">
                <span className="bg-purple-500 text-white p-1 rounded mr-2">3</span>
                Séminaire citoyen
              </h3>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Formation aux compétences du XXI° siècle - "Citoyen des deux rives"
              </p>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center">
                <span className="bg-amber-500 text-white p-1 rounded mr-2">4</span>
                Certification & Réseau
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Diplôme SpotBulle Certified + réseau international + agent IA personnalisé
              </p>
            </div>
          </div>
        </div>

        {/* CTA pour l'annuaire */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-2xl shadow-lg text-center">
          <h2 className="text-xl font-bold mb-3">Rejoignez l'annuaire des talents SpotBulle</h2>
          <p className="mb-4 opacity-90">
            Découvrez les autres participants et créez des connections dans la communauté France–Maroc
          </p>
          <Button 
            onClick={handleNavigateToDirectory}
            className="bg-white text-primary-600 hover:bg-primary-50 font-semibold"
          >
            🌍 Explorer l'Annuaire International
          </Button>
        </div>
      </div>
    </div>
  );
}
