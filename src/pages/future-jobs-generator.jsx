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
  const [selectedGenerator, setSelectedGenerator] = useState('SORA'); // 🔥 CHANGÉ: Toujours en majuscule
  const [selectedStyle, setSelectedStyle] = useState('futuristic');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [variants, setVariants] = useState(null);
  const [showVariants, setShowVariants] = useState(false);
  
  // États pour la génération vidéo
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoResult, setVideoResult] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [generationTime, setGenerationTime] = useState(null);

  // Charger les métiers au montage
  useEffect(() => {
    const allJobs = pinnPromptService.getAllJobs();
    setJobs(allJobs);
    
    // Charger l'historique des vidéos générées
    if (user) {
      loadUserVideos();
    }
  }, [user]);

  // Nettoyer l'intervalle de polling à la destruction du composant
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
      setVideoResult(null);
      setVideoError(null);
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FONCTION PRINCIPALE CORRIGÉE - PAYLOAD NORMALISÉ
  const handleGenerateVideo = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour générer une vidéo');
      return;
    }

    if (!generatedPrompt || !generatedPrompt.prompt) {
      toast.error('Veuillez d\'abord générer un prompt');
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationStatus('🚀 Démarrage de la génération vidéo...');
    setVideoError(null);
    setVideoResult(null);
    setGenerationTime(Date.now());

    try {
      // ✅ FIX: Payload strictement aligné avec l'Edge Function
      const result = await futureJobsVideoService.generateJobVideo({
        prompt: String(generatedPrompt.prompt).trim(), // ✅ STRING + TRIM
        generator: selectedGenerator.toUpperCase(), // ✅ TOUJOURS MAJUSCULES
        style: selectedStyle,
        duration: Number(selectedDuration),
        userId: user.id,
        jobId: selectedJobId
      });

      if (result.success) {
        setVideoResult(result);
        setGenerationStatus('✅ Vidéo générée avec succès !');
        toast.success('Vidéo générée avec succès !');
        
        if (result.metadata?.is_placeholder) {
          toast.info('⚠️ Note: Sora API n\'est pas encore disponible. Une image DALL-E a été générée comme placeholder.');
        }
        
        await loadUserVideos();
      } else {
        throw new Error(result.error || 'Échec de la génération');
      }
    } catch (error) {
      console.error('❌ Erreur génération vidéo:', error);
      setVideoError(error.message);
      setGenerationStatus('❌ Erreur lors de la génération');
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Fonction pour vérifier le statut d'une vidéo
  const handleCheckStatus = async (videoId) => {
    try {
      const result = await futureJobsVideoService.checkVideoStatus(videoId);
      if (result.success) {
        toast.info(`Statut: ${result.status}`);
        await loadUserVideos(); // Recharger la liste
      }
    } catch (error) {
      toast.error('Erreur vérification statut');
    }
  };

  // Fonction pour annuler une génération
  const handleCancelGeneration = async (videoId) => {
    if (window.confirm('Annuler cette génération ?')) {
      const result = await futureJobsVideoService.cancelVideoGeneration(videoId);
      if (result.success) {
        toast.success('Génération annulée');
        await loadUserVideos();
      }
    }
  };

  // Fonction pour relancer une génération
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
      // ✅ Même payload normalisé
      const result = await futureJobsVideoService.generateJobVideo({
        prompt: String(generatedPrompt.prompt).trim(),
        generator: selectedGenerator.toUpperCase(),
        style: selectedStyle,
        duration: selectedDuration,
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

  // Copier le prompt
  const handleCopyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Prompt copié dans le presse-papiers !');
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
      toast.success('Prompt téléchargé !');
    }
  };

  // Télécharger la vidéo
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

  // Calcul du temps écoulé
  const getElapsedTime = () => {
    if (!generationTime) return '0s';
    const seconds = Math.floor((Date.now() - generationTime) / 1000);
    return `${seconds}s`;
  };

  // Fonction pour générer des variantes
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
    <div className="future-jobs-generator min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🎬 Générateur de Vidéos Métiers du Futur</h1>
          <p className="text-gray-400">Générez des prompts et créez des vidéos IA pour les métiers du futur (2030-2040)</p>
          <p className="text-sm text-gray-500 mt-2">Framework PINN-like: Contraintes réalistes + Créativité visuelle</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panneau de contrôle */}
          <div className="lg:col-span-1 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-3">Métier du Futur</label>
              <select
                value={selectedJobId}
                onChange={(e) => {
                  setSelectedJobId(Number(e.target.value));
                  setGeneratedPrompt(null);
                  setVideoResult(null);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.title} ({job.year})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Générateur</label>
                <select
                  value={selectedGenerator}
                  onChange={(e) => setSelectedGenerator(e.target.value.toUpperCase())} // ✅ MAJUSCULES
                  className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white text-sm"
                >
                  <option value="SORA">OpenAI Sora</option>
                  <option value="RUNWAY">RunwayML</option>
                  <option value="PIKA">Pika Labs</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Style Visuel</label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white text-sm"
                >
                  <option value="semi-realistic">Semi-réaliste</option>
                  <option value="futuristic">Futuriste</option>
                  <option value="cinematic">Cinématique</option>
                  <option value="documentary">Documentaire</option>
                  <option value="abstract">Abstrait</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Durée (secondes): {selectedDuration}s</label>
              <input
                type="range"
                min="15"
                max="60"
                step="5"
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={handleGeneratePrompt}
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold rounded-md flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                ✨ Générer Prompt
              </button>
              
              <button
                onClick={handleGenerateVideo}
                disabled={!generatedPrompt || isGeneratingVideo}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-bold rounded-md flex items-center justify-center gap-2 transition-all"
              >
                {isGeneratingVideo ? <Loader2 className="animate-spin" /> : <Play size={20} />}
                🎬 Générer la vidéo
              </button>

              <button
                onClick={handleGenerateVariants}
                disabled={loading || !selectedJobId}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm"
              >
                Variantes de prompts
              </button>
            </div>
          </div>

          {/* Zone d'affichage */}
          <div className="lg:col-span-2 space-y-6">
            {/* Aperçu du métier sélectionné */}
            {selectedJob && !generatedPrompt && !isGeneratingVideo && (
              <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap size={40} className="text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">{selectedJob.title}</h2>
                <p className="text-gray-400 mb-6">Horizon: {selectedJob.year}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                  <div>
                    <h4 className="text-sm font-bold text-blue-400 uppercase mb-2">Tâches clés:</h4>
                    <ul className="text-sm space-y-1 text-gray-300">
                      {selectedJob.key_tasks.map((t, i) => <li key={i}>• {t}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-purple-400 uppercase mb-2">Compétences:</h4>
                    <ul className="text-sm space-y-1 text-gray-300">
                      {selectedJob.core_skills.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Loader de génération vidéo */}
            {isGeneratingVideo && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-12 text-center">
                <Loader2 size={60} className="animate-spin text-purple-500 mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-2">{generationStatus}</h3>
                <p className="text-gray-400">Temps écoulé: {getElapsedTime()}</p>
                <div className="mt-8 max-w-md mx-auto bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full animate-pulse" style={{width: '70%'}}></div>
                </div>
              </div>
            )}

            {/* Affichage du prompt généré */}
            {generatedPrompt && !isGeneratingVideo && !videoResult && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-700/50 p-4 flex justify-between items-center border-b border-slate-600">
                  <h3 className="font-bold flex items-center gap-2">
                    <Eye size={18} /> Prompt Généré
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={handleCopyPrompt} className="p-2 hover:bg-slate-600 rounded transition-colors" title="Copier">
                      {copied ? <CheckCircle size={18} className="text-green-400" /> : <Copy size={18} />}
                    </button>
                    <button onClick={handleDownloadPrompt} className="p-2 hover:bg-slate-600 rounded transition-colors" title="Télécharger">
                      <Download size={18} />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-blue-100 bg-slate-900/50 p-4 rounded border border-slate-700 leading-relaxed">
                    {generatedPrompt.prompt}
                  </pre>
                  
                  <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Générateur: {selectedGenerator}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      Style: {selectedStyle}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Durée: {selectedDuration}s
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Résultat vidéo */}
            {videoResult && !isGeneratingVideo && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-green-400">✅ Vidéo Générée avec Succès !</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadVideo}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 text-sm"
                    >
                      <Download size={16} />
                      Télécharger
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(videoResult.videoUrl)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center gap-2 text-sm"
                    >
                      <Copy size={16} />
                      Copier
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {videoResult.videoUrl && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <video
                        src={videoResult.videoUrl}
                        controls
                        className="w-full h-full"
                        poster="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800"
                      >
                        Votre navigateur ne supporte pas la lecture de vidéos.
                      </video>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-slate-900/50 p-3 rounded">
                      <p className="text-gray-400">ID de la vidéo:</p>
                      <p className="text-white font-mono truncate">{videoResult.videoId || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded">
                      <p className="text-gray-400">Statut:</p>
                      <p className="text-green-300 font-semibold">{videoResult.status || 'done'}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded">
                      <p className="text-gray-400">Modèle:</p>
                      <p className="text-white">{videoResult.metadata?.model || selectedGenerator}</p>
                    </div>
                  </div>
                  
                  {videoResult.metadata?.is_placeholder && (
                    <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-200 text-sm">
                      ⚠️ Note: Sora API n'est pas encore publique. Une image DALL-E a été générée comme placeholder.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section erreur */}
            {videoError && (
              <div className="bg-red-900/30 backdrop-blur border border-red-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-red-400">❌ Erreur de Génération</h3>
                  <button
                    onClick={() => handleRetryGeneration(videoResult?.videoId)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2 text-sm"
                  >
                    <RefreshCw size={16} />
                    Réessayer
                  </button>
                </div>
                
                <p className="text-red-200 mb-3">{videoError}</p>
                <p className="text-gray-300 text-sm">
                  Vérifiez que votre Edge Function est correctement déployée et que votre clé API OpenAI est configurée.
                </p>
              </div>
            )}

            {/* Historique des vidéos générées */}
            {generatedVideos.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">📜 Historique des Vidéos</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {generatedVideos.map((video, index) => (
                    <div key={video.id} className="bg-slate-900/50 rounded p-4 border border-slate-600">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-gray-300 font-medium">
                            {video.job_prompts?.future_jobs?.title || 'Vidéo générée'}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {new Date(video.created_at).toLocaleDateString('fr-FR')} • 
                            Statut: <span className={
                              video.status === 'done' ? 'text-green-400 font-semibold' :
                              video.status === 'generating' ? 'text-yellow-400 font-semibold' :
                              video.status === 'error' ? 'text-red-400 font-semibold' : 'text-gray-400'
                            }>{video.status}</span>
                          </p>
                          {video.job_prompts?.generator && (
                            <p className="text-gray-500 text-xs mt-1">
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
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center gap-1"
                            >
                              <Eye size={14} />
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
