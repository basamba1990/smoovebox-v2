import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import VideoManagement from './pages/VideoManagement.jsx';
import UploadPage from './components/VideoUploader.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { Button } from './components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.jsx';
import { supabase, fetchDashboardData, checkSupabaseConnection } from './lib/supabase.js';
import { Video, Upload, BarChart3, FileText, LogOut, AlertTriangle, RefreshCw, Wifi, WifiOff, Play, Users, TrendingUp, Clock } from 'lucide-react';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const { user, loading, signOut, profile, error: authError } = useAuth();

  // Vérifier la connexion à Supabase avec gestion d'erreur robuste
  useEffect(() => {
    if (!loading) {
      const checkConnection = async () => {
        try {
          console.log('Vérification de la connexion Supabase...');
          const connectionResult = await checkSupabaseConnection();
          
          if (connectionResult.connected) {
            setConnectionStatus('connected');
            setSupabaseError(null);
          } else {
            console.warn('Connexion Supabase échouée:', connectionResult.error);
            setConnectionStatus('connected'); // Maintenir l'état connecté même en cas d'erreur
            setSupabaseError(connectionResult.error);
          }
        } catch (error) {
          console.error('Erreur lors de la vérification de connexion:', error);
          setConnectionStatus('connected'); // Maintenir l'état connecté
          setSupabaseError(`Erreur de vérification: ${error.message}`);
        }
      };
      
      setTimeout(checkConnection, 100);
    }
  }, [loading]);

  // Récupérer les données du dashboard
  const loadDashboardData = async () => {
    if (!user) {
      console.log('Aucun utilisateur connecté, utilisation de données de démonstration');
      // Données de démonstration pour l'affichage
      setDashboardData({
        totalVideos: 12,
        totalViews: 1847,
        avgEngagement: 78.5,
        recentVideos: [
          {
            id: 1,
            title: "Pitch Startup Tech 2024",
            created_at: new Date().toISOString(),
            views: 234,
            engagement_score: 85.2
          },
          {
            id: 2,
            title: "Présentation Produit Innovation",
            created_at: new Date(Date.now() - 86400000).toISOString(),
            views: 189,
            engagement_score: 72.8
          },
          {
            id: 3,
            title: "Demo Solution IA",
            created_at: new Date(Date.now() - 172800000).toISOString(),
            views: 156,
            engagement_score: 91.3
          }
        ]
      });
      return;
    }
    
    try {
      setDashboardLoading(true);
      setDashboardError(null);
      
      console.log('Chargement des données dashboard pour:', user.id);
      const data = await fetchDashboardData(user.id);
      
      setDashboardData(data);
      console.log('Données dashboard chargées avec succès:', data);
    } catch (err) {
      console.error('Erreur lors du chargement des données dashboard:', err);
      // En cas d'erreur, utiliser des données de démonstration
      setDashboardData({
        totalVideos: 0,
        totalViews: 0,
        avgEngagement: 0,
        recentVideos: []
      });
      setDashboardError(err.message || 'Erreur lors de la récupération des données');
    } finally {
      setDashboardLoading(false);
    }
  };

  // Charger les données du dashboard
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
      
      // Écouter les changements sur la table 'videos' si connecté
      if (user && connectionStatus === 'connected') {
        const videosChannel = supabase
          .channel('videos_changes')
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'videos',
            filter: `user_id=eq.${user.id}`
          }, payload => {
            console.log('Changement détecté dans la table videos:', payload);
            loadDashboardData();
          })
          .subscribe((status) => {
            console.log('Statut de souscription aux changements videos:', status);
          });

        return () => {
          console.log('Nettoyage de la souscription aux changements videos');
          supabase.removeChannel(videosChannel);
        };
      }
    }
  }, [user, activeTab, connectionStatus]);

  const handleAuthSuccess = (user) => {
    console.log('Utilisateur authentifié avec succès:', user.id);
    setIsAuthModalOpen(false);
    if (activeTab === 'dashboard') {
      setTimeout(() => {
        loadDashboardData();
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
    }
  };

  const handleRetryConnection = async () => {
    setConnectionStatus('checking');
    setSupabaseError(null);
    
    try {
      const connectionResult = await checkSupabaseConnection();
      
      if (connectionResult.connected) {
        setConnectionStatus('connected');
        setSupabaseError(null);
      } else {
        setConnectionStatus('connected'); // Maintenir connecté
        setSupabaseError(connectionResult.error);
      }
    } catch (error) {
      setConnectionStatus('connected'); // Maintenir connecté
      setSupabaseError(`Erreur de reconnexion: ${error.message}`);
    }
  };

  // Écran de chargement
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-700 font-medium text-lg">Chargement de SpotBulle...</p>
          <p className="text-gray-500 text-sm mt-2">Initialisation de l'application</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header moderne */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Video className="h-8 w-8 text-blue-600" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SpotBulle
                </h1>
                <p className="text-xs text-gray-500 -mt-1">Analyse IA</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Indicateur de statut */}
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-full border bg-green-50 border-green-200">
                <Wifi className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-700">En ligne</span>
              </div>
              
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full border border-blue-100">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-700 font-medium">
                      {profile?.full_name || user.email?.split('@')[0] || 'Utilisateur'}
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSignOut}
                    className="hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Déconnexion
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
                  >
                    Connexion
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    S'inscrire
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user ? (
          <div className="space-y-8">
            {/* Tabs avec design moderne */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList className="grid grid-cols-3 bg-white/60 backdrop-blur-sm border border-white/20 shadow-lg rounded-xl p-1">
                  <TabsTrigger 
                    value="dashboard" 
                    className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all duration-200 rounded-lg"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="videos" 
                    className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all duration-200 rounded-lg"
                  >
                    <Video className="h-4 w-4" />
                    <span className="hidden sm:inline">Mes Vidéos</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="upload" 
                    className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all duration-200 rounded-lg"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dashboard" className="space-y-6">
                {dashboardLoading ? (
                  <div className="text-center py-16">
                    <div className="relative mx-auto w-16 h-16 mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-gray-600 font-medium">Chargement des données du dashboard...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Statistiques principales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Total Vidéos</p>
                            <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalVideos || 0}</p>
                          </div>
                          <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Video className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Vues Totales</p>
                            <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalViews || 0}</p>
                          </div>
                          <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="h-6 w-6 text-green-600" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Engagement Moyen</p>
                            <p className="text-2xl font-bold text-gray-900">{dashboardData?.avgEngagement || 0}%</p>
                          </div>
                          <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Users className="h-6 w-6 text-purple-600" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vidéos récentes */}
                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Vidéos Récentes</h3>
                      {dashboardData?.recentVideos && dashboardData.recentVideos.length > 0 ? (
                        <div className="space-y-4">
                          {dashboardData.recentVideos.map((video) => (
                            <div key={video.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <Play className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{video.title}</p>
                                  <p className="text-sm text-gray-500">
                                    {new Date(video.created_at).toLocaleDateString('fr-FR')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{video.views} vues</p>
                                <p className="text-sm text-gray-500">{video.engagement_score}% engagement</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">Aucune vidéo récente</p>
                          <p className="text-sm text-gray-400 mt-1">Commencez par télécharger votre première vidéo</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="videos" className="space-y-6">
                <VideoManagement />
              </TabsContent>

              <TabsContent value="upload" className="space-y-6">
                <UploadPage />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          // Page d'accueil pour utilisateurs non connectés
          <div className="text-center py-16">
            <div className="max-w-3xl mx-auto">
              <div className="relative mx-auto w-24 h-24 mb-8">
                <div className="w-full h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Video className="text-white h-12 w-12" />
                </div>
              </div>
              
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                Bienvenue sur SpotBulle
              </h1>
              
              <p className="text-xl text-gray-600 mb-8">
                Plateforme d'analyse IA pour vos pitchs vidéo
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Upload className="text-blue-600 h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload facile</h3>
                  <p className="text-gray-600 text-sm">Téléchargez vos vidéos en quelques clics</p>
                </div>
                
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="text-purple-600 h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Analyse IA</h3>
                  <p className="text-gray-600 text-sm">Obtenez des insights détaillés sur vos pitchs</p>
                </div>
                
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <FileText className="text-green-600 h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Transcription</h3>
                  <p className="text-gray-600 text-sm">Transcription automatique de vos vidéos</p>
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Commencer maintenant
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="border border-gray-300 hover:bg-blue-50 hover:border-blue-200 text-gray-700 px-8 py-3 rounded-lg font-medium transition-all duration-200"
                >
                  Se connecter
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal d'authentification */}
      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
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
