import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ENERGIES } from '../config/catalogue-interne.config';

export default function TalentEcosystem({ userId }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);

  useEffect(() => {
    fetchMatches();
  }, [userId]);

  const fetchMatches = async () => {
    // Récupérer les correspondances via la fonction SQL calculate_match_score ou une vue
    const { data } = await supabase
      .from('talent_matches')
      .select('*, talent2:profiles!talent2_id(*)')
      .eq('talent1_id', userId);
    if (data) setMatches(data);
  };

  const sendRequest = async (matchId) => {
    const match = matches.find(m => m.id === matchId);
    await supabase.from('collaboration_requests').insert({
      sender_id: userId,
      receiver_id: match.talent2_id,
      match_id: matchId,
      project: 'Projet commun',
      description: 'Proposition de collaboration',
      required_skills: match.complementarity_analysis,
    });
    alert('Demande envoyée !');
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-cyan-400';
    if (score >= 40) return 'text-orange-500';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cyan-400">Écosystème de Talents</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.map(match => (
          <motion.div
            key={match.id}
            whileHover={{ scale: 1.02 }}
            className="bg-slate-800/80 p-4 rounded-xl border border-cyan-500/20 cursor-pointer"
            onClick={() => setSelectedMatch(match)}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-2xl">
                {match.talent2?.avatar ? <img src={match.talent2.avatar} className="rounded-full" /> : '👤'}
              </div>
              <div className="flex-1">
                <h3 className="font-bold">{match.talent2?.full_name || 'Utilisateur'}</h3>
                <div className="flex gap-2 mt-1">
                  {Object.entries(match.compatibility_analysis || {}).map(([key, val]) => (
                    <span key={key} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${ENERGIES[key]?.color}30`, color: ENERGIES[key]?.color }}>
                      {ENERGIES[key]?.icon} {val}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(match.compatibility_score)}`}>
                {match.compatibility_score}%
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-cyan-500">
            <h3 className="text-xl font-bold mb-2">Détails de la correspondance</h3>
            <p><span className="text-cyan-400">Score :</span> {selectedMatch.compatibility_score}%</p>
            <p className="mt-2"><span className="text-cyan-400">Analyse :</span> {selectedMatch.reason}</p>
            <p className="mt-2"><span className="text-cyan-400">Complémentarité :</span> {selectedMatch.complementarity_analysis}</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => sendRequest(selectedMatch.id)}
                className="flex-1 bg-cyan-600 py-2 rounded-lg"
              >
                Proposer collaboration
              </button>
              <button
                onClick={() => setSelectedMatch(null)}
                className="flex-1 bg-slate-600 py-2 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
