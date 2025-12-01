// src/routes/AppRoutes.jsx
// Simple component that contains all route definitions

import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "../components/RequireAuth.jsx";
import WelcomeAgent from "../components/WelcomeAgent.jsx";
import SimplifiedHome from "../pages/SimplifiedHome.jsx";
import Login from "../pages/login.jsx";
import AuthCallback from "../pages/AuthCallback.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";
import { TransformationDemo } from "../pages/TransformationDemo.jsx";
import { PsgSignup } from "../pages/psg-signup.jsx";
import { PsgSignin } from "../pages/psg-signin.jsx";
import FootballChatTest from "../pages/FootballChatTest.jsx";
import SpotBullePremium from "../pages/SpotBullePremium.jsx";
import SpotCoach from "../pages/SpotCoach.jsx";
import EnhancedRecordVideo from "../pages/enhanced-record-video.jsx";
import Dashboard from "../components/Dashboard.jsx";
import VideoVault from "../pages/video-vault.jsx";
import VideoAnalysisPage from "../pages/video-analysis.jsx";
import FourColorsTest from "../components/FourColorsTest.jsx";
import SeminarsList from "../components/SeminarsList.jsx";
import Certification from "../components/Certification.jsx";
import Home from "../pages/home.jsx";
import VideoSuccess from "../pages/video-success.jsx";
import Directory from "../pages/directory.jsx";
import LumiOnboarding from "../pages/lumi-onboarding.jsx";

export default function AppRoutes({
  user,
  profile,
  connectionStatus,
  onSignOut,
  dashboardData,
  dashboardLoading,
  handleVideoUploaded,
  cameraChecked,
  navigate,
  setIsAuthModalOpen,
}) {
  return (
    <Routes>
      {/* Route racine intelligente */}
      <Route
        path="/"
        element={
          user ? (
            <RequireAuth>
              <SimplifiedHome
                user={user}
                profile={profile}
                connectionStatus={connectionStatus}
                onSignOut={onSignOut}
                dashboardData={dashboardData}
                loading={dashboardLoading}
              />
            </RequireAuth>
          ) : (
            <WelcomeAgent
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onDemoMode={() => navigate("/demo")}
            />
          )
        }
      />

      {/* Routes d'authentification */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/transformation-demo" element={<TransformationDemo />} />
      <Route path="/psg-signup" element={<PsgSignup />} />
      <Route path="/psg-signin" element={<PsgSignin />} />
      <Route path="/test-chat" element={<FootballChatTest />} />
      <Route path="/premium" element={<SpotBullePremium />} />
      <Route
        path="/spotcoach"
        element={
          <RequireAuth>
            <SpotCoach />
          </RequireAuth>
        }
      />
      <Route
        path="/lumi/onboarding"
        element={
          <RequireAuth>
            <LumiOnboarding />
          </RequireAuth>
        }
      />

      {/* Routes protégées */}
      <Route
        path="/record-video"
        element={
          <RequireAuth>
            <EnhancedRecordVideo
              user={user}
              profile={profile}
              onSignOut={onSignOut}
              onVideoUploaded={handleVideoUploaded}
              cameraChecked={cameraChecked}
            />
          </RequireAuth>
        }
      />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard
              refreshKey={Date.now()}
              onVideoUploaded={handleVideoUploaded}
              userProfile={profile}
            />
          </RequireAuth>
        }
      />

      <Route
        path="/video-vault"
        element={
          <RequireAuth>
            <VideoVault
              user={user}
              profile={profile}
              onSignOut={onSignOut}
              onVideoAdded={handleVideoUploaded}
            />
          </RequireAuth>
        }
      />

      <Route
        path="/video-analysis/:videoId"
        element={
          <RequireAuth>
            <VideoAnalysisPage
              user={user}
              profile={profile}
              onSignOut={onSignOut}
            />
          </RequireAuth>
        }
      />

      <Route
        path="/personality-test"
        element={
          <RequireAuth>
            <FourColorsTest
              user={user}
              profile={profile}
              onSignOut={onSignOut}
            />
          </RequireAuth>
        }
      />

      <Route
        path="/seminars"
        element={
          <RequireAuth>
            <SeminarsList
              user={user}
              profile={profile}
              onSignOut={onSignOut}
            />
          </RequireAuth>
        }
      />

      <Route
        path="/certification"
        element={
          <RequireAuth>
            <Certification
              user={user}
              profile={profile}
              onSignOut={onSignOut}
            />
          </RequireAuth>
        }
      />

      {/* Routes de compatibilité */}
      <Route
        path="/classic"
        element={
          <RequireAuth>
            <Home
              user={user}
              profile={profile}
              connectionStatus={connectionStatus}
              onSignOut={onSignOut}
              dashboardData={dashboardData}
              dashboardLoading={dashboardLoading}
            />
          </RequireAuth>
        }
      />

      <Route
        path="/video-success"
        element={
          <RequireAuth>
            <VideoSuccess />
          </RequireAuth>
        }
      />

      <Route
        path="/directory"
        element={
          <RequireAuth>
            <Directory />
          </RequireAuth>
        }
      />

      {/* Routes de démonstration */}
      <Route path="/demo" element={<WelcomeAgent demoMode={true} />} />
      <Route
        path="/features"
        element={<WelcomeAgent showFeatures={true} />}
      />

      {/* Gestion des erreurs 404 */}
      <Route
        path="/404"
        element={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="text-center text-white">
              <h1 className="text-6xl font-bold mb-4">404</h1>
              <p className="text-xl mb-8">Page non trouvée</p>
              <button
                onClick={() => navigate("/")}
                style={{
                  padding: "10px 20px",
                  background: "hsl(222.2 84% 4.9%)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        }
      />

      {/* Redirection catch-all */}
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
