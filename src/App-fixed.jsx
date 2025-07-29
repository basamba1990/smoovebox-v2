import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext-fixed.jsx';
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import VideoManagement from './pages/VideoManagement.jsx';
import UploadPage from './components/VideoUploader.jsx';
import ErrorBoundary from './components/ErrorBoundary-fixed.jsx';
import { useAuth } from './context/AuthContext-fixed.jsx';
import { Button } from './components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.jsx';
import { supabase, fetchDashboardData, checkSupabaseConnection } from './lib/supabase-fixed.js';
import { Video, Upload, BarChart3, FileText, LogOut, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const { user, loading, signOut, profile, error: authError } = useAuth();

  // Vérifier la connexion à Supabase avec gestion d'erreur améliorée
  useEffect(() => {
    if (!loading) {
      const checkConnection = async () => {
        try {
          console.log('Vérification de la connexion Supabase...');
          const connectionResult = await checkSupabaseConnection();
          
          if (connectionResult.connected) {
            setConnectionStatus('connected');
            setSupabaseError(null);
            
            if (connectionResult.error) {
              console.warn('Connexion avec avertissements:', connectionResult.error);
              // Ne pas bloquer l'application pour les avertissements
            }
          } else {
            setConnectionStatus('error');
            setSupabaseError(connectionResult.error);
          }
        } catch (error) {
          console.error('Erreur lors de la vérification de connexion:', error);
          setConnectionStatus('error');
          setSupabaseError(`Erreur de vérification: ${error.message}`);
        }
      };
      
      checkConnection();
    }
  }, [loading]);

  // Récupérer les données du dashboard directement depuis Supabase
  const loadDashboardData = async () => {
    if (!user) {
      console.log('Aucun utilisateur connecté, pas de chargement de données');
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
      setDashboardError(err.message || 'Erreur lors de la récupération des données');
    } finally {
      setDashboardLoading(false);
    }
  };

  // Charger les données du dashboard quand l'utilisateur est connecté ou change d'onglet
  useEffect(() => {
    if (user && activeTab === 'dashboard' && connectionStatus === 'connected') {
      loadDashboardData();
      
      // Écouter les changements sur la table 'videos' avec gestion d'erreurs
      const videosChannel = supabase
        .channel('videos_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'videos',
          filter: `user_id=eq.${user.id}`
        }, payload => {
          console.log('Changement détecté dans la table videos:', payload);
          loadDashboardData(); // Rafraîchir les données du dashboard
        })
        .subscribe((status) => {
          console.log('Statut de souscription aux changements videos:', status);
        });

      // Nettoyage à la désinscription
      return () => {
        console.log('Nettoyage de la souscription aux changements videos');
        supabase.removeChannel(videosChannel);
      };
    }
  }, [user, activeTab, connectionStatus]);

  const handleAuthSuccess = (user) => {
    console.log('Utilisateur authentifié avec succès:', user.id);
    setIsAuthModalOpen(false);
    // Charger les données du dashboard après connexion réussie
    if (activeTab === 'dashboard') {
      setTimeout(() => {
        loadDashboardData();
      }, 1000); // Délai pour laisser le temps aux triggers de s'exécuter
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Déconnexion demandée');
      await signOut();
      // Réinitialiser les données du dashboard
      setDashboardData(null);
      setActiveTab('dashboard'); // Retour au dashboard
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
        setConnectionStatus('error');
        setSupabaseError(connectionResult.error);
      }
    } catch (error) {
      setConnectionStatus('error');
      setSupabaseError(`Erreur de reconnexion: ${error.message}`);
    }
  };

  // Affichage d'erreur de connexion avec plus de détails et options de récupération
  if (connectionStatus === 'error' && supabaseError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-2xl border border-red-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <WifiOff className="h-10 w-10 text-red-600" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
            </div>
            <h2 className="text-xl font-bold text-red-800">Erreur de connexion</h2>
          </div>
          
          <div className="space-y-4 text-sm text-gray-700">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-medium text-red-800 mb-2">Détails de l'erreur :</p>
              <p className="text-red-700">{supabaseError}</p>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-xs font-medium mb-2">
                <strong>Solutions possibles :</strong>
              </p>
              <ul className="text-yellow-800 text-xs space-y-1">
                <li>• Vérifiez votre connexion internet</li>
                <li>• Vérifiez que les variables d'environnement sont correctes</li>
                <li>• Vérifiez que le projet Supabase est actif</li>
                <li>• Contactez le support si le problème persiste</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleRetryConnection} 
                className="flex-1"
                disabled={connectionStatus === 'checking'}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
                {connectionStatus === 'checking' ? 'Vérification...' : 'Réessayer'}
              </Button>
              
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recharger
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Écran de chargement amélioré avec indicateur de statut
  if (loading || connectionStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-700 font-medium text-lg">Chargement de SpotBulle...</p>
          <p className="text-gray-500 text-sm mt-2">
            {connectionStatus === 'checking' ? 'Vérification de la connexion' : 'Initialisation de l\'application'}
          </p>
          
          {connectionStatus === 'connected' && (
            <div className="flex items-center justify-center gap-2 mt-4 text-green-600">
              <Wifi className="h-4 w-4" />
              <span className="text-xs">Connexion établie</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header avec design moderne et indicateur de statut */}
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
              {/* Indicateur de statut de connexion */}
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-full bg-green-50 border border-green-200">
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

      {/* Main Content avec design amélioré */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user ? (
          <div className="space-y-8">
            {/* Affichage des erreurs d'authentification */}
            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <p className="text-red-800 font-medium">Erreur d'authentification</p>
                </div>
                <p className="text-red-700 text-sm mt-1">{authError}</p>
              </div>
            )}

            {/* Tabs avec design moderne */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList className="grid grid-cols-2 bg-white/60 backdrop-blur-sm border border-white/20 shadow-lg rounded-xl p-1">
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
                    <p className="text-gray-400 text-sm mt-2">Synchronisation en cours</p>
                  </div>
                ) : dashboardError ? (
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-8 text-center shadow-lg">
                    <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-800 mb-2">
                      Erreur de chargement des données
                    </h3>
                    <p className="text-red-700 mb-6">
                      {dashboardError}
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={loadDashboardData}
                      className="flex items-center gap-2 hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Réessayer
                    </Button>
                  </div>
                ) : (
                  <Dashboard dashboardData={dashboardData} />
                )}
              </TabsContent>

              <TabsContent value="videos" className="space-y-8">
                <VideoManagement />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          // Page d'accueil pour les utilisateurs non connectés
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-lg">
                <Video className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Bienvenue sur SpotBulle
              </h1>
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
              Votre plateforme de gestion vidéo intelligente
            </p>
            <Button 
              size="lg"
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl text-lg px-8 py-3"
            >
              Commencer maintenant
            </Button>
          </div>
        )}
      </main>

      {/* Modal d'authentification */}
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
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

