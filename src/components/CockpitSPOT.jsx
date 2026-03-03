import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import LumiaRadar from './LumiaRadar.jsx';
import { useLumia } from '../hooks/useLumia.js';
import RobotIO from './RobotIO.jsx';

// Initialisation Supabase client (Edge Function)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CockpitSPOT() {
  const { userLumiaProfile, calculateBalance, territories, loading } = useLumia();
  const [scores, setScores] = useState({ feu_score: 50, air_score: 50, terre_score: 50, eau_score: 50 });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (userLumiaProfile?.lumia) {
      setScores(userLumiaProfile.lumia);
    }
  }, [userLumiaProfile]);

  const balance = calculateBalance();

  const territory = useMemo(() => {
    return (
      (userLumiaProfile?.lumia?.territoire &&
        territories.find((t) => t.name === userLumiaProfile.lumia.territoire)) ||
      territories[0]
    );
  }, [userLumiaProfile, territories]);

  // Missions dynamiques selon scores faibles (<70)
  const missions = useMemo(() => {
    const arr = [];
    if (scores.feu_score < 70) arr.push({ element: 'FEU', title: 'Pitch de Leadership', desc: 'Renforce l’action sur ton territoire' });
    if (scores.air_score < 70) arr.push({ element: 'AIR', title: 'Communication Express', desc: 'Améliore ton impact oral' });
    if (scores.terre_score < 70) arr.push({ element: 'TERRE', title: 'Atelier Structuré', desc: 'Consolide ta méthodologie' });
    if (scores.eau_score < 70) arr.push({ element: 'EAU', title: 'Atelier Cohésion', desc: 'Renforce l’esprit d’équipe' });
    return arr.length > 0 ? arr : [{ element: 'FEU', title: 'Mission Bonus', desc: 'Continue tes progrès' }];
  }, [scores]);

  const colorMap = { FEU: 'orange-500', AIR: 'cyan-500', TERRE: 'green-500', EAU: 'blue-500' };

  // Fonction pour lancer mission et mettre à jour les scores via Edge Function
  const launchMission = async (element) => {
    if (!userLumiaProfile?.id) return;
    setUpdating(true);
    try {
      const response = await supabase.functions.invoke('update-lumia-score', {
        body: { userId: userLumiaProfile.id, element },
      });
      if (response.data?.newScores) {
        setScores(response.data.newScores);
      }
    } catch (err) {
      console.error('Erreur mise à jour scores:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-cyan-400">Chargement du cockpit...</div>;
  }

  return (
    <div className="bg-[#020617] text-white p-6 font-sans">
      {/* Header Cockpit */}
      <header className="flex justify-between items-center mb-8 border-b border-cyan-900/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            COCKPIT SPOT
          </h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest">
            Système de Pilotage Énergétique • {territory.name}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase">Indice d'Équilibre</div>
            <div className="text-2xl font-mono text-cyan-400">{balance}%</div>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500/50 flex items-center justify-center bg-cyan-500/10">
            <span className="text-xl">⚡</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne Gauche */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl flex flex-col items-center">
            <RobotIO
              size="md"
              interactive={true}
              message={`Bonjour ! Nous sommes à ${territory?.name || 'Casablanca'}. L'état énergétique est stable à ${balance}%. Prêt pour ta prochaine mission ?`}
            />
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-800 bg-slate-900/20">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase">Zones Énergétiques</h3>
            <div className="space-y-4">
              {['FEU', 'AIR', 'TERRE', 'EAU'].map((zone) => {
                const score = scores[zone.toLowerCase() + '_score'] || 0;
                return (
                  <div key={zone} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{zone}</span>
                      <span className="text-cyan-400">{score}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colonne Centrale */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/60 to-cyan-900/10 backdrop-blur-2xl min-h-[400px] flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold mb-8 text-cyan-100">Radar Énergétique Territorial</h2>
            <div className="w-full max-w-md">
              <LumiaRadar
                scores={{
                  feu: scores.feu_score,
                  air: scores.air_score,
                  terre: scores.terre_score,
                  eau: scores.eau_score,
                }}
              />
            </div>
          </div>

          {/* Missions dynamiques */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {missions.map((m) => {
              const tailwindColor = colorMap[m.element] || 'cyan-500';
              return (
                <motion.div
                  key={m.element}
                  whileHover={{ scale: 1.05, translateY: -4 }}
                  className={`p-4 rounded-2xl border transition-colors cursor-pointer border-${tailwindColor}/20 bg-${tailwindColor}/5 hover:bg-${tailwindColor}/10 ${
                    updating ? 'opacity-50 pointer-events-none' : ''
                  }`}
                  onClick={() => launchMission(m.element)}
                >
                  <div className={`text-${tailwindColor} text-xs font-bold mb-1`}>MISSION {m.element}</div>
                  <div className="font-semibold">{m.title}</div>
                  <p className="text-xs text-slate-400 mt-1">{m.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
