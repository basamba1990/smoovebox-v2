// ✅ VERSION CORRIGÉE : App.jsx 
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, BrowserRouter as Router } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { supabase } from "./lib/supabase.js";
import { Toaster } from "sonner";
import { QueryClientProvider, QueryClient, useQueryClient } from "@tanstack/react-query";
import { useVideos } from "./hooks/useVideos.js";
// Import des composants
import AuthModal from "./AuthModal.jsx";
import ErrorBoundaryEnhanced, { SupabaseErrorFallback } from "./components/ErrorBoundaryEnhanced.jsx";
import { checkSupabaseConnection } from "./lib/supabase.js";
import SupabaseDiagnostic from "./components/SupabaseDiagnostic.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary.jsx"; // ✅ NOUVEAU
import "./App.css";
import "./styles/design-system.css";

// ✅ COMPOSANT : Service Worker
const ServiceWorkerRegistration = () => {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log();
        })
        .catch((error) => {
          console.log("❌ Erreur Service Worker:", error);
        });
    }
  }, []);
  return null;
};

// ✅ COMPOSANT PRINCIPAL SIMPLIFIÉ - PROTÉGÉ PAR ErrorBoundaryEnhanced
const AppContentProtected = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut, profile } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [cameraChecked, setCameraChecked] = useState(false);
  const [hasNetworkError, setHasNetworkError] = useState(false);

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
          ["ready", "uploaded", "published"].includes(v.status)
        ).length,
        processing: videos.filter((v) => 
          ["processing", "analyzing", "generating"].includes(v.status)
        ).length,
        analyzed: videos.filter((v) => v.status === "analyzed" || v.analysis).length,
        failed: videos.filter((v) => 
          ["failed", "error", "cancelled"].includes(v.status)
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

  const dashboardLoading = videosLoading;

  // ✅ Vérification connexion Supabase + Réseau
  useEffect(() => {
    const initializeApp = async () => {
      try {
        
        // Vérification réseau d'abord
        const networkOk = await checkNetworkConnection();
        if (!networkOk) {
          setConnectionStatus("offline");
          setHasNetworkError(true);
          console.warn("⚠️ Pas de connexion internet");
          return;
        }

        // Vérification Supabase ensuite
        const result = await checkSupabaseConnection();
        if (result.connected) {
          setConnectionStatus("connected");
          setSupabaseError(null);
          setHasNetworkError(false);
        } else {
          setConnectionStatus("api_error");
          setSupabaseError(result.error);
          setHasNetworkError(true);
          console.error("❌ Connexion Supabase échouée:", result.error);
        }
      } catch (err) {
        console.error("❌ Erreur initialisation:", err);
        setConnectionStatus("disconnected");
        setSupabaseError(err.message);
        setHasNetworkError(true);
      }
    };

    initializeApp();
    
    // Vérifier périodiquement
    const interval = setInterval(initializeApp, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Fonction de vérification réseau
  const checkNetworkConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://api.cloudflare.com/cdn-cgi/trace', {
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Vérification réseau échouée:', error);
      return false;
    }
  };

  // ✅ Vérification permissions caméra
  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(
            (device) => device.kind === "videoinput"
          );
          setCameraChecked(true);
        }
      } catch (err) {
        console.warn("⚠️ Vérification caméra échouée:", err);
        setCameraChecked(true);
      }
    };
    checkCameraPermissions();
  }, []);

  // ✅ Gestionnaires d'événements
  const handleAuthSuccess = useCallback(
    (userData) => {
      setIsAuthModalOpen(false);
      setConnectionStatus("connected");
      setHasNetworkError(false);
      
      // Invalidate videos query to refetch after authentication
      queryClient.invalidateQueries({ queryKey: ['videos', userData.id] });
      navigate("/");
    },
    [queryClient, navigate]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      navigate("/");
      // Invalider le cache des vidéos
      queryClient.removeQueries({ queryKey: ['videos'] });
    } catch (err) {
      console.error("❌ Erreur déconnexion:", err);
    }
  }, [signOut, navigate, queryClient]);

  const handleVideoUploaded = useCallback(() => {
    // Invalidate videos query to refetch
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['videos', user.id] });
    }
  }, [user, queryClient]);

  const handleRetryConnection = useCallback(async () => {
    setConnectionStatus("checking");
    setSupabaseError(null);
    setHasNetworkError(false);
    
    try {
      // Vérifier réseau d'abord
      const networkOk = await checkNetworkConnection();
      if (!networkOk) {
        setConnectionStatus("offline");
        setHasNetworkError(true);
        return;
      }

      const result = await checkSupabaseConnection();
      if (result.connected) {
        setConnectionStatus("connected");
        setHasNetworkError(false);
        // Invalidate videos query to refetch after reconnection
        if (user) {
          queryClient.invalidateQueries({ queryKey: ['videos', user.id] });
        }
      } else {
        setConnectionStatus("api_error");
        setSupabaseError(result.error);
        setHasNetworkError(true);
      }
    } catch (err) {
      setConnectionStatus("disconnected");
      setSupabaseError(err.message);
      setHasNetworkError(true);
    }
  }, [user, queryClient]);

  // ✅ Rendre l'UI de diagnostic si erreur critique
  if (hasNetworkError && connectionStatus !== "connected") {
    const errorMessage = 
      connectionStatus === "offline" 
        ? "Pas de connexion internet. Vérifiez votre réseau."
        : connectionStatus === "api_error"
        ? "Service temporairement indisponible. Réessayez dans quelques instants."
        : "Impossible de se connecter au service.";

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">
            {connectionStatus === "offline" ? "Hors ligne" : "Service limité"}
          </h2>
          
          <p className="text-gray-300 mb-6">
            {errorMessage}
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleRetryConnection}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              Réessayer la connexion
            </button>
            
            <button
              onClick={() => {
                setHasNetworkError(false);
                // Permettre à l'utilisateur de continuer quand même
              }}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              Continuer sans connexion
            </button>
          </div>
          
          <p className="text-gray-500 text-sm mt-6">
            SpotBulle 🇫🇷🇲🇦 • Support: support@spotbulle.fr
          </p>
        </div>
      </div>
    );
  }

  // ✅ Rendu normal de l'application
  return (
    <div className="app-container">
      <Toaster 
        position="top-right" 
        duration={5000} 
        closeButton 
        richColors 
        theme="dark" 
      />
      
      {/* Indicateur de statut en bas à gauche */}
      {connectionStatus !== "connected" && connectionStatus !== "checking" && (
        <div className={`fixed bottom-4 left-4 z-50 px-3 py-2 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg ${
          connectionStatus === "connected" ? "bg-green-500 text-white" :
          connectionStatus === "offline" ? "bg-red-500 text-white" :
          "bg-yellow-500 text-white"
        }`}>
          <span>
            {connectionStatus === "connected" ? "🟢" :
             connectionStatus === "offline" ? "🔴" : "🟡"}
          </span>
          <span>
            {connectionStatus === "connected" ? "Connecté" :
             connectionStatus === "offline" ? "Hors ligne" : "Service limité"}
          </span>
        </div>
      )}
      
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
        hasNetworkError={hasNetworkError}
        onRetryConnection={handleRetryConnection}
      />
      
      {/* Modal d'authentification */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        connectionStatus={connectionStatus}
      />
      
      {/* Service Worker */}
      <ServiceWorkerRegistration />
    </div>
  );
};

// ✅ WRAPPER pour AppContentProtected avec ErrorBoundaryEnhanced
const AppContentWithErrorBoundary = () => (
  <ErrorBoundaryEnhanced 
    FallbackComponent={SupabaseErrorFallback}
    onError={(error, errorInfo) => {
      console.error("🚨 Erreur Application (ErrorBoundaryEnhanced):", error, errorInfo);
    }}
  >
    <AppContentProtected />
  </ErrorBoundaryEnhanced>
);

// ✅ Configuration React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        // Ne pas retenter sur les erreurs 401/403 (authentification)
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Éviter les refetch gênants
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
  },
});

// ✅ COMPOSANT RACINE PRINCIPAL
function App() {
  
  return (
    // Niveau 1: GlobalErrorBoundary pour capturer TOUTES les erreurs React (page blanche)
    <GlobalErrorBoundary>
      {/* Niveau 2: React Query pour la gestion des données */}
      <QueryClientProvider client={queryClient}>
        {/* Niveau 3: Session Supabase */}
        <SessionContextProvider supabaseClient={supabase}>
          {/* Niveau 4: Auth Provider personnalisé */}
          <AuthProvider>
            {/* Niveau 5: Router React */}
            <Router>
              {/* Niveau 6: ErrorBoundaryEnhanced pour les erreurs fonctionnelles */}
              <AppContentWithErrorBoundary />
            </Router>
          </AuthProvider>
        </SessionContextProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
