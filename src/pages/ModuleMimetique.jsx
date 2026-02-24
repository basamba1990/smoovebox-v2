// src/pages/ModuleMimetique.jsx
// Step 3 – Le module mimétique (vidéo / miroir de ton étoile)

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button.jsx";
import EnhancedRecordVideo from "./enhanced-record-video.jsx";
import { getOdysseyStepById } from "../config/odysseyConfig.js";
import VideoVault from "./video-vault.jsx";

const STEP_4 = getOdysseyStepById(4);
const STEP_4_PATH = STEP_4?.path ?? "/labo-transformation";

export default function ModuleMimetique({ user, profile, onSignOut, onVideoUploaded, cameraChecked }) {
  const navigate = useNavigate();
  const [showVault, setShowVault] = useState(false);

  return (
    <OdysseyLayout
      currentStep={3}
      title=""
      maxWidthClass="max-w-6xl"
      onSignOut={onSignOut}
    >
      <h1 className="text-2xl sm:text-3xl font-semibold text-white text-center mt-2">
        Le module mimétique
      </h1>
      <p className="text-white/90 text-center mt-3 mb-6 max-w-2xl mx-auto">
        Enregistrement vidéo et miroir de ton étoile.
      </p>

      <EnhancedRecordVideo
        user={user}
        profile={profile}
        onSignOut={onSignOut}
        onVideoUploaded={onVideoUploaded}
        cameraChecked={cameraChecked}
        embedInOdyssey
      />
      
      {/* Coffre-fort vidéo – même fond que Thème Actif / Conseils Lumi */}
      <div className="mt-8">
        <div className="glass-card border-white/10 rounded-3xl p-6 shadow-xl">
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
              className="w-full border border-teal-500/30 text-teal-400 bg-transparent hover:bg-teal-500/10 hover:text-teal-200 rounded-xl text-[10px] font-bold uppercase tracking-widest"
            >
              {showVault ? "Masquer le Coffre-fort" : "Ouvrir mon Coffre-fort vidéo"}
            </Button>
          </div>
        </div>
      </div>

      {showVault && (
        <div className="mt-6">
          <VideoVault
            user={user}
            profile={profile}
            onSignOut={onSignOut}
            onVideoAdded={onVideoUploaded}
            embedInOdyssey
          />
        </div>
      )}

      <div className="mt-8 flex justify-between items-center">
        <Button
          onClick={() => navigate("/scan-elements")}
          size="lg"
          className="bg-teal-600 hover:bg-teal-500 text-white px-8"
        >
          ← Précédent
        </Button>
        <Button
          onClick={() => navigate(STEP_4_PATH)}
          size="lg"
          className="bg-teal-600 hover:bg-teal-500 text-white px-8"
        >
          Continuer →
        </Button>
      </div>
    </OdysseyLayout>
  );
}
