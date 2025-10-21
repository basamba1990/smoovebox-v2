// ✅ VERSION COMPLÈTE : App.jsx corrigé et optimisé
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SessionContextProvider, useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase.js';
import { Toaster } from 'sonner';

// Import des composants
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import ErrorBoundaryEnhanced, { SupabaseErrorFallback } from './components/ErrorBoundaryEnhanced.jsx';
import WelcomeAgent from './components/WelcomeAgent.jsx';
import { checkSupabaseConnection } from './lib/supabase.js';
import LoadingScreen from './components/LoadingScreen.jsx';
import SupabaseDiagnostic from './components/SupabaseDiagnostic.jsx';
import AuthCallback from '@/pages/AuthCallback.jsx';
import ResetPassword from '@/pages/ResetPassword.jsx';
import EnhancedRecordVideo from '@/pages/enhanced-record-video.jsx';
import VideoSuccess from '@/pages/video-success.jsx';
import Directory from '@/pages/directory.jsx';
import Login from '@/pages/login.jsx';
import ProfessionalHeader from './components/ProfessionalHeader.jsx';
import Home from '@/pages/home.jsx';
import VideoAnalysisPage from '@/pages/video-analysis.jsx';
import UserJourneyOnboarding from '@/components/UserJourneyOnboarding.jsx';
import VideoVault from '@/pages/video-vault.jsx';
import FourColorsTest from '@/components/FourColorsTest.jsx';
import SeminarsList from '@/components/SeminarsList.jsx';
import Certification from '@/components/Certification.jsx';
import SimplifiedHome from '@/pages/SimplifiedHome.jsx';

import './App.css';
import './styles/design-system.css';

// ✅ HOOK PERSONNALISÉ : Gestion de session optimisée
const useSessionManager = () => {
  const supabase = useSupabaseClient();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [session, setSession] = useState(null);

  const checkSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      setSession(session);
      return session;
    } catch (error) {
      console.error('❌ Erreur vérification session:', error);
      return null;
    } finally {
      setSessionChecked(true);
    }
  }, [supabase]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return { session, sessionChecked, checkSession };
};

// ✅ COMPOSANT : Gestion d'authentification sécurisée
const RequireAuth = ({ children, fallbackPath = '/login' }) => {
  const { user, loading } = useAuth();
  const { session, sessionChecked } = useSessionManager();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && sessionChecked && !user && !session) {
      console.log('🔐 Redirection vers login - session invalide');
      navigate(fallbackPath, { replace: true });
    }
  }, [user, session, loading, sessionChecked, navigate, fallbackPath]);

  if (loading || !sessionChecked) {
    return (
      <LoadingScreen 
        message="Vérification de sécurité..." 
        subtitle="Authentification en cours"
      />
    );
  }

  if (!user || !session) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

// ✅ COMPOSANT : Gestion des erreurs avancée
const ErrorBoundaryWrapper = ({ children }) => (
  <ErrorBoundaryEnhanced 
    FallbackComponent={SupabaseErrorFallback}
    onError={(error, errorInfo) => {
      // Journalisation des erreurs
      console.error('🚨 Erreur Application:', error, errorInfo);
      // Envoi à un service de monitoring
      if (window.sentry) {
        window.sentry.captureException(error, { extra: errorInfo });
      }
    }}
  >
    {children}
  </ErrorBoundaryEnhanced>
);

// ✅ HOOK : Gestion des données utilisateur
const useUserData = () => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUserProfile = useCallback(async () => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (err) {
      console.error('❌ Erreur chargement profil:', err);
      setError(err.message);
    }
  }, [user, supabase]);

  const loadDashboardData = useCallback(async () => {
    if (!user) {
      setDashboardData(null);
      return;
    }

    try {
      setLoading(true);
      
      // Requête optimisée avec jointure
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select(`
          *,
          transcription_data,
          analysis,
          profiles!inner(full_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;

      const videoList = videos || [];
      const stats = {
        totalVideos: videoList.length,
        recentVideos: videoList.slice(0, 5),
        videosByStatus: {
          ready: videoList.filter(v => ['ready', 'uploaded'].includes(v.status)).length,
          processing: videoList.filter(v => ['processing', 'analyzing'].includes(v.status)).length,
          analyzed: videoList.filter(v => v.status === 'analyzed').length,
          failed: videoList.filter(v => ['failed', 'error'].includes(v.status)).length
        },
        totalDuration: videoList.reduce((sum, video) => sum + (video.duration || 0), 0),
        transcribedCount: videoList.filter(v => v.transcription_data || v.transcription_text).length,
        analyzedCount: videoList.filter(v => v.analysis || v.ai_result).length,
        engagementScore: calculateEngagementScore(videoList)
      };

      setDashboardData(stats);
    } catch (err) {
      console.error('❌ Erreur chargement dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  const calculateEngagementScore = (videos) => {
    if (videos.length === 0) return 0;
    
    let score = 0;
    videos.forEach(video => {
      if (video.analysis) score += 40;
      else if (video.transcription_data) score += 30;
      else if (video.status === 'processed') score += 20;
      else score += 10;
    });

    return Math.round(score / videos.length);
  };

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadDashboardData();
    }
  }, [user, loadUserProfile, loadDashboardData]);

  const refreshData = useCallback(() => {
    loadUserProfile();
    loadDashboardData();
  }, [loadUserProfile, loadDashboardData]);

  return {
    userProfile,
    dashboardData,
    loading,
    error,
    refreshData,
    loadUserProfile,
    loadDashboardData
  };
};

// ✅ COMPOSANT PRINCIPAL : AppContent optimisé
const AppContent = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const { user, signOut } = useAuth();
  const { userProfile, dashboardData, loading, error, refreshData } = useUserData();
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [cameraChecked, setCameraChecked] = useState(false);

  // ✅ Vérification connexion Supabase
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🔄 Initialisation SpotBulle...');
        const result = await checkSupabaseConnection();
        
        if (result.connected) {
          setConnectionStatus('connected');
          setSupabaseError(null);
          console.log('✅ Connexion Supabase établie');
        } else {
          setConnectionStatus('disconnected');
          setSupabaseError(result.error);
          console.error('❌ Connexion Supabase échouée:', result.error);
        }
      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        setConnectionStatus('disconnected');
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
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log(`📹 ${videoDevices.length} caméra(s) détectée(s)`);
          setCameraChecked(true);
        }
      } catch (err) {
        console.warn('⚠️ Vérification caméra échouée:', err);
        setCameraChecked(true);
      }
    };

    checkCameraPermissions();
  }, []);

  // ✅ Gestionnaires d'événements optimisés
  const handleAuthSuccess = useCallback((userData) => {
    console.log('✅ Utilisateur authentifié:', userData.id);
    setIsAuthModalOpen(false);
    setConnectionStatus('connected');
    refreshData();
    navigate('/');
  }, [refreshData, navigate]);

  const handleSignOut = useCallback(async () => {
    try {
      console.log('🚪 Déconnexion utilisateur...');
      await signOut();
      refreshData();
      navigate('/');
      toast.success('Déconnexion réussie');
    } catch (err) {
      console.error('❌ Erreur déconnexion:', err);
      toast.error('Erreur lors de la déconnexion');
    }
  }, [signOut, refreshData, navigate]);

  const handleVideoUploaded = useCallback(() => {
    console.log('🎥 Vidéo uploadée - rechargement données');
    refreshData();
    toast.success('Vidéo traitée avec succès !');
  }, [refreshData]);

  const handleRetryConnection = useCallback(async () => {
    setConnectionStatus('checking');
    setSupabaseError(null);
    
    try {
      const result = await checkSupabaseConnection();
      if (result.connected) {
        setConnectionStatus('connected');
        refreshData();
      } else {
        setConnectionStatus('disconnected');
        setSupabaseError(result.error);
      }
    } catch (err) {
      setConnectionStatus('disconnected');
      setSupabaseError(err.message);
    }
  }, [refreshData]);

  // ✅ Rendu conditionnel des erreurs
  if (supabaseError && connectionStatus === 'disconnected') {
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
      {/* ✅ Configuration Toaster avancée */}
      <Toaster 
        position="top-right"
        duration={5000}
        closeButton
        richColors
        expand={true}
        visibleToasts={5}
        theme="dark"
        toastOptions={{
          className: 'sonner-toast spotbulle-toast',
          style: {
            background: 'hsl(222 84% 4.9%)',
            color: 'hsl(210 40% 98%)',
            border: '1px solid hsl(217.2 32.6% 17.5%)',
          },
        }}
      />
      
      <Routes>
        {/* Route racine intelligente */}
        <Route path="/" element={
          user ? 
            <RequireAuth>
              <SimplifiedHome 
                user={user}
                profile={userProfile}
                connectionStatus={connectionStatus}
                onSignOut={handleSignOut}
                dashboardData={dashboardData}
                loading={loading}
                error={error}
                loadDashboardData={refreshData}
                onProfileUpdated={refreshData}
              />
            </RequireAuth>
          : 
            <WelcomeAgent 
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onDemoMode={() => navigate('/demo')}
            />
        } />
        
        {/* Routes d'authentification */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Routes protégées avec gestion d'erreur */}
        <Route path="/record-video" element={
          <RequireAuth>
            <EnhancedRecordVideo 
              user={user}
              profile={userProfile}
              onSignOut={handleSignOut}
              onVideoUploaded={handleVideoUploaded}
              cameraChecked={cameraChecked}
            />
          </RequireAuth>
        } />
        
        <Route path="/dashboard" element={
          <RequireAuth>
            <Dashboard 
              refreshKey={Date.now()}
              onVideoUploaded={handleVideoUploaded}
              userProfile={userProfile}
            />
          </RequireAuth>
        } />

        <Route path="/video-vault" element={
          <RequireAuth>
            <VideoVault 
              user={user}
              profile={userProfile}
              onSignOut={handleSignOut}
              onVideoAdded={handleVideoUploaded}
            />
          </RequireAuth>
        } />

        <Route path="/video-analysis/:videoId" element={
          <RequireAuth>
            <VideoAnalysisPage 
              user={user}
              profile={userProfile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />

        <Route path="/personality-test" element={
          <RequireAuth>
            <FourColorsTest 
              user={user}
              profile={userProfile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />

        <Route path="/seminars" element={
          <RequireAuth>
            <SeminarsList 
              user={user}
              profile={userProfile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />

        <Route path="/certification" element={
          <RequireAuth>
            <Certification 
              user={user}
              profile={userProfile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />

        {/* Routes de compatibilité */}
        <Route path="/classic" element={
          <RequireAuth>
            <Home 
              user={user}
              profile={userProfile}
              connectionStatus={connectionStatus}
              onSignOut={handleSignOut}
              dashboardData={dashboardData}
              dashboardLoading={loading}
              dashboardError={error}
              loadDashboardData={refreshData}
            />
          </RequireAuth>
        } />

        <Route path="/video-success" element={
          <RequireAuth>
            <VideoSuccess />
          </RequireAuth>
        } />

        <Route path="/directory" element={
          <RequireAuth>
            <Directory />
          </RequireAuth>
        } />

        {/* Routes de démonstration (non protégées) */}
        <Route path="/demo" element={<WelcomeAgent demoMode={true} />} />
        <Route path="/features" element={<WelcomeAgent showFeatures={true} />} />

        {/* Gestion des erreurs 404 */}
        <Route path="/404" element={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="text-center text-white">
              <h1 className="text-6xl font-bold mb-4">404</h1>
              <p className="text-xl mb-8">Page non trouvée</p>
              <Button onClick={() => navigate('/')}>
                Retour à l'accueil
              </Button>
            </div>
          </div>
        } />

        {/* Redirection catch-all */}
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>

      {/* Modal d'authentification */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* ✅ Service Worker pour les performances */}
      <ServiceWorkerRegistration />
    </div>
  );
};

// ✅ COMPOSANT : Enregistrement Service Worker
const ServiceWorkerRegistration = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('✅ Service Worker enregistré:', registration);
        })
        .catch(error => {
          console.log('❌ Erreur Service Worker:', error);
        });
    }
  }, []);

  return null;
};

// ✅ COMPOSANT RACINE : App principal
function App() {
  console.log('🚀 Initialisation SpotBulle v2.0');

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
