// src/pages/ModuleMimetique.jsx
// Step 3 – Le module mimétique (vidéo / miroir de ton étoile)

import React from "react";
import { useNavigate } from "react-router-dom";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button-enhanced.jsx";
import EnhancedRecordVideo from "./enhanced-record-video.jsx";
import { getOdysseyStepById } from "../config/odysseyConfig.js";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STEP_4 = getOdysseyStepById(4);
const STEP_4_PATH = STEP_4?.path ?? "/labo-transformation";

export default function ModuleMimetique({ user, profile, onSignOut, onVideoUploaded, cameraChecked }) {
  const navigate = useNavigate();

  return (
    <OdysseyLayout
      currentStep={3}
      title="Le module mimétique"
      subtitle="Enregistrez votre message pour activer le miroir de votre étoile"
      maxWidthClass="max-w-6xl"
    >
      <div className="space-y-10">
        <EnhancedRecordVideo
          user={user}
          profile={profile}
          onSignOut={onSignOut}
          onVideoUploaded={onVideoUploaded}
          cameraChecked={cameraChecked}
          embedInOdyssey
        />

        <div className="flex justify-between items-center pt-6 border-t border-white/10">
          <Button
            onClick={() => navigate("/scan-elements")}
            variant="outline"
            className="h-14 px-8 bg-white/5 hover:bg-white/10 text-white border-white/10 rounded-2xl flex items-center gap-2 transition-all active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Précédent</span>
          </Button>
          
          <Button
            onClick={() => navigate(STEP_4_PATH)}
            className="h-14 px-10 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl flex items-center gap-2 shadow-xl shadow-teal-900/20 transition-all active:scale-95 font-bold"
          >
            <span>Continuer l'Odyssée</span>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </OdysseyLayout>
  );
}
