// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import VideoManagement from './pages/VideoManagement.jsx';
import EnhancedVideoUploader from './components/EnhancedVideoUploader.jsx';
import ProgressTracking from './components/ProgressTracking.jsx';
import { SupabaseErrorFallback } from './components/ErrorBoundaryEnhanced.jsx';
import EmptyState from './components/EmptyState.jsx';
import ProfessionalHeader from './components/ProfessionalHeader.jsx';
import WelcomeAgent from './components/WelcomeAgent.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import SupabaseDiagnostic from './components/SupabaseDiagnostic.jsx';
import { supabase, checkSupabaseConnection } from './lib/supabase.js';
import './App.css';
import './styles/design-system.css';

function AppContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const { user, loading, signOut, profile } = useAuth();
  const navigate = useNavigate();

  const loadDashboardData = async () => {
    if (!user) {
      console.log('Aucun utilisateur connecté, aucune donnée à charger');
      setDashboardData(null);
      return;
    }

    try {
      setDashboardLoading(true);
      setDashboardError(null);
      console.log('Chargement des données dashboard pour:', user.id);

      const { data: videosData, error: vError } = await supabase
        .from('videos')
        .select('*, transcriptions (*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (vError) {
        console.warn('Erreur lors de la récupération des vidéos:', vError);
        throw vError;
      }

      const { data: statsData, error: statsError } = await supabase
        .rpc('get_user_video_stats', { user_id_param: user.id });

      if (statsError) {
        console.warn('Erreur lors de la récupération des statistiques:', statsError);
      }

      const dashboardData = {
        totalVideos: videosData?.length || 0,
        recentVideos: videosData?.slice(0, 5) || [],
        videosByStatus: {
          ready: videosData?.filter(v => ['ready', 'uploaded', 'published'].includes(v.status)).length || 0,
          processing: videosData?.filter(v => ['processing', 'analyzing', 'transcribing'].includes(v.status)).length || 0,
          transcribed: videosData?.filter(v => v.transcription_text?.length > 0 || Object.keys(v.transcription_data || {}).length > 0).length || 0,
          analyzed: videosData?.filter(v => Object.keys(v.analysis_result || {}).length > 0 || Object.keys(v.analysis || {}).length > 0 || (v.ai_result?.length > 0)).length || 0,
          failed: videosData?.filter(v => v.status === 'failed').length || 0,
        },
        totalDuration: videosData?.reduce((sum, video) => sum + (video.duration || 0), 0) || 0,
        transcriptionsCount: videosData?.filter(v => v.transcription_text?.length > 0 || Object.keys(v.transcription_data || {}).length > 0).length || 0,
        analysisCount: videosData?.filter(v => Object.keys(v.analysis_result || {}).length > 0 || Object.keys(v.analysis || {}).length > 0 || (v.ai_result?.length > 0)).length || 0,
        videoPerformance: statsData?.performance_data || [],
        progressStats: statsData?.progress_stats || { completed: 0, inProgress: 0, totalTime: 0 },
      };

      setDashboardData(dashboardData);
      console.log('Données dashboard chargées:', dashboardData);
    } catch (err) {
      console.error('Erreur lors du chargement des données dashboard:', err);
      setDashboardError(err.message || 'Erreur lors de la récupération des données');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('Vérification de la connexion Supabase...');
        const { connected, error } = await checkSupabaseConnection();
        if (connected) {
          setConnectionStatus('connected');
          setSupabaseError(null);
        } else {
          console.warn('Connexion Supabase échouée:', error);
          setConnectionStatus('disconnected');
          setSupabaseError(error || 'Erreur de connexion Supabase');
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de connexion:', error);
        setConnectionStatus('disconnected');
        setSupabaseError(`Erreur de vérification: ${error.message}`);
      }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const handleAuthSuccess = (userData) => {
    console.log('Utilisateur authentifié avec succès:', userData.id);
    setIsAuthModalOpen(false);
    navigate('/record-video');
  };

  const handleSignOut = async () => {
    try {
      console.log('Déconnexion demandée');
      await signOut();
      setDashboardData(null);
      navigate('/');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      navigate('/');
    }
  };

  if (loading) {
    return <LoadingScreen message="Vérification de l'authentification..." />;
  }

  if (supabaseError) {
    return (
      <SupabaseDiagnostic
        error={supabaseError}
        onRetry={async () => {
          setConnectionStatus('checking');
          setSupabaseError(null);
          const { connected, error } = await checkSupabaseConnection();
          setConnectionStatus(connected ? 'connected' : 'disconnected');
          setSupabaseError(error || null);
        }}
        onContinue={() => setSupabaseError(null)}
      />
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate to="/record-video" replace />
          ) : (
            <>
              <WelcomeAgent onOpenAuthModal={() => setIsAuthModalOpen(true)} />
              <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onAuthSuccess={handleAuthSuccess}
              />
            </>
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          user ? (
            <>
              <ProfessionalHeader
                user={user}
                profile={profile}
                connectionStatus={connectionStatus}
                onSignOut={handleSignOut}
                onAuthModalOpen={() => setIsAuthModalOpen(true)}
              />
              {dashboardLoading ? (
                <LoadingScreen message="Chargement des données du dashboard..." />
              ) : dashboardError ? (
                <EmptyState
                  type="error"
                  message={dashboardError}
                  onAction={() => loadDashboardData()}
                  loading={dashboardLoading}
                />
              ) : !dashboardData || dashboardData.totalVideos === 0 ? (
                <EmptyState
                  type="dashboard"
                  message="Aucune vidéo disponible. Commencez par en uploader une !"
                  onAction={() => navigate('/record-video')}
                />
              ) : (
                <Dashboard
                  data={dashboardData}
                  onVideoSelect={(videoId) => navigate(`/video/${videoId}`)}
                />
              )}
              <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onAuthSuccess={handleAuthSuccess}
              />
            </>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return <AppContent />;
}

export default App;
