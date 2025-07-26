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
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });   
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Video className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">SpotBulle</h1>
              
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Bonjour, {profile?.full_name || user.email}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Déconnexion
                  </Button>
                </div>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsAuthModalOpen(true)}
                  >
                    Connexion
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setIsAuthModalOpen(true)}
                  >
                    S'inscrire
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="transcription" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Analyse IA
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              {dashboardLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Chargement des données du dashboard...</p>
                </div>
              ) : dashboardError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                  <AlertTriangle className="h-10 w-10 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-800 mb-2">
                    Erreur de chargement
                  </h3>
                  <p className="text-red-700 mb-4">
                    {dashboardError}
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={fetchDashboardData}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Réessayer
                  </Button>
                </div>
              ) : (
                <Dashboard dashboardData={dashboardData} />
              )}
            </TabsContent>

            <TabsContent value="upload" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Upload Vidéo Mobile</h2>
                <p className="text-gray-600">
                  Uploadez vos pitchs vidéo avec compression automatique et optimisation mobile
                </p>
              </div>
              <div className="flex justify-center">
                <UploadVideoMobile />
              </div>
            </TabsContent>

            <TabsContent value="transcription" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Analyse IA de Pitch</h2>
                <p className="text-gray-600">
                  Transcription automatique et suggestions d'amélioration par intelligence artificielle
                </p>
              </div>
              <TranscriptionViewer />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-16">
            <Video className="h-16 w-16 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Bienvenue sur SpotBulle avec analyse IA
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              La plateforme moderne de pitch vidéo avec intelligence artificielle. 
              Créez, analysez et améliorez vos présentations avec l'aide de l'IA.
            </p>
            <div className="space-y-4">
              <Button 
                size="lg" 
                onClick={() => setIsAuthModalOpen(true)}
                className="px-8 py-3"
              >
                Commencer maintenant
              </Button>
              <p className="text-sm text-gray-500">
                Aucun compte requis pour tester • Inscription gratuite
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p className="text-sm">
              SpotBulle avec analyse IA - Plateforme moderne de pitch vidéo avec IA
            </p>
            <p className="text-xs mt-2">
              Stack: Outils Innovants Pour Notre Jeunesse de Demain 
            </p>
          </div>
        </div>
      </footer>

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
