import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

export default function DevelopmentPathways({ userId }) {
  const [pathways, setPathways] = useState([]);
  const [newPathway, setNewPathway] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchPathways();
  }, [userId]);

  const fetchPathways = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('development_pathways')
      .select('*, milestones(*)')
      .eq('user_id', userId);
    if (error) console.error('Erreur chargement parcours:', error);
    else setPathways(data || []);
    setFetching(false);
  };

  const createPathway = async () => {
    if (!newPathway.name) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('development_pathways')
      .insert({
        user_id: userId,
        pathway_name: newPathway.name,
        description: newPathway.description,
      })
      .select()
      .single();
    if (error) {
      console.error(error);
      alert('Erreur création');
    } else if (data) {
      setPathways([data, ...pathways]);
      setNewPathway({ name: '', description: '' });
    }
    setLoading(false);
  };

  const toggleMilestone = async (milestoneId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await supabase
      .from('milestones')
      .update({ status: newStatus })
      .eq('id', milestoneId);
    fetchPathways(); // refresh
  };

  if (fetching) return <div className="text-center py-8">Chargement des parcours...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cyan-400">Parcours Structurés</h2>

      {/* Création */}
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
          disabled={loading || !newPathway.name}
          className="bg-cyan-600 px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Ajouter'}
        </button>
      </div>

      {/* Liste */}
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
                      {m.name} – {new Date(m.target_date).toLocaleDateString()}
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
