import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider } from './context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import VideoManagement from './pages/VideoManagement.jsx';
import VideoUploader from './components/VideoUploader.jsx';
import EnhancedVideoUploader from './components/EnhancedVideoUploader.jsx';
import ProgressTracking from './components/ProgressTracking.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import EmptyState from './components/EmptyState.jsx';
import ProfessionalHeader from './components/ProfessionalHeader.jsx';
import ModernTabs from './components/ModernTabs.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { Button } from './components/ui/button.jsx';
import { Tabs, TabsContent } from './components/ui/tabs.jsx';
import { supabase, fetchDashboardData, checkSupabaseConnection, retryOperation } from './lib/supabase.js';
import { RefreshCw, AlertTriangle, Video, Upload, BarChart3, FileText } from 'lucide-react';
import LoadingScreen from './components/LoadingScreen.jsx';
import SupabaseDiagnostic from './components/SupabaseDiagnostic.jsx';
import VideoProcessingStatus from './components/VideoProcessingStatus.jsx';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { user, loading, signOut, profile, error: authError, connectionStatus: authConnectionStatus } = useAuth();

  // CORRECTION: Utiliser useRef pour éviter les re-créations et fuites mémoire
  const mountedRef = useRef(true);
  const dashboardChannelRef = useRef(null);
  const loadingTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  // CORRECTION: Simplifier la gestion de l'état d'authentification
  useEffect(() => {
    if (!loading) {
      const authenticated = !!(user && profile);
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        console.log('Utilisateur authentifié avec profil:', user.id, profile);
        // Fermer automatiquement le modal d'auth si ouvert
        if (isAuthModalOpen) {
          setIsAuthModalOpen(false);
        }
      } else {
        setDashboardData(null);
        setDashboardError(null);
      }
    }
  }, [user, profile, loading, isAuthModalOpen]);

  // CORRECTION: Simplifier la vérification de connexion
  useEffect(() => {
    if (!loading && !connectionTimeoutRef.current) {
      connectionTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('Vérification de la connexion Supabase...');
          const connectionResult = await Promise.race([
            checkSupabaseConnection(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout de connexion')), 5000)
            )
          ]);

          if (mountedRef.current) {
            if (connectionResult.connected) {
              setConnectionStatus('connected');
              setSupabaseError(null);
            } else {
              console.warn('Connexion Supabase échouée:', connectionResult.error);
              setConnectionStatus('connected');
              setSupabaseError(connectionResult.error);
            }
          }
        } catch (error) {
          console.error('Erreur lors de la vérification de connexion:', error);
          if (mountedRef.current) {
            setConnectionStatus('connected');
            setSupabaseError(`Erreur de vérification: ${error.message}`);
          }
        } finally {
          connectionTimeoutRef.current = null;
        }
      }, 100);
    }

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [loading]);

  // CORRECTION: Fonction de chargement des données dashboard optimisée
  const loadDashboardData = useCallback(async () => {
    if (!user || !isAuthenticated || !mountedRef.current) {
      console.log('Conditions non remplies pour charger les données dashboard');
      setDashboardData(null);
      return;
    }

    try {
      setDashboardLoading(true);
      setDashboardError(null);

      console.log('Chargement des données dashboard pour:', user.id);

      let videos = [];

      // CORRECTION: Simplifier la récupération des données avec un seul try-catch
      try {
        const { data: videosData, error: vError } = await supabase
          .from('video_details')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (vError) {
          console.warn('Erreur avec video_details, tentative avec la table videos:', vError);
          
          // Fallback vers la table videos
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('videos')
            .select(`
              *,
              transcriptions (
                id,
                status,
                confidence_score,
                processed_at,
                error_message,
                analysis_result
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (fallbackError) throw fallbackError;
          videos = fallbackData;
        } else {
          videos = videosData;
        }
      } catch (dataError) {
        throw new Error(`Erreur de récupération des données: ${dataError.message}`);
      }

      // Récupération des statistiques (optionnelle)
      let stats = null;
      try {
        const { data: statsData, error: statsError } = await supabase
          .rpc('get_user_video_stats', { user_id_param: user.id });

        if (!statsError) {
          stats = statsData;
        }
      } catch (statsError) {
        console.warn('Statistiques non disponibles:', statsError);
      }

      // CORRECTION: Construction simplifiée des données dashboard
      const dashboardData = {
        totalVideos: videos.length,
        recentVideos: videos.slice(0, 5),
        videosByStatus: {
          ready: videos.filter(v => ['ready', 'uploaded', 'published'].includes(v.status)).length,
          processing: videos.filter(v => ['processing', 'analyzing', 'transcribing'].includes(v.status)).length,
          transcribed: videos.filter(v => {
            if (v.transcriptions) {
              return Array.isArray(v.transcriptions) 
                ? v.transcriptions.some(t => t.status === 'completed')
                : v.transcriptions.status === 'completed';
            }
            return !!(v.transcription_text && v.transcription_text.length > 0);
          }).length,
          analyzed: videos.filter(v => {
            if (v.transcriptions) {
              return Array.isArray(v.transcriptions)
                ? v.transcriptions.some(t => t.analysis_result)
                : v.transcriptions.analysis_result;
            }
            return !!(v.analysis_result && Object.keys(v.analysis_result).length > 0);
          }).length,
          failed: videos.filter(v => v.status === 'failed').length
        },
        totalDuration: videos.reduce((sum, video) => sum + (video.duration || 0), 0),
        transcriptionsCount: videos.filter(v => {
          if (v.transcriptions) {
            return Array.isArray(v.transcriptions)
              ? v.transcriptions.some(t => t.status === 'completed')
              : v.transcriptions.status === 'completed';
          }
          return !!(v.transcription_text && v.transcription_text.length > 0);
        }).length,
        analysisCount: videos.filter(v => {
          if (v.transcriptions) {
            return Array.isArray(v.transcriptions)
              ? v.transcriptions.some(t => t.analysis_result)
              : v.transcriptions.analysis_result;
          }
          return !!(v.analysis_result && Object.keys(v.analysis_result).length > 0);
        }).length,
        videoPerformance: stats?.performance_data || [],
        progressStats: stats?.progress_stats || {
          completed: 0,
          inProgress: 0,
          totalTime: 0
        }
      };

      if (mountedRef.current) {
        setDashboardData(dashboardData);
        console.log('Données dashboard chargées avec succès:', dashboardData);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des données dashboard:', err);
      if (mountedRef.current) {
        setDashboardData(null);
        setDashboardError(err.message || 'Erreur lors de la récupération des données');
      }
    } finally {
      if (mountedRef.current) {
        setDashboardLoading(false);
      }
    }
  }, [user, isAuthenticated]);

  // CORRECTION: Effet simplifié pour le chargement des données dashboard
  useEffect(() => {
    if (activeTab === 'dashboard' && isAuthenticated && !dashboardLoading) {
      // CORRECTION: Délai plus court et nettoyage approprié
      loadingTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          loadDashboardData();
        }
      }, 300);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [activeTab, isAuthenticated, loadDashboardData]);

  // CORRECTION: Abonnement realtime simplifié pour le dashboard
  useEffect(() => {
    if (activeTab === 'dashboard' && user && connectionStatus === 'connected' && isAuthenticated) {
      try {
        // Nettoyer l'ancien canal
        if (dashboardChannelRef.current) {
          supabase.removeChannel(dashboardChannelRef.current);
        }

        dashboardChannelRef.current = supabase
          .channel('dashboard_videos_changes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'videos',
            filter: `user_id=eq.${user.id}`
          }, payload => {
            console.log('Changement détecté dans la table videos pour dashboard:', payload);
            // CORRECTION: Délai pour éviter les appels trop fréquents
            setTimeout(() => {
              if (mountedRef.current && activeTab === 'dashboard') {
                loadDashboardData();
              }
            }, 1000);
          })
          .subscribe((status) => {
            console.log('Statut de souscription dashboard:', status);
          });
      } catch (err) {
        console.error('Erreur lors de la configuration du canal realtime dashboard:', err);
      }
    }

    return () => {
      if (dashboardChannelRef.current) {
        try {
          supabase.removeChannel(dashboardChannelRef.current);
          dashboardChannelRef.current = null;
        } catch (err) {
          console.error('Erreur lors de la suppression du canal dashboard:', err);
        }
      }
    };
  }, [activeTab, user, connectionStatus, isAuthenticated, loadDashboardData]);

  // CORRECTION: Gestion simplifiée du succès d'authentification
  const handleAuthSuccess = useCallback((userData) => {
    console.log('Utilisateur authentifié avec succès:', userData.id);
    setIsAuthModalOpen(false);
    setActiveTab('dashboard');
    
    // CORRECTION: Délai plus court et plus fiable
    setTimeout(() => {
      if (mountedRef.current) {
        loadDashboardData();
      }
    }, 500);
  }, [loadDashboardData]);

  const handleSignOut = useCallback(async () => {
    try {
      console.log('Déconnexion demandée');
      await signOut();
      setDashboardData(null);
      setDashboardError(null);
      setIsAuthenticated(false);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      // CORRECTION: Forcer la réinitialisation même en cas d'erreur
      setDashboardData(null);
      setDashboardError(null);
      setIsAuthenticated(false);
      setActiveTab('dashboard');
    }
  }, [signOut]);

  const handleRetryConnection = useCallback(async () => {
    setConnectionStatus('checking');
    setSupabaseError(null);

    try {
      const connectionResult = await Promise.race([
        checkSupabaseConnection(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de reconnexion')), 5000)
        )
      ]);

      if (mountedRef.current) {
        if (connectionResult.connected) {
          setConnectionStatus('connected');
          setSupabaseError(null);
        } else {
          setConnectionStatus('connected');
          setSupabaseError(connectionResult.error);
        }
      }
    } catch (error) {
      if (mountedRef.current) {
        setConnectionStatus('connected');
        setSupabaseError(`Erreur de reconnexion: ${error.message}`);
      }
    }
  }, []);

  // CORRECTION: Timeout de sécurité simplifié
  useEffect(() => {
    if (loading) {
      const safetyTimeout = setTimeout(() => {
        console.warn('Timeout de chargement déclenché après 15 secondes');
        if (loading && mountedRef.current) {
          window.location.reload();
        }
      }, 15000);

      return () => clearTimeout(safetyTimeout);
    }
  }, [loading]);

  // CORRECTION: Nettoyage au démontage
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      
      // Nettoyer tous les timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      // Nettoyer les canaux realtime
      if (dashboardChannelRef.current) {
        try {
          supabase.removeChannel(dashboardChannelRef.current);
        } catch (err) {
          console.error('Erreur lors du nettoyage final:', err);
        }
      }
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header professionnel */}
      <ProfessionalHeader
        user={user}
        profile={profile}
        connectionStatus={connectionStatus}
        onSignOut={handleSignOut}
        onAuthModalOpen={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Tabs modernes */}
          <ModernTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            user={user}
          />

          {isAuthenticated ? (
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
                <ProgressTracking userId={user.id} userProfile={profile} isVisible={true} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 sm:py-12 lg:py-16">
              <div className="max-w-md mx-auto px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <img src="/logo.png" alt="SpotBulle AI Logo" className="h-12 w-12 sm:h-16 sm:w-16" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                  Bienvenue sur SpotBulle
                </h2>
                <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
                  Plateforme d'analyse vidéo alimentée par l'IA pour optimiser vos contenus et améliorer votre engagement.
                </p>
                <Button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Commencer maintenant
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal d'authentification */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
