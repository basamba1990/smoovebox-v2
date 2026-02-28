import React from 'react';
import { motion } from 'framer-motion';
import LumiaRadar from './LumiaRadar.jsx';
import RobotIO from './RobotIO.jsx';
import CatalogueInterneFlow from './CatalogueInterneFlow.jsx';
import { useLumia } from '../hooks/useLumia.js';
import { useCatalogueInterne } from '../hooks/useCatalogueInterne.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ENERGIES } from '../config/catalogue-interne.config.js';

export default function CockpitSPOT() {
  const { user } = useAuth();
  const { userProfile, calculateBalance, territories, getTerritoryInfo, zones } = useLumia();
  const { getProgress, currentEtape } = useCatalogueInterne();

  const balance = calculateBalance();
  const territory = userProfile?.lumia_id
    ? getTerritoryInfo(userProfile.lumia_id)
    : territories[0];
  const progress = getProgress();

  // Couleurs des zones depuis ENERGIES
  const zoneColors = {
    FEU: ENERGIES.feu.color,
    AIR: ENERGIES.air.color,
    TERRE: ENERGIES.terre.color,
    EAU: ENERGIES.eau.color,
  };

  // Récupérer les scores depuis radar_scores (ou défauts)
  const scores = userProfile?.radar_scores || { feu: 50, air: 50, terre: 50, eau: 50 };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 font-sans">
      <header className="flex justify-between items-center mb-8 border-b border-cyan-900/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            COCKPIT SPOT
          </h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest">
            Système de Pilotage Énergétique • {territory?.territoire || 'Territoire inconnu'}
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
          <div className="glass-card p-6 rounded-3xl border border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl">
            <RobotIO
              message={`Bonjour ${user?.user_metadata?.full_name || ''} ! Nous sommes à ${
                territory?.territoire || 'votre territoire'
              }. L'état énergétique est stable à ${balance}%. Prêt pour ta prochaine mission ?`}
            />
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-800 bg-slate-900/20">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase">Zones Énergétiques</h3>
            <div className="space-y-4">
              {zones.map((zone) => {
                const score = scores[zone.id];
                return (
                  <div key={zone.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{zone.label}</span>
                      <span className="text-cyan-400">{score}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full"
                        style={{ background: `linear-gradient(90deg, ${zone.color}, #60a5fa)` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-4 rounded-3xl border border-cyan-500/20 bg-slate-900/30">
            <h3 className="text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
              <span>📊</span> Progression
            </h3>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Étape {progress.current} / {progress.total}</span>
              <span>{progress.percentage}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {currentEtape?.label || 'Chargement...'}
            </p>
          </div>
        </div>

        {/* Colonne Centrale */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/60 to-cyan-900/10 backdrop-blur-2xl min-h-[400px] flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold mb-8 text-cyan-100">Radar Énergétique Territorial</h2>
            <div className="w-full max-w-md">
              <LumiaRadar scores={scores} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-colors cursor-pointer">
              <div className="text-orange-400 text-xs font-bold mb-1">MISSION FEU</div>
              <div className="font-semibold">Pitch de Leadership</div>
              <p className="text-xs text-slate-400 mt-1">Renforce l'action sur ton territoire.</p>
            </div>
            <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer">
              <div className="text-blue-400 text-xs font-bold mb-1">MISSION EAU</div>
              <div className="font-semibold">Atelier de Cohésion</div>
              <p className="text-xs text-slate-400 mt-1">Améliore l'impact social local.</p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-3xl border border-cyan-500/20">
            <CatalogueInterneFlow />
          </div>
        </div>
      </div>
    </div>
  );
}
