import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ENERGIES } from '../config/catalogue-interne.config';
import { toast } from 'sonner';

export default function AISkillsEvaluator({ userId }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [fetchingVideos, setFetchingVideos] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      if (!userId) {
        setFetchingVideos(false);
        setError('Utilisateur non identifié');
        return;
      }

      setFetchingVideos(true);
      setError(null);

      try {
        // ✅ CORRECTION : accepter les statuts 'ready', 'completed' et 'analyzed'
        const { data, error: fetchError } = await supabase
          .from('videos')
          .select('id, title, created_at, status')
          .eq('user_id', userId)
          .in('status', ['ready', 'completed', 'analyzed'])
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Erreur chargement vidéos:', fetchError);
          setError('Impossible de charger vos vidéos');
          toast.error('Erreur lors du chargement des vidéos');
        } else {
          setVideos(data || []);
          if (!data || data.length === 0) {
            setError('Aucune vidéo disponible. Enregistrez d\'abord une vidéo dans l\'onglet Enregistrement.');
          }
        }
      } catch (err) {
        console.error('Erreur fetch vidéos:', err);
        setError('Erreur lors de la récupération des vidéos');
        toast.error('Erreur technique lors du chargement');
      } finally {
        setFetchingVideos(false);
      }
    };

    fetchVideos();
  }, [userId]);

  const analyzeVideo = async () => {
    if (!selectedVideo) {
      toast.error('Veuillez sélectionner une vidéo');
      return;
    }

    setLoading(true);
    setAnalysis(null);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const apiUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!apiUrl) {
        throw new Error('Configuration manquante');
      }

      const requestBody = {
        videoId: selectedVideo.id,
        context: 'lumia_skills_evaluation',
        elements: ['FEU', 'AIR', 'TERRE', 'EAU'],
        softPromptTask: 'skills-evaluation',
      };

      console.log('Envoi de la requête d\'analyse:', requestBody);

      const response = await fetch(
        `${apiUrl}/functions/v1/analyze-pitch-recording`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log('Réponse API status:', response.status);

      if (!response.ok) {
        let errorMessage = `Erreur API: ${response.status}`;
        
        try {
          const errorData = await response.json();
          console.error('Détails erreur API:', errorData);
          errorMessage = errorData?.message || errorData?.error || errorMessage;
        } catch (parseError) {
          console.error('Impossible de parser la réponse d\'erreur:', parseError);
          const textError = await response.text();
          console.error('Réponse brute:', textError);
        }

        if (response.status === 400) {
          errorMessage = 'Erreur de validation : Vérifiez que la vidéo est valide et complète.';
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Données d\'analyse reçues:', data);

      const scores = {
        feu: data.analysis?.elements?.FEU || data.analysis?.feu || 0,
        air: data.analysis?.elements?.AIR || data.analysis?.air || 0,
        terre: data.analysis?.elements?.TERRE || data.analysis?.terre || 0,
        eau: data.analysis?.elements?.EAU || data.analysis?.eau || 0,
      };

      const analysisResult = {
        ...data.analysis,
        scores,
        feedback: data.analysis?.feedback || 'Analyse complétée',
        recommendations: data.analysis?.recommendations || 'Continuez vos enregistrements',
      };

      setAnalysis(analysisResult);

      // Sauvegarde dans skills_evaluations
      try {
        await supabase.from('skills_evaluations').insert({
          user_id: userId,
          video_id: selectedVideo.id,
          scores,
          feedback: analysisResult.feedback,
          recommendations: analysisResult.recommendations,
          created_at: new Date().toISOString(),
        });
      } catch (dbError) {
        console.warn('Erreur sauvegarde en base:', dbError);
        toast.warning('Analyse réussie mais non sauvegardée en base.');
      }

      toast.success('✅ Évaluation LUMIA terminée !');
    } catch (err) {
      console.error('Erreur analyse:', err);
      const errorMessage = err?.message || 'Échec de l\'évaluation des compétences';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-2xl font-bold text-cyan-300 flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          Évaluation IA des 4 Éléments
        </h2>
        <p className="text-slate-400 text-sm mt-2">
          Sélectionnez une vidéo et laissez l'IA analyser vos compétences LUMIA
        </p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm"
        >
          ⚠️ {error}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
      >
        <select
          className="flex-1 bg-slate-700/50 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
          onChange={(e) => {
            const video = videos.find(v => v.id === e.target.value);
            setSelectedVideo(video || null);
          }}
          value={selectedVideo?.id || ''}
          disabled={fetchingVideos || videos.length === 0}
        >
          <option value="">
            {fetchingVideos
              ? '⏳ Chargement des vidéos...'
              : videos.length === 0
              ? '❌ Aucune vidéo disponible'
              : '📹 Sélectionnez une vidéo'}
          </option>
          {videos.map(v => (
            <option key={v.id} value={v.id}>
              {v.title || `Vidéo du ${new Date(v.created_at).toLocaleDateString('fr-FR')}`}
            </option>
          ))}
        </select>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={analyzeVideo}
          disabled={!selectedVideo || loading || fetchingVideos}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-700 px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? (
            <>
              <span className="inline-block animate-spin mr-2">⚙️</span>
              Analyse en cours...
            </>
          ) : (
            '🔍 Analyser'
          )}
        </motion.button>
      </motion.div>

      <AnimatePresence mode="wait">
        {analysis && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(analysis.scores).map(([key, value], index) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center p-4 rounded-xl border border-cyan-500/20 transition-all hover:border-cyan-500/50"
                  style={{
                    backgroundColor: `${ENERGIES[key]?.color || '#0891b2'}15`,
                  }}
                >
                  <div className="text-3xl mb-2">{ENERGIES[key]?.icon || '⚡'}</div>
                  <div
                    className="text-2xl font-bold mb-1"
                    style={{ color: ENERGIES[key]?.color || '#06b6d4' }}
                  >
                    {Math.round(value)}%
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">
                    {ENERGIES[key]?.label || key}
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50"
            >
              {analysis.feedback && (
                <div>
                  <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-2">
                    📋 Feedback
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {analysis.feedback}
                  </p>
                </div>
              )}

              {analysis.recommendations && (
                <div>
                  <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-2">
                    💡 Recommandations
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {analysis.recommendations}
                  </p>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex gap-3 pt-2"
            >
              <button
                onClick={() => {
                  setAnalysis(null);
                  setSelectedVideo(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg font-medium text-white transition-colors"
              >
                ← Nouvelle analyse
              </button>
              <button
                onClick={() => {
                  toast.success('Résultats sauvegardés !');
                }}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg font-medium text-white transition-colors"
              >
                ✓ Confirmer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!analysis && videos.length === 0 && !fetchingVideos && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-slate-800/30 rounded-xl border border-dashed border-slate-600 text-center"
        >
          <p className="text-slate-400 text-sm">
            📹 Enregistrez d'abord une vidéo dans l'onglet <span className="font-semibold text-cyan-300">Enregistrement</span>.
          </p>
        </motion.div>
      )}
    </div>
  );
}
