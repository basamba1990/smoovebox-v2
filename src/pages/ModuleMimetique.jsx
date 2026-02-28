// src/pages/ModuleMimetique.jsx
// Step 3 – Le module mimétique (vidéo / miroir de ton étoile)
// Version mise à jour complète avec corrections et améliorations

import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button.jsx";
import EnhancedRecordVideo from "./enhanced-record-video.jsx";
import { getOdysseyStepById } from "../config/odysseyConfig.js";
import VideoVault from "./video-vault.jsx";
import { motion } from "framer-motion";

const STEP_4 = getOdysseyStepById(4);
const STEP_4_PATH = STEP_4?.path ?? "/labo-transformation";

export default function ModuleMimetique({ 
  user, 
  profile, 
  onSignOut, 
  onVideoUploaded, 
  cameraChecked 
}) {
  const navigate = useNavigate();
  const [showVault, setShowVault] = useState(false);
  const [videoUploadedRecently, setVideoUploadedRecently] = useState(false);

  const handleVideoUploadSuccess = useCallback((videoData) => {
    setVideoUploadedRecently(true);
    if (onVideoUploaded) {
      onVideoUploaded(videoData);
    }
    // Reset after 3 seconds
    setTimeout(() => setVideoUploadedRecently(false), 3000);
  }, [onVideoUploaded]);

  const handleNavigatePrevious = useCallback(() => {
    navigate("/scan-elements");
  }, [navigate]);

  const handleNavigateNext = useCallback(() => {
    navigate(STEP_4_PATH);
  }, [navigate, STEP_4_PATH]);

  return (
    <OdysseyLayout
      currentStep={3}
      title=""
      maxWidthClass="max-w-6xl"
      onSignOut={onSignOut}
    >
      {/* Header Section */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-between items-center mb-8 border-b border-teal-900/30 pb-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tighter bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
            Le Module Mimétique
          </h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest">
            Enregistrement vidéo et miroir de ton étoile.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="inline-block px-4 py-2 bg-teal-500/10 border border-teal-500/30 rounded-full">
            <p className="text-teal-300 text-xs font-semibold uppercase tracking-widest">
              📹 Étape 3 sur 7 - Miroir de l'Étoile
            </p>
          </div>
        </div>
      </motion.header>

      {/* Video Recording Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
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
      {videoUploadedRecently && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl"
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
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-8"
      >
          <div className="glass-card p-6 rounded-3xl border border-teal-500/20 bg-slate-900/40 backdrop-blur-xl">
          <h3 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
            📁 Mon Coffre-fort Vidéo
          </h3>
          <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl">
            <p className="text-teal-100/80 text-sm leading-relaxed mb-4 italic">
              Retrouve et rejoue toutes tes vidéos enregistrées dans ton coffre-fort personnel.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowVault((prev) => !prev)}
              className="w-full border border-teal-500/30 text-teal-400 bg-transparent hover:bg-teal-500/10 hover:text-teal-200 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300"
            >
              {showVault ? "📂 Masquer le Coffre-fort" : "🔓 Ouvrir mon Coffre-fort vidéo"}
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
            <p className="text-slate-300 text-xs font-semibold">
              Étape 3 / 7
            </p>
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
        className="mt-8 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5"
      >
        <p className="text-blue-200/80 text-xs leading-relaxed">
          💡 <span className="font-semibold">Conseil :</span> Enregistre plusieurs versions de toi-même pour trouver celle qui te représente le mieux. Chaque vidéo est une opportunité de te découvrir et de progresser.
        </p>
      </motion.div>
    </OdysseyLayout>
  );
}
