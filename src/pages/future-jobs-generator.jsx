import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Copy, Download, Zap, Eye, Play, Loader2, CheckCircle, XCircle, RefreshCw, LogIn, ArrowLeft } from 'lucide-react';
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

  const handleDownload = async (video) => {
    const res = await futureJobsVideoService.downloadVideo(video);
    if (res.success) toast.success('Téléchargement lancé');
    else toast.error('Erreur de téléchargement');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Générateur de Métiers du Futur</h1>
        
        <div className="grid gap-6 bg-slate-800 p-6 rounded-xl border border-slate-700">
          {/* Configuration UI simplifiée pour la livraison */}
          <div className="flex flex-wrap gap-4">
            <select 
              value={selectedJobId} 
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-slate-700 p-2 rounded"
            >
              {jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
            <button 
              onClick={handleGeneratePrompt}
              disabled={loading}
              className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Zap size={18} />}
              Générer le Prompt PINN
            </button>
          </div>

          {generatedPrompt && (
            <div className="mt-4 p-4 bg-slate-900 rounded border border-blue-500/30">
              <p className="text-sm text-slate-400 mb-2">Prompt prêt pour {selectedGenerator}</p>
              <button 
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo}
                className="w-full bg-green-600 py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2"
              >
                {isGeneratingVideo ? <Loader2 className="animate-spin" /> : <Play size={18} />}
                Lancer la Génération Vidéo
              </button>
            </div>
          )}

          {videoResult && (
            <div className="mt-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-green-400">✅ Vidéo/Image prête</h3>
                <button onClick={() => handleDownload(videoResult)} className="bg-green-600 p-2 rounded">
                  <Download size={18} />
                </button>
              </div>
              <div className="aspect-video bg-black rounded overflow-hidden">
                {videoResult.metadata?.is_placeholder ? (
                  <img src={videoResult.url} alt="DALL-E" className="w-full h-full object-cover" />
                ) : (
                  <video src={videoResult.url} controls className="w-full h-full" />
                )}
              </div>
            </div>
          )}

          {videoError && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded text-red-200">
              <p className="font-bold">❌ Erreur</p>
              <pre className="text-xs mt-2">{JSON.stringify(videoError, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Historique */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4">📜 Historique</h2>
          <div className="grid gap-4">
            {generatedVideos.map(v => (
              <div key={v.id} className="bg-slate-800 p-4 rounded border border-slate-700 flex justify-between items-center">
                <div>
                  <p className="font-medium">{v.title}</p>
                  <p className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDownload(v)} className="p-2 hover:bg-slate-700 rounded"><Download size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
