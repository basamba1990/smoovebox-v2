import React from 'react';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SB</span>
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SpotBulle
                </h1>
                <p className="text-xs text-gray-500 -mt-1">Analyse IA</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <div className="max-w-3xl mx-auto">
            <div className="relative mx-auto w-24 h-24 mb-8">
              <div className="w-full h-full bg-blue-600 rounded-2xl flex items-center justify-center">
                <span className="text-white font-bold text-2xl">SB</span>
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
                  <span className="text-blue-600 font-bold">↑</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload facile</h3>
                <p className="text-gray-600 text-sm">Téléchargez vos vidéos en quelques clics</p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-purple-600 font-bold">📊</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Analyse IA</h3>
                <p className="text-gray-600 text-sm">Obtenez des insights détaillés sur vos pitchs</p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-600 font-bold">📝</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Transcription</h3>
                <p className="text-gray-600 text-sm">Transcription automatique de vos vidéos</p>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl">
                Commencer maintenant
              </button>
              
              <button className="border border-gray-300 hover:bg-blue-50 hover:border-blue-200 text-gray-700 px-8 py-3 rounded-lg font-medium transition-all duration-200">
                Se connecter
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

