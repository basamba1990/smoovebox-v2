import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Button } from './components/ui/button-enhanced.jsx';
import { Tabs, TabsContent } from './components/ui/tabs.jsx';
import { supabase, checkSupabaseConnection } from './lib/supabase.js';
import { Upload } from 'lucide-react';
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
  const { user, loading, signOut, profile, error: authError, connectionStatus: authConnectionStatus } = useAuth();
  const navigate = useNavigate();

  const loadDashboardData = async () => {
    if (!user || !isAuthenticated) {
      console.log('Aucun utilisateur connecté ou non authentifié, aucune donnée à charger');
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
          .select(`
            *,
            transcriptions (*)
          `)
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
      if (user && profile) {
        setIsAuthenticated(true);
        setShowWelcome(false);
        console.log('Utilisateur authentifié avec profil:', user.id, profile);
        if (isAuthModalOpen) {
          setIsAuthModalOpen(false);
        }
        if (activeTab === 'dashboard') {
          setTimeout(() => {
            loadDashboardData().catch(err => {
              console.error('Erreur lors du chargement initial des données:', err);
            });
          }, 500);
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

    if (activeTab === 'dashboard' && isAuthenticated) {
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
      if (user && connectionStatus === 'connected') {
        try {
          videosChannel = supabase
            .channel('videos_changes')
            .on('postgres_changes', 
              { 
                event: '*', 
                schema: 'public', 
                table: 'videos',
                filter: `user_id=eq.${user.id}` 
              }, 
              payload => {
                console.log('Changement détecté dans la table videos:', payload);
                if (mounted) {
                  loadDashboardData().catch(err => {
                    console.error('Erreur lors du rechargement après changement:', err);
                  });
                }
              }
            )
            .subscribe((status) => {
              console.log('Statut de souscription aux changements videos:', status);
            });
        } catch (err) {
          console.error('Erreur lors de la configuration du canal realtime:', err);
        }
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
  }, [user, activeTab, connectionStatus, isAuthenticated]);

  const handleAuthSuccess = (userData) => {
    console.log('Utilisateur authentifié avec succès:', userData.id);
    setIsAuthModalOpen(false);
    setShowWelcome(false);
    setIsAuthenticated(true);
    loadDashboardData().catch(err => {
      console.error('Erreur après authentification:', err);
    });
  };

  const handleSignOut = async () => {
    try {
      console.log('Déconnexion demandée');
      await signOut();
      setDashboardData(null);
      setIsAuthenticated(false);
      setActiveTab('dashboard');
      setShowWelcome(true);
      navigate('/');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      setDashboardData(null);
      setIsAuthenticated(false);
      setActiveTab('dashboard');
      setShowWelcome(true);
      navigate('/');
    }
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
        setSupabaseError(null); // Correction ici
      } else {
        setConnectionStatus('disconnected');
        setSupabaseError(connectionResult.error);
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setSupabaseError(`Erreur de reconnexion: ${error.message}`);
    }
  };

  useEffect(() => {
    let safetyTimeout = null;
    
    if (loading) {
      safetyTimeout = setTimeout(() => {
        console.warn('Timeout de chargement déclenché après 15 secondes');
        if (loading) {
          window.location.reload();
        }
      }, 15000);
    }
    
    return () => {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
      }
    };
  }, [loading]);

  if (loading) {
    return <LoadingScreen />;
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

  if (showWelcome && !isAuthenticated) {
    return (
      <div>
        <WelcomeAgent onOpenAuthModal={() => setIsAuthModalOpen(true)} />
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <ProfessionalHeader 
        user={user} 
        profile={profile} 
        connectionStatus={connectionStatus}
        onSignOut={handleSignOut}
        onAuthModalOpen={() => setIsAuthModalOpen(true)}
      />
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="space-y-6 sm:space-y-8">
          <div className="flex justify-end mb-4">
            <Button 
              onClick={() => navigate('/record-video')} 
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Démarrer une nouvelle vidéo
            </Button>
          </div>
          <ModernTabs activeTab={activeTab} onTabChange={setActiveTab} user={user} />
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="dashboard" className="space-y-6">
              {dashboardLoading ? (
                <LoadingScreen 
                  message="Chargement des données du dashboard..." 
                  showReloadButton={false}
                  onCancel={() => {
                    setDashboardLoading(false);
                    loadDashboardData();
                  }}
                />
              ) : dashboardError ? (
                <EmptyState 
                  type="error" 
                  onAction={() => loadDashboardData()} 
                  loading={dashboardLoading}
                />
              ) : !dashboardData || (dashboardData.totalVideos === 0) ? (
                <EmptyState 
                  type="dashboard" 
                  onAction={() => setActiveTab('upload')}
                />
              ) : (
                <div className="space-y-6">
                  <Dashboard data={dashboardData} />
                </div>
              )}
            </TabsContent>
            <TabsContent value="videos" className="space-y-6">
              <VideoManagement />
            </TabsContent>
            <TabsContent value="upload" className="space-y-6">
              <EnhancedVideoUploader />
            </TabsContent>
            <TabsContent value="progress" className="space-y-6">
              <ProgressTracking 
                userId={user.id} 
                userProfile={profile} 
                isVisible={true}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
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
