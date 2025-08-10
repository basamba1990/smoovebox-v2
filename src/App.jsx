import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import VideoManagement from './pages/VideoManagement.jsx';
import VideoUploader from './components/VideoUploader.jsx';
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
  const { user, loading, signOut, profile, error: authError, connectionStatus: authConnectionStatus } = useAuth();

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
            setConnectionStatus('connected');
            setSupabaseError(connectionResult.error);
          }
        } catch (error) {
          console.error('Erreur lors de la vérification de connexion:', error);
          setConnectionStatus('connected');
          setSupabaseError(`Erreur de vérification: ${error.message}`);
        }
      };
      
      const connectionTimer = setTimeout(checkConnection, 100);
      
      return () => {
        clearTimeout(connectionTimer);
      };
    }
  }, [loading]);

  // Récupérer les données du dashboard avec gestion d'erreur robuste
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
      
      const data = await retryOperation(async () => {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de récupération des données')), 8000)
        );
        
        return await Promise.race([
          fetchDashboardData(user.id),
          timeoutPromise
        ]);
      }, 2);
      
      setDashboardData(data);
      console.log('Données dashboard chargées avec succès:', data);
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
    
    if (activeTab === 'dashboard') {
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
  }, [user, activeTab, connectionStatus]);

  const handleAuthSuccess = (user) => {
    console.log('Utilisateur authentifié avec succès:', user.id);
    setIsAuthModalOpen(false);
    if (activeTab === 'dashboard') {
      setTimeout(() => {
        loadDashboardData().catch(err => {
          console.error('Erreur après authentification:', err);
        });
      }, 1000);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Déconnexion demandée');
      await signOut();
      setDashboardData(null);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      setDashboardData(null);
      setActiveTab('dashboard');
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
        setConnectionStatus('connected');
        setSupabaseError(connectionResult.error);
      }
    } catch (error) {
      setConnectionStatus('connected');
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
    return <LoadingScreen message="Initialisation de l'application" showReloadButton={true} />;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
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

          {user ? (
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
                <VideoUploader />
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
                  <div className="flex flex-col gap-3 justify-center">
                    <Button 
                      size="lg"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl w-full sm:w-auto"
                    >
                      Commencer maintenant
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 w-full sm:w-auto"
                    >
                      Se connecter
                    </Button>
                  </div>
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
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

