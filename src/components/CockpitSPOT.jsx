import React from 'react';
import { motion } from 'framer-motion';
import LumiaRadar from './LumiaRadar.jsx';
import RobotIO from './RobotIO.jsx';
import { useLumia } from '../hooks/useLumia.js';

/**
 * Composant Cockpit SPOT
 * Dashboard énergétique LUMIA en temps réel
 */
export default function CockpitSPOT() {
  const { userProfile, territories, zones, calculateBalance } = useLumia();

  // Sécurité si pas de profil
  if (!userProfile || !userProfile.territory) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-6 flex items-center justify-center">
        <RobotIO message="Chargement de votre profil LUMIA..." />
      </div>
    );
  }

  const balance = calculateBalance();
  const territory = territories.find(t => t.id === userProfile.territory) || territories[0];
  const dominantZone = zones.find(z => z.id === userProfile.dominantZone) || zones[0];
  const scores = userProfile.scores || { feu: 50, air: 50, terre: 50, eau: 50 };

  // Missions recommandées basées sur la zone dominante
  const recommendedMissions = {
    feu: {
      title: 'Pitch de Leadership',
      description: 'Renforce l’action sur ton territoire.',
      color: 'orange',
    },
    air: {
      title: 'Atelier Innovation',
      description: 'Développe ta vision créative.',
      color: 'blue',
    },
    terre: {
      title: 'Projet Structure',
      description: 'Organise une initiative locale.',
      color: 'green',
    },
    eau: {
      title: 'Mission Cohésion',
      description: 'Fédère autour d’un impact social.',
      color: 'cyan',
    },
  }[userProfile.dominantZone] || {
    title: 'Découvre ta première mission',
    description: 'Complète ton profil pour des suggestions personnalisées.',
    color: 'slate',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1120] to-[#1A1F2E] text-white p-6 font-sans">
      {/* Header Cockpit */}
      <header className="flex flex-wrap justify-between items-center mb-8 border-b border-cyan-900/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            COCKPIT SPOT
          </h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest">
            Système de Pilotage Énergétique • {territory.name} {territory.icon}
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

      {/* Grille principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne Gauche : Mascotte & État */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl border border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl">
            <RobotIO
              message={`Bonjour ! Nous sommes à ${territory.name}. Ton équilibre est à ${balance}%. Ta zone dominante : ${dominantZone.label}. Prêt pour ta prochaine mission ?`}
            />
          </div>

          <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/20">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase">Zones Énergétiques</h3>
            <div className="space-y-4">
              {Object.entries(scores).map(([key, value]) => {
                const zone = zones.find(z => z.id === key) || { label: key.toUpperCase(), color: '#06b6d4' };
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{zone.label}</span>
                      <span className="text-cyan-400">{value}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        style={{ backgroundColor: zone.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colonne Centrale : Radar LUMIA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/60 to-cyan-900/10 backdrop-blur-2xl min-h-[400px] flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold mb-8 text-cyan-100">Radar Énergétique Territorial</h2>
            <div className="w-full max-w-md">
              <LumiaRadar scores={scores} />
            </div>
          </div>

          {/* Missions Recommandées */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`p-4 rounded-2xl border border-${recommendedMissions.color}-500/20 bg-${recommendedMissions.color}-500/5 hover:bg-${recommendedMissions.color}-500/10 transition-colors cursor-pointer`}
            >
              <div className={`text-${recommendedMissions.color}-400 text-xs font-bold mb-1`}>
                MISSION {dominantZone.label}
              </div>
              <div className="font-semibold">{recommendedMissions.title}</div>
              <p className="text-xs text-slate-400 mt-1">{recommendedMissions.description}</p>
            </div>

            {/* Deuxième mission (exemple) */}
            <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer">
              <div className="text-blue-400 text-xs font-bold mb-1">MISSION DÉCOUVERTE</div>
              <div className="font-semibold">Explore une autre zone</div>
              <p className="text-xs text-slate-400 mt-1">Développe une compétence complémentaire.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pied de page : Intégration LUMIA */}
      <div className="mt-8 pt-4 border-t border-slate-800/50 text-xs text-slate-500 flex justify-between items-center">
        <span>Territoire actif : {territory.name} • Zone dominante : {dominantZone.label}</span>
        <span className="text-cyan-400/70">⚡ Synchronisé avec LUMIA</span>
      </div>
    </div>
  );
}
