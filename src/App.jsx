import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import UploadVideoMobile from './components/UploadVideoMobile.jsx';
import TranscriptionViewer from './components/TranscriptionViewer.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { Button } from './components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.jsx';
import { supabase } from './lib/supabase.js';
import { Video, Upload, BarChart3, FileText, LogOut, AlertTriangle, RefreshCw } from 'lucide-react';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const { user, loading, signOut, profile } = useAuth();

  // Vérifier la connexion à Supabase avec gestion d'erreur améliorée
  useEffect(() => {
    if (!loading) {
      const checkSupabaseConnection = async () => {
        try {
          // Test simple de connexion sans requête sur les tables
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Erreur de session Supabase:", error);
            setSupabaseError("Erreur de connexion à l'authentification");
            return;
          }

          // Test de connexion à la base de données (optionnel)
          try {
            const { data: testData, error: testError } = await supabase
              .from('profiles')
              .select('count')
              .limit(1);
            
            if (testError && testError.code !== 'PGRST116') { // PGRST116 = table not found, acceptable
              console.warn("Avertissement base de données:", testError);
            }
          } catch (dbError) {
            console.warn("Base de données non accessible:", dbError);
            // Ne pas bloquer l'application pour les erreurs de DB
          }
          
        } catch (error) {
          console.error("Erreur de connexion Supabase:", error);
          setSupabaseError("Erreur de configuration Supabase");
        }
      };
      
      checkSupabaseConnection();
    }
  }, [loading]);

  // Récupérer les données du dashboard directement depuis Supabase
  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      setDashboardLoading(true);
      setDashboardError(null);
      
      // Récupérer les statistiques des vidéos
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, title, description, created_at, status, thumbnail_url, file_path')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (videosError && videosError.code !== 'PGRST116') {
        console.error('Erreur vidéos:', videosError);
      }
      
      // Récupérer les transcriptions
      const { data: transcriptionsData, error: transcriptionsError } = await supabase
        .from('transcriptions')
        .select('id, confidence_score, created_at')
        .eq('user_id', user.id);
      
      if (transcriptionsError && transcriptionsError.code !== 'PGRST116') {
        console.error('Erreur transcriptions:', transcriptionsError);
      }
      
      // Calculer les statistiques
      const videosCount = videosData ? videosData.length : 0;
      const transcriptionsCount = transcriptionsData ? transcriptionsData.length : 0;
      
      // Calculer le score moyen de confiance
      let averageScore = null;
      if (transcriptionsData && transcriptionsData.length > 0) {
        const validScores = transcriptionsData
          .filter(t => t.confidence_score !== null)
          .map(t => t.confidence_score);
        
        if (validScores.length > 0) {
          averageScore = Math.round(
            validScores.reduce((sum, score) => sum + score, 0) / validScores.length
          );
        }
      }
      
      // Préparer les données du dashboard
      const dashboardData = {
        stats: {
          videosCount,
          transcriptionsCount,
          averageScore
        },
        recentVideos: videosData ? videosData.slice(0, 5) : []
      };
      
      setDashboardData(dashboardData);
    } catch (err) {
      console.error('Erreur dashboard:', err);
      setDashboardError(err.message || 'Erreur lors de la récupération des données');
    } finally {
      setDashboardLoading(false);
    }
  };

  // Charger les données du dashboard quand l'utilisateur est connecté ou change d'onglet
  useEffect(() => {
    if (user && activeTab === 'dashboard') {
      fetchDashboardData();
      
      // Écouter les changements sur la table 'videos'
      const videosChannel = supabase
        .channel('videos_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, payload => {
          console.log('Changement détecté dans la table videos:', payload);
          fetchDashboardData(); // Rafraîchir les données du dashboard
        })
        .subscribe();

      // Nettoyage à la désinscription
      return () => {
        supabase.removeChannel(videosChannel);
      };
    }
  }, [user, activeTab]);

  const handleAuthSuccess = (user) => {
    console.log('User authenticated:', user);
    setIsAuthModalOpen(false);
    // Charger les données du dashboard après connexion réussie
    if (activeTab === 'dashboard') {
      fetchDashboardData();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Réinitialiser les données du dashboard
      setDashboardData(null);
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  // Affichage d'erreur avec plus de détails
  if (supabaseError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg border border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <h2 className="text-xl font-bold text-red-800">Erreur de configuration</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            <p>{supabaseError}</p>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-xs">
                <strong>Solutions possibles :</strong>
              </p>
              <ul className="text-yellow-800 text-xs mt-2 space-y-1">
                <li>• Vérifiez les variables d'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY</li>
                <li>• Vérifiez que le projet Supabase est actif</li>
                <li>• Vérifiez la configuration réseau</li>
              </ul>
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full mt-4"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Écran de chargement amélioré
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de SpotBulle...</p>
          <p className="text-gray-400 text-sm mt-2">Connexion à la base de données</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header avec design moderne */}
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
                    value="upload" 
                    className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all duration-200 rounded-lg"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="transcription" 
                    className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all duration-200 rounded-lg"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Analyse IA</span>
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
                      Erreur de chargement
                    </h3>
                    <p className="text-red-700 mb-6">
                      {dashboardError}
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={fetchDashboardData}
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

              <TabsContent value="upload" className="space-y-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-3 mb-4">
                    <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Upload Vidéo
                    </h2>
                  </div>
                  <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
                    Uploadez vos pitchs vidéo avec compression automatique et optimisation mobile. 
                    Notre IA analysera automatiquement votre contenu pour vous fournir des suggestions d'amélioration.
                  </p>
                </div>
                <div className="flex justify-center">
                  <div className="w-full max-w-lg">
                    <UploadVideoMobile />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="transcription" className="space-y-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-3 mb-4">
                    <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Analyse IA
                    </h2>
                  </div>
                  <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
                    Transcription automatique et suggestions d'amélioration par intelligence artificielle. 
                    Découvrez comment optimiser vos présentations grâce à notre analyse avancée.
                  </p>
                </div>
                <TranscriptionViewer />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-20 animate-pulse"></div>
              </div>
              <Video className="h-20 w-20 text-blue-600 mx-auto relative z-10" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Bienvenue sur{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                SmooveBox
              </span>
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Votre plateforme de gestion vidéo intelligente
            </p>
            <Button 
              size="lg"
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl px-8 py-3"
            >
              Commencer maintenant
            </Button>
          </div>
        )}
      </main>

      {/* Auth Modal */}
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

