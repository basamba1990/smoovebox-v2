// src/pages/ModuleMimetique.jsx
// Module Mimétique - Hub centralisé avec onglets (Cockpit SPOT, Évaluation IA, Parcours, Écosystème, Enregistrement)
// Version refactorisée avec design glass-morphism et intégration complète

import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useLumia } from "../hooks/useLumia";
import { useCatalogueInterne } from "../hooks/useCatalogueInterne";
import { useSpotBulleSkills } from "../hooks/useSpotBulleSkills";

// Import des composants pour chaque onglet
import CockpitSPOT from "../components/CockpitSPOT";
import AISkillsEvaluator from "../components/AISkillsEvaluator";
import DevelopmentPathways from "../components/DevelopmentPathways";
import TalentEcosystem from "../components/TalentEcosystem";
import EnhancedRecordVideo from "./enhanced-record-video.jsx";
import VideoVault from "./video-vault.jsx";
import { Button } from "../components/ui/button.jsx";
import { getOdysseyStepById } from "../config/odysseyConfig.js";

const STEP_4 = getOdysseyStepById(4);
const STEP_4_PATH = STEP_4?.path ?? "/labo-transformation";

export default function ModuleMimetique({
  user,
  profile,
  onSignOut,
  onVideoUploaded,
  cameraChecked,
}) {
  const navigate = useNavigate();
  const { userProfile } = useLumia();
  const { getProgress } = useCatalogueInterne();
  const { evaluations, loading: skillsLoading } = useSpotBulleSkills(user?.id);

  const [activeTab, setActiveTab] = useState("cockpit");
  const [showVault, setShowVault] = useState(false);
  const [videoUploadedRecently, setVideoUploadedRecently] = useState(false);

  // Configuration des onglets
  const tabs = [
    {
      id: "cockpit",
      label: "Cockpit SPOT",
      icon: "🛰",
      description: "Tableau de bord énergétique",
    },
    {
      id: "evaluation",
      label: "Évaluation IA",
      icon: "🤖",
      description: "Analyse des compétences",
    },
    {
      id: "parcours",
      label: "Parcours",
      icon: "🎯",
      description: "Missions prioritaires",
    },
    {
      id: "ecosysteme",
      label: "Écosystème",
      icon: "🌐",
      description: "LUMIA Territoriale",
    },
    {
      id: "enregistrement",
      label: "Enregistrement",
      icon: "🎥",
      description: "Capture vidéo",
    },
  ];

  const handleVideoUploadSuccess = useCallback(
    (videoData) => {
      setVideoUploadedRecently(true);
      if (onVideoUploaded) {
        onVideoUploaded(videoData);
      }
      setTimeout(() => setVideoUploadedRecently(false), 3000);
    },
    [onVideoUploaded]
  );

  const handleNavigatePrevious = useCallback(() => {
    navigate("/scan-elements");
  }, [navigate]);

  const handleNavigateNext = useCallback(() => {
    navigate(STEP_4_PATH);
  }, [navigate, STEP_4_PATH]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <main className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Module Mimétique – Cockpit SPOT
              </h1>
              <p className="text-slate-400 mt-2 text-sm sm:text-base">
                Pilotez votre énergie, enregistrez vos pitchs, explorez votre potentiel.
              </p>
            </div>
            <div className="inline-block px-4 py-2 bg-teal-500/10 border border-teal-500/30 rounded-full">
              <p className="text-teal-300 text-xs font-semibold uppercase tracking-widest">
                📹 Étape 3 sur 7
              </p>
            </div>
          </div>
        </motion.header>

        {/* Tabs Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex flex-wrap gap-2 border-b border-cyan-900/30 pb-4 overflow-x-auto">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-4 py-2 rounded-t-lg font-medium transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-b-2 border-cyan-400 shadow-lg shadow-cyan-500/20"
                    : "text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50"
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
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
            className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 border border-cyan-500/20 shadow-2xl"
          >
            {/* Cockpit SPOT Tab */}
            {activeTab === "cockpit" && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-cyan-300 flex items-center gap-2">
                    <span>🛰</span> Cockpit SPOT
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Vue d'ensemble immédiate de votre énergie territoriale
                  </p>
                </div>
                <CockpitSPOT onSignOut={onSignOut} />
              </div>
            )}

            {/* AI Evaluation Tab */}
            {activeTab === "evaluation" && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-purple-300 flex items-center gap-2">
                    <span>🤖</span> Évaluation IA
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Retour direct sur vos pitchs enregistrés
                  </p>
                </div>
                <AISkillsEvaluator userId={user?.id} />
              </div>
            )}

            {/* Development Pathways Tab */}
            {activeTab === "parcours" && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-orange-300 flex items-center gap-2">
                    <span>🎯</span> Parcours
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Suivi de votre progression dans l'Odyssée
                  </p>
                </div>
                <DevelopmentPathways userId={user?.id} />
              </div>
            )}

            {/* Talent Ecosystem Tab */}
            {activeTab === "ecosysteme" && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-green-300 flex items-center gap-2">
                    <span>🌐</span> Écosystème
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Visualisation de votre impact global
                  </p>
                </div>
                <TalentEcosystem userId={user?.id} />
              </div>
            )}

            {/* Recording Tab */}
            {activeTab === "enregistrement" && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-red-300 flex items-center gap-2">
                    <span>🎥</span> Enregistrement
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Capturez vos meilleures versions
                  </p>
                </div>

                {/* Video Recording Section */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <EnhancedRecordVideo
                    user={user}
                    profile={profile}
                    onSignOut={onSignOut}
                    onVideoUploaded={handleVideoUploadSuccess}
                    cameraChecked={cameraChecked}
                    embedInOdyssey
                  />
                </div>

                {/* Success Message */}
                {videoUploadedRecently && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-green-500/10 border border-green-500/30 rounded-2xl"
                  >
                    <p className="text-green-300 text-sm font-semibold text-center">
                      ✅ Vidéo enregistrée avec succès !
                    </p>
                  </motion.div>
                )}

                {/* Video Vault Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="mt-6"
                >
                  <div className="bg-slate-800/30 border border-teal-500/20 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      📁 Mon Coffre-fort Vidéo
                    </h3>
                    <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl">
                      <p className="text-teal-100/80 text-sm leading-relaxed mb-4 italic">
                        Retrouvez et rejouez toutes vos vidéos enregistrées dans votre coffre-fort personnel.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowVault((prev) => !prev)}
                        className="w-full border border-teal-500/30 text-teal-400 bg-transparent hover:bg-teal-500/10 hover:text-teal-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300"
                      >
                        {showVault
                          ? "📂 Masquer le Coffre-fort"
                          : "🔓 Ouvrir mon Coffre-fort vidéo"}
                      </Button>
                    </div>
                  </div>
                </motion.div>

                {/* Video Vault Content */}
                {showVault && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mt-6"
                  >
                    <VideoVault
                      user={user}
                      profile={profile}
                      onSignOut={onSignOut}
                      onVideoAdded={handleVideoUploadSuccess}
                      embedInOdyssey
                    />
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex justify-between items-center gap-4"
        >
          <Button
            onClick={handleNavigatePrevious}
            size="lg"
            className="bg-teal-600 hover:bg-teal-500 text-white px-8 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/50"
          >
            ← Précédent
          </Button>

          <div className="flex-1 flex justify-center">
            <div className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg">
              <p className="text-slate-300 text-xs font-semibold">Étape 3 / 7</p>
            </div>
          </div>

          <Button
            onClick={handleNavigateNext}
            size="lg"
            className="bg-teal-600 hover:bg-teal-500 text-white px-8 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/50"
          >
            Continuer →
          </Button>
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl"
        >
          <p className="text-blue-200/80 text-xs leading-relaxed">
            💡 <span className="font-semibold">Conseil :</span> Explorez chaque
            onglet pour une expérience complète. Le Cockpit SPOT vous donne une
            vue d'ensemble, l'Évaluation IA analyse vos compétences, et
            l'Enregistrement vous permet de capturer vos meilleures versions.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
