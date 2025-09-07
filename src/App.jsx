import React, { useState, useEffect } from 'react';
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
import WelcomeAgent from './components/WelcomeAgent.jsx'; // Import du nouveau composant
import { useAuth } from './context/AuthContext.jsx';
import { Button } from './components/ui/button-enhanced.jsx';
import { Tabs, TabsContent } from './components/ui/tabs.jsx';
import { supabase, fetchDashboardData, checkSupabaseConnection, retryOperation } from './lib/supabase.js';
import { RefreshCw, AlertTriangle, Video, Upload, BarChart3, FileText } from 'lucide-react';
import LoadingScreen from './components/LoadingScreen.jsx';
import { SkeletonDashboard } from './components/ui/skeleton.jsx';
import SupabaseDiagnostic from './components/SupabaseDiagnostic.jsx';
import VideoProcessingStatus from './components/VideoProcessingStatus.jsx';
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
  const [showWelcome, setShowWelcome] = useState(true); // État pour contrôler l'affichage de WelcomeAgent
  const { user, loading, signOut, profile, error: authError, connectionStatus: authConnectionStatus } = useAuth();

  // CORRECTION: Gestion améliorée de l'état d'authentification
  useEffect(() => {
    if (!loading) {
      if (user && profile) {
        setIsAuthenticated(true);
        setShowWelcome(false); // Cacher WelcomeAgent une fois authentifié
        console.log('Utilisateur authentifié avec profil:', user.id, profile);
        // Fermer automatiquement le modal d'auth si ouvert
        if (isAuthModalOpen) {
          setIsAuthModalOpen(false);
        }
        // Charger les données du dashboard si on est sur l'onglet dashboard
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
        setShowWelcome(true); // Afficher WelcomeAgent si non authentifié
      }
    }
  }, [user, profile, loading, activeTab, isAuthModalOpen]);

  // Vérifier la connexion à Supabase avec gestion d'erreur robuste
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

  // CORRECTION: Récupérer les données du dashboard avec gestion d'erreur robuste et fallback
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
      let videosError = null;

      // CORRECTION: Utiliser la même structure de requête que VideoManagement
      try {
        const { data: videosData, error: vError } = await supabase
          .from('videos')
          .select(`
            *,
            transcriptions (*)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (vError) {
          console.warn('Erreur avec la table videos:', vError);
          throw vError;
        }
        videos = videosData;
      } catch (viewError) {
        // Fallback: utiliser une requête plus simple si la jointure échoue
        console.warn('Utilisation du fallback vers une requête simple');
        const { data: videosData, error: vError } = await supabase
          .from('videos')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (vError) throw vError;
        videos = videosData;
      }

      // Récupération des statistiques globales
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

      // CORRECTION: Construction des données pour le dashboard
      const dashboardData = {
        totalVideos: videos.length,
        recentVideos: videos.slice(0, 5),
        videosByStatus: {
          ready: videos.filter(v => v.status === 'ready' || v.status === 'uploaded' || v.status === 'published').length,
          processing: videos.filter(v => v.status === 'processing' || v.status === 'analyzing' || v.status === 'transcribing').length,
          transcribed: videos.filter(v => {
            // Vérifier selon la struktur de données
            return v.transcription_text && v.transcription_text.length > 0 || 
                   (v.transcription_data && Object.keys(v.transcription_data).length > 0);
          }).length,
          analyzed: videos.filter(v => {
            // Vérifier selon la struktur de données
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

  // Charger les données du dashboard avec gestion des erreurs
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

  // CORRECTION: Gestion améliorée du succès d'authentification
  const handleAuthSuccess = (userData) => {
    console.log('Utilisateur authentifié avec succès:', userData.id);
    setIsAuthModalOpen(false);
    setShowWelcome(false); // Cacher WelcomeAgent après authentification réussie
    // Attendre que le contexte d'auth soit mis à jour
    setTimeout(() => {
      setActiveTab('dashboard');
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
      setIsAuthenticated(false);
      setActiveTab('dashboard');
      setShowWelcome(true); // Afficher WelcomeAgent après déconnexion
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      setDashboardData(null);
      setIsAuthenticated(false);
      setActiveTab('dashboard');
      setShowWelcome(true); // Afficher WelcomeAgent en cas d'erreur de déconnexion
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

  // Écran de chargement avec timeout de sécurité
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

  // Afficher WelcomeAgent si l'utilisateur n'est pas authentifié
  if (showWelcome && !isAuthenticated) {
    return (
      <div>
        <WelcomeAgent onOpenAuthModal={() => setIsAuthModalOpen(true)} />
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      </div>
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
          <ModernTabs activeTab={activeTab} onTabChange={setActiveTab} user={user} />
          
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
                <ProgressTracking 
                  userId={user.id} 
                  userProfile={profile} 
                  isVisible={true}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 sm:py-12 lg:py-16">
              <div className="max-w-md mx-auto px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <img src="/logo-spotbulle-final.png" alt="SpotBulle AI Logo" className="h-12 w-12 sm:h-16 sm:w-16" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                  Bienvenue sur SpotBulle
                </h2>
                <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
                  Plateforme d'analyse IA pour vos pitchs vidéo
                </p>
                
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
                      <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 text-xs sm:text-sm">Upload facile</h3>
                      <p className="text-xs text-gray-600 mt-1">Téléchargez vos vidéos en quelques clics</p>
                    </div>
                    
                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
                      <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 text-xs sm:text-sm">Analyse IA</h3>
                      <p className="text-xs text-gray-600 mt-1">Obtenez des insights détaillés sur vos pitchs</p>
                    </div>
                    
                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
                      <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 text-xs sm:text-sm">Transcription</h3>
                      <p className="text-xs text-gray-600 mt-1">Transcription automatique de vos vidéos</p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Commencer maintenant
                  </Button>
                </div>
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
    <AuthProvider>
      <ErrorBoundaryEnhanced FallbackComponent={SupabaseErrorFallback}>
        <AppContent />
      </ErrorBoundaryEnhanced>
    </AuthProvider>
  );
}

export default App;
