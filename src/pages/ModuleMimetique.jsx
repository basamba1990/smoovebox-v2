// src/pages/ModuleMimetique.jsx
// Step 3 – Le module mimétique (vidéo / miroir de ton étoile)

import React from "react";
import { useNavigate } from "react-router-dom";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button.jsx";
import EnhancedRecordVideo from "./enhanced-record-video.jsx";
import { getOdysseyStepById } from "../config/odysseyConfig.js";

const STEP_4 = getOdysseyStepById(4);
const STEP_4_PATH = STEP_4?.path ?? "/labo-transformation";

export default function ModuleMimetique({ user, profile, onSignOut, onVideoUploaded, cameraChecked }) {
  const navigate = useNavigate();

  return (
    <OdysseyLayout
      currentStep={3}
      title="Le module mimétique"
      maxWidthClass="max-w-6xl"
    >
      <p className="text-white/90 text-center my-6 max-w-2xl mx-auto">
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
