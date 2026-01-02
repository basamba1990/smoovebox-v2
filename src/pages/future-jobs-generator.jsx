import React, { useState, useEffect } from 'react';
import { ChevronDown, Copy, Download, Zap, Eye, Play, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import pinnPromptService from '../services/pinnPromptService';
import { futureJobsVideoService } from '../services/futureJobsVideoService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import '../styles/futureJobsGenerator.css';

export default function FutureJobsGenerator() {
  const { user, profile } = useAuth();
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
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoResult, setVideoResult] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [generationTime, setGenerationTime] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    const allJobs = pinnPromptService.getAllJobs();
    setJobs(allJobs);
    if (user) {
      loadUserVideos();
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const loadUserVideos = async () => {
    if (!user) return;
    try {
      const result = await futureJobsVideoService.getUserVideos(user.id, 5);
      if (result.success) {
        setGeneratedVideos(result.videos);
      }
    } catch (error) {
      console.error('Erreur chargement vidéos:', error);
    }
  };

  const handleGeneratePrompt = (e) => {
    if (e) e.preventDefault();
    console.log('Bouton Générer Prompt cliqué');
    setLoading(true);
    setValidationErrors({});
    try {
      const prompt = pinnPromptService.generatePrompt(selectedJobId, {
        generator: selectedGenerator,
        style: selectedStyle,
        duration: Number(selectedDuration)
      });
      
      // VALIDATION CRITIQUE DU PROMPT RETOURNÉ
      if (!prompt || !prompt.prompt || typeof prompt.prompt !== 'string' || prompt.prompt.trim().length === 0) {
        const error = new Error('Le service de prompt a retourné un prompt invalide');
        error.code = 'INVALID_PROMPT_RESPONSE';
        throw error;
      }
      
      console.log('Prompt généré avec succès:', prompt);
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
    console.log('Bouton Générer Vidéo cliqué');

    // VALIDATION STRICTE AVANT ENVOI
    if (!user) {
      toast.error('Veuillez vous connecter pour générer une vidéo');
      return;
    }

    if (!generatedPrompt || !generatedPrompt.prompt) {
      toast.error('Veuillez d\'abord générer un prompt valide');
      return;
    }

    // VALIDATION DU PROMPT
    if (typeof generatedPrompt.prompt !== 'string' || generatedPrompt.prompt.trim().length === 0) {
      toast.error('Le prompt généré est invalide. Veuillez régénérer un prompt.');
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationStatus('🚀 Démarrage de la génération vidéo...');
    setVideoError(null);
    setVideoResult(null);
    setGenerationTime(Date.now());
    setValidationErrors({});

    try {
      // PRÉPARATION PAYLOAD AVEC NORMALISATION
      const payload = {
        prompt: generatedPrompt.prompt.trim(),
        generator: selectedGenerator.toUpperCase(),
        style: selectedStyle.toLowerCase().trim(),
        duration: Number(selectedDuration),
        userId: user.id,
        jobId: selectedJobId
      };

      console.log('📤 Envoi payload normalisé:', payload);

      const result = await futureJobsVideoService.generateJobVideo(payload);

      if (result.success) {
        setVideoResult(result);
        setGenerationStatus('✅ Vidéo générée avec succès !');
        toast.success('Vidéo générée avec succès !');
        if (result.metadata?.is_placeholder) {
          toast.info('⚠️ Note: Sora API n\'est pas encore disponible. Une image DALL-E a été générée comme placeholder.');
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
      
      // MESSAGES D'ERREUR UTILISATEUR
      const userMessage = error.code === 'INVALID_STYLE' 
        ? 'Style visuel non reconnu. Veuillez choisir parmi les options disponibles.'
        : error.code === 'INVALID_PROMPT'
        ? 'Le prompt est invalide ou vide. Veuillez régénérer un prompt.'
        : error.code === 'NETWORK_ERROR'
        ? 'Problème de connexion. Vérifiez votre connexion internet.'
        : `Erreur: ${error.message}`;
      
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

  const handleRetryGeneration = async (videoId) => {
    if (!generatedPrompt) {
      toast.error('Veuillez d\'abord générer un prompt');
      return;
    }
    if (!user) {
      toast.error('Veuillez vous connecter');
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationStatus('🔄 Relance de la génération...');
    setVideoError(null);

    try {
      const result = await futureJobsVideoService.generateJobVideo({
        prompt: generatedPrompt.prompt,
        generator: selectedGenerator.toUpperCase(),
        style: selectedStyle.toLowerCase(),
        duration: Number(selectedDuration),
        userId: user.id,
        jobId: selectedJobId
      });

      if (result.success) {
        setVideoResult(result);
        setGenerationStatus('✅ Vidéo regénérée avec succès !');
        toast.success('Vidéo regénérée !');
        await loadUserVideos();
      } else {
        throw new Error(result.error || 'Échec de la regénération');
      }
    } catch (error) {
      console.error('❌ Erreur regénération:', error);
      setVideoError(error.message);
      setGenerationStatus('❌ Erreur lors de la regénération');
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsGeneratingVideo(false);
    }
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
    if (videoResult?.videoUrl) {
      const link = document.createElement('a');
      link.href = videoResult.videoUrl;
      link.download = `${generatedPrompt?.jobTitle?.replace(/\s+/g, '-') || 'video'}-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Vidéo téléchargée !');
    }
  };

  const getElapsedTime = () => {
    if (!generationTime) return '0s';
    const seconds = Math.floor((Date.now() - generationTime) / 1000);
    return `${seconds}s`;
  };

  const handleGenerateVariants = () => {
    setLoading(true);
    try {
      const variantsData = pinnPromptService.generatePromptVariants(selectedJobId, 3, {
        generator: selectedGenerator
      });
      setVariants(variantsData);
      setShowVariants(true);
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            🎬 Générateur de Vidéos Métiers du Futur
          </h1>
          <p className="text-slate-300 max-w-3xl mx-auto">
            Générez des prompts et créez des vidéos IA pour les métiers du futur (2030-2040)
          </p>
          <p className="text-sm text-slate-400 mt-2">
            Framework PINN-like: Contraintes réalistes + Créativité visuelle
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
            <h2 className="text-xl font-semibold mb-6 text-blue-300">📋 Configuration</h2>

            {/* Job Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Métier du Futur
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => {
                  setSelectedJobId(Number(e.target.value));
                  setGeneratedPrompt(null);
                  setVideoResult(null);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
              >
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.year})
                  </option>
                ))}
              </select>
            </div>

            {/* Generator & Style */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Générateur
                </label>
                <select
                  value={selectedGenerator}
                  onChange={(e) => setSelectedGenerator(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Sora">OpenAI Sora</option>
                  <option value="Runway">RunwayML</option>
                  <option value="Pika">Pika Labs</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Style Visuel
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="semi-realistic">Semi-réaliste</option>
                  <option value="futuristic">Futuriste</option>
                  <option value="cinematic">Cinématique</option>
                  <option value="documentary">Documentaire</option>
                  <option value="abstract">Abstrait</option>
                  <option value="lumi-universe">Univers de Lumi</option>
                </select>
              </div>
            </div>

            {/* Duration Slider */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Durée (secondes): {selectedDuration}s
                </label>
                <span className="text-xs text-slate-400">15-60s</span>
              </div>
              <input
                type="range"
                min="15"
                max="60"
                step="5"
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>15s</span>
                <span>30s</span>
                <span>45s</span>
                <span>60s</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGeneratePrompt}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-700 disabled:to-slate-800 text-white font-bold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                ✨ Générer Prompt
              </button>

              <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={!generatedPrompt || isGeneratingVideo}
                className={`w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                  !generatedPrompt || isGeneratingVideo
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:from-purple-700 hover:to-purple-800 cursor-pointer'
                }`}
              >
                {isGeneratingVideo ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                🎬 Générer la vidéo
              </button>

              <button
                type="button"
                onClick={handleGenerateVariants}
                disabled={loading || !selectedJobId}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Variantes de prompts
              </button>
            </div>

            {/* Validation Errors Display */}
            {Object.keys(validationErrors).length > 0 && (
              <div className="mt-6 p-3 bg-red-900/30 border border-red-700 rounded-md">
                <h3 className="text-red-300 font-semibold mb-2">⚠️ Erreurs de validation:</h3>
                <ul className="text-sm text-red-200">
                  {Object.entries(validationErrors).map(([key, error]) => (
                    <li key={key} className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Main Content - Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Preview */}
            {selectedJob && !generatedPrompt && !isGeneratingVideo && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-900/30 rounded-lg">
                    <Eye size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                    <p className="text-slate-300">Horizon: {selectedJob.year}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-blue-300">Tâches clés:</h3>
                    <ul className="space-y-2">
                      {selectedJob.keyTasks.split('. ').map((t, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-400 mt-1">•</span>
                          <span className="text-slate-300">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-blue-300">Compétences:</h3>
                    <ul className="space-y-2">
                      {selectedJob.coreSkills.split('. ').map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-400 mt-1">•</span>
                          <span className="text-slate-300">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Generation Status */}
            {isGeneratingVideo && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
                <h3 className="text-xl font-semibold mb-4 text-purple-300">{generationStatus}</h3>
                <p className="text-slate-300 mb-4">Temps écoulé: {getElapsedTime()}</p>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full animate-pulse"
                    style={{ width: '70%' }}
                  ></div>
                </div>
              </div>
            )}

            {/* Generated Prompt */}
            {generatedPrompt && !isGeneratingVideo && !videoResult && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold">Prompt Généré</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyPrompt}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 transition"
                    >
                      {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                      {copied ? 'Copié !' : 'Copier'}
                    </button>
                    <button
                      onClick={handleDownloadPrompt}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center gap-2 transition"
                    >
                      <Download size={16} />
                      Télécharger
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/70 p-4 rounded-lg border border-slate-600 mb-4">
                  <p className="text-slate-200 whitespace-pre-wrap">{generatedPrompt.prompt}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">Générateur:</p>
                    <p className="font-semibold">{selectedGenerator}</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">Style:</p>
                    <p className="font-semibold">{selectedStyle}</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">Durée:</p>
                    <p className="font-semibold">{selectedDuration}s</p>
                  </div>
                </div>
              </div>
            )}

            {/* Video Result */}
            {videoResult && !isGeneratingVideo && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-green-400">✅ Vidéo Générée avec Succès !</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadVideo}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-2 text-sm"
                    >
                      <Download size={16} />
                      Télécharger
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(videoResult.videoUrl)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center gap-2 text-sm"
                    >
                      <Copy size={16} />
                      Copier URL
                    </button>
                  </div>
                </div>

                {videoResult.videoUrl && (
                  <div className="mb-6">
                    <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden">
                      <video
                        controls
                        className="w-full h-full"
                        src={videoResult.videoUrl}
                        poster="https://storage.googleapis.com/ai-video-placeholders/video-preview.jpg"
                      >
                        Votre navigateur ne supporte pas la lecture de vidéos.
                      </video>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">ID de la vidéo:</p>
                    <p className="font-mono text-slate-200">{videoResult.videoId || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">Statut:</p>
                    <p className="font-semibold text-green-400">{videoResult.status || 'done'}</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">Modèle:</p>
                    <p className="font-semibold">{videoResult.metadata?.model || selectedGenerator}</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">Temps de génération:</p>
                    <p className="font-semibold">{videoResult.metadata?.processing_time_ms || 'N/A'}ms</p>
                  </div>
                </div>

                {videoResult.metadata?.model === 'dall-e-3' && (
                  <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-md">
                    <p className="text-yellow-300">
                      ⚠️ Note: Sora API n'est pas encore publique. Une image DALL-E a été générée comme placeholder.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Video Error */}
            {videoError && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-red-700/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-red-400">❌ Erreur de Génération</h3>
                  <button
                    onClick={() => handleRetryGeneration(videoResult?.videoId)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2 text-sm"
                  >
                    <RefreshCw size={16} />
                    Réessayer
                  </button>
                </div>

                <div className="bg-red-900/20 p-4 rounded-lg border border-red-800 mb-4">
                  <pre className="text-red-200 whitespace-pre-wrap text-sm">
                    {typeof videoError === 'string'
                      ? videoError
                      : JSON.stringify(videoError, null, 2)}
                  </pre>
                </div>

                <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                  <p className="text-slate-300 text-sm">
                    <span className="font-semibold">Conseil de dépannage:</span> Vérifiez que votre Edge Function est
                    correctement déployée et que votre clé API OpenAI est configurée. Code d'erreur:{' '}
                    {videoError.code || 'UNKNOWN'}
                  </p>
                </div>
              </div>
            )}

            {/* Video History */}
            {generatedVideos.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
                <h3 className="text-xl font-semibold mb-4">📜 Historique des Vidéos</h3>
                <div className="space-y-3">
                  {generatedVideos.map((video, index) => (
                    <div
                      key={video.id}
                      className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 hover:border-slate-600 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">
                            {video.job_prompts?.future_jobs?.title || 'Vidéo générée'}
                          </h4>
                          <p className="text-sm text-slate-400">
                            {new Date(video.created_at).toLocaleDateString('fr-FR')} • Statut:{' '}
                            <span
                              className={
                                video.status === 'done'
                                  ? 'text-green-400 font-semibold'
                                  : video.status === 'generating'
                                  ? 'text-yellow-400 font-semibold'
                                  : video.status === 'error'
                                  ? 'text-red-400 font-semibold'
                                  : 'text-gray-400'
                              }
                            >
                              {video.status}
                            </span>
                          </p>
                          {video.job_prompts?.generator && (
                            <p className="text-sm text-slate-500 mt-1">
                              Générateur: {video.job_prompts.generator} • Style: {video.job_prompts.style}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {video.video_url && (
                            <a
                              href={video.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                            >
                              Voir
                            </a>
                          )}
                          {video.status === 'generating' && (
                            <button
                              onClick={() => handleCancelGeneration(video.id)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                            >
                              Annuler
                            </button>
                          )}
                          {video.status === 'error' && (
                            <button
                              onClick={() => handleCheckStatus(video.id)}
                              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded"
                            >
                              Vérifier
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
          <h3 className="text-lg font-semibold mb-3 text-blue-300">📚 À propos du Framework PINN-like</h3>
          <p className="text-slate-300 mb-4">
            Ce générateur utilise un framework inspiré des <strong>Physics-Informed Neural Networks (PINN)</strong>.
            Les "physics" sont les contraintes réalistes du marché de l'emploi basées sur le rapport WEF 2025.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-blue-400 font-bold mb-2">🎯 Contraintes Réalistes</div>
              <p className="text-sm text-slate-300">
                Basées sur les données du WEF: tâches clés, compétences, technologies émergentes.
              </p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-blue-400 font-bold mb-2">🎨 Créativité Guidée</div>
              <p className="text-sm text-slate-300">
                Les prompts respectent les contraintes tout en permettant une expression créative riche.
              </p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-blue-400 font-bold mb-2">🚀 Prêt pour la Production</div>
              <p className="text-sm text-slate-300">
                Compatible avec Sora, Runway et Pika. Exportable en plusieurs formats.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
