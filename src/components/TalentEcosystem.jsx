import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ENERGIES } from '../config/catalogue-interne.config';

export default function TalentEcosystem({ userId }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, [userId]);

  const fetchMatches = async () => {
    setLoading(true);
    // Ici, on suppose que la table talent_matches existe et contient des correspondances
    // Si elle n'existe pas, on peut appeler une fonction RPC pour calculer les correspondances
    const { data, error } = await supabase
      .from('talent_matches')
      .select('*, talent2:profiles!talent2_id(*)')
      .eq('talent1_id', userId);
    if (error) {
      console.error('Erreur chargement correspondances:', error);
      // Fallback : données mockées pour la démo
      setMatches([
        {
          id: 'mock1',
          talent2: { id: '2', full_name: 'Alex D.', avatar: null },
          compatibility_score: 85,
          reason: 'Complémentarité FEU/AIR',
          complementarity_analysis: 'Votre énergie FEU complète son AIR pour l’innovation.',
        },
        {
          id: 'mock2',
          talent2: { id: '3', full_name: 'Marie L.', avatar: null },
          compatibility_score: 72,
          reason: 'Équilibre TERRE/EAU',
          complementarity_analysis: 'Votre structure renforce son impact social.',
        },
      ]);
    } else {
      setMatches(data || []);
    }
    setLoading(false);
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

  if (loading) return <div className="text-center py-8">Chargement des correspondances...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cyan-400">Écosystème de Talents</h2>

      {matches.length === 0 ? (
        <p className="text-slate-400 italic">Aucune correspondance trouvée pour le moment.</p>
      ) : (
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
                  {match.talent2?.avatar ? <img src={match.talent2.avatar} className="rounded-full" alt="" /> : '👤'}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">{match.talent2?.full_name || 'Utilisateur'}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {match.complementarity_analysis && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {match.complementarity_analysis.substring(0, 30)}...
                      </span>
                    )}
                  </div>
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(match.compatibility_score)}`}>
                  {match.compatibility_score}%
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-cyan-500">
            <h3 className="text-xl font-bold mb-2">Détails de la correspondance</h3>
            <p><span className="text-cyan-400">Score :</span> {selectedMatch.compatibility_score}%</p>
            <p className="mt-2"><span className="text-cyan-400">Analyse :</span> {selectedMatch.reason || 'Complémentaire'}</p>
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
