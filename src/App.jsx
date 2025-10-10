import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
// ✅ CORRECTION CRITIQUE : Import CORRECT des hooks Supabase
import { SessionContextProvider, useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase.js';
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
import './App.css';
import './styles/design-system.css';

// ✅ CORRECTION : Composant RequireAuth amélioré
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const supabase = useSupabaseClient();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !loading) {
        console.log('🚫 Aucune session active, redirection vers login');
      }
      setSessionChecked(true);
    };
    checkSession();
  }, [supabase, loading]);

  if (loading || !sessionChecked) {
    return <LoadingScreen message="Vérification de l'authentification..." />;
  }
  
  return user ? children : <Navigate to="/login" replace />;
}

// ✅ CORRECTION : AppContent avec gestion d'erreur améliorée
function AppContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [cameraChecked, setCameraChecked] = useState(false);
  
  // ✅ CORRECTION : Utilisation des hooks Supabase DANS le SessionContextProvider
  const supabase = useSupabaseClient();
  const { user, loading, signOut, profile } = useAuth();
  const navigate = useNavigate();

  console.log('🔍 AppContent - User:', user?.id, 'Loading:', loading);

  // Vérification des permissions caméra
  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        if (typeof navigator.mediaDevices?.enumerateDevices === 'function') {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log(`📹 ${videoDevices.length} caméra(s) détectée(s)`);
        }
        setCameraChecked(true);
      } catch (error) {
        console.error('❌ Erreur vérification caméras:', error);
        setCameraChecked(true);
      }
    };

    if (!loading) {
      checkCameraPermissions();
    }
  }, [loading]);

  // Vérification connexion Supabase
  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('🔄 Vérification connexion Supabase...');
        const result = await checkSupabaseConnection();
        
        if (result.connected) {
          setConnectionStatus('connected');
          setSupabaseError(null);
          console.log('✅ Connexion Supabase OK');
        } else {
          setConnectionStatus('disconnected');
          setSupabaseError(result.error);
          console.error('❌ Connexion Supabase échouée:', result.error);
        }
      } catch (error) {
        console.error('❌ Erreur vérification connexion:', error);
        setConnectionStatus('disconnected');
        setSupabaseError(error.message);
      }
    };

    checkConnection();
  }, []);

  // Chargement des données dashboard
  const loadDashboardData = async () => {
    if (!user) {
      console.log('👤 Aucun utilisateur connecté');
      return;
    }

    try {
      setDashboardLoading(true);
      setDashboardError(null);
      
      console.log('📊 Chargement données dashboard pour:', user.id);

      // Requête simplifiée et robuste
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;

      const dashboardData = {
        totalVideos: videos?.length || 0,
        recentVideos: videos?.slice(0, 5) || [],
        videosByStatus: {
          ready: videos?.filter(v => v.status === 'ready' || v.status === 'uploaded').length || 0,
          processing: videos?.filter(v => v.status === 'processing' || v.status === 'analyzing').length || 0,
          analyzed: videos?.filter(v => v.status === 'analyzed').length || 0,
          failed: videos?.filter(v => v.status === 'failed').length || 0
        },
        totalDuration: videos?.reduce((sum, video) => sum + (video.duration || 0), 0) || 0
      };

      setDashboardData(dashboardData);
      console.log('✅ Données dashboard chargées');

    } catch (err) {
      console.error('❌ Erreur chargement dashboard:', err);
      setDashboardError(err.message);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Chargement données quand utilisateur change
  useEffect(() => {
    if (user && connectionStatus === 'connected') {
      loadDashboardData();
    }
  }, [user, connectionStatus]);

  const handleAuthSuccess = (userData) => {
    console.log('✅ Utilisateur authentifié:', userData.id);
    setIsAuthModalOpen(false);
    setConnectionStatus('connected');
    navigate('/');
  };

  const handleSignOut = async () => {
    try {
      console.log('🚪 Déconnexion...');
      await signOut();
      setDashboardData(null);
      setShowOnboarding(false);
      navigate('/');
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
      navigate('/');
    }
  };

  const handleVideoUploaded = () => {
    console.log('🎥 Vidéo uploadée, rechargement données');
    loadDashboardData();
  };

  const handleRetryConnection = async () => {
    setConnectionStatus('checking');
    setSupabaseError(null);
    
    try {
      const result = await checkSupabaseConnection();
      if (result.connected) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
        setSupabaseError(result.error);
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setSupabaseError(error.message);
    }
  };

  if (loading) {
    return <LoadingScreen message="Chargement de l'application..." />;
  }

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
      <Routes>
        {/* Route racine */}
        <Route path="/" element={
          user ? 
            <RequireAuth>
              <Home 
                dashboardData={dashboardData}
                loading={dashboardLoading}
                error={dashboardError}
                loadDashboardData={loadDashboardData}
                user={user}
                profile={profile}
                connectionStatus={connectionStatus}
                onSignOut={handleSignOut}
                onAuthModalOpen={() => setIsAuthModalOpen(true)}
              />
            </RequireAuth>
          : 
            <WelcomeAgent onOpenAuthModal={() => setIsAuthModalOpen(true)} />
        } />
        
        {/* Routes d'authentification */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Routes protégées */}
        <Route path="/record-video" element={
          <RequireAuth>
            <EnhancedRecordVideo 
              user={user}
              profile={profile}
              onSignOut={handleSignOut}
              onVideoUploaded={handleVideoUploaded}
              cameraChecked={cameraChecked}
            />
          </RequireAuth>
        } />
        
        <Route path="/personality-test" element={
          <RequireAuth>
            <FourColorsTest 
              user={user}
              profile={profile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />
        
        <Route path="/video-vault" element={
          <RequireAuth>
            <VideoVault 
              user={user}
              profile={profile}
              onSignOut={handleSignOut}
              onVideoAdded={handleVideoUploaded}
            />
          </RequireAuth>
        } />

        <Route path="/seminars" element={
          <RequireAuth>
            <SeminarsList 
              user={user}
              profile={profile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />

        <Route path="/certification" element={
          <RequireAuth>
            <Certification 
              user={user}
              profile={profile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />
        
        <Route path="/video-analysis/:videoId" element={
          <RequireAuth>
            <VideoAnalysisPage 
              user={user}
              profile={profile}
              onSignOut={handleSignOut}
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
        
        {/* Redirections */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Modal d'authentification */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

// ✅ CORRECTION CRITIQUE : Composant App principal avec SessionContextProvider
function App() {
  console.log('🚀 Initialisation de App');
  
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <AuthProvider>
        <ErrorBoundaryEnhanced FallbackComponent={SupabaseErrorFallback}>
          <AppContent />
        </ErrorBoundaryEnhanced>
      </AuthProvider>
    </SessionContextProvider>
  );
}

export default App;
