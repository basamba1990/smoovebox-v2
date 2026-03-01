/**
 * Composant Cockpit SPOT - VERSION AMÉLIORÉE
 * Dashboard énergétique LUMIA en temps réel avec intégration complète du flux
 * 
 * Intègre:
 * - Affichage du profil utilisateur et de la LUMIA territoriale
 * - Missions disponibles et constellations actives
 * - Radar énergétique avec scores en temps réel
 * - Navigation vers les étapes suivantes du flux (Constellation → Pitch → Validation)
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import LumiaRadar from './LumiaRadar.jsx';
import { useLumiaFlow } from '../hooks/useLumiaFlow.js';
import RobotIO from './RobotIO.jsx';
import '../styles/lumia-cockpit.css';

export default function CockpitSPOT() {
  const navigate = useNavigate();
  const {
    userLumiaProfile,
    availableMissions,
    userConstellations,
    loadingProfile,
    loadingMissions,
    loadingConstellations,
    profileError,
    missionsError,
    constellationsError,
  } = useLumiaFlow();

  const [selectedMission, setSelectedMission] = useState(null);
  const [showMissionDetails, setShowMissionDetails] = useState(false);

  // Calcul de l'équilibre énergétique
  const calculateBalance = () => {
    if (!userLumiaProfile?.lumia) return 0;
    const { feu_score, air_score, terre_score, eau_score } = userLumiaProfile.lumia;
    const avg = (feu_score + air_score + terre_score + eau_score) / 4;
    const variance = [feu_score, air_score, terre_score, eau_score].reduce(
      (sum, val) => sum + Math.pow(val - avg, 2),
      0
    ) / 4;
    return Math.round(100 - Math.sqrt(variance));
  };

  const balance = calculateBalance();

  // Gestion des erreurs
  if (profileError || missionsError || constellationsError) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-6 font-sans flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Erreur de chargement</h2>
          <p className="text-slate-400">Une erreur est survenue lors du chargement des données LUMIA.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Chargement
  if (loadingProfile || loadingMissions || loadingConstellations) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-6 font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mb-4"></div>
          <p className="text-slate-400">Chargement du Cockpit SPOT...</p>
        </div>
      </div>
    );
  }

  if (!userLumiaProfile) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-6 font-sans flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">Profil LUMIA non trouvé</h2>
          <p className="text-slate-400">Veuillez d'abord créer votre profil LUMIA.</p>
        </div>
      </div>
    );
  }

  const { user, lumia } = userLumiaProfile;
  const territory = lumia.territoire;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 font-sans">
      {/* Header Cockpit */}
      <header className="flex justify-between items-center mb-8 border-b border-cyan-900/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            COCKPIT SPOT
          </h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest">
            Système de Pilotage Énergétique • {territory}
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
          <div className="glass-card p-6 rounded-3xl border border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl">
            <RobotIO 
              message={`Bonjour ! Nous sommes à ${territory}. L'état énergétique est stable à ${balance}%. ${availableMissions.length} mission(s) disponible(s). Prêt pour ta prochaine mission ?`} 
            />
          </div>
          
          <div className="glass-card p-6 rounded-3xl border border-slate-800 bg-slate-900/20">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase">Zones Énergétiques</h3>
            <div className="space-y-4">
              {[
                { zone: 'feu', label: 'FEU', icon: '🔥' },
                { zone: 'air', label: 'AIR', icon: '🌬' },
                { zone: 'terre', label: 'TERRE', icon: '🌍' },
                { zone: 'eau', label: 'EAU', icon: '💧' },
              ].map(({ zone, label, icon }) => (
                <div key={zone} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{icon} {label}</span>
                    <span className="text-cyan-400">{lumia[`${zone}_score`]}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${lumia[`${zone}_score`]}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Constellations Actives */}
          {userConstellations.length > 0 && (
            <div className="glass-card p-6 rounded-3xl border border-slate-800 bg-slate-900/20">
              <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase">🌌 Constellations Actives</h3>
              <div className="space-y-3">
                {userConstellations.map((constellation) => (
                  <motion.div
                    key={constellation.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => navigate(`/constellation/${constellation.id}`)}
                    className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer transition-colors"
                  >
                    <div className="text-purple-400 text-xs font-bold mb-1">ÉQUIPE</div>
                    <div className="font-semibold text-sm">{constellation.missions?.titre || 'Mission'}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      👥 {constellation.members?.length || 0} membres • Score: {constellation.score}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colonne Centrale : Radar LUMIA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/60 to-cyan-900/10 backdrop-blur-2xl min-h-[400px] flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold mb-8 text-cyan-100">Radar Énergétique Territorial</h2>
            <div className="w-full max-w-md">
              <LumiaRadar scores={{
                feu: lumia.feu_score,
                air: lumia.air_score,
                terre: lumia.terre_score,
                eau: lumia.eau_score,
              }} />
            </div>
          </div>

          {/* Missions Disponibles */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-cyan-100">🎯 Missions Prioritaires</h3>
            {availableMissions.length === 0 ? (
              <div className="p-6 rounded-2xl border border-slate-700 bg-slate-800/30 text-center text-slate-400">
                Aucune mission disponible pour le moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableMissions.slice(0, 4).map((mission) => {
                  const zoneColors = {
                    feu: 'orange-500',
                    air: 'blue-500',
                    terre: 'green-500',
                    eau: 'cyan-500',
                  };
                  const zoneEmojis = {
                    feu: '🔥',
                    air: '🌬',
                    terre: '🌍',
                    eau: '💧',
                  };
                  const color = zoneColors[mission.zone_dominante] || 'slate-500';
                  const emoji = zoneEmojis[mission.zone_dominante] || '📌';

                  return (
                    <motion.div 
                      key={mission.id}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => {
                        setSelectedMission(mission);
                        setShowMissionDetails(true);
                      }}
                      className={`p-4 rounded-2xl border border-${color}/20 bg-${color}/5 hover:bg-${color}/10 transition-colors cursor-pointer`}
                    >
                      <div className={`text-${color} text-xs font-bold mb-1`}>
                        MISSION {mission.zone_dominante.toUpperCase()}
                      </div>
                      <div className="font-semibold text-sm">{emoji} {mission.titre}</div>
                      <p className="text-xs text-slate-400 mt-2">{mission.description?.substring(0, 60)}...</p>
                      <div className="text-xs text-slate-500 mt-2">
                        ⏱️ {mission.duree_jours} jours • 📦 {mission.livrables?.length || 0} livrables
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Détails Mission */}
          {showMissionDetails && selectedMission && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowMissionDetails(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-2xl font-bold text-cyan-100 mb-4">{selectedMission.titre}</h2>
                <p className="text-slate-400 mb-6">{selectedMission.description}</p>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-2">Objectifs</h4>
                    <ul className="text-sm text-slate-300 space-y-1">
                      {selectedMission.objectifs?.map((obj, i) => (
                        <li key={i}>• {obj}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-2">Livrables</h4>
                    <ul className="text-sm text-slate-300 space-y-1">
                      {selectedMission.livrables?.map((liv, i) => (
                        <li key={i}>✓ {liv}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowMissionDetails(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => {
                      navigate(`/mission/${selectedMission.id}`);
                      setShowMissionDetails(false);
                    }}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors font-semibold"
                  >
                    Démarrer la Mission
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
