import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
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
import { supabase, checkSupabaseConnection } from './lib/supabase.js';
import LoadingScreen from './components/LoadingScreen.jsx';
import SupabaseDiagnostic from './components/SupabaseDiagnostic.jsx';
import './App.css';
import './styles/design-system.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
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

      const { data: videosData, error: vError } = await supabase
        .from('videos')
        .select('*, transcriptions(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (vError) throw vError;

      const dashboardData = {
        totalVideos: videosData.length,
        recentVideos: videosData.slice(0, 5),
      };
      setDashboardData(dashboardData);
    } catch (err) {
      console.error('Erreur dashboard:', err);
      setDashboardError(err.message || 'Erreur lors de la récupération des données');
      setDashboardData(null);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (user && profile) {
        setIsAuthenticated(true);
        setShowWelcome(false);
        if (activeTab === 'dashboard') loadDashboardData();
        if (isAuthModalOpen) setIsAuthModalOpen(false);
      } else {
        setIsAuthenticated(false);
        setDashboardData(null);
        setShowWelcome(true);
      }
    }
  }, [user, profile, loading, activeTab, isAuthModalOpen]);

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    setShowWelcome(false);
    setActiveTab('dashboard');
    navigate('/dashboard');
    loadDashboardData();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      setDashboardData(null);
      setIsAuthenticated(false);
      setShowWelcome(true);
      navigate('/');
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route
        path="/"
        element={
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
            <>
              <ProfessionalHeader
                user={user}
                profile={profile}
                connectionStatus={connectionStatus}
                onSignOut={handleSignOut}
                onAuthModalOpen={() => setIsAuthModalOpen(true)}
              />
              <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                <ModernTabs activeTab={activeTab} onTabChange={setActiveTab} user={user} />
              </main>
              <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSuccess={handleAuthSuccess}
              />
            </>
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <>
              <ProfessionalHeader
                user={user}
                profile={profile}
                connectionStatus={connectionStatus}
                onSignOut={handleSignOut}
                onAuthModalOpen={() => setIsAuthModalOpen(true)}
              />
              <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                {dashboardLoading ? (
                  <LoadingScreen message="Chargement des données du dashboard..." />
                ) : dashboardError ? (
                  <EmptyState type="error" onAction={() => loadDashboardData()} />
                ) : !dashboardData ? (
                  <EmptyState type="dashboard" onAction={() => {}} />
                ) : (
                  <Dashboard data={dashboardData} />
                )}
              </main>
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
  return (
    <AuthProvider>
      <ErrorBoundaryEnhanced FallbackComponent={SupabaseErrorFallback}>
        <AppContent />
      </ErrorBoundaryEnhanced>
    </AuthProvider>
  );
}

export default App;
