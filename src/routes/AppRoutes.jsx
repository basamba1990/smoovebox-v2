// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "../components/RequireAuth.jsx";
import WelcomeAgent from "../components/WelcomeAgent.jsx";
import SimplifiedHome from "../pages/SimplifiedHome.jsx";
import Login from "../pages/login.jsx";
import AuthCallback from "../pages/AuthCallback.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";
import { TransformationDemo } from "../pages/TransformationDemo.jsx";
import { CompanySignup } from "../pages/company-signup.jsx";
import { CompanySignin } from "../pages/company-signin.jsx";
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
import LumiUnifiedProfile from "../pages/LumiUnifiedProfile.jsx";
import ModuleMimetique from "../pages/ModuleMimetique.jsx";
import UpdateDISC from "../pages/UpdateDISC.jsx";
import PitchAnalysisPage from "../pages/PitchAnalysisPage.jsx";
import { CompanyRecord } from "../pages/company-record.jsx";
import SoftPowerPassions from "../components/SoftPowerPassions.jsx";
import PitchRecording from "../components/PitchRecording.jsx";
import FutureJobsGenerator from "../pages/future-jobs-generator.jsx";
import TrendsDashboard from "../pages/TrendsDashboard.jsx";
import GenupPortfolioPage from "../pages/genupPortfolioPage.jsx";
import PersonasSelector from "../components/PersonasSelector.jsx";
import ImmersionSimulator from "../components/ImmersionSimulator.jsx";
import ComplementaryMatches from "../components/ComplementaryMatches.jsx";
import Questionnaire from "../components/Questionnaire.jsx";
import FootballChatModal from "../components/FootballChatModal.jsx";
import QuickActions from "../components/QuickActions.jsx";

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
      {/* Root route: redirect based on auth */}
      <Route
        path="/"
        element={
          user
            ? <Navigate to="/embark" replace />
            : <Navigate to="/login" replace />
        }
      />

      {/* Routes d'authentification */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/transformation-demo" element={<TransformationDemo />} />
      {/* Company authentication routes */}
      <Route path="/company-signup" element={<CompanySignup />} />
      <Route path="/company-signin" element={<CompanySignin />} />
      {/* Legacy PSG routes - redirect to company routes */}
      <Route path="/psg-signup" element={<CompanySignup />} />
      <Route path="/psg-signin" element={<CompanySignin />} />
      {/* Company recording page - only for company users */}
      <Route
        path="/company-record"
        element={
          <RequireAuth>
            <CompanyRecord />
          </RequireAuth>
        }
      />
      <Route path="/test-chat" element={<FootballChatTest />} />
      
      {/* ✅ ROUTES POUR LES NOUVELLES FONCTIONNALITÉS */}
      <Route
        path="/soft-power-passions"
        element={
          <RequireAuth>
            <SoftPowerPassions user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route
        path="/pitch-recording"
        element={
          <RequireAuth>
            <PitchRecording user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route
        path="/pitch-analysis"
        element={
          <RequireAuth>
            <PitchAnalysisPage user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route
        path="/personas-selector"
        element={
          <RequireAuth>
            <PersonasSelector user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route
        path="/immersion-simulator"
        element={
          <RequireAuth>
            <ImmersionSimulator user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route
        path="/complementary-matches"
        element={
          <RequireAuth>
            <ComplementaryMatches user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route
        path="/questionnaire"
        element={
          <RequireAuth>
            <Questionnaire 
              user={user} 
              profile={profile} 
              onComplete={() => navigate("/")}
            />
          </RequireAuth>
        }
      />

      {/* Routes Premium & Coaching */}
      <Route path="/premium" element={<SpotBullePremium />} />
      <Route
        path="/embark"
        element={
          <RequireAuth>
            <SpotCoach user={user} profile={profile} />
          </RequireAuth>
        }
      />
      {/* Optional backward compatibility for old /spotcoach URL */}
      <Route path="/spotcoach" element={<Navigate to="/embark" replace />} />
      <Route
        path="/scan-elements"
        element={
          <RequireAuth>
            <LumiOnboarding user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route path="/lumi/onboarding" element={<Navigate to="/scan-elements" replace />} />
      <Route
        path="/module-mimetique"
        element={
          <RequireAuth>
            <ModuleMimetique />
          </RequireAuth>
        }
      />
      <Route
        path="/lumi/profile"
        element={
          <RequireAuth>
            <LumiUnifiedProfile user={user} profile={profile} />
          </RequireAuth>
        }
      />

      {/* ✅ Route DISC */}
      <Route
        path="/update-disc"
        element={
          <RequireAuth>
            <UpdateDISC user={user} profile={profile} onSignOut={onSignOut} />
          </RequireAuth>
        }
      />

      {/* Routes principales */}
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

      {/* Route /personality-test dépréciée */}
      <Route path="/personality-test" element={<Navigate to="/update-disc" replace />} />

      {/* Routes formations */}
      <Route
        path="/seminars"
        element={
          <RequireAuth>
            <SeminarsList user={user} profile={profile} onSignOut={onSignOut} />
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
            <VideoSuccess user={user} profile={profile} />
          </RequireAuth>
        }
      />

      <Route
        path="/directory"
        element={
          <RequireAuth>
            <Directory user={user} profile={profile} />
          </RequireAuth>
        }
      />

      {/* Ancienne home / dashboard simplifié */}
      <Route
        path="/old"
        element={
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
        }
      />

      {/* ✅ NOUVELLES ROUTES FUTUR & IA */}
      <Route
        path="/future-jobs-generator"
        element={
          <RequireAuth>
            <FutureJobsGenerator user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route
        path="/trends-dashboard"
        element={
          <RequireAuth>
            <TrendsDashboard user={user} profile={profile} />
          </RequireAuth>
        }
      />
      <Route
        path="/genup-portfolio"
        element={
          <RequireAuth>
            <GenupPortfolioPage user={user} profile={profile} />
          </RequireAuth>
        }
      />

      {/* Routes de démonstration */}
      <Route path="/demo" element={<WelcomeAgent demoMode={true} />} />
      <Route path="/features" element={<WelcomeAgent showFeatures={true} />} />

      {/* Gestion des erreurs 404 */}
      <Route
        path="/404"
        element={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="text-center text-white">
              <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-wide">
                le sas d'accueil : Radar de naissance
              </h1>
              <p className="text-lg md:text-xl text-slate-300">
                Cette étape de l&apos;odyssée n&apos;existe pas encore dans le voyage de Lumi.
              </p>
            </div>
          </div>
        }
      />

      {/* Redirection catch-all */}
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
