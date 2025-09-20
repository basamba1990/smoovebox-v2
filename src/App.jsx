// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import VideoManagement from './pages/VideoManagement.jsx';
import EnhancedVideoUploader from './components/EnhancedVideoUploader.jsx';
import ProgressTracking from './components/ProgressTracking.jsx';
import ErrorBoundaryEnhanced, { SupabaseErrorFallback } from './components/ErrorBoundaryEnhanced.jsx';
import EmptyState from './components/EmptyState.jsx';
import ProfessionalHeader from './components/ProfessionalHeader.jsx';
import ModernTabs from './components/ModernTabs.jsx';
import WelcomeAgent from './components/WelcomeAgent.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { supabase, checkSupabaseConnection } from './lib/supabase.js';
import LoadingScreen from './components/LoadingScreen.jsx';
import SupabaseDiagnostic from './components/SupabaseDiagnostic.jsx';
import './App.css';
import './styles/design-system.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [postLoginRedirect, setPostLoginRedirect] = useState(null);

  const { user, loading, signOut, profile } = useAuth();
  const navigate = useNavigate();

  const loadDashboardData = async () => {
    if (!user || !isAuthenticated) {
      setDashboardData(null);
      return;
    }

    try {
      setDashboardLoading(true);
      setDashboardError(null);

      // Récupération des vidéos
      let videos = [];
      try {
        const { data: videosData, error: vError } = await supabase
          .from('videos')
          .select(`*, transcriptions (*)`)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (vError) throw vError;
        videos = videosData;
      } catch {
        // fallback simple
        const { data: videosData, error: vError } = await supabase
          .from('videos')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (vError) throw vError;
        videos = videosData;
      }

      // Récupération stats
      let stats = null;
      try {
        const { data: statsData, error: statsError } = await supabase
          .rpc('get_user_video_stats', { user_id_param: user.id });
        if (!statsError) stats = statsData;
      } catch {}

      const dashboardData = {
        totalVideos: videos.length,
        recentVideos: videos.slice(0, 5),
        videosByStatus: {
          ready: videos.filter(v => ['ready','uploaded','published'].includes(v.status)).length,
          processing: videos.filter(v => ['processing','analyzing','transcribing'].includes(v.status)).length,
          transcribed: videos.filter(v => v.transcription_text || (v.transcription_data && Object.keys(v.transcription_data).length > 0)).length,
          analyzed: videos.filter(v => v.analysis_result || v.analysis || v.ai_result).length,
          failed: videos.filter(v => v.status === 'failed').length
        },
        totalDuration: videos.reduce((sum, v) => sum + (v.duration || 0), 0),
        transcriptionsCount: videos.filter(v => v.transcription_text || (v.transcription_data && Object.keys(v.transcription_data).length > 0)).length,
        analysisCount: videos.filter(v => v.analysis_result || v.analysis || v.ai_result).length,
        videoPerformance: stats?.performance_data || [],
        progressStats: stats?.progress_stats || { completed:0, inProgress:0, totalTime:0 }
      };

      setDashboardData(dashboardData);
    } catch (err) {
      console.error('Erreur dashboard:', err);
      setDashboardData(null);
      setDashboardError(err.message || 'Erreur lors de la récupération des données');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (user && profile) {
        setIsAuthenticated(true);
        setShowWelcome(false);
        if (isAuthModalOpen) setIsAuthModalOpen(false);
        if (activeTab === 'dashboard') loadDashboardData().catch(console.error);
        if (postLoginRedirect) {
          navigate(postLoginRedirect);
          setPostLoginRedirect(null);
        }
      } else {
        setIsAuthenticated(false);
        setDashboardData(null);
        setShowWelcome(true);
      }
    }
  }, [user, profile, loading, activeTab, isAuthModalOpen]);

  useEffect(() => {
    if (!loading) {
      const checkConnection = async () => {
        try {
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
          const connectionResult = await Promise.race([checkSupabaseConnection(), timeoutPromise]);
          if (connectionResult.connected) {
            setConnectionStatus('connected');
            setSupabaseError(null);
          } else {
            setConnectionStatus('disconnected');
            setSupabaseError(connectionResult.error);
          }
        } catch (error) {
          setConnectionStatus('disconnected');
          setSupabaseError(`Erreur: ${error.message}`);
        }
      };
      const timer = setTimeout(checkConnection, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleAuthSuccess = (userData) => {
    setIsAuthModalOpen(false);
    setShowWelcome(false);
    setIsAuthenticated(true);
    if (postLoginRedirect) {
      navigate(postLoginRedirect);
      setPostLoginRedirect(null);
    } else {
      setActiveTab('dashboard');
      navigate('/dashboard');
    }
    loadDashboardData().catch(console.error);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      setDashboardData(null);
      setIsAuthenticated(false);
      setActiveTab('dashboard');
      setShowWelcome(true);
      navigate('/');
    }
  };

  const handleGoDashboard = () => {
    if (user && isAuthenticated) {
      navigate('/dashboard');
    } else {
      setPostLoginRedirect('/dashboard');
      setIsAuthModalOpen(true);
    }
  };

  const handleRetryConnection = async () => {
    setConnectionStatus('checking');
    setSupabaseError(null);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
      const connectionResult = await Promise.race([checkSupabaseConnection(), timeoutPromise]);
      if (connectionResult.connected) {
        setConnectionStatus('connected');
        setSupabaseError(null);
      } else {
        setConnectionStatus('disconnected');
        setSupabaseError(connectionResult.error);
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setSupabaseError(`Erreur: ${error.message}`);
    }
  };

  if (loading) return <LoadingScreen />;
  if (supabaseError) return <SupabaseDiagnostic error={supabaseError} onRetry={handleRetryConnection} onContinue={() => setSupabaseError(null)} />;

  return (
    <Routes>
      <Route path="/" element={
        showWelcome && !isAuthenticated ? (
          <>
            <WelcomeAgent onOpenAuthModal={() => setIsAuthModalOpen(true)} />
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => setIsAuthModalOpen(false)}
              onSuccess={handleAuthSuccess}
            />
          </>
        ) : (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
            <ProfessionalHeader
              user={user}
              profile={profile}
              connectionStatus={connectionStatus}
              onSignOut={handleSignOut}
              onAuthModalOpen={() => setIsAuthModalOpen(true)}
            />
            <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
              <ModernTabs activeTab={activeTab} onTabChange={setActiveTab} user={user} />
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsContent value="dashboard">
                  {dashboardLoading ? <LoadingScreen message="Chargement du dashboard..." /> :
                   dashboardError ? <EmptyState type="error" onAction={() => loadDashboardData()} /> :
                   !dashboardData || dashboardData.totalVideos === 0 ? <EmptyState type="dashboard" onAction={() => setActiveTab('upload')} /> :
                   <Dashboard data={dashboardData} />
                  }
                </TabsContent>
                <TabsContent value="videos"><VideoManagement /></TabsContent>
                <TabsContent value="upload"><EnhancedVideoUploader /></TabsContent>
                <TabsContent value="progress"><ProgressTracking userId={user.id} userProfile={profile} isVisible /></TabsContent>
              </Tabs>
            </main>
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => setIsAuthModalOpen(false)}
              onSuccess={handleAuthSuccess}
            />
          </div>
        )
      } />
      <Route path="/dashboard" element={
        isAuthenticated ? (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
            <ProfessionalHeader
              user={user}
              profile={profile}
              connectionStatus={connectionStatus}
              onSignOut={handleSignOut}
              onAuthModalOpen={() => setIsAuthModalOpen(true)}
            />
            <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
              <ModernTabs activeTab={activeTab} onTabChange={setActiveTab} user={user} />
              <Tabs value="dashboard" className="w-full">
                <TabsContent value="dashboard">
                  {dashboardLoading ? <LoadingScreen message="Chargement du dashboard..." /> :
                   dashboardError ? <EmptyState type="error" onAction={() => loadDashboardData()} /> :
                   !dashboardData || dashboardData.totalVideos === 0 ? <EmptyState type="dashboard" onAction={() => setActiveTab('upload')} /> :
                   <Dashboard data={dashboardData} />
                  }
                </TabsContent>
              </Tabs>
            </main>
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => setIsAuthModalOpen(false)}
              onSuccess={handleAuthSuccess}
            />
          </div>
        ) : <Navigate to="/" replace />
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ErrorBoundaryEnhanced FallbackComponent={SupabaseErrorFallback}>
        <AppContent />
      </ErrorBoundaryEnhanced>
    </AuthProvider>
  );
}

export default App;
