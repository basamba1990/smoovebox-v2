import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Copy, Download, Zap, Eye, Play, Loader2, CheckCircle, XCircle, RefreshCw, LogIn, ArrowLeft } from 'lucide-react';
import pinnPromptService from '../services/pinnPromptService';
import { futureJobsVideoService } from '../services/futureJobsVideoService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import '../styles/futureJobsGenerator.css';

export default function FutureJobsGenerator() {
  const { user, profile, openAuthModal } = useAuth();
  const [selectedJobId, setSelectedJobId] = useState(1);
  const [selectedGenerator, setSelectedGenerator] = useState('sora'); // CORRECTION: minuscules
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
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  // CORRECTION: Normalisation immédiate de la casse
  const handleGeneratorSelect = useCallback((generator) => {
    setSelectedGenerator(generator.toLowerCase());
  }, []);

  const handleStyleSelect = useCallback((style) => {
    setSelectedStyle(style.toLowerCase());
  }, []);

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
      const result = await futureJobsVideoService.getUserVideos(user.id, 10);
      if (result.success) {
        setGeneratedVideos(result.videos || []);
      } else if (result.code === 'RLS_ERROR') {
        toast.error('Erreur de permissions. Actualisez la page.');
      }
    } catch (error) {
      console.error('Erreur chargement vidéos:', error);
      toast.error('Impossible de charger l\'historique');
    }
  };

  const handleGeneratePrompt = (e) => {
    if (e) e.preventDefault();
    if (loading || isButtonDisabled) return;
    
    console.log('Bouton Générer Prompt cliqué');
    setLoading(true);
    setIsButtonDisabled(true);
    setValidationErrors({});
    
    // Réactivation après 2 secondes pour prévenir le double-click
    setTimeout(() => setIsButtonDisabled(false), 2000);
    
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
      
      console.log('Prompt généré avec succès:', prompt);
      setGeneratedPrompt(prompt);
      setShowPreview(true);
      setVideoResult(null);
      setVideoError(null);
      setValidationErrors({});
      toast.success('Prompt généré avec succès !');
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
    if (isGeneratingVideo || isButtonDisabled) return;
    
    console.log('Bouton Générer Vidéo cliqué');

    // Vérification authentification
    if (!user) {
      toast.error('Veuillez vous connecter pour générer une vidéo');
      openAuthModal?.();
      return;
    }

    if (!generatedPrompt || !generatedPrompt.prompt) {
      toast.error('Veuillez d\'abord générer un prompt valide');
      return;
    }

    setIsGeneratingVideo(true);
    setIsButtonDisabled(true);
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
        // CORRECTION: On ne passe plus userId, le JWT sera utilisé
        jobId: selectedJobId
      };

      console.log('📤 Envoi payload normalisé à Edge Function:', payload);

      const result = await futureJobsVideoService.generateJobVideo(payload);

      if (result.success) {
        setVideoResult(result);
        setGenerationStatus('✅ Vidéo générée avec succès !');
        toast.success('Vidéo générée avec succès !');
        
        if (result.metadata?.is_placeholder) {
          toast.info('⚠️ Note: Sora API n\'est pas encore disponible. Une image DALL-E a été générée comme placeholder.');
        }
        
        // Rechargement de l'historique après succès
        setTimeout(() => loadUserVideos(), 1000);
      } else {
        // Gestion spécifique des erreurs d'authentification
        if (result.code === 'AUTH_REQUIRED' || result.requiresReauth) {
          toast.error('Session expirée. Veuillez vous reconnecter.');
          openAuthModal?.();
        }
        
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
      
      // Message d'erreur spécifique
      if (error.code === 'AUTH_REQUIRED') {
        toast.error('Session expirée. Veuillez vous reconnecter.');
      } else {
        toast.error(`Erreur: ${error.message}`);
      }
    } finally {
      setIsGeneratingVideo(false);
      // Réactivation après 3 secondes
      setTimeout(() => setIsButtonDisabled(false), 3000);
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
      openAuthModal?.();
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationStatus('🔄 Relance de la génération...');
    setVideoError(null);

    try {
      const result = await futureJobsVideoService.generateJobVideo({
        prompt: generatedPrompt.prompt,
        generator: selectedGenerator.toLowerCase().trim(),
        style: selectedStyle.toLowerCase().trim(),
        duration: Number(selectedDuration),
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
      toast.success('Prompt copié !');
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

  const handleDownloadVideo = async () => {
    if (!videoResult) return;
    
    try {
      const result = await futureJobsVideoService.downloadVideo(videoResult);
      if (result.success) {
        toast.success(`Téléchargement de ${result.fileName} lancé !`);
      } else {
        toast.error('Erreur lors du téléchargement');
      }
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    }
  };

  const getElapsedTime = () => {
    if (!generationTime) return '0s';
    const seconds = Math.floor((Date.now() - generationTime) / 1000);
    return `${seconds}s`;
  };

  const handleGenerateVariants = () => {
    if (loading || isButtonDisabled) return;
    
    setLoading(true);
    setIsButtonDisabled(true);
    
    setTimeout(() => setIsButtonDisabled(false), 2000);
    
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
    <div className="future-jobs-container min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span>Retour</span>
          </button>
        </div>
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
            Générateur de Métiers du Futur
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Framework PINN-like pour la génération de prompts vidéo optimisés basés sur les données du WEF 2025.
          </p>
          
          {!user && (
            <div className="mt-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700 max-w-md mx-auto">
              <p className="text-slate-300 mb-3">🔐 Connectez-vous pour générer des vidéos</p>
              <button
                onClick={() => openAuthModal?.()}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-semibold flex items-center gap-2 mx-auto hover:from-blue-500 hover:to-purple-500 transition"
              >
                <LogIn size={20} />
                Se connecter
              </button>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Configuration Panel */}
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
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Générateur Vidéo
                    <span className="text-xs text-slate-500 ml-2">(tout en minuscules)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['sora', 'runway', 'pika'].map((gen) => (
                      <button
                        key={gen}
                        type="button"
                        onClick={() => handleGeneratorSelect(gen)}
                        className={`py-2 rounded-lg text-sm font-semibold transition ${
                          selectedGenerator === gen
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {gen.charAt(0).toUpperCase() + gen.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Style Visuel
                    <span className="text-xs text-slate-500 ml-2">(tout en minuscules)</span>
                  </label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => handleStyleSelect(e.target.value)}
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
                  disabled={loading || isButtonDisabled}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
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
                  disabled={isGeneratingVideo || isButtonDisabled || !user}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingVideo ? <Loader2 className="animate-spin" /> : <Play size={20} />}
                  {!user ? 'Connectez-vous pour générer' : 'Lancer la Génération Vidéo'}
                </button>
                
                {isGeneratingVideo && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-slate-400">⏳ Temps écoulé: {getElapsedTime()}</p>
                    <div className="w-full bg-slate-800 rounded-full h-2 mt-2">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Display Panel */}
          <div className="lg:col-span-8 space-y-6">
            {/* Generated Prompt */}
            {generatedPrompt && !isGeneratingVideo && !videoResult && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold">Prompt Généré et Optimisé</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyPrompt}
                      disabled={copied}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 transition disabled:opacity-50"
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

                <h4 className="text-lg font-semibold text-blue-300 mb-2">Prompt Final (Anglais - Optimisé pour Sora/Runway)</h4>
                <div className="bg-slate-900/70 p-4 rounded-lg border border-slate-600 mb-4">
                  <p className="text-slate-200 whitespace-pre-wrap">{generatedPrompt.prompt}</p>
                </div>

                <h4 className="text-lg font-semibold text-purple-300 mb-2">Prompt Original (Français - Pour Référence)</h4>
                <div className="bg-slate-900/70 p-4 rounded-lg border border-slate-600 mb-4">
                  <p className="text-slate-400 whitespace-pre-wrap">{generatedPrompt.originalPrompt}</p>
                </div>

                <h4 className="text-lg font-semibold text-green-300 mb-2">Contraintes Appliquées (PINN-like)</h4>
                <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                  <li>**Métier**: {generatedPrompt.jobTitle} (Horizon: {generatedPrompt.year})</li>
                  <li>**Générateur**: {generatedPrompt.generator} | **Style**: {generatedPrompt.style} | **Durée**: {generatedPrompt.duration} secondes</li>
                  <li>**Tâches Clés**: {generatedPrompt.constraints.keyTasks}</li>
                  <li>**Technologies Émergentes**: {generatedPrompt.constraints.emergingTech}</li>
                  <li>**Éléments Visuels de Lumi**: {generatedPrompt.constraints.visualElements}</li>
                  <li>**Compétences Core**: {generatedPrompt.constraints.coreSkills}</li>
                </ul>
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
                    {videoResult.metadata?.is_placeholder && (
                      <span className="px-3 py-2 bg-yellow-600/20 text-yellow-400 rounded text-sm flex items-center">
                        Placeholder DALL-E
                      </span>
                    )}
                  </div>
                </div>

                <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden mb-6">
                  {videoResult.metadata?.is_placeholder ? (
                    <img
                      src={videoResult.url || videoResult.publicUrl || videoResult.videoUrl}
                      alt="Placeholder DALL-E"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      controls
                      className="w-full h-full"
                      src={videoResult.url || videoResult.publicUrl || videoResult.videoUrl}
                      poster="https://storage.googleapis.com/ai-video-placeholders/video-preview.jpg"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">Statut:</p>
                    <p className="font-semibold text-green-400">{videoResult.status || 'ready'}</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <p className="text-slate-400">Modèle:</p>
                    <p className="font-semibold">{videoResult.metadata?.generator || selectedGenerator}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Video Error */}
            {videoError && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-red-700/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-red-400">❌ Erreur de Génération</h3>
                  <div className="flex gap-2">
                    {videoError.code === 'AUTH_REQUIRED' ? (
                      <button
                        onClick={() => openAuthModal?.()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 text-sm"
                      >
                        <LogIn size={16} />
                        Se reconnecter
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRetryGeneration(videoResult?.videoId)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2 text-sm"
                      >
                        <RefreshCw size={16} />
                        Réessayer
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-red-900/20 p-4 rounded-lg border border-red-800">
                  <pre className="text-red-200 whitespace-pre-wrap text-sm">
                    {typeof videoError === 'string' 
                      ? videoError 
                      : JSON.stringify({
                          message: videoError.message,
                          code: videoError.code,
                          details: videoError.details
                        }, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Video History */}
            {user && generatedVideos.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">📜 Historique des Vidéos</h3>
                  <button
                    onClick={loadUserVideos}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded flex items-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Actualiser
                  </button>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {generatedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 hover:border-slate-600 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold">
                            {video.title || video.metadata?.jobTitle || `Vidéo ${video.id.substring(0, 8)}`}
                          </h4>
                          <p className="text-sm text-slate-400">
                            {new Date(video.created_at).toLocaleDateString('fr-FR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} • 
                            Statut: {' '}
                            <span
                              className={
                                video.status === 'ready' || video.status === 'done'
                                  ? 'text-green-400 font-semibold'
                                  : video.status === 'error' || video.status === 'failed'
                                  ? 'text-red-400 font-semibold'
                                  : video.status === 'generating'
                                  ? 'text-yellow-400 font-semibold animate-pulse'
                                  : 'text-slate-400 font-semibold'
                              }
                            >
                              {video.status}
                            </span>
                          </p>
                          {video.metadata?.generator && (
                            <p className="text-sm text-slate-500 mt-1">
                              Générateur: {video.metadata.generator} • 
                              Style: {video.metadata.style} • 
                              Durée: {video.metadata.duration || 'N/A'}s
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          {(video.url || video.public_url || video.video_url || video.status === 'ready' || video.status === 'transcribed') && (
                            <div className="flex gap-2">
                              <a
                                href={video.url || video.public_url || video.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center gap-1"
                              >
                                <Eye size={14} />
                                Voir
                              </a>
                              <button
                                onClick={() => futureJobsVideoService.downloadVideo(video)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded flex items-center gap-1"
                              >
                                <Download size={14} />
                                Télécharger
                              </button>
                            </div>
                          )}
                          {video.status === 'generating' && (
                            <button
                              onClick={() => handleCancelGeneration(video.id)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                            >
                              Annuler
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
              <div className="text-blue-400 font-bold mb-2">🔐 Authentification JWT</div>
              <p className="text-sm text-slate-300">
                Utilisation sécurisée du token JWT pour lier automatiquement les vidéos à l'utilisateur.
              </p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-blue-400 font-bold mb-2">🚀 Compatible Edge Functions</div>
              <p className="text-sm text-slate-300">
                Optimisé pour l'Edge Function corrigée avec gestion des casse et RLS.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
