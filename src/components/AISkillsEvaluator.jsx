import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ENERGIES } from '../config/catalogue-interne.config';

export default function AISkillsEvaluator({ userId }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState([]);

  React.useEffect(() => {
    const fetchVideos = async () => {
      const { data } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data) setVideos(data);
    };
    fetchVideos();
  }, [userId]);

  const analyzeVideo = async () => {
    if (!selectedVideo) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-pitch-recording', {
        body: { videoUrl: selectedVideo.url },
      });
      if (error) throw error;

      const scores = {
        feu: data.scores?.feu || 0,
        air: data.scores?.air || 0,
        terre: data.scores?.terre || 0,
        eau: data.scores?.eau || 0,
      };
      setAnalysis({ ...data, scores });

      // Sauvegarder en base
      await supabase.from('skills_evaluations').insert({
        user_id: userId,
        video_id: selectedVideo.id,
        scores,
        feedback: data.feedback,
        recommendations: data.recommendations,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cyan-400">Évaluation IA des 4 Éléments</h2>
      <div className="flex gap-4 items-center">
        <select
          className="flex-1 bg-slate-700 border border-cyan-500/30 rounded-lg px-4 py-2 text-white"
          onChange={(e) => setSelectedVideo(videos.find(v => v.id === e.target.value))}
          value={selectedVideo?.id || ''}
        >
          <option value="">Sélectionnez une vidéo</option>
          {videos.map(v => (
            <option key={v.id} value={v.id}>{v.title || v.id}</option>
          ))}
        </select>
        <button
          onClick={analyzeVideo}
          disabled={!selectedVideo || loading}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Analyse...' : 'Analyser'}
        </button>
      </div>

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-4 p-4 bg-slate-900/50 rounded-xl"
        >
          {Object.entries(analysis.scores).map(([key, value]) => (
            <div key={key} className="text-center p-3 rounded-lg" style={{ backgroundColor: `${ENERGIES[key]?.color}20` }}>
              <div className="text-2xl">{ENERGIES[key]?.icon}</div>
              <div className="font-bold" style={{ color: ENERGIES[key]?.color }}>{value}%</div>
              <div className="text-xs text-slate-400">{ENERGIES[key]?.label}</div>
            </div>
          ))}
          <div className="col-span-2 mt-2">
            <p className="text-sm text-slate-300"><span className="text-cyan-400">Feedback :</span> {analysis.feedback}</p>
            <p className="text-sm text-slate-300 mt-1"><span className="text-cyan-400">Recommandations :</span> {analysis.recommendations}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
