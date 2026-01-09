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
    setLoading(true);
    setValidationErrors({});
    try {
      const prompt = pinnPromptService.generatePrompt(selectedJobId, {
        generator: selectedGenerator,
        style: selectedStyle,
        duration: Number(selectedDuration)
      });
      
      if (!prompt || !prompt.prompt) {
        throw new Error('Échec de génération du prompt');
      }
      
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

  const handleGenerateVideo = async (e) => {
    if (e) e.preventDefault();
    if (!user) {
      toast.error('Veuillez vous connecter');
      return;
    }
    if (!generatedPrompt) {
      toast.error('Générez d\'abord un prompt');
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationStatus('🚀 Démarrage de la génération...');
    setVideoError(null);
    setVideoResult(null);
    setGenerationTime(Date.now());

    try {
      const payload = {
        prompt: generatedPrompt.prompt.trim(),
        generator: selectedGenerator.toLowerCase().trim(),
        style: selectedStyle.toLowerCase().trim(),
        duration: Number(selectedDuration),
        userId: user.id,
        jobId: selectedJobId
      };

      const result = await futureJobsVideoService.generateJobVideo(payload);

      if (result.success) {
        setVideoResult(result);
        setGenerationStatus('✅ Succès !');
        toast.success('Vidéo générée !');
        await loadUserVideos();
      } else {
        throw new Error(result.error || 'Échec');
      }
    } catch (error) {
      setVideoError(error.message);
      setGenerationStatus('❌ Erreur');
      toast.error(error.message);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleCheckStatus = async (videoId) => {
    const result = await futureJobsVideoService.checkVideoStatus(videoId);
    if (result.success) {
      toast.info(`Statut: ${result.status}`);
      await loadUserVideos();
    }
  };

  const handleCancelGeneration = async (videoId) => {
    if (window.confirm('Annuler ?')) {
      const result = await futureJobsVideoService.cancelVideoGeneration(videoId);
      if (result.success) {
        toast.success('Annulé');
        await loadUserVideos();
      }
    }
  };

  const handleRetryGeneration = async () => {
    handleGenerateVideo();
  };

  const handleCopyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copié !');
    }
  };

  const handleDownloadPrompt = () => {
    if (generatedPrompt) {
      const markdown = pinnPromptService.exportForGenerator(generatedPrompt, 'markdown');
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(markdown));
      element.setAttribute('download', `prompt.md`);
      element.click();
    }
  };

  const handleDownloadVideo = () => {
    if (videoResult?.videoUrl || videoResult?.url || videoResult?.publicUrl) {
      const url = videoResult.url || videoResult.publicUrl || videoResult.videoUrl;
      window.open(url, '_blank');
    }
  };

  const getElapsedTime = () => {
    if (!generationTime) return '0s';
    return `${Math.floor((Date.now() - generationTime) / 1000)}s`;
  };

  return (
    <div className="future-jobs-container min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
            Générateur de Métiers du Futur
          </h1>
          <p className="text-xl text-slate-400">Framework PINN-like / WEF 2025</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Config */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-slate-800">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Zap className="text-yellow-400" /> Config</h2>
              <form onSubmit={handleGeneratePrompt} className="space-y-5">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Métier</label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3"
                  >
                    {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Générateur</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Sora', 'Runway', 'Pika'].map((gen) => (
                      <button
                        key={gen} type="button"
                        onClick={() => setSelectedGenerator(gen)}
                        className={`py-2 rounded-lg text-sm ${selectedGenerator === gen ? 'bg-blue-600' : 'bg-slate-800'}`}
                      >
                        {gen}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-blue-600 py-4 rounded-xl font-bold">
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Générer Prompt'}
                </button>
              </form>
            </div>

            {generatedPrompt && (
              <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
                <button
                  onClick={handleGenerateVideo} disabled={isGeneratingVideo}
                  className="w-full bg-green-600 py-4 rounded-xl font-bold"
                >
                  {isGeneratingVideo ? <Loader2 className="animate-spin mx-auto" /> : 'Lancer Vidéo'}
                </button>
              </div>
            )}
          </div>

          {/* Display */}
          <div className="lg:col-span-8 space-y-6">
            {isGeneratingVideo && (
              <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
                <Loader2 size={48} className="animate-spin mb-4 mx-auto text-blue-500" />
                <h3 className="text-2xl font-bold">{generationStatus}</h3>
                <p>{getElapsedTime()}</p>
              </div>
            )}

            {generatedPrompt && !isGeneratingVideo && !videoResult && (
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <div className="flex justify-between mb-4">
                  <h3 className="text-2xl font-bold">Prompt PINN</h3>
                  <div className="flex gap-2">
                    <button onClick={handleCopyPrompt} className="p-2 bg-blue-600 rounded"><Copy size={16} /></button>
                    <button onClick={handleDownloadPrompt} className="p-2 bg-slate-700 rounded"><Download size={16} /></button>
                  </div>
                </div>
                <div className="bg-slate-900 p-4 rounded border border-slate-600">
                  <p className="text-slate-200">{generatedPrompt.prompt}</p>
                </div>
              </div>
            )}

            {videoResult && !isGeneratingVideo && (
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <h3 className="text-2xl font-bold text-green-400 mb-4">✅ Vidéo Prête</h3>
                <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden mb-4">
                  <video controls className="w-full h-full" src={videoResult.url || videoResult.publicUrl || videoResult.videoUrl} />
                </div>
                <button onClick={handleDownloadVideo} className="w-full bg-green-600 py-2 rounded">Télécharger</button>
              </div>
            )}

            {/* Historique Corrigé (Sans jointures) */}
            {generatedVideos.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <h3 className="text-xl font-semibold mb-4">📜 Historique Récent</h3>
                <div className="space-y-3">
                  {generatedVideos.map((video) => (
                    <div key={video.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold">{video.title || 'Vidéo Métier'}</h4>
                          <p className="text-sm text-slate-400">
                            {new Date(video.created_at).toLocaleDateString()} • 
                            <span className={video.status === 'ready' || video.status === 'done' ? 'text-green-400' : 'text-yellow-400'}>
                               {video.status}
                            </span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {(video.url || video.public_url || video.video_url) && (
                            <a href={video.url || video.public_url || video.video_url} target="_blank" className="px-3 py-1 bg-blue-600 rounded text-sm">Voir</a>
                          )}
                          {video.status === 'error' && (
                            <button onClick={() => handleCheckStatus(video.id)} className="px-3 py-1 bg-yellow-600 rounded text-sm">Vérifier</button>
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
      </div>
    </div>
  );
}
