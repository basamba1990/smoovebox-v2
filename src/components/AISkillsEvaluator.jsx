/**
 * AISkillsEvaluator - VERSION CORRIGÉE
 * Évalue les compétences à partir des enregistrements vidéo.
 * 
 * Corrections apportées :
 * 1. Utilisation de la table 'user_lumia_profile' pour les scores.
 * 2. Gestion robuste des erreurs avec messages explicatifs.
 * 3. Support du nouveau schéma SQL (feu_score, air_score, etc.).
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { BrainCircuit, Play, CheckCircle2, AlertCircle } from 'lucide-react';

const ENERGIES = {
  feu: { label: 'FEU', icon: '🔥', color: '#F97316' },
  air: { label: 'AIR', icon: '🌬', color: '#0EA5E9' },
  terre: { label: 'TERRE', icon: '🌍', color: '#22C55E' },
  eau: { label: 'EAU', icon: '💧', color: '#06B6D4' },
};

export default function AISkillsEvaluator({ userId }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [fetchingVideos, setFetchingVideos] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      if (!userId) return;
      setFetchingVideos(true);
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setVideos(data || []);
      } catch (error) {
        console.error('Erreur chargement vidéos:', error);
        toast.error('Impossible de charger vos vidéos');
      } finally {
        setFetchingVideos(false);
      }
    };
    fetchVideos();
  }, [userId]);

  const analyzeVideo = async () => {
    if (!selectedVideo) {
      toast.error('Veuillez sélectionner une vidéo à analyser');
      return;
    }
    
    setLoading(true);
    setAnalysis(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée. Veuillez vous reconnecter.');

      // Appel à la fonction Edge Supabase pour l'analyse IA
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-pitch-recording`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            videoId: selectedVideo.id,
            context: 'lumia_skills_evaluation',
            elements: ['FEU', 'AIR', 'TERRE', 'EAU'],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors de l\'évaluation IA');
      }

      const data = await response.json();
      
      // Mapping des scores de l'IA vers notre structure
      const scores = {
        feu: data.analysis?.elements?.FEU || 0,
        air: data.analysis?.elements?.AIR || 0,
        terre: data.analysis?.elements?.TERRE || 0,
        eau: data.analysis?.elements?.EAU || 0,
      };
      
      setAnalysis({ ...data.analysis, scores });

      // Étape 1: Sauvegarder l'évaluation détaillée
      const { error: evalError } = await supabase.from('skills_evaluations').insert({
        user_id: userId,
        video_id: selectedVideo.id,
        scores,
        feedback: data.analysis?.feedback || '',
        recommendations: data.analysis?.recommendations || '',
      });

      if (evalError) console.error('Erreur sauvegarde évaluation:', evalError);

      // Étape 2: Mettre à jour le profil LUMIA de l'utilisateur (user_lumia_profile)
      const { error: profileError } = await supabase
        .from('user_lumia_profile')
        .update({
          feu_score: scores.feu,
          air_score: scores.air,
          terre_score: scores.terre,
          eau_score: scores.eau,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Erreur mise à jour profil LUMIA:', profileError);
        // On ne bloque pas car l'évaluation est quand même réussie
      }

      toast.success('Évaluation LUMIA terminée avec succès !');
    } catch (err) {
      console.error('Erreur analyse:', err);
      toast.error(`Échec de l'évaluation : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
          <BrainCircuit size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Évaluation IA des 4 Éléments</h2>
          <p className="text-xs text-slate-400">Analysez vos pitchs pour mesurer votre énergie</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sélection de Vidéo */}
        <div className="md:col-span-2 space-y-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Sélectionner un enregistrement
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fetchingVideos ? (
              Array(2).fill(0).map((_, i) => (
                <div key={i} className="h-24 bg-slate-800/50 animate-pulse rounded-xl border border-slate-700" />
              ))
            ) : videos.length === 0 ? (
              <div className="col-span-2 p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center">
                <AlertCircle className="mx-auto text-slate-600 mb-2" size={32} />
                <p className="text-slate-500 text-sm">Aucune vidéo trouvée. Enregistrez un pitch d'abord !</p>
              </div>
            ) : (
              videos.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVideo(v)}
                  className={`
                    p-4 rounded-xl border text-left transition-all duration-300 group
                    ${selectedVideo?.id === v.id 
                      ? "bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/5" 
                      : "bg-slate-800/30 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${selectedVideo?.id === v.id ? "bg-purple-500 text-white" : "bg-slate-700 text-slate-400 group-hover:text-white"}`}>
                      <Play size={14} fill="currentColor" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white truncate max-w-[150px]">
                        {v.title || "Pitch Vidéo"}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(v.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Action d'Analyse */}
        <div className="flex flex-col justify-end">
          <button
            onClick={analyzeVideo}
            disabled={!selectedVideo || loading}
            className={`
              w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all duration-300
              ${!selectedVideo || loading 
                ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
                : "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]"}
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyse en cours...
              </span>
            ) : (
              "Lancer l'Analyse IA"
            )}
          </button>
        </div>
      </div>

      {/* Résultats de l'Analyse */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(analysis.scores).map(([key, value]) => (
                <div
                  key={key}
                  className="relative p-4 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden group"
                >
                  <div 
                    className="absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10" 
                    style={{ backgroundColor: ENERGIES[key]?.color }} 
                  />
                  <div className="relative z-10 text-center">
                    <div className="text-2xl mb-1">{ENERGIES[key]?.icon}</div>
                    <div className="text-2xl font-black" style={{ color: ENERGIES[key]?.color }}>
                      {value}%
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {ENERGIES[key]?.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Feedback de l'IA
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {analysis.feedback}
                </p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <BrainCircuit size={14} /> Recommandations
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {analysis.recommendations}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
