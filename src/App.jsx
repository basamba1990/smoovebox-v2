// ✅ VERSION CORRIGÉE : App.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import ErrorBoundaryEnhanced, {
  SupabaseErrorFallback,
} from "./components/ErrorBoundaryEnhanced.jsx";
import { checkSupabaseConnection } from "./lib/supabase.js";
import SupabaseDiagnostic from "./components/SupabaseDiagnostic.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

import "./App.css";
import "./styles/design-system.css";

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

      <AppRoutes
        user={user}
        profile={profile}
        connectionStatus={connectionStatus}
        onSignOut={handleSignOut}
        dashboardData={dashboardData}
        dashboardLoading={dashboardLoading}
        loadDashboardData={loadDashboardData}
        handleVideoUploaded={handleVideoUploaded}
        cameraChecked={cameraChecked}
        navigate={navigate}
        setIsAuthModalOpen={setIsAuthModalOpen}
      />

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
