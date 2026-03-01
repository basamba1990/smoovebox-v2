/**
 * ModuleMimetique - VERSION FINALE
 * Tous les onglets opérationnels et fonctionnels
 * 5 onglets: Cockpit, Évaluation IA, Parcours, Écosystème, Analyse Visuelle
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import OdysseyLayout from '../components/OdysseyLayout.jsx';
import { Button } from '../components/ui/button.jsx';
import RobotIONaturel from '../components/RobotIO.jsx';
// Import des composants d'onglets
import CockpitSPOT from '../components/CockpitSPOT.jsx';
import AISkillsEvaluator from '../components/AISkillsEvaluator.jsx';
import DevelopmentPathways from '../components/DevelopmentPathways.jsx';
import TalentEcosystem from '../components/TalentEcosystem.jsx';

const STEP_3 = { id: 3, label: 'Le Module Mimétique', path: '/module-mimetique' };
const STEP_4 = { id: 4, label: 'Le Labo de Transformation', path: '/labo-transformation' };

// Composant Analyse Visuelle (remplace VideoRecorder)
const AnalyseVisuelle = ({ profile }) => {
  const [selectedElement, setSelectedElement] = useState(null);

  const elements = [
    {
      id: 'eau',
      label: 'EAU',
      icon: '💧',
      color: 'from-cyan-500 to-blue-500',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      description: 'Cohésion, Inclusion, Impact Social',
      traits: ['Empathie', 'Collaboration', 'Adaptabilité', 'Écoute'],
      score: profile?.skills?.eau || 75,
    },
    {
      id: 'air',
      label: 'AIR',
      icon: '💨',
      color: 'from-blue-500 to-purple-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      description: 'Innovation, Vision, Créativité',
      traits: ['Créativité', 'Vision', 'Communication', 'Agilité'],
      score: profile?.skills?.air || 80,
    },
    {
      id: 'feu',
      label: 'FEU',
      icon: '🔥',
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      description: 'Leadership, Action, Pitch',
      traits: ['Leadership', 'Passion', 'Action', 'Conviction'],
      score: profile?.skills?.feu || 85,
    },
    {
      id: 'terre',
      label: 'TERRE',
      icon: '🌍',
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      description: 'Structure, Organisation, Économie',
      traits: ['Rigueur', 'Organisation', 'Pragmatisme', 'Stabilité'],
      score: profile?.skills?.terre || 70,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Titre */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🎥</span>
        <div>
          <h2 className="text-2xl font-bold text-red-300">Analyse Visuelle</h2>
          <p className="text-slate-400 text-sm">
            Visualisez votre profil énergétique à travers les 4 Éléments
          </p>
        </div>
      </div>

      {/* Grille des éléments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {elements.map((element, index) => (
          <motion.div
            key={element.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => setSelectedElement(selectedElement === element.id ? null : element.id)}
            className={`cursor-pointer p-6 rounded-2xl border-2 transition-all duration-300 ${
              selectedElement === element.id
                ? `${element.bgColor} ${element.borderColor} shadow-lg`
                : `bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50`
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{element.icon}</span>
                <div>
                  <h3 className={`text-xl font-bold bg-gradient-to-r ${element.color} bg-clip-text text-transparent`}>
                    {element.label}
                  </h3>
                  <p className="text-xs text-slate-400">{element.description}</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: selectedElement === element.id ? 180 : 0 }}
                className="text-2xl"
              >
                ▼
              </motion.div>
            </div>

            {/* Score */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300 font-semibold">Score</span>
                <span className={`text-lg font-bold bg-gradient-to-r ${element.color} bg-clip-text text-transparent`}>
                  {element.score}%
                </span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${element.score}%` }}
                  transition={{ duration: 1, delay: index * 0.1 }}
                  className={`h-full bg-gradient-to-r ${element.color} rounded-full`}
                />
              </div>
            </div>

            {/* Traits (affichés si sélectionné) */}
            <AnimatePresence>
              {selectedElement === element.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-slate-600/30 space-y-2"
                >
                  <p className="text-xs text-slate-400 font-semibold">Traits caractéristiques:</p>
                  <div className="flex flex-wrap gap-2">
                    {element.traits.map((trait) => (
                      <motion.span
                        key={trait}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${element.color} text-white`}
                      >
                        {trait}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Radar visuel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-6 bg-slate-800/30 border border-slate-700/30 rounded-2xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Profil Énergétique Global</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {elements.map((element) => (
            <div key={element.id} className="text-center">
              <div className="text-3xl mb-2">{element.icon}</div>
              <p className="text-xs text-slate-400 mb-2">{element.label}</p>
              <div className="relative w-16 h-16 mx-auto">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgba(100, 116, 139, 0.3)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={40 * (element.score / 100)}
                    fill={`url(#grad-${element.id})`}
                    opacity="0.3"
                  />
                  <defs>
                    <linearGradient id={`grad-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#0EA5E9" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">{element.score}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Conseil */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl"
      >
        <p className="text-sm text-red-300 leading-relaxed">
          <span className="font-bold">💡 Conseil:</span> Cliquez sur chaque élément pour découvrir vos traits caractéristiques. Équilibrez vos 4 énergies pour un développement harmonieux.
        </p>
      </motion.div>
    </div>
  );
};

export default function ModuleMimetique({ user, profile, onSignOut }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cockpit');

  // Configuration des onglets
  const tabs = [
    {
      id: 'cockpit',
      label: 'Cockpit SPOT',
      icon: '🛰',
      color: 'from-cyan-500 to-blue-500',
      description: 'Tableau de bord énergétique',
    },
    {
      id: 'evaluation',
      label: 'Évaluation IA',
      icon: '🤖',
      color: 'from-purple-500 to-pink-500',
      description: 'Analyse des compétences',
    },
    {
      id: 'parcours',
      label: 'Parcours',
      icon: '🎯',
      color: 'from-orange-500 to-red-500',
      description: 'Suivi de progression',
    },
    {
      id: 'ecosysteme',
      label: 'Écosystème',
      icon: '🌐',
      color: 'from-green-500 to-emerald-500',
      description: 'Matching de talents',
    },
    {
      id: 'analyse',
      label: 'Analyse Visuelle',
      icon: '🎥',
      color: 'from-red-500 to-rose-500',
      description: 'Profil énergétique',
    },
  ];

  // Gestion du changement d'onglet
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  // Navigation
  const handleNavigatePrevious = useCallback(() => {
    navigate('/scan-elements');
  }, [navigate]);

  const handleNavigateNext = useCallback(() => {
    navigate(STEP_4.path);
  }, [navigate]);

  // Composant Tab Button avec animation
  const TabButton = ({ tab, isActive, index }) => (
    <motion.button
      onClick={() => handleTabChange(tab.id)}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      title={tab.description}
      className={`relative px-4 py-3 rounded-t-lg font-semibold transition-all duration-300 whitespace-nowrap flex items-center gap-2 text-sm sm:text-base group ${
        isActive
          ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      <span className="text-lg sm:text-xl">{tab.icon}</span>
      <span className="hidden sm:inline">{tab.label}</span>
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-400"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  );

  return (
    <OdysseyLayout
      currentStep={3}
      title=""
      maxWidthClass="max-w-7xl"
      onSignOut={onSignOut}
    >
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              Module Mimétique – Cockpit SPOT
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              Pilotez votre énergie, explorez votre potentiel à travers les 4 Éléments.
            </p>
          </div>
          <div className="hidden sm:flex items-center">
            <RobotIONaturel size="md" />
          </div>
        </div>
      </motion.div>

      {/* Tabs Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8 overflow-x-auto"
      >
        <div className="flex gap-2 border-b border-slate-700/50 pb-4 min-w-max sm:min-w-0">
          {tabs.map((tab, index) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              index={index}
            />
          ))}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="glass-card border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl bg-slate-900/60 backdrop-blur-xl"
        >
          {/* Cockpit SPOT */}
          {activeTab === 'cockpit' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <CockpitSPOT user={user} profile={profile} />
            </motion.div>
          )}

          {/* Évaluation IA */}
          {activeTab === 'evaluation' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🤖</span>
                <div>
                  <h2 className="text-2xl font-bold text-purple-300">Évaluation IA</h2>
                  <p className="text-slate-400 text-sm">
                    Analyse intelligente de vos compétences et potentiel
                  </p>
                </div>
              </div>
              <AISkillsEvaluator user={user} profile={profile} />
            </motion.div>
          )}

          {/* Parcours */}
          {activeTab === 'parcours' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🎯</span>
                <div>
                  <h2 className="text-2xl font-bold text-orange-300">Parcours</h2>
                  <p className="text-slate-400 text-sm">
                    Suivi de votre progression dans l'Odyssée
                  </p>
                </div>
              </div>
              <DevelopmentPathways user={user} profile={profile} />
            </motion.div>
          )}

          {/* Écosystème */}
          {activeTab === 'ecosysteme' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🌐</span>
                <div>
                  <h2 className="text-2xl font-bold text-green-300">Écosystème</h2>
                  <p className="text-slate-400 text-sm">
                    Visualisation de votre impact global
                  </p>
                </div>
              </div>
              <TalentEcosystem user={user} profile={profile} />
            </motion.div>
          )}

          {/* Analyse Visuelle */}
          {activeTab === 'analyse' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <AnalyseVisuelle profile={profile} />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex justify-between items-center gap-4"
      >
        <Button
          onClick={handleNavigatePrevious}
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          ← Précédent
        </Button>

        <div className="text-center">
          <p className="text-slate-400 text-sm font-semibold">
            Étape 3 / 7
          </p>
        </div>

        <Button
          onClick={handleNavigateNext}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold shadow-lg shadow-cyan-500/30"
        >
          Continuer →
        </Button>
      </motion.div>

      {/* Conseil */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl"
      >
        <p className="text-sm text-cyan-300 leading-relaxed">
          <span className="font-bold text-lg">💡 Conseil:</span> Explorez chaque onglet pour une expérience complète. Le Cockpit SPOT vous donne une vue d'ensemble énergétique, l'Évaluation IA analyse vos compétences, le Parcours suit votre progression, l'Écosystème visualise votre impact, et l'Analyse Visuelle affiche votre profil énergétique.
        </p>
      </motion.div>
    </OdysseyLayout>
  );
}
