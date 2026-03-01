import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

export default function DevelopmentPathways({ userId }) {
  const [pathways, setPathways] = useState([]);
  const [newPathway, setNewPathway] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchPathways();
    }
  }, [userId]);

  const fetchPathways = async () => {
    setFetching(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('development_pathways')
        .select('*, milestones(*)')
        .eq('user_id', userId);
      
      if (fetchError) {
        console.error('Erreur chargement parcours:', fetchError);
        setError('Impossible de charger vos parcours');
      } else {
        setPathways(data || []);
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors du chargement des parcours');
    } finally {
      setFetching(false);
    }
  };

  const createPathway = async () => {
    if (!newPathway.name.trim()) {
      setError('Le nom du parcours est requis');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('development_pathways')
        .insert({
          user_id: userId,
          pathway_name: newPathway.name,
          description: newPathway.description,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      setPathways([{ ...data, milestones: [] }, ...pathways]);
      setNewPathway({ name: '', description: '' });
    } catch (err) {
      console.error('Erreur création:', err);
      setError('Erreur lors de la création du parcours');
    } finally {
      setLoading(false);
    }
  };

  const toggleMilestone = async (milestoneId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const { error: updateError } = await supabase
        .from('milestones')
        .update({ status: newStatus })
        .eq('id', milestoneId);
      
      if (updateError) throw updateError;
      
      fetchPathways();
    } catch (err) {
      console.error('Erreur mise à jour:', err);
      setError('Erreur lors de la mise à jour du jalon');
    }
  };

  if (fetching) return <div className="text-center py-8 text-cyan-400">Chargement des parcours...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cyan-400">Parcours Structurés</h2>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Nom du parcours"
          className="flex-1 min-w-[200px] bg-slate-700 border border-cyan-500/30 rounded-lg px-4 py-2 text-white"
          value={newPathway.name}
          onChange={(e) => setNewPathway({ ...newPathway, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Description"
          className="flex-1 min-w-[200px] bg-slate-700 border border-cyan-500/30 rounded-lg px-4 py-2 text-white"
          value={newPathway.description}
          onChange={(e) => setNewPathway({ ...newPathway, description: e.target.value })}
        />
        <button
          onClick={createPathway}
          disabled={loading || !newPathway.name.trim()}
          className="bg-cyan-600 px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Ajouter'}
        </button>
      </div>

      {pathways.length === 0 ? (
        <p className="text-slate-400 italic">Aucun parcours créé.</p>
      ) : (
        <div className="space-y-4">
          {pathways.map(p => {
            const total = p.milestones?.length || 0;
            const completed = p.milestones?.filter(m => m.status === 'completed').length || 0;
            const progress = total ? Math.round((completed / total) * 100) : 0;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-800/80 p-4 rounded-xl border border-cyan-500/20"
              >
                <h3 className="font-bold text-cyan-300">{p.pathway_name}</h3>
                <p className="text-sm text-slate-400 mb-2">{p.description}</p>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-xs text-right text-slate-500">{progress}%</div>
                {p.milestones?.map(m => (
                  <div key={m.id} className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={m.status === 'completed'}
                      onChange={() => toggleMilestone(m.id, m.status)}
                      className="accent-cyan-500"
                    />
                    <span className={m.status === 'completed' ? 'line-through text-slate-500' : ''}>
                      {m.name} – {m.target_date ? new Date(m.target_date).toLocaleDateString() : 'Sans date'}
                    </span>
                  </div>
                ))}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
