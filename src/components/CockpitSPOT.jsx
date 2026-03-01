import { motion } from 'framer-motion';
import LumiaRadar from './LumiaRadar.jsx';
import { useLumia } from '../hooks/useLumia.js';
import RobotIO from './RobotIO.jsx';

/**
 * Composant Cockpit SPOT
 * Dashboard énergétique LUMIA en temps réel
 * Avec RobotIO Joueur Numéro 10
 */
export default function CockpitSPOT() {
  const { userLumiaProfile, calculateBalance, territories, getTerritoryInfo, loading } = useLumia();
  
  if (loading) {
    return <div className="p-10 text-center text-cyan-400">Chargement du cockpit...</div>;
  }

  const balance = calculateBalance();
  const territory = (userLumiaProfile?.lumia?.territoire && territories.find(t => t.name === userLumiaProfile.lumia.territoire)) || territories[0];
  const scores = userLumiaProfile?.lumia || { feu_score: 50, air_score: 50, terre_score: 50, eau_score: 50 };

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
        {/* Colonne Gauche : Mascotte & État */}
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
              {['FEU', 'AIR', 'TERRE', 'EAU'].map((zone) => (
                <div key={zone} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{zone}</span>
                    <span className="text-cyan-400">75%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '75%' }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne Centrale : Radar LUMIA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/60 to-cyan-900/10 backdrop-blur-2xl min-h-[400px] flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold mb-8 text-cyan-100">Radar Énergétique Territorial</h2>
            <div className="w-full max-w-md">
              <LumiaRadar scores={{
                feu: scores.feu_score,
                air: scores.air_score,
                terre: scores.terre_score,
                eau: scores.eau_score
              }} />
            </div>
          </div>

          {/* Missions Recommandées */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div 
              whileHover={{ scale: 1.05, translateY: -4 }}
              className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-colors cursor-pointer"
            >
              <div className="text-orange-400 text-xs font-bold mb-1">MISSION FEU</div>
              <div className="font-semibold">Pitch de Leadership</div>
              <p className="text-xs text-slate-400 mt-1">Renforce l'action sur ton territoire.</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05, translateY: -4 }}
              className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer"
            >
              <div className="text-blue-400 text-xs font-bold mb-1">MISSION EAU</div>
              <div className="font-semibold">Atelier de Cohésion</div>
              <p className="text-xs text-slate-400 mt-1">Améliore l'impact social local.</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
