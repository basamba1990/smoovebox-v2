// src/pages/home.jsx
import React, { useState } from 'react';
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import { Button } from "../components/ui/button-enhanced.jsx";
import { useNavigate } from 'react-router-dom';

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

  const handleNavigateToDirectory = () => {
    navigate('/directory');
  };

  return (
    <div className="app-container min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <ProfessionalHeader 
        user={user} 
        profile={profile} 
        connectionStatus={connectionStatus} 
        onSignOut={onSignOut} 
      />

      {/* Bannière d'accueil */}
      <div className="bg-gradient-to-r from-blue-600 to-red-600 text-white p-6 md:p-8 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            🌟 Bienvenue sur SpotBulle France–Maroc
          </h1>
          <p className="text-sm md:text-base opacity-90">
            Exprimez votre passion, découvrez vos talents et connectez-vous avec la communauté
          </p>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            className={`py-3 px-6 font-medium text-sm md:text-base transition-colors ${
              activeTab === 'record'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('record')}
          >
            🎥 Enregistrement Vidéo
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm md:text-base transition-colors ${
              activeTab === 'dashboard'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Tableau de Bord
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Section d'actions rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-center">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg mr-4">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h3 className="font-semibold">Profil SpotBulle</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Complétez votre profil</p>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-center">
            <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg mr-4">
              <span className="text-2xl">🤝</span>
            </div>
            <div>
              <h3 className="font-semibold">Réseau</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connectez-vous à la communauté</p>
            </div>
          </div>
          
          <div 
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={handleNavigateToDirectory}
          >
            <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg mr-4">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <h3 className="font-semibold">Annuaire</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Découvrez les participants</p>
            </div>
          </div>
        </div>

        {/* Contenu selon l'onglet actif */}
        {activeTab === 'record' ? (
          <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-4 md:p-6 mb-6">
            <div className="flex items-center mb-6">
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg mr-4">
                <span className="text-2xl">🎥</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Expression & Premier Pitch
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Exprimez vos rêves, besoins et projections "dans 5 ans"
                </p>
              </div>
            </div>
            
            <RecordVideo />
            
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">
                💡 Conseil SpotBulle
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Soyez authentique et passionné ! Votre vidéo sera analysée par notre IA pour vous offrir 
                une expérience personnalisée et vous connecter avec la communauté France–Maroc.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-4 md:p-6 mb-6">
            <div className="flex items-center mb-6">
              <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg mr-4">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Mon Progrès SpotBulle
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Suivez votre évolution dans le programme France–Maroc
                </p>
              </div>
            </div>

            {dashboardLoading ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-3 text-gray-500">Chargement de vos données...</p>
              </div>
            ) : dashboardError ? (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                <p className="text-red-600 dark:text-red-400 mb-3">Erreur : {dashboardError}</p>
                <Button 
                  onClick={loadDashboardData}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Réessayer
                </Button>
              </div>
            ) : !dashboardData || dashboardData.totalVideos === 0 ? (
              <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-5xl mb-4">🎬</div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Commencez votre aventure SpotBulle
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Enregistrez votre première vidéo pour démarrer votre parcours et obtenir votre carte d'identité SpotBulle.
                </p>
                <Button 
                  onClick={() => setActiveTab('record')}
                  className="bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white"
                >
                  Première Vidéo
                </Button>
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
        )}

        {/* Section Programme SpotBulle */}
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
            <span className="bg-gradient-to-r from-blue-600 to-red-600 text-white p-2 rounded-lg mr-3">🇫🇷🇲🇦</span>
            Programme SpotBulle France–Maroc
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Étape 1: Expression</h3>
              <p className="text-sm text-blue-600 dark:text-blue-200">
                Enregistrez votre pitch vidéo et complétez votre profil pour créer votre carte d'identité SpotBulle.
              </p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">Étape 2: Analyse IA</h3>
              <p className="text-sm text-green-600 dark:text-green-200">
                Notre IA analyse votre vidéo et questionnaire pour identifier vos forces et talents.
              </p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Étape 3: Séminaire</h3>
              <p className="text-sm text-purple-600 dark:text-purple-200">
                Participez à des ateliers collaboratifs et rencontrez la communauté France–Maroc.
              </p>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-amber-700 dark:text-amber-300 mb-2">Étape 4: Certification</h3>
              <p className="text-sm text-amber-600 dark:text-amber-200">
                Recevez votre diplôme SpotBulle Certified France–Maroc et rejoignez le réseau.
              </p>
            </div>
          </div>
        </div>

        {/* CTA pour l'annuaire */}
        <div className="bg-gradient-to-r from-blue-600 to-red-600 text-white p-6 rounded-2xl shadow-lg text-center">
          <h2 className="text-xl font-bold mb-3">Rejoignez l'annuaire SpotBulle</h2>
          <p className="mb-4 opacity-90">
            Découvrez les autres participants et créez des connections dans la communauté France–Maroc
          </p>
          <Button 
            onClick={handleNavigateToDirectory}
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold"
          >
            Explorer l'Annuaire
          </Button>
        </div>
      </div>
    </div>
  );
}
