import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLumia } from '../hooks/useLumia';
import { useCatalogueInterne } from '../hooks/useCatalogueInterne';
import { useSpotBulleSkills } from '../hooks/useSpotBulleSkills';
import CockpitSPOT from '../components/CockpitSPOT';
import ModuleMimetique from './ModuleMimetique';
import AISkillsEvaluator from '../components/AISkillsEvaluator';
import DevelopmentPathways from '../components/DevelopmentPathways';
import TalentEcosystem from '../components/TalentEcosystem';
import { motion, AnimatePresence } from 'framer-motion';

export default function ModuleMimetiqueComplet({
  user,
  profile,
  onSignOut,
  onVideoUploaded,
  cameraChecked,
}) {
  const { userProfile } = useLumia();
  const { getProgress } = useCatalogueInterne();
  const { evaluations, loading: skillsLoading } = useSpotBulleSkills(user?.id);

  const [activeTab, setActiveTab] = useState('cockpit');

  const tabs = [
    { id: 'cockpit', label: 'Cockpit SPOT', icon: '🛰' },
    { id: 'evaluation', label: 'Évaluation IA', icon: '🤖' },
    { id: 'parcours', label: 'Parcours', icon: '🎯' },
    { id: 'ecosysteme', label: 'Écosystème', icon: '🌐' },
    { id: 'enregistrement', label: 'Enregistrement', icon: '🎥' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <main className="container mx-auto px-4 py-8">
        {/* Header sans menu latéral (déjà présent dans le layout global) */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Module Mimétique – Cockpit SPOT
          </h1>
          <p className="text-slate-400 mt-2">
            Pilotez votre énergie, enregistrez vos pitchs, explorez votre potentiel.
          </p>
        </header>

        {/* Barre d'onglets */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-cyan-900/30 pb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu des onglets */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20"
          >
            {activeTab === 'cockpit' && (
              <CockpitSPOT onSignOut={onSignOut} />
            )}
            {activeTab === 'evaluation' && (
              <AISkillsEvaluator userId={user?.id} />
            )}
            {activeTab === 'parcours' && (
              <DevelopmentPathways userId={user?.id} />
            )}
            {activeTab === 'ecosysteme' && (
              <TalentEcosystem userId={user?.id} />
            )}
            {activeTab === 'enregistrement' && (
              <ModuleMimetique
                user={user}
                profile={profile}
                onSignOut={onSignOut}
                onVideoUploaded={onVideoUploaded}
                cameraChecked={cameraChecked}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
