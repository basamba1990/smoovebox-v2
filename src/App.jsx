import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import UploadVideoMobile from './components/UploadVideoMobile.jsx';
import TranscriptionViewer from './components/TranscriptionViewer.jsx';
import Dashboard from './components/Dashboard.jsx';
import { Video, Upload, BarChart3, FileText } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

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
              <Button variant="outline" size="sm">
                Connexion
              </Button>
              <Button size="sm">
                S'inscrire
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p className="text-sm">
              Smoovebox v2.0 - Plateforme moderne de pitch vidéo avec IA
            </p>
            <p className="text-xs mt-2">
              Stack: React + Next.js + Tailwind + Supabase + OpenAI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
