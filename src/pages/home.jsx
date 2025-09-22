import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import WelcomeAgent from "../components/WelcomeAgent.jsx";
import RecordVideo from "./record-video.jsx";
import VideoSuccess from "./video-success.jsx";
import Dashboard from "../components/Dashboard.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";

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
  const [step, setStep] = useState(1); // 1: Welcome, 2: Record, 3: Success, 4: Directory
  const [lastVideoId, setLastVideoId] = useState(null);

  const recordRef = useRef(null);
  const successRef = useRef(null);
  const dashboardRef = useRef(null);

  const goToNextStep = (videoId) => {
    if (step === 2 && videoId) setLastVideoId(videoId);
    setStep((prev) => prev + 1);
  };

  // Scroll automatique vers la section active
  useEffect(() => {
    const refs = { 2: recordRef, 3: successRef, 4: dashboardRef };
    const currentRef = refs[step];
    if (currentRef?.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [step]);

  return (
    <div className="app-container min-h-screen bg-gray-50 dark:bg-gray-950">
      <ProfessionalHeader
        user={user}
        profile={profile}
        connectionStatus={connectionStatus}
        onSignOut={onSignOut}
      />

      {/* Progress bar / étapes */}
      <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 relative mt-4">
        <motion.div
          className="h-2 bg-gradient-to-r from-blue-500 to-purple-600"
          initial={{ width: 0 }}
          animate={{ width: `${(step - 1) * 33.33}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <p className="text-center text-gray-700 dark:text-gray-300 mt-2 mb-4">
        Étape {step} sur 4
      </p>

      <div className="flex flex-col gap-6 p-4 md:p-8">
        {/* Step 1: WelcomeAgent */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <WelcomeAgent onOpenAuthModal={() => goToNextStep()} />
          </motion.div>
        )}

        {/* Step 2: RecordVideo */}
        {step === 2 && (
          <motion.div
            ref={recordRef}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white dark:bg-gray-900 shadow-md rounded-2xl p-4 md:p-6 flex flex-col"
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              🎥 Enregistrer une vidéo
            </h2>
            <RecordVideo onComplete={goToNextStep} />
          </motion.div>
        )}

        {/* Step 3: VideoSuccess */}
        {step === 3 && lastVideoId && (
          <motion.div
            ref={successRef}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <VideoSuccess videoId={lastVideoId} onNextStep={() => goToNextStep()} />
          </motion.div>
        )}

        {/* Step 4: Dashboard / Directory */}
        {step === 4 && (
          <motion.div
            ref={dashboardRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {dashboardData && dashboardData.totalVideos > 0 ? (
              <Dashboard
                dashboardData={dashboardData}
                loading={dashboardLoading}
                error={dashboardError}
                onRetry={loadDashboardData}
              />
            ) : (
              <p className="text-center text-gray-700 dark:text-gray-300">
                Explorez l'annuaire des participants pour découvrir les autres SpotBulle !
              </p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
