import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
// ✅ CORRECTION CRITIQUE : Import CORRECT des hooks Supabase
import { SessionContextProvider, useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase.js';
import { Toaster } from 'sonner'; // ✅ AJOUT CRITIQUE : Import du Toaster
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

// ✅ NOUVEAU : Import de la page d'accueil simplifiée
import SimplifiedHome from '@/pages/SimplifiedHome.jsx';

import './App.css';
import './styles/design-system.css';

// ✅ CORRECTION : Composant RequireAuth amélioré
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const supabase = useSupabaseClient();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && !loading) {
          console.log('🚫 Aucune session active, redirection vers login');
        }
        setSessionChecked(true);
      } catch (error) {
        console.error('❌ Erreur vérification session:', error);
        setSessionChecked(true);
      }
    };
    
    if (!loading) {
      checkSession();
    }
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
  const [userProfile, setUserProfile] = useState(null);
  
  // ✅ CORRECTION : Utilisation des hooks Supabase DANS le SessionContextProvider
  const supabase = useSupabaseClient();
  const { user, loading, signOut, profile } = useAuth();
  const navigate = useNavigate();

  console.log('🔍 AppContent - User:', user?.id, 'Loading:', loading, 'Profile:', profile);

  // ✅ CORRECTION : Chargement du profil utilisateur
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;

      try {
        console.log('👤 Chargement du profil utilisateur:', user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('⚠️ Erreur chargement profil:', error);
          return;
        }

        if (data) {
          console.log('✅ Profil chargé:', data);
          setUserProfile(data);
        }
      } catch (error) {
        console.error('❌ Erreur chargement profil:', error);
      }
    };

    if (user) {
      loadUserProfile();
    }
  }, [user, supabase]);

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

      if (videosError) {
        console.warn('⚠️ Erreur récupération vidéos:', videosError);
        // Continuer même avec erreur
      }

      const videoList = videos || [];

      const dashboardData = {
        totalVideos: videoList.length,
        recentVideos: videoList.slice(0, 5) || [],
        videosByStatus: {
          ready: videoList.filter(v => v.status === 'ready' || v.status === 'uploaded').length || 0,
          processing: videoList.filter(v => v.status === 'processing' || v.status === 'analyzing').length || 0,
          analyzed: videoList.filter(v => v.status === 'analyzed').length || 0,
          failed: videoList.filter(v => v.status === 'failed' || v.status === 'error').length || 0
        },
        totalDuration: videoList.reduce((sum, video) => sum + (video.duration || 0), 0) || 0,
        transcribedCount: videoList.filter(v => v.transcription_data || v.transcript || v.transcription_text).length || 0,
        analyzedCount: videoList.filter(v => v.analysis || v.ai_result).length || 0
      };

      setDashboardData(dashboardData);
      console.log('✅ Données dashboard chargées:', dashboardData);

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
    
    // Recharger les données après authentification
    setTimeout(() => {
      loadDashboardData();
    }, 1000);
    
    navigate('/');
  };

  const handleSignOut = async () => {
    try {
      console.log('🚪 Déconnexion...');
      await signOut();
      setDashboardData(null);
      setUserProfile(null);
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
        // Recharger les données après reconnexion
        if (user) {
          loadDashboardData();
        }
      } else {
        setConnectionStatus('disconnected');
        setSupabaseError(result.error);
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setSupabaseError(error.message);
    }
  };

  // ✅ NOUVEAU : Gestion de la mise à jour du profil
  const handleProfileUpdated = () => {
    console.log('🔄 Profil mis à jour, rechargement...');
    // Recharger les données du profil
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserProfile(data);
          }
        });
    }
    loadDashboardData();
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
      {/* ✅ AJOUT CRITIQUE : Toaster pour les notifications */}
      <Toaster 
        position="top-right"
        duration={4000}
        closeButton
        richColors
        expand={false}
        visibleToasts={3}
        toastOptions={{
          className: 'sonner-toast',
          style: {
            background: 'var(--background)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          },
        }}
      />
      
      <Routes>
        {/* ✅ MODIFICATION : Route racine utilisant SimplifiedHome */}
        <Route path="/" element={
          user ? 
            <RequireAuth>
              <SimplifiedHome 
                user={user}
                profile={userProfile || profile}
                connectionStatus={connectionStatus}
                onSignOut={handleSignOut}
                dashboardData={dashboardData}
                loading={dashboardLoading}
                error={dashboardError}
                loadDashboardData={loadDashboardData}
                onProfileUpdated={handleProfileUpdated}
              />
            </RequireAuth>
          : 
            <WelcomeAgent onOpenAuthModal={() => setIsAuthModalOpen(true)} />
        } />
        
        {/* Routes d'authentification */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* ✅ AJOUT : Route pour l'ancien Home (conservé pour compatibilité) */}
        <Route path="/classic" element={
          <RequireAuth>
            <Home 
              user={user}
              profile={userProfile || profile}
              connectionStatus={connectionStatus}
              onSignOut={handleSignOut}
              dashboardData={dashboardData}
              dashboardLoading={dashboardLoading}
              dashboardError={dashboardError}
              loadDashboardData={loadDashboardData}
            />
          </RequireAuth>
        } />
        
        {/* Routes protégées */}
        <Route path="/record-video" element={
          <RequireAuth>
            <EnhancedRecordVideo 
              user={user}
              profile={userProfile || profile}
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
              profile={userProfile || profile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />
        
        <Route path="/video-vault" element={
          <RequireAuth>
            <VideoVault 
              user={user}
              profile={userProfile || profile}
              onSignOut={handleSignOut}
              onVideoAdded={handleVideoUploaded}
            />
          </RequireAuth>
        } />

        <Route path="/seminars" element={
          <RequireAuth>
            <SeminarsList 
              user={user}
              profile={userProfile || profile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />

        <Route path="/certification" element={
          <RequireAuth>
            <Certification 
              user={user}
              profile={userProfile || profile}
              onSignOut={handleSignOut}
            />
          </RequireAuth>
        } />
        
        <Route path="/video-analysis/:videoId" element={
          <RequireAuth>
            <VideoAnalysisPage 
              user={user}
              profile={userProfile || profile}
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
        
        {/* ✅ AJOUT : Route pour le tableau de bord standalone */}
        <Route path="/dashboard" element={
          <RequireAuth>
            <Dashboard 
              refreshKey={Date.now()}
              onVideoUploaded={handleVideoUploaded}
            />
          </RequireAuth>
        } />
        
        {/* Redirections */}
        <Route path="/old-home" element={<Navigate to="/" replace />} />
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
