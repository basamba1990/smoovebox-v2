import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ENERGIES } from '../config/catalogue-interne.config';
import { toast } from 'sonner';

export default function AISkillsEvaluator({ userId }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [fetchingVideos, setFetchingVideos] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      setFetchingVideos(true);
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Erreur chargement vidéos:', error);
        toast.error('Impossible de charger vos vidéos');
      } else {
        setVideos(data || []);
      }
      setFetchingVideos(false);
    };
    if (userId) fetchVideos();
  }, [userId]);

  const analyzeVideo = async () => {
    if (!selectedVideo) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-pitch-recording`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            videoId: selectedVideo.id,
            context: 'lumia_skills_evaluation',
            elements: ['FEU', 'AIR', 'TERRE', 'EAU'],
          }),
        }
      );

      if (!response.ok) throw new Error('Erreur lors de l\'évaluation IA');

      const data = await response.json();
      const scores = {
        feu: data.analysis?.elements?.FEU || 0,
        air: data.analysis?.elements?.AIR || 0,
        terre: data.analysis?.elements?.TERRE || 0,
        eau: data.analysis?.elements?.EAU || 0,
      };
      setAnalysis({ ...data.analysis, scores });

      // Sauvegarder en base
      await supabase.from('skills_evaluations').insert({
        user_id: userId,
        video_id: selectedVideo.id,
        scores,
        feedback: data.analysis?.feedback || '',
        recommendations: data.analysis?.recommendations || '',
      });

      toast.success('Évaluation LUMIA terminée !');
    } catch (err) {
      console.error('Erreur analyse:', err);
      toast.error('Échec de l\'évaluation des compétences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cyan-400">Évaluation IA des 4 Éléments</h2>
      <div className="flex flex-wrap gap-4 items-center">
        <select
          className="flex-1 min-w-[200px] bg-slate-700 border border-cyan-500/30 rounded-lg px-4 py-2 text-white"
          onChange={(e) => setSelectedVideo(videos.find(v => v.id === e.target.value))}
          value={selectedVideo?.id || ''}
          disabled={fetchingVideos}
        >
          <option value="">{fetchingVideos ? 'Chargement...' : 'Sélectionnez une vidéo'}</option>
          {videos.map(v => (
            <option key={v.id} value={v.id}>
              {v.title || `Vidéo du ${new Date(v.created_at).toLocaleDateString()}`}
            </option>
          ))}
        </select>
        <button
          onClick={analyzeVideo}
          disabled={!selectedVideo || loading}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Analyse en cours...' : 'Analyser'}
        </button>
      </div>

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-4 p-4 bg-slate-900/50 rounded-xl"
        >
          {Object.entries(analysis.scores).map(([key, value]) => (
            <div
              key={key}
              className="text-center p-3 rounded-lg"
              style={{ backgroundColor: `${ENERGIES[key]?.color}20` }}
            >
              <div className="text-2xl">{ENERGIES[key]?.icon}</div>
              <div className="font-bold" style={{ color: ENERGIES[key]?.color }}>
                {value}%
              </div>
              <div className="text-xs text-slate-400">{ENERGIES[key]?.label}</div>
            </div>
          ))}
          <div className="col-span-2 mt-2">
            <p className="text-sm text-slate-300">
              <span className="text-cyan-400">Feedback :</span> {analysis.feedback}
            </p>
            <p className="text-sm text-slate-300 mt-1">
              <span className="text-cyan-400">Recommandations :</span> {analysis.recommendations}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
