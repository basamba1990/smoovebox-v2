// ✅ VERSION CORRIGÉE : App.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import {
  SessionContextProvider,
  useUser,
  useSupabaseClient,
} from "@supabase/auth-helpers-react";
import { supabase } from "./lib/supabase.js";
import { Toaster, toast } from "sonner";
import { QueryClientProvider, QueryClient, useQueryClient } from "@tanstack/react-query";
import { useVideos } from "./hooks/useVideos.js";

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
  const queryClient = useQueryClient();
  const { user, signOut, profile } = useAuth();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [cameraChecked, setCameraChecked] = useState(false);

  // ✅ Use React Query hook for videos
  const { data: videos = [], isLoading: videosLoading } = useVideos();

  // ✅ Calculate dashboard stats from videos data (memoized for performance)
  const dashboardData = useMemo(() => {
    if (!videos || videos.length === 0) {
      return null;
    }

    return {
      totalVideos: videos.length,
      recentVideos: videos.slice(0, 5),
      videosByStatus: {
        ready: videos.filter((v) =>
          ["ready", "uploaded"].includes(v.status)
        ).length,
        processing: videos.filter((v) =>
          ["processing", "analyzing"].includes(v.status)
        ).length,
        analyzed: videos.filter((v) => v.status === "analyzed").length,
        failed: videos.filter((v) =>
          ["failed", "error"].includes(v.status)
        ).length,
      },
      totalDuration: videos.reduce(
        (sum, video) => sum + (video.duration || 0),
        0
      ),
      transcribedCount: videos.filter(
        (v) => v.transcription_data || v.transcription_text
      ).length,
      analyzedCount: videos.filter((v) => v.analysis || v.ai_result).length,
    };
  }, [videos]);

  // Use videosLoading for dashboardLoading
  const dashboardLoading = videosLoading;

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

  // Removed loadDashboardData - now using React Query hook
  // Dashboard data is calculated from videos using useMemo

  // ✅ Gestionnaires d'événements
  const handleAuthSuccess = useCallback(
    (userData) => {
      console.log("✅ Utilisateur authentifié:", userData.id);
      setIsAuthModalOpen(false);
      setConnectionStatus("connected");
      // Invalidate videos query to refetch after authentication
      queryClient.invalidateQueries({ queryKey: ['videos', userData.id] });
      navigate("/");
    },
    [queryClient, navigate]
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
    // Invalidate videos query to refetch
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['videos', user.id] });
    }
    toast.success("Vidéo traitée avec succès !");
  }, [user, queryClient]);

  const handleRetryConnection = useCallback(async () => {
    setConnectionStatus("checking");
    setSupabaseError(null);

    try {
      const result = await checkSupabaseConnection();
      if (result.connected) {
        setConnectionStatus("connected");
        // Invalidate videos query to refetch after reconnection
        if (user) {
          queryClient.invalidateQueries({ queryKey: ['videos', user.id] });
        }
      } else {
        setConnectionStatus("disconnected");
        setSupabaseError(result.error);
      }
    } catch (err) {
      setConnectionStatus("disconnected");
      setSupabaseError(err.message);
    }
  }, [user, queryClient]);

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
// Create QueryClient instance for React Query (needed by other components)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
  },
});

function App() {
  console.log("🚀 Initialisation SpotBulle");

  return (
    <QueryClientProvider client={queryClient}>
      <SessionContextProvider supabaseClient={supabase}>
        <AuthProvider>
          <ErrorBoundaryWrapper>
            <AppContent />
          </ErrorBoundaryWrapper>
        </AuthProvider>
      </SessionContextProvider>
    </QueryClientProvider>
  );
}

export default App;
