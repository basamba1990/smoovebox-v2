// src/pages/ModuleMimetique.jsx
// Module Mimétique - Hub centralisé avec onglets
// Avec RobotIO Joueur Numéro 10 (design exact)

import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button.jsx";

// Import des composants pour chaque onglet
import CockpitSPOT from "../components/CockpitSPOT.jsx";
import AISkillsEvaluator from "../components/AISkillsEvaluator.jsx";
import DevelopmentPathways from "../components/DevelopmentPathways.jsx";
import TalentEcosystem from "../components/TalentEcosystem.jsx";
import EnhancedRecordVideo from "./enhanced-record-video.jsx";
import VideoVault from "./video-vault.jsx";
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
  const [activeTab, setActiveTab] = useState("cockpit");
  const [showVault, setShowVault] = useState(false);
  const [videoUploadedRecently, setVideoUploadedRecently] = useState(false);

  // Configuration des onglets
  const tabs = [
    {
      id: "cockpit",
      label: "Cockpit SPOT",
      icon: "🛰",
      color: "cyan",
    },
    {
      id: "evaluation",
      label: "Évaluation IA",
      icon: "🤖",
      color: "purple",
    },
    {
      id: "parcours",
      label: "Parcours",
      icon: "🎯",
      color: "orange",
    },
    {
      id: "ecosysteme",
      label: "Écosystème",
      icon: "🌐",
      color: "green",
    },
    {
      id: "enregistrement",
      label: "Enregistrement",
      icon: "🎥",
      color: "red",
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

  // Sécurité : Si l'utilisateur n'est pas chargé, on peut afficher un état de chargement
  // ou laisser OdysseyLayout gérer la redirection via RequireAuth (déjà fait dans AppRoutes)

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
        <h1 className="text-3xl sm:text-4xl font-bold text-white text-center">
          Module Mimétique – Cockpit SPOT
        </h1>
        <p className="text-slate-400 text-center mt-3 text-sm sm:text-base max-w-2xl mx-auto">
          Pilotez votre énergie, enregistrez vos pitchs, explorez votre potentiel à travers les 4 Éléments.
        </p>
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
              className={`px-4 py-3 rounded-t-lg font-semibold transition-all duration-300 whitespace-nowrap flex items-center gap-2 text-sm sm:text-base ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-b-2 border-cyan-400 shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50"
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
          {activeTab === "cockpit" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <CockpitSPOT onSignOut={onSignOut} />
            </motion.div>
          )}

          {/* AI Evaluation Tab */}
          {activeTab === "evaluation" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              {user?.id ? (
                <AISkillsEvaluator userId={user.id} />
              ) : (
                <div className="text-center py-10 text-slate-400 italic">
                  Veuillez vous connecter pour accéder à l'évaluation.
                </div>
              )}
            </motion.div>
          )}

          {/* Development Pathways Tab */}
          {activeTab === "parcours" && (
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
              {user?.id ? (
                <DevelopmentPathways userId={user.id} />
              ) : (
                <div className="text-center py-10 text-slate-400 italic">
                  Veuillez vous connecter pour accéder à vos parcours.
                </div>
              )}
            </motion.div>
          )}

          {/* Talent Ecosystem Tab */}
          {activeTab === "ecosysteme" && (
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
              {user?.id ? (
                <TalentEcosystem userId={user.id} />
              ) : (
                <div className="text-center py-10 text-slate-400 italic">
                  Veuillez vous connecter pour accéder à l'écosystème.
                </div>
              )}
            </motion.div>
          )}

          {/* Recording Tab */}
          {activeTab === "enregistrement" && (
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

              {/* Video Recording Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50"
              >
                <EnhancedRecordVideo
                  user={user}
                  profile={profile}
                  onSignOut={onSignOut}
                  onVideoUploaded={handleVideoUploadSuccess}
                  cameraChecked={cameraChecked}
                  embedInOdyssey
                />
              </motion.div>

              {/* Success Message */}
              <AnimatePresence>
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
              </AnimatePresence>

              {/* Video Vault Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card border-white/10 rounded-2xl p-6 bg-slate-900/40"
              >
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  📁 Mon Coffre-fort Vidéo
                </h3>
                <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl">
                  <p className="text-teal-100/80 text-sm leading-relaxed mb-4 italic">
                    Retrouvez et rejouez toutes vos vidéos enregistrées dans votre coffre-fort personnel.
                  </p>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
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
                  </motion.div>
                </div>
              </motion.div>

              {/* Video Vault Content */}
              <AnimatePresence>
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
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-10 flex justify-between items-center gap-4 flex-wrap"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={handleNavigatePrevious}
            size="lg"
            className="bg-teal-600 hover:bg-teal-500 text-white px-8 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/50"
          >
            ← Précédent
          </Button>
        </motion.div>

        <div className="flex-1 flex justify-center">
          <div className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg">
            <p className="text-slate-300 text-xs font-semibold">Étape 3 / 7</p>
          </div>
        </div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={handleNavigateNext}
            size="lg"
            className="bg-teal-600 hover:bg-teal-500 text-white px-8 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/50"
          >
            Continuer →
          </Button>
        </motion.div>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="mt-8 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl"
      >
        <p className="text-blue-200/80 text-xs leading-relaxed">
          💡 <span className="font-semibold">Conseil :</span> Explorez chaque onglet pour une expérience complète. Le Cockpit SPOT vous donne une vue d'ensemble énergétique, l'Évaluation IA analyse vos compétences, et l'Enregistrement vous permet de capturer vos meilleures versions.
        </p>
      </motion.div>
    </OdysseyLayout>
  );
}
