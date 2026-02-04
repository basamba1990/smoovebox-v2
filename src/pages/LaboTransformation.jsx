// src/pages/LaboTransformation.jsx
// Step 4 – Le labo de transformation (placeholder for Odyssée de Lumi)

import React from "react";
import { useNavigate } from "react-router-dom";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button.jsx";
import { getOdysseyStepById } from "../config/odysseyConfig.js";

const STEP_3 = getOdysseyStepById(3);
const STEP_3_PATH = STEP_3?.path ?? "/module-mimetique";

export default function LaboTransformation() {
  const navigate = useNavigate();

  return (
    <OdysseyLayout
      currentStep={4}
      title="Le labo de transformation"
      subtitle="Contenu à venir."
      maxWidthClass="max-w-4xl"
    >
      <div className="mt-8 rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg p-8 text-center">
        <p className="text-slate-700 text-lg">
          Cette étape sera dédiée au labo de transformation. Contenu à venir.
        </p>
      </div>
      <div className="mt-8 flex justify-between items-center">
        <Button
          onClick={() => navigate(STEP_3_PATH)}
          size="lg"
          className="bg-teal-600 hover:bg-teal-500 text-white px-8"
        >
          ← Précédent
        </Button>
      </div>
    </OdysseyLayout>
  );
}
