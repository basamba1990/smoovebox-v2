import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import ErrorBoundaryEnhanced, { SupabaseErrorFallback } from './components/ErrorBoundaryEnhanced.jsx';
import WelcomeAgent from './components/WelcomeAgent.jsx';
import { supabase, checkSupabaseConnection } from './lib/supabase.js';
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
import './App.css';
import './styles/design-system.css';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen message="Vérification de l'authentification..." />;
  return user ? children : <Navigate to="/" replace />;
}

function AppContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
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
      
      let videos = [];
      try {
        const { data: videosData, error: vError } = await supabase
          .from('videos')
          .select('*, transcriptions(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (vError) throw vError;
        videos = videosData;
      } catch (viewError) {
        console.warn('Utilisation du fallback vers une requête simple');
        const { data: videosData, error: vError } = await supabase
          .from('videos')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (vError) throw vError;
        videos = videosData;
      }

      let stats = null;
      try {
        const { data: statsData, error: statsError } = await supabase
          .rpc('get_user_video_stats', { user_id_param: user.id });
        
        if (statsError) {
          console.warn('Erreur lors de la récupération des statistiques:', statsError);
        } else {
          stats = statsData;
        }
      } catch (statsError) {
        console.warn('Exception lors de la récupération des statistiques:', statsError);
      }

      const dashboardData = {
        totalVideos: videos.length,
        recentVideos: videos.slice(0, 5),
        videosByStatus: {
          ready: videos.filter(v => v.status === 'ready' || v.status === 'uploaded' || v.status === 'published').length,
          processing: videos.filter(v => v.status === 'processing' || v.status === 'analyzing' || v.status === 'transcribing').length,
          transcribed: videos.filter(v => {
            return v.transcription_text && v.transcription_text.length > 0 || 
                   (v.transcription_data && Object.keys(v.transcription_data).length > 0);
          }).length,
          analyzed: videos.filter(v => {
            return v.analysis_result && Object.keys(v.analysis_result).length > 0 || 
                   (v.analysis && Object.keys(v.analysis).length > 0) || 
                   (v.ai_result && v.ai_result.length > 0);
          }).length,
          failed: videos.filter(v => v.status === 'failed').length
        },
        totalDuration: videos.reduce((sum, video) => sum + (video.duration || 0), 0),
        transcriptionsCount: videos.filter(v => {
          return v.transcription_text && v.transcription_text.length > 0 || 
                 (v.transcription_data && Object.keys(v.transcription_data).length > 0);
        }).length,
        analysisCount: videos.filter(v => {
          return v.analysis_result && Object.keys(v.analysis_result).length > 0 || 
                 (v.analysis && Object.keys(v.analysis).length > 0) || 
                 (v.ai_result && v.ai_result.length > 0);
        }).length,
        videoPerformance: stats?.performance_data || [],
        progressStats: stats?.progress_stats || { completed: 0, inProgress: 0, totalTime: 0 }
      };
      
      setDashboardData(dashboardData);
      console.log('Données dashboard chargées avec succès:', dashboardData);
    } catch (err) {
      console.error('Erreur lors du chargement des données dashboard:', err);
      setDashboardData(null);
      setDashboardError(err.message || 'Erreur lors de la récupération des données');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      const checkConnection = async () => {
        try {
          console.log('Vérification de la connexion Supabase...');
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout de connexion')), 5000)
          );

          const connectionResult = await Promise.race([
            checkSupabaseConnection(),
            timeoutPromise
          ]);
          
          if (connectionResult.connected) {
            setConnectionStatus('connected');
            setSupabaseError(null);
          } else {
            console.warn('Connexion Supabase échouée:', connectionResult.error);
            setConnectionStatus('disconnected');
            setSupabaseError(connectionResult.error);
          }
        } catch (error) {
          console.error('Erreur lors de la vérification de connexion:', error);
          setConnectionStatus('disconnected');
          setSupabaseError(`Erreur de vérification: ${error.message}`);
        }
      };
      
      const connectionTimer = setTimeout(checkConnection, 100);
      return () => {
        clearTimeout(connectionTimer);
      };
    }
  }, [loading]);

  useEffect(() => {
    let mounted = true;
    let dataTimeout = null;

    if (user && connectionStatus === 'connected') {
      dataTimeout = setTimeout(() => {
        if (mounted) {
          loadDashboardData().catch(err => {
            console.error('Erreur non gérée lors du chargement des données:', err);
            if (mounted) {
              setDashboardError(err.message || 'Erreur inattendue');
              setDashboardLoading(false);
            }
          });
        }
      }, 200);

      let videosChannel = null;
      try {
        videosChannel = supabase
          .channel('videos_changes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'videos',
            filter: `user_id=eq.${user.id}`
          }, payload => {
            console.log('Changement détecté dans la table videos:', payload);
            if (mounted) {
              loadDashboardData().catch(err => {
                console.error('Erreur lors du rechargement après changement:', err);
              });
            }
          })
          .subscribe((status) => {
            console.log('Statut de souscription aux changements videos:', status);
          });
      } catch (err) {
        console.error('Erreur lors de la configuration du canal realtime:', err);
      }

      return () => {
        mounted = false;
        if (dataTimeout) {
          clearTimeout(dataTimeout);
        }
        if (videosChannel) {
          try {
            supabase.removeChannel(videosChannel);
          } catch (err) {
            console.error('Erreur lors de la suppression du canal:', err);
          }
        }
      };
    }
  }, [user, connectionStatus]);

  const handleAuthSuccess = (userData) => {
    console.log('Utilisateur authentifié avec succès:', userData.id);
    setIsAuthModalOpen(false);
    setTimeout(() => {
      navigate('/');
      loadDashboardData().catch(err => {
        console.error('Erreur après authentification:', err);
      });
    }, 1000);
  };

  const handleSignOut = async () => {
    try {
      console.log('Déconnexion demandée');
      await signOut();
      setDashboardData(null);
      navigate('/');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      setDashboardData(null);
      navigate('/');
    }
  };

  const handleVideoUploaded = () => {
    console.log('🔄 App: Vidéo uploadée, rechargement des données');
    loadDashboardData();
  };

  const handleRetryConnection = async () => {
    setConnectionStatus('checking');
    setSupabaseError(null);

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout de reconnexion')), 5000)
      );
      
      const connectionResult = await Promise.race([
        checkSupabaseConnection(),
        timeoutPromise
      ]);
      
      if (connectionResult.connected) {
        setConnectionStatus('connected');
        setSupabaseError(null);
      } else {
        setConnectionStatus('disconnected');
        setSupabaseError(connectionResult.error);
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setSupabaseError(`Erreur de reconnexion: ${error.message}`);
    }
  };

  if (loading) {
    return <LoadingScreen message="Chargement de l'application..." />;
  }

  if (supabaseError) {
    return (
      <SupabaseDiagnostic 
        error={supabaseError} 
        onRetry={handleRetryConnection}
        onContinue={() => setSupabaseError(null)}
      />
    );
  }

  return (
    <>
      <Routes>
        {/* Route racine avec onboarding intégré */}
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
        
        {/* Routes principales de l'application */}
        <Route path="/record-video" element={
          <RequireAuth>
            <EnhancedRecordVideo 
              user={user}
              profile={profile}
              onSignOut={handleSignOut}
              onVideoUploaded={handleVideoUploaded}
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
        
        {/* Redirections et fallback */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Modal d'authentification */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
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
