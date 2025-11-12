// ✅ VERSION CORRIGÉE : App.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import {
  SessionContextProvider,
  useUser,
  useSupabaseClient,
} from "@supabase/auth-helpers-react";
import { supabase } from "./lib/supabase.js";
import { Toaster, toast } from "sonner";

// Import des composants
import AuthModal from "./AuthModal.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ErrorBoundaryEnhanced, {
  SupabaseErrorFallback,
} from "./components/ErrorBoundaryEnhanced.jsx";
import WelcomeAgent from "./components/WelcomeAgent.jsx";
import { checkSupabaseConnection } from "./lib/supabase.js";
import LoadingScreen from "./components/LoadingScreen.jsx";
import SupabaseDiagnostic from "./components/SupabaseDiagnostic.jsx";
import AuthCallback from "@/pages/AuthCallback.jsx";
import ResetPassword from "@/pages/ResetPassword.jsx";
import EnhancedRecordVideo from "@/pages/enhanced-record-video.jsx";
import VideoSuccess from "@/pages/video-success.jsx";
import Directory from "@/pages/directory.jsx";
import Login from "@/pages/login.jsx";
import Home from "@/pages/home.jsx";
import VideoAnalysisPage from "@/pages/video-analysis.jsx";
import VideoVault from "@/pages/video-vault.jsx";
import FourColorsTest from "@/components/FourColorsTest.jsx";
import SeminarsList from "@/components/SeminarsList.jsx";
import Certification from "@/components/Certification.jsx";
import SimplifiedHome from "@/pages/SimplifiedHome.jsx";
import SpotCoach from "@/pages/SpotCoach.jsx";

import "./App.css";
import "./styles/design-system.css";
import { TransformationDemo } from "./pages/TransformationDemo.jsx";
import { PsgSignup } from "./pages/psg-signup.jsx";
import { PsgSignin } from "./pages/psg-signin.jsx";
import FootballChatTest from "./pages/FootballChatTest.jsx";
import SpotBullePremium from "./pages/SpotBullePremium.jsx";

// ✅ COMPOSANT : Gestion d'authentification simplifiée
const RequireAuth = ({ children, fallbackPath = "/login" }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      console.log("🔐 Redirection vers login - utilisateur non authentifié");
      navigate(fallbackPath, { replace: true });
    }
  }, [user, loading, navigate, fallbackPath]);

  if (loading && !user) {
    return (
      <LoadingScreen
        message="Vérification de sécurité..."
        subtitle="Authentification en cours"
      />
    );
  }

  return user ? children : <Navigate to={fallbackPath} replace />;
};

// ✅ COMPOSANT : Gestion des erreurs
const ErrorBoundaryWrapper = ({ children }) => (
  <ErrorBoundaryEnhanced
    FallbackComponent={SupabaseErrorFallback}
    onError={(error, errorInfo) => {
      console.error("🚨 Erreur Application:", error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundaryEnhanced>
);

// ✅ COMPOSANT : Service Worker
const ServiceWorkerRegistration = () => {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("✅ Service Worker enregistré:", registration);
        })
        .catch((error) => {
          console.log("❌ Erreur Service Worker:", error);
        });
    }
  }, []);

  return null;
};

// ✅ BOUTON DE SECOURS (si import manquant)
const FallbackButton = ({ onClick, children, ...props }) => (
  <button
    onClick={onClick}
    style={{
      padding: "10px 20px",
      background: "hsl(222.2 84% 4.9%)",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
    }}
    {...props}
  >
    {children}
  </button>
);

// ✅ COMPOSANT PRINCIPAL SIMPLIFIÉ
const AppContent = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const { user, signOut, profile } = useAuth();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [cameraChecked, setCameraChecked] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // ✅ Vérification connexion Supabase
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("🔄 Initialisation SpotBulle...");
        const result = await checkSupabaseConnection();

        if (result.connected) {
          setConnectionStatus("connected");
          setSupabaseError(null);
          console.log("✅ Connexion Supabase établie");
        } else {
          setConnectionStatus("disconnected");
          setSupabaseError(result.error);
          console.error("❌ Connexion Supabase échouée:", result.error);
        }
      } catch (err) {
        console.error("❌ Erreur initialisation:", err);
        setConnectionStatus("disconnected");
        setSupabaseError(err.message);
      }
    };

    initializeApp();
  }, []);

  // ✅ Vérification permissions caméra
  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(
            (device) => device.kind === "videoinput"
          );
          console.log(`📹 ${videoDevices.length} caméra(s) détectée(s)`);
          setCameraChecked(true);
        }
      } catch (err) {
        console.warn("⚠️ Vérification caméra échouée:", err);
        setCameraChecked(true);
      }
    };

    checkCameraPermissions();
  }, []);

  // ✅ Chargement données dashboard
  const loadDashboardData = useCallback(async () => {
    if (!user) {
      setDashboardData(null);
      return;
    }

    try {
      setDashboardLoading(true);

      const { data: videos, error: videosError } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (videosError) throw videosError;

      const videoList = videos || [];
      const stats = {
        totalVideos: videoList.length,
        recentVideos: videoList.slice(0, 5),
        videosByStatus: {
          ready: videoList.filter((v) =>
            ["ready", "uploaded"].includes(v.status)
          ).length,
          processing: videoList.filter((v) =>
            ["processing", "analyzing"].includes(v.status)
          ).length,
          analyzed: videoList.filter((v) => v.status === "analyzed").length,
          failed: videoList.filter((v) =>
            ["failed", "error"].includes(v.status)
          ).length,
        },
        totalDuration: videoList.reduce(
          (sum, video) => sum + (video.duration || 0),
          0
        ),
        transcribedCount: videoList.filter(
          (v) => v.transcription_data || v.transcription_text
        ).length,
        analyzedCount: videoList.filter((v) => v.analysis || v.ai_result)
          .length,
      };

      setDashboardData(stats);
    } catch (err) {
      console.error("❌ Erreur chargement dashboard:", err);
    } finally {
      setDashboardLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user && connectionStatus === "connected") {
      loadDashboardData();
    }
  }, [user, connectionStatus, loadDashboardData]);

  // ✅ Gestionnaires d'événements
  const handleAuthSuccess = useCallback(
    (userData) => {
      console.log("✅ Utilisateur authentifié:", userData.id);
      setIsAuthModalOpen(false);
      setConnectionStatus("connected");
      loadDashboardData();
      navigate("/");
    },
    [loadDashboardData, navigate]
  );

  const handleSignOut = useCallback(async () => {
    try {
      console.log("🚪 Déconnexion utilisateur...");
      await signOut();
      setDashboardData(null);
      navigate("/");
      toast.success("Déconnexion réussie");
    } catch (err) {
      console.error("❌ Erreur déconnexion:", err);
      toast.error("Erreur lors de la déconnexion");
    }
  }, [signOut, navigate]);

  const handleVideoUploaded = useCallback(() => {
    console.log("🎥 Vidéo uploadée - rechargement données");
    loadDashboardData();
    toast.success("Vidéo traitée avec succès !");
  }, [loadDashboardData]);

  const handleRetryConnection = useCallback(async () => {
    setConnectionStatus("checking");
    setSupabaseError(null);

    try {
      const result = await checkSupabaseConnection();
      if (result.connected) {
        setConnectionStatus("connected");
        loadDashboardData();
      } else {
        setConnectionStatus("disconnected");
        setSupabaseError(result.error);
      }
    } catch (err) {
      setConnectionStatus("disconnected");
      setSupabaseError(err.message);
    }
  }, [loadDashboardData]);

  // ✅ Rendu conditionnel des erreurs
  if (supabaseError && connectionStatus === "disconnected") {
    return (
      <SupabaseDiagnostic
        error={supabaseError}
        onRetry={handleRetryConnection}
        onContinue={() => setSupabaseError(null)}
      />
    );
  }

  return (
    <div className="app-container">
      <Toaster
        position="top-right"
        duration={5000}
        closeButton
        richColors
        theme="dark"
      />

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
                  onSignOut={handleSignOut}
                  dashboardData={dashboardData}
                  loading={dashboardLoading}
                  loadDashboardData={loadDashboardData}
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

        {/* Routes protégées */}
        <Route
          path="/record-video"
          element={
            <RequireAuth>
              <EnhancedRecordVideo
                user={user}
                profile={profile}
                onSignOut={handleSignOut}
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
                onSignOut={handleSignOut}
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
                onSignOut={handleSignOut}
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
                onSignOut={handleSignOut}
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
                onSignOut={handleSignOut}
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
                onSignOut={handleSignOut}
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
                onSignOut={handleSignOut}
                dashboardData={dashboardData}
                dashboardLoading={dashboardLoading}
                loadDashboardData={loadDashboardData}
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
                <FallbackButton onClick={() => navigate("/")}>
                  Retour à l'accueil
                </FallbackButton>
              </div>
            </div>
          }
        />

        {/* Redirection catch-all */}
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>

      {/* Modal d'authentification */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Service Worker */}
      <ServiceWorkerRegistration />
    </div>
  );
};

// ✅ COMPOSANT RACINE
function App() {
  console.log("🚀 Initialisation SpotBulle");

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <AuthProvider>
        <ErrorBoundaryWrapper>
          <AppContent />
        </ErrorBoundaryWrapper>
      </AuthProvider>
    </SessionContextProvider>
  );
}

export default App;
