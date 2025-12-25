import React, { useState, useEffect } from 'react';
import { ChevronDown, Copy, Download, Zap, Eye } from 'lucide-react';
import pinnPromptService from '../services/pinnPromptService';
import '../styles/futureJobsGenerator.css';

export default function FutureJobsGenerator() {
  const [selectedJobId, setSelectedJobId] = useState(1);
  const [selectedGenerator, setSelectedGenerator] = useState('Sora');
  const [selectedStyle, setSelectedStyle] = useState('futuristic');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [variants, setVariants] = useState(null);
  const [showVariants, setShowVariants] = useState(false);

  // Charger les métiers au montage
  useEffect(() => {
    const allJobs = pinnPromptService.getAllJobs();
    setJobs(allJobs);
  }, []);

  // Générer le prompt
  const handleGeneratePrompt = () => {
    setLoading(true);
    try {
      const prompt = pinnPromptService.generatePrompt(selectedJobId, {
        generator: selectedGenerator,
        style: selectedStyle,
        duration: selectedDuration
      });
      setGeneratedPrompt(prompt);
      setShowPreview(true);
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Générer des variantes
  const handleGenerateVariants = () => {
    setLoading(true);
    try {
      const variantsData = pinnPromptService.generatePromptVariants(selectedJobId, 3, {
        generator: selectedGenerator
      });
      setVariants(variantsData);
      setShowVariants(true);
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Copier le prompt
  const handleCopyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Télécharger le prompt
  const handleDownloadPrompt = () => {
    if (generatedPrompt) {
      const markdown = pinnPromptService.exportForGenerator(generatedPrompt, 'markdown');
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(markdown));
      element.setAttribute('download', `prompt-${generatedPrompt.jobTitle.replace(/\s+/g, '-')}.md`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="future-jobs-generator min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🎬 Générateur de Prompts Vidéo</h1>
          <p className="text-gray-400">Créez des prompts vidéo pour les métiers du futur (2030-2040) basés sur le rapport WEF</p>
          <p className="text-sm text-gray-500 mt-2">Framework PINN-like: Contraintes réalistes + Créativité visuelle</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panneau de contrôle */}
          <div className="lg:col-span-1 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-3">Métier du Futur</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.year})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-3">Générateur Vidéo</label>
              <select
                value={selectedGenerator}
                onChange={(e) => setSelectedGenerator(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option>Sora</option>
                <option>Runway</option>
                <option>Pika</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-3">Style Visuel</label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="semi-realistic">Semi-réaliste</option>
                <option value="futuristic">Futuriste</option>
                <option value="cinematic">Cinématique</option>
                <option value="documentary">Documentaire</option>
                <option value="abstract">Abstrait</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-3">Durée (secondes)</label>
              <select
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option>15</option>
                <option>20</option>
                <option>25</option>
                <option>30</option>
                <option>45</option>
                <option>60</option>
              </select>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGeneratePrompt}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
              >
                {loading ? 'Génération...' : '✨ Générer Prompt'}
              </button>

              <button
                onClick={handleGenerateVariants}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                {loading ? 'Génération...' : 'Variantes'}
              </button>
            </div>
          </div>

          {/* Zone de résultat */}
          <div className="lg:col-span-2">
            {selectedJob && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">{selectedJob.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 mb-1">Tâches clés:</p>
                    <p className="text-gray-200">{selectedJob.keyTasks}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Compétences:</p>
                    <p className="text-gray-200">{selectedJob.coreSkills}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Technologies:</p>
                    <p className="text-gray-200">{selectedJob.emergingTech}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Éléments visuels:</p>
                    <p className="text-gray-200">{selectedJob.visualElements}</p>
                  </div>
                </div>
              </div>
            )}

            {generatedPrompt && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Prompt Généré</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyPrompt}
                      className="bg-slate-700 hover:bg-slate-600 p-2 rounded transition"
                      title="Copier"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={handleDownloadPrompt}
                      className="bg-slate-700 hover:bg-slate-600 p-2 rounded transition"
                      title="Télécharger"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>

                {copied && (
                  <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded text-green-200 text-sm">
                    ✓ Copié dans le presse-papiers
                  </div>
                )}

                <div className="bg-slate-900/50 rounded p-4 font-mono text-sm text-gray-300 max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {generatedPrompt.prompt}
                </div>

                <div className="mt-4 p-4 bg-slate-700/30 rounded border border-slate-600 text-sm">
                  <p className="text-gray-400 mb-2"><strong>Métadonnées:</strong></p>
                  <ul className="text-gray-300 space-y-1">
                    <li>• Générateur: {generatedPrompt.generator}</li>
                    <li>• Style: {generatedPrompt.style}</li>
                    <li>• Durée: {generatedPrompt.duration}s</li>
                    <li>• Généré: {new Date(generatedPrompt.metadata.generatedAt).toLocaleString('fr-FR')}</li>
                  </ul>
                </div>
              </div>
            )}

            {showVariants && variants && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 mt-6">
                <h3 className="text-xl font-bold mb-4">Variantes ({variants.variantCount})</h3>
                <div className="space-y-4">
                  {variants.variants.map((variant, idx) => (
                    <div key={idx} className="bg-slate-900/50 rounded p-4 border border-slate-600">
                      <p className="text-sm text-gray-400 mb-2">
                        <strong>Variante {idx + 1}:</strong> {variant.style} • {variant.duration}s
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(variant.prompt);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                      >
                        <Copy size={14} /> Copier
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informations sur le framework PINN-like */}
        <div className="mt-8 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">📚 À propos du Framework PINN-like</h3>
          <p className="text-gray-300 mb-4">
            Ce générateur utilise un framework inspiré des <strong>Physics-Informed Neural Networks (PINN)</strong>. 
            Les "physics" sont les contraintes réalistes du marché de l'emploi basées sur le rapport WEF 2025.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-700/30 rounded p-3">
              <p className="font-semibold text-blue-400 mb-2">🎯 Contraintes Réalistes</p>
              <p className="text-gray-300">Basées sur les données du WEF: tâches clés, compétences, technologies émergentes.</p>
            </div>
            <div className="bg-slate-700/30 rounded p-3">
              <p className="font-semibold text-purple-400 mb-2">🎨 Créativité Guidée</p>
              <p className="text-gray-300">Les prompts respectent les contraintes tout en permettant une expression créative riche.</p>
            </div>
            <div className="bg-slate-700/30 rounded p-3">
              <p className="font-semibold text-green-400 mb-2">🚀 Prêt pour la Production</p>
              <p className="text-gray-300">Compatible avec Sora, Runway et Pika. Exportable en plusieurs formats.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
