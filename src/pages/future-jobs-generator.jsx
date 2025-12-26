// Dans future-jobs-generator.jsx (extrait modifié)
import React, { useState, useEffect } from 'react';
import VideoGenerationPanel from '../components/VideoGenerationPanel';
import { useAuth } from '../contexts/AuthContext';
import pinnPromptService from '../services/pinnPromptService';

export default function FutureJobsGenerator() {
  const { user } = useAuth();
  const [selectedJobId, setSelectedJobId] = useState(1);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [videoResult, setVideoResult] = useState(null);

  // Charger les métiers
  useEffect(() => {
    const allJobs = pinnPromptService.getAllJobs();
    setJobs(allJobs);
  }, []);

  // Générer le prompt
  const handleGeneratePrompt = () => {
    const prompt = pinnPromptService.generatePrompt(selectedJobId, {
      generator: 'Sora',
      style: 'futuristic',
      duration: 30
    });
    setGeneratedPrompt(prompt);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🎬 Générateur de Métiers du Futur</h1>
          <p className="text-gray-400">Générez des vidéos réalistes pour les métiers de 2030-2040</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section gauche : Sélection et prompt */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">1. Sélectionnez un métier</h2>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.year})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">2. Générer le prompt</h2>
              <button
                onClick={handleGeneratePrompt}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
              >
                ✨ Générer le prompt
              </button>

              {generatedPrompt && (
                <div className="mt-4 p-4 bg-slate-900/50 rounded">
                  <h3 className="font-semibold mb-2">Prompt généré:</h3>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                    {generatedPrompt.prompt}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Section droite : Génération vidéo */}
          <div>
            <VideoGenerationPanel
              jobId={selectedJobId}
              jobTitle={selectedJob?.title}
              jobYear={selectedJob?.year}
              generatedPrompt={generatedPrompt}
              onGenerationComplete={(result) => {
                setVideoResult(result);
                console.log('Vidéo générée:', result);
              }}
              onError={(error) => {
                console.error('Erreur génération:', error);
              }}
            />

            {/* Historique des vidéos */}
            {user && (
              <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">📜 Historique des générations</h3>
                {/* Vous pouvez intégrer l'historique ici */}
              </div>
            )}
          </div>
        </div>

        {/* Affichage de la vidéo générée */}
        {videoResult && videoResult.videoUrl && (
          <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">🎥 Vidéo Générée</h2>
            <div className="aspect-video max-w-4xl mx-auto bg-black rounded-lg overflow-hidden">
              <video
                src={videoResult.videoUrl}
                controls
                className="w-full h-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
