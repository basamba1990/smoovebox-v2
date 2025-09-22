// src/pages/home.jsx
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";

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
  return (
    <div className="app-container min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <ProfessionalHeader 
        user={user} 
        profile={profile} 
        connectionStatus={connectionStatus} 
        onSignOut={onSignOut} 
      />

      {/* Contenu principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 md:p-8">
        
        {/* Bloc RecordVideo */}
        <div className="bg-white dark:bg-gray-900 shadow-md rounded-2xl p-4 md:p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            🎥 Enregistrer une vidéo
          </h2>
          <div className="flex-1">
            <RecordVideo />
          </div>
        </div>

        {/* Bloc Dashboard */}
        <div className="bg-white dark:bg-gray-900 shadow-md rounded-2xl p-4 md:p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            📊 Mon Dashboard
          </h2>

          {dashboardLoading ? (
            <p className="text-gray-500">Chargement du dashboard...</p>
          ) : dashboardError ? (
            <div className="text-red-500">
              <p>Erreur : {dashboardError}</p>
              <button 
                onClick={loadDashboardData}
                className="mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Réessayer
              </button>
            </div>
          ) : !dashboardData ? (
            <p className="text-gray-500">Aucune donnée trouvée.</p>
          ) : (
            <Dashboard 
              dashboardData={dashboardData}
              loading={dashboardLoading}
              error={dashboardError}
              onRetry={loadDashboardData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
