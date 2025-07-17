import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import UploadVideoMobile from './components/UploadVideoMobile.jsx';
import TranscriptionViewer from './components/TranscriptionViewer.jsx';
import Dashboard from './components/Dashboard.jsx';
import AuthModal from '../AuthModal.jsx';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { Video, Upload, BarChart3, FileText, LogOut, AlertTriangle } from 'lucide-react';
import './App.css';

// Composant d'erreur pour afficher les problèmes de configuration
function ErrorBoundary({ children }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  // Vérifier les variables d'environnement
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg border border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <h2 className="text-xl font-bold text-red-800">Configuration manquante</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            <p>Les variables d'environnement suivantes sont manquantes :</p>
            <ul className="list-disc list-inside space-y-1 text-red-600">
              {!supabaseUrl && <li>VITE_SUPABASE_URL</li>}
              {!supabaseKey && <li>VITE_SUPABASE_ANON_KEY</li>}
              {!openaiKey && <li>VITE_OPENAI_API_KEY</li>}
            </ul>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-xs">
                <strong>Solution :</strong> Configurez ces variables dans les paramètres de votre plateforme de déploiement (Vercel, Netlify, etc.)
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg border border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <h2 className="text-xl font-bold text-red-800">Erreur de l'application</h2>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            Une erreur s'est produite lors du chargement de l'application.
          </p>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 mb-4">
              {error.toString()}
            </div>
          )}
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full"
          >
            Recharger la page
          </Button>
        </div>
      </div>
    );
  }

  try {
    return children;
  } catch (err) {
    setHasError(true);
    setError(err);
    return null;
  }
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, loading, signOut } = useAuth();

  const handleAuthSuccess = (user) => {
    console.log('User authenticated:', user);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
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
              <h1 className="text-xl font-bold text-gray-900">Smoovebox</h1>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">v2.0</span>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Bonjour, {user.user_metadata?.first_name || user.email}
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
            <TabsList className="grid w-full grid-cols-4 mb-8">
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
              <TabsTrigger value="demo" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Démo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <Dashboard />
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

            <TabsContent value="demo" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Fonctionnalités Démo</h2>
                <p className="text-gray-600">
                  Aperçu des fonctionnalités avancées de Smoovebox v2.0
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Video className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold">Compression Vidéo</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Compression automatique avec FFmpeg pour optimiser la taille des fichiers
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Format MP4/H.264</li>
                    <li>• Résolution max 1080p</li>
                    <li>• Taille max 50 Mo</li>
                  </ul>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <FileText className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold">Transcription Whisper</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Transcription automatique avec timestamps via l'API OpenAI Whisper
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Précision élevée</li>
                    <li>• Support multilingue</li>
                    <li>• Timestamps précis</li>
                  </ul>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold">Analyse GPT-4</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Suggestions d'amélioration personnalisées par intelligence artificielle
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Analyse du contenu</li>
                    <li>• Suggestions de style</li>
                    <li>• Métriques de performance</li>
                  </ul>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Upload className="h-6 w-6 text-orange-600" />
                    </div>
                    <h3 className="font-semibold">Stockage Supabase</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Stockage sécurisé et scalable avec authentification intégrée
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Buckets dédiés</li>
                    <li>• Politiques RLS</li>
                    <li>• CDN intégré</li>
                  </ul>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Video className="h-6 w-6 text-red-600" />
                    </div>
                    <h3 className="font-semibold">Réseau Social</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Fonctionnalités communautaires avec followers et interactions
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Système de followers</li>
                    <li>• Commentaires et likes</li>
                    <li>• Feed personnalisé</li>
                  </ul>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-yellow-600" />
                    </div>
                    <h3 className="font-semibold">Tests Psychotechniques</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Intégration de quizzes et tests de personnalité (4 couleurs, etc.)
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Test 4 couleurs</li>
                    <li>• Talent To Be</li>
                    <li>• Résultats visuels</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-16">
            <Video className="h-16 w-16 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Bienvenue sur Smoovebox v2.0
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              La plateforme moderne de pitch vidéo avec intelligence artificielle. 
              Créez, analysez et améliorez vos présentations avec l'aide de l'IA.
            </p>
            <Button 
              size="lg" 
              onClick={() => setIsAuthModalOpen(true)}
              className="px-8 py-3"
            >
              Commencer maintenant
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p className="text-sm">
              Smoovebox v2.0 - Plateforme moderne de pitch vidéo avec IA
            </p>
            <p className="text-xs mt-2">
              Stack: React + Vite + Tailwind + Supabase + OpenAI
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

