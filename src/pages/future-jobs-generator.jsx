import React, { useState, useEffect } from 'react';
import { ChevronDown, Copy, Download, Zap, Play, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import pinnPromptService from '../services/pinnPromptService';
import { futureJobsVideoService } from '../services/futureJobsVideoService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import '../styles/futureJobsGenerator.css';

export default function FutureJobsGenerator() {
  const { user } = useAuth();
  const [selectedJobId, setSelectedJobId] = useState(1);
  const [selectedGenerator, setSelectedGenerator] = useState('Sora');
  const [selectedStyle, setSelectedStyle] = useState('futuristic');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoResult, setVideoResult] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [generationTime, setGenerationTime] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    const allJobs = pinnPromptService.getAllJobs();
    setJobs(allJobs);
    if (user) {
      loadUserVideos();
    }
  }, [user]);

  const loadUserVideos = async () => {
    if (!user) return;
    try {
      const result = await futureJobsVideoService.getUserVideos(user.id, 5);
      if (result.success) {
        setGeneratedVideos(result.videos);
      } else {
        console.error('Erreur chargement vidéos:', result.error);
        toast.error("Impossible de charger l'historique des vidéos.");
      }
    } catch (error) {
      console.error('Erreur critique chargement vidéos:', error);
    }
  };

  const handleGeneratePrompt = (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setValidationErrors({});
    try {
      const prompt = pinnPromptService.generatePrompt(selectedJobId, {
        generator: selectedGenerator,
        style: selectedStyle,
        duration: Number(selectedDuration)
      });
      
      if (!prompt || !prompt.prompt || typeof prompt.prompt !== 'string' || prompt.prompt.trim().length === 0) {
        const error = new Error('Le service de prompt a retourné un prompt invalide');
        error.code = 'INVALID_PROMPT_RESPONSE';
        throw error;
      }
      
      setGeneratedPrompt(prompt);
      setShowPreview(true);
      setVideoResult(null);
      setVideoError(null);
      setValidationErrors({});
    } catch (error) {
      console.error('Erreur lors de la génération du prompt:', error);
      toast.error(`Erreur: ${error.message || 'Erreur inconnue'}`);
      setValidationErrors({
        prompt: error.message || 'Échec de génération du prompt'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async (e) => {
    if (e) e.preventDefault();

    if (!user) {
      toast.error('Veuillez vous connecter pour générer une vidéo');
      return;
    }

    if (!generatedPrompt || !generatedPrompt.prompt || generatedPrompt.prompt.trim().length === 0) {
      toast.error('Veuillez d\'abord générer un prompt valide');
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationStatus('🚀 Démarrage de la génération vidéo...');
    setVideoError(null);
    setVideoResult(null);
    setGenerationTime(Date.now());
    setValidationErrors({});

    try {
      const payload = {
        prompt: generatedPrompt.prompt.trim(),
        generator: selectedGenerator.toLowerCase().trim(),
        style: selectedStyle.toLowerCase().trim(),
        duration: Number(selectedDuration),
        userId: user.id,
        jobId: String(selectedJobId)
      };

      console.log('📤 Envoi payload normalisé:', payload);

      const result = await futureJobsVideoService.generateJobVideo(payload);

      if (result.success) {
        setVideoResult(result);
        setGenerationStatus('✅ Vidéo générée avec succès !');
        toast.success('Vidéo générée avec succès !');
        if (result.metadata?.is_placeholder) {
          toast.info('Note: Sora API indisponible. Une image DALL-E a été générée.', { duration: 5000 });
        }
        await loadUserVideos();
      } else {
        const error = new Error(result.error || 'Échec de la génération');
        error.code = result.code;
        error.details = result.details;
        throw error;
      }
    } catch (error) {
      console.error('❌ Erreur génération vidéo:', error);
      setVideoError({
        message: error.message,
        code: error.code,
        details: error.details,
        status: error.status
      });
      setGenerationStatus('❌ Erreur lors de la génération');
      
      const userMessage = `Erreur: ${error.message || 'Une erreur inconnue est survenue'}`;
      toast.error(userMessage);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleCheckStatus = async (videoId) => {
    try {
      const result = await futureJobsVideoService.checkVideoStatus(videoId);
      if (result.success) {
        toast.info(`Statut: ${result.status}`);
        await loadUserVideos();
      }
    } catch (error) {
      toast.error('Erreur vérification statut');
    }
  };

  const handleCancelGeneration = async (videoId) => {
    if (window.confirm('Annuler cette génération ?')) {
      const result = await futureJobsVideoService.cancelVideoGeneration(videoId);
      if (result.success) {
        toast.success('Génération annulée');
        await loadUserVideos();
      }
    }
  };

  const handleRetryGeneration = async () => {
    await handleGenerateVideo();
  };

  const handleCopyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Prompt copié dans le presse-papiers !');
    }
  };

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
      toast.success('Prompt téléchargé !');
    }
  };

  const handleDownloadVideo = () => {
    const url = videoResult?.publicUrl || videoResult?.signedUrl;
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `${generatedPrompt?.jobTitle?.replace(/\s+/g, '-') || 'video'}-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Téléchargement de la vidéo initié !');
    }
  };

  const getElapsedTime = () => {
    if (!generationTime) return '0s';
    const seconds = Math.floor((Date.now() - generationTime) / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="future-jobs-container min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
            Générateur de Métiers du Futur
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Framework PINN-like pour la génération de prompts vidéo optimisés basés sur les données du WEF 2025.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-slate-800 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Zap className="text-yellow-400" /> Configuration
              </h2>

              <form onSubmit={handleGeneratePrompt} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Métier du Futur</label>
                  <div className="relative">
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition"
                    >
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Générateur Vidéo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Sora', 'Runway', 'Pika'].map((gen) => (
                      <button
                        key={gen}
                        type="button"
                        onClick={() => setSelectedGenerator(gen)}
                        className={`py-2 rounded-lg text-sm font-semibold transition ${
                          selectedGenerator === gen
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {gen}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Style Visuel</label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  >
                    <option value="futuristic">Futuriste / High-Tech</option>
                    <option value="semi-realistic">Semi-Réaliste</option>
                    <option value="cinematic">Cinématique</option>
                    <option value="documentary">Documentaire</option>
                    <option value="abstract">Abstrait / Conceptuel</option>
                    <option value="lumi-universe">Lumi Universe (Signature)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Durée (secondes): {selectedDuration}s</label>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(e.target.value)}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                  Générer le Prompt PINN
                </button>
              </form>
            </div>

            {generatedPrompt && (
              <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-slate-800 shadow-xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Play className="text-green-400" /> Actions Vidéo
                </h3>
                <button
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg
