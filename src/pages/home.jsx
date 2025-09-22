import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import WelcomeAgent from "../components/WelcomeAgent.jsx";

export default function Home({
  user,
  profile,
  connectionStatus,
  onSignOut,
  dashboardData,
  dashboardLoading,
  dashboardError,
  loadDashboardData,
}) {
  const recordRef = useRef(null);
  const dashboardRef = useRef(null);

  const [showWelcome, setShowWelcome] = useState(
    !dashboardData || dashboardData.totalVideos === 0
  );
  const [showRecord, setShowRecord] = useState(false);
  const [showDashboard, setShowDashboard] = useState(
    dashboardData && dashboardData.totalVideos > 0
  );

  const handleStartExperience = () => {
    setShowWelcome(false);
    setShowRecord(true);
    setTimeout(() => {
      if (recordRef.current) recordRef.current.scrollIntoView({ behavior: "smooth" });
    }, 200);
  };

  useEffect(() => {
    if (dashboardData && dashboardData.totalVideos > 0) {
      setShowDashboard(true);
      setShowRecord(false);
      if (dashboardRef.current) dashboardRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [dashboardData]);

  return (
    <div className="app-container min-h-screen bg-gray-50 dark:bg-gray-950">
      <ProfessionalHeader
        user={user}
        profile={profile}
        connectionStatus={connectionStatus}
        onSignOut={onSignOut}
      />

      <div className="flex flex-col md:flex-row gap-6 p-4 md:p-8">
        {/* Colonne gauche: WelcomeAgent + RecordVideo */}
        <div className="flex-1 flex flex-col gap-6">
          {showWelcome && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <WelcomeAgent onOpenAuthModal={handleStartExperience} />
            </motion.div>
          )}

          {showRecord && (
            <motion.div
              ref={recordRef}
              className="bg-white dark:bg-gray-900 shadow-md rounded-2xl p-4 md:p-6 flex flex-col"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
                🎥 Enregistrer une vidéo
              </h2>
              <RecordVideo />
            </motion.div>
          )}
        </div>

        {/* Colonne droite: Dashboard */}
        {showDashboard && (
          <motion.div
            ref={dashboardRef}
            className="flex-1 bg-white dark:bg-gray-900 shadow-md rounded-2xl p-4 md:p-6 flex flex-col"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
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
            ) : (
              <Dashboard
                dashboardData={dashboardData}
                loading={dashboardLoading}
                error={dashboardError}
                onRetry={loadDashboardData}
              />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
