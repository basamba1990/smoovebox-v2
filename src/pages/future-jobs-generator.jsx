import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronDown, Copy, Download, Zap, Eye, Play, Loader2, 
  CheckCircle, XCircle, RefreshCw, LogIn, ArrowLeft, 
  Sparkles, Shield, Cpu, Globe, Info, Video, Image as ImageIcon
} from 'lucide-react';
import pinnPromptService from '../services/pinnPromptService';
import { futureJobsVideoService } from '../services/futureJobsVideoService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { qg } from '../utils/logger'; // Import du logger corrigé
import '../styles/futureJobsGenerator.css';

export default function FutureJobsGenerator() {
  const { user, profile, openAuthModal } = useAuth();
  const [selectedJobId, setSelectedJobId] = useState(1);
  const [selectedGenerator, setSelectedGenerator] = useState('sora');
  const [selectedStyle, setSelectedStyle] = useState('futuristic');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoResult, setVideoResult] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [generatedVideos, setGeneratedVideos] = useState([]);

  useEffect(() => {
    const allJobs = pinnPromptService.getAllJobs();
    setJobs(allJobs);
    if (user) loadUserVideos();
  }, [user]);

  const loadUserVideos = async () => {
    if (!user) return;
    const result = await futureJobsVideoService.getUserVideos(user.id);
    if (result.success) setGeneratedVideos(result.videos || []);
  };

  const handleGeneratePrompt = (e) => {
    if (e) e.preventDefault();
    qg.info('Génération du prompt PINN...');
    setLoading(true);
    try {
      const prompt = pinnPromptService.generatePrompt(selectedJobId, {
        generator: selectedGenerator,
        style: selectedStyle,
        duration: Number(selectedDuration)
      });
      setGeneratedPrompt(prompt);
      toast.success('Prompt généré !');
    } catch (error) {
      qg.error('Erreur prompt:', error);
      toast.error('Échec de génération du prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async (e) => {
    if (e) e.preventDefault();
    if (!user) return openAuthModal?.();
    if (!generatedPrompt) return toast.error('Générez d\'abord un prompt');

    qg.info('Lancement de la génération vidéo...');
    setIsGeneratingVideo(true);
    setVideoError(null);

    try {
      const result = await futureJobsVideoService.generateJobVideo({
        prompt: generatedPrompt.prompt,
        generator: selectedGenerator,
        style: selectedStyle,
        duration: selectedDuration,
        jobId: selectedJobId
      });

      if (result.success) {
        setVideoResult(result);
        toast.success('Vidéo générée !');
        if (result.metadata?.is_placeholder) {
          toast.info('Note: Image DALL-E générée (Sora non disponible)');
        }
        loadUserVideos();
      } else {
        throw result;
      }
    } catch (error) {
      qg.error('Erreur génération:', error);
      setVideoError(error);
      toast.error(error.error || 'Erreur de génération');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleRetryGeneration = (videoId) => {
    handleGenerateVideo();
  };

  const handleCancelGeneration = (videoId) => {
    toast.info("L'annulation sera effective sous peu.");
  };

  const handleDownload = async (video) => {
    const res = await futureJobsVideoService.downloadVideo(video);
    if (res.success) toast.success('Téléchargement lancé');
    else toast.error('Erreur de téléchargement');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papier');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-12">
        {/* Header Section */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
            <Sparkles size={14} />
            <span>Framework PINN-like (Physics-Informed Neural Networks)</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-white via-blue-100 to-slate-400 bg-clip-text text-transparent">
            Générateur de Métiers du Futur
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Visualisez l'évolution du marché de l'emploi en 2025 grâce à l'IA générative et aux contraintes réalistes du rapport WEF.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Configuration */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Cpu className="text-blue-400" size={20} />
                Configuration du Job
              </h2>

              <div className="space-y-5">
                {/* Job Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Sélectionner un métier</label>
                  <div className="relative">
                    <select 
                      value={selectedJobId} 
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-blue-500/50 outline-none transition"
                    >
                      {jobs.map(job => (
                        <option key={job.id} value={job.id}>{job.title}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                  </div>
                </div>

                {/* Generator & Style */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Générateur</label>
                    <select 
                      value={selectedGenerator} 
                      onChange={(e) => setSelectedGenerator(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 appearance-none focus:ring-2 focus:ring-blue-500/50 outline-none transition"
                    >
                      <option value="sora">OpenAI Sora</option>
                      <option value="runway">Runway Gen-3</option>
                      <option value="pika">Pika 1.5</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Style Visuel</label>
                    <select 
                      value={selectedStyle} 
                      onChange={(e) => setSelectedStyle(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 appearance-none focus:ring-2 focus:ring-blue-500/50 outline-none transition"
                    >
                      <option value="futuristic">Futuriste</option>
                      <option value="cinematic">Cinématique</option>
                      <option value="realistic">Réaliste</option>
                      <option value="cyberpunk">Cyberpunk</option>
                    </select>
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2 flex justify-between">
                    <span>Durée de la simulation</span>
                    <span className="text-blue-400">{selectedDuration}s</span>
                  </label>
                  <input 
                    type="range" min="5" max="60" step="5"
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(e.target.value)}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <button 
                  onClick={handleGeneratePrompt}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                  Générer le Prompt PINN
                </button>
              </div>
            </div>

            {/* Prompt Display */}
            {generatedPrompt && (
              <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-blue-500/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-blue-400 flex items-center gap-2">
                    <Sparkles size={18} />
                    Prompt Optimisé
                  </h3>
                  <button 
                    onClick={() => copyToClipboard(generatedPrompt.prompt)}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition"
                  >
                    <Copy size={18} />
                  </button>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 mb-6">
                  <p className="text-sm text-slate-300 leading-relaxed italic">
                    "{generatedPrompt.prompt}"
                  </p>
                </div>
                <button 
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo}
                  className="w-full bg-white text-slate-950 hover:bg-slate-100 disabled:opacity-50 font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {isGeneratingVideo ? <Loader2 className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                  Lancer la Génération Vidéo
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Results & History */}
          <div className="lg:col-span-7 space-y-8">
            {/* Main Result Area */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800 overflow-hidden min-h-[400px] flex flex-col">
              {!videoResult && !isGeneratingVideo && !videoError && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 text-slate-600">
                    <Video size={40} />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-slate-300">Prêt pour la simulation</h3>
                  <p className="text-slate-500 max-w-xs">
                    Configurez votre métier et générez un prompt pour voir le résultat ici.
                  </p>
                </div>
              )}

              {isGeneratingVideo && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Cpu className="text-blue-400 animate-pulse" size={32} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-white">Génération en cours...</h3>
                  <p className="text-slate-400 animate-pulse">
                    Le moteur PINN traite les contraintes du marché...
                  </p>
                </div>
              )}

              {videoResult && (
                <div className="p-6 animate-in zoom-in-95 duration-500">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500/20 p-2 rounded-lg text-green-400">
                        <CheckCircle size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Simulation Terminée</h3>
                        <p className="text-xs text-slate-400">ID: {videoResult.videoId}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDownload(videoResult)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition"
                    >
                      <Download size={16} />
                      Télécharger
                    </button>
                  </div>

                  <div className="aspect-video bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative group">
                    {videoResult.metadata?.is_placeholder ? (
                      <img src={videoResult.url} alt="Génération IA" className="w-full h-full object-cover" />
                    ) : (
                      <video src={videoResult.url} controls className="w-full h-full" />
                    )}
                    <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-white border border-white/10">
                      {videoResult.metadata?.is_placeholder ? 'DALL-E 3 Image' : 'AI Video Render'}
                    </div>
                  </div>
                </div>
              )}

              {videoError && (
                <div className="p-6">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                        <XCircle size={24} />
                        Erreur de Génération
                      </h3>
                      <button 
                        onClick={() => handleRetryGeneration(videoResult?.videoId)}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                      >
                        <RefreshCw size={20} />
                      </button>
                    </div>
                    <div className="bg-slate-950/50 p-4 rounded-xl border border-red-900/30">
                      <pre className="text-red-200/70 text-xs whitespace-pre-wrap font-mono">
                        {typeof videoError === 'string' ? videoError : JSON.stringify(videoError, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* History Section */}
            {user && generatedVideos.length > 0 && (
              <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Globe className="text-purple-400" size={20} />
                    Historique des Simulations
                  </h3>
                  <button 
                    onClick={loadUserVideos}
                    className="text-slate-400 hover:text-white transition"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {generatedVideos.map((video) => (
                    <div key={video.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm truncate text-slate-200">
                            {video.title || `Simulation ${video.id.substring(0, 8)}`}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {new Date(video.created_at).toLocaleDateString('fr-FR')} • {video.status}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleDownload(video)}
                            className="p-1.5 bg-slate-700 hover:bg-blue-600 rounded-lg text-slate-300 hover:text-white transition"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden relative">
                        {video.metadata?.is_placeholder ? (
                          <ImageIcon className="absolute inset-0 m-auto text-slate-800" size={24} />
                        ) : (
                          <Video className="absolute inset-0 m-auto text-slate-800" size={24} />
                        )}
                        {video.video_url && (
                          <img 
                            src={video.video_url} 
                            alt="Preview" 
                            className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <footer className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/30 p-6 rounded-2xl border border-slate-800/50">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-4">
              <Shield size={20} />
            </div>
            <h4 className="font-bold mb-2">Contraintes Réalistes</h4>
            <p className="text-sm text-slate-400">
              Basé sur le rapport WEF 2025 : tâches clés, compétences et technologies émergentes.
            </p>
          </div>
          <div className="bg-slate-900/30 p-6 rounded-2xl border border-slate-800/50">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-4">
              <Sparkles size={20} />
            </div>
            <h4 className="font-bold mb-2">IA Hybride</h4>
            <p className="text-sm text-slate-400">
              Utilise DALL-E 3 pour les aperçus Sora et Runway Gen-3 pour les simulations cinématiques.
            </p>
          </div>
          <div className="bg-slate-900/30 p-6 rounded-2xl border border-slate-800/50">
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400 mb-4">
              <Info size={20} />
            </div>
            <h4 className="font-bold mb-2">Sécurité JWT</h4>
            <p className="text-sm text-slate-400">
              Authentification robuste et isolation des données via les politiques RLS de Supabase.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
