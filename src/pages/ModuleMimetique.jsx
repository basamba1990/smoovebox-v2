/**
 * ModuleMimetique - VERSION FINALE
 * Hub centralisé avec 5 onglets et gestion robuste des erreurs
 * 
 * Onglets:
 * 1. Cockpit SPOT - Dashboard énergétique
 * 2. Évaluation IA - Analyse des compétences
 * 3. Parcours - Suivi de progression
 * 4. Écosystème - Matching de talents
 * 5. Enregistrement - Capture vidéo
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import OdysseyLayout from '../components/OdysseyLayout.jsx';
import { Button } from '../components/ui/button.jsx';
import CockpitSPOT from '../components/CockpitSPOT.jsx';
import RobotIO from '../components/RobotIO.jsx';

const STEP_4 = {
  id: 4,
  label: 'Le Labo de Transformation',
  path: '/labo-transformation',
};

export default function ModuleMimetique({
  user,
  profile,
  onSignOut,
  onVideoUploaded,
  cameraChecked,
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cockpit');
  const [showVault, setShowVault] = useState(false);
  const [videoUploadedRecently, setVideoUploadedRecently] = useState(false);
  const [tabErrors, setTabErrors] = useState({});

  // Configuration des onglets
  const tabs = [
    {
      id: 'cockpit',
      label: 'Cockpit SPOT',
      icon: '🛰',
      color: 'cyan',
      description: 'Tableau de bord énergétique',
    },
    {
      id: 'evaluation',
      label: 'Évaluation IA',
      icon: '🤖',
      color: 'purple',
      description: 'Analyse des compétences',
    },
    {
      id: 'parcours',
      label: 'Parcours',
      icon: '🎯',
      color: 'orange',
      description: 'Suivi de progression',
    },
    {
      id: 'ecosysteme',
      label: 'Écosystème',
      icon: '🌐',
      color: 'green',
      description: 'Matching de talents',
    },
    {
      id: 'enregistrement',
      label: 'Enregistrement',
      icon: '🎥',
      color: 'red',
      description: 'Capture vidéo',
    },
  ];

  // Gestion du succès de l'upload vidéo
  const handleVideoUploadSuccess = useCallback((videoData) => {
    setVideoUploadedRecently(true);
    if (onVideoUploaded) {
      onVideoUploaded(videoData);
    }
    setTimeout(() => setVideoUploadedRecently(false), 3000);
  }, [onVideoUploaded]);

  // Navigation
  const handleNavigatePrevious = useCallback(() => {
    navigate('/scan-elements');
  }, [navigate]);

  const handleNavigateNext = useCallback(() => {
    navigate(STEP_4.path);
  }, [navigate]);

  // Gestion des erreurs d'onglet
  const handleTabError = useCallback((tabId, error) => {
    setTabErrors((prev) => ({
      ...prev,
      [tabId]: error,
    }));
  }, []);

  // Composant fallback pour onglet en erreur
  const TabErrorFallback = ({ tabId, error }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 bg-red-500/10 border border-red-500/30 rounded-2xl text-center"
    >
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-xl font-bold text-red-400 mb-2">Erreur de chargement</h3>
      <p className="text-slate-400 mb-6">{error || 'Une erreur est survenue'}</p>
      <Button
        onClick={() => {
          setTabErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[tabId];
            return newErrors;
          });
        }}
        className="bg-red-600 hover:bg-red-500"
      >
        Réessayer
      </Button>
    </motion.div>
  );

  // Composant fallback pour onglet en chargement
  const TabLoadingFallback = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 text-center"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="inline-block h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full mb-4"
      />
      <p className="text-slate-400">Chargement...</p>
    </motion.div>
  );

  // Composant fallback pour onglet non implémenté
  const TabNotImplementedFallback = ({ tabLabel }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-center"
    >
      <div className="text-4xl mb-4">🚀</div>
      <h3 className="text-xl font-bold text-cyan-300 mb-2">Bientôt disponible</h3>
      <p className="text-slate-400 mb-6">
        L'onglet "{tabLabel}" est en cours de développement.
      </p>
      <p className="text-sm text-slate-500">
        Revenez bientôt pour découvrir cette nouvelle fonctionnalité !
      </p>
    </motion.div>
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              Module Mimétique – Cockpit SPOT
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              Pilotez votre énergie, enregistrez vos pitchs, explorez votre potentiel à travers les 4 Éléments.
            </p>
          </div>
          <div className="hidden sm:block">
            <RobotIO size="md" />
          </div>
        </div>
      </motion.div>

      {/* Tabs Navigation - Horizontal Scrollable */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8 overflow-x-auto"
      >
        <div className="flex gap-2 border-b border-cyan-900/30 pb-4 min-w-max sm:min-w-0">
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              title={tab.description}
              className={`px-4 py-3 rounded-t-lg font-semibold transition-all duration-300 whitespace-nowrap flex items-center gap-2 text-sm sm:text-base ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-b-2 border-cyan-400 shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50'
              }`}
            >
              <span className="text-lg sm:text-xl">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Tab Content Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="glass-card border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl bg-slate-900/60"
        >
          {/* Cockpit SPOT Tab */}
          {activeTab === 'cockpit' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              {tabErrors.cockpit ? (
                <TabErrorFallback tabId="cockpit" error={tabErrors.cockpit} />
              ) : (
                <CockpitSPOT onSignOut={onSignOut} />
              )}
            </motion.div>
          )}

          {/* AI Evaluation Tab */}
          {activeTab === 'evaluation' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-purple-300 flex items-center gap-2">
                  <span>🤖</span> Évaluation IA
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Analyse intelligente de vos compétences et potentiel
                </p>
              </div>
              <TabNotImplementedFallback tabLabel="Évaluation IA" />
            </motion.div>
          )}

          {/* Development Pathways Tab */}
          {activeTab === 'parcours' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-orange-300 flex items-center gap-2">
                  <span>🎯</span> Parcours
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Suivi de votre progression dans l'Odyssée
                </p>
              </div>
              <TabNotImplementedFallback tabLabel="Parcours" />
            </motion.div>
          )}

          {/* Talent Ecosystem Tab */}
          {activeTab === 'ecosysteme' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-green-300 flex items-center gap-2">
                  <span>🌐</span> Écosystème
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Visualisation de votre impact global
                </p>
              </div>
              <TabNotImplementedFallback tabLabel="Écosystème" />
            </motion.div>
          )}

          {/* Recording Tab */}
          {activeTab === 'enregistrement' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-red-300 flex items-center gap-2">
                  <span>🎥</span> Enregistrement
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Capturez vos meilleures versions et vos pitchs
                </p>
              </div>
              <TabNotImplementedFallback tabLabel="Enregistrement" />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex justify-between items-center"
      >
        <Button
          onClick={handleNavigatePrevious}
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          ← Précédent
        </Button>

        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Étape 3 / 7
          </p>
        </div>

        <Button
          onClick={handleNavigateNext}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold"
        >
          Continuer →
        </Button>
      </motion.div>

      {/* Conseil */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl"
      >
        <p className="text-sm text-cyan-300">
          💡 <span className="font-semibold">Conseil:</span> Explorez chaque onglet pour une expérience complète. Le Cockpit SPOT vous donne une vue d'ensemble énergétique, l'Évaluation IA analyse vos compétences, et l'Enregistrement vous permet de capturer vos meilleures versions.
        </p>
      </motion.div>
    </OdysseyLayout>
  );
}
