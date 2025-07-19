import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Video, Upload, BarChart3, FileText, LogOut, AlertTriangle, User } from 'lucide-react';
import './App.css';

// Composant Dashboard simplifié
function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
        <p className="text-gray-600">
          Aperçu de vos activités et statistiques
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold">Vidéos uploadées</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-sm text-gray-500">Cette semaine</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold">Analyses IA</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-sm text-gray-500">Transcriptions</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold">Score moyen</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">-</p>
          <p className="text-sm text-gray-500">Évaluation IA</p>
        </div>
      </div>
    </div>
  );
}

// Composant Upload simplifié
function UploadVideoMobile() {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="max-w-md mx-auto">
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          // Logique d'upload ici
        }}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Glissez votre vidéo ici</h3>
        <p className="text-gray-600 mb-4">ou cliquez pour sélectionner</p>
        <Button>
          Sélectionner un fichier
        </Button>
        <p className="text-xs text-gray-500 mt-4">
          Formats supportés: MP4, MOV, AVI (max 100MB)
        </p>
      </div>
    </div>
  );
}

// Composant Transcription simplifié
function TranscriptionViewer() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Analyse IA de Pitch</h2>
        <p className="text-gray-600">
          Aucune transcription disponible pour le moment
        </p>
      </div>
      
      <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Uploadez une vidéo pour commencer</h3>
        <p className="text-gray-600 mb-4">
          L'IA analysera automatiquement votre pitch et vous fournira des suggestions d'amélioration
        </p>
        <Button variant="outline">
          Aller à l'upload
        </Button>
      </div>
    </div>
  );
}

// Modal d'authentification simplifié
function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {isLogin ? 'Connexion' : 'Inscription'}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            ×
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input 
              type="email" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="votre@email.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Mot de passe</label>
            <input 
              type="password" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          
          <Button className="w-full" onClick={onAuthSuccess}>
            {isLogin ? 'Se connecter' : 'S\'inscrire'}
          </Button>
          
          <div className="text-center">
            <button 
              className="text-blue-600 hover:underline text-sm"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Pas de compte ? S\'inscrire' : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Vérifier les variables d'environnement
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  // Dans un environnement de production, vous utiliseriez ici la logique d'authentification réelle
  // Pour l'instant, nous allons simuler un utilisateur connecté si les clés sont présentes
  useEffect(() => {
    if (supabaseUrl && supabaseKey && openaiKey) {
      // Simuler un utilisateur connecté pour la démo de l'interface
      setUser({ email: 'user@example.com', user_metadata: { first_name: 'Utilisateur' } });
    } else {
      setUser(null);
    }
  }, [supabaseUrl, supabaseKey, openaiKey]);

  const handleAuthSuccess = () => {
    // Logique d'authentification réelle ici
    setUser({ email: 'authenticated@example.com', user_metadata: { first_name: 'Authentifié' } });
    setIsAuthModalOpen(false);
  };

  const handleSignOut = () => {
    setUser(null);
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
              <TranscriptionViewer />
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

export default App;


