// src/pages/ModuleMimetique.jsx
// Step 3 – Le module mimétique (placeholder for Odyssée de Lumi)

import React from "react";
import OdysseyLayout from "../components/OdysseyLayout.jsx";

export default function ModuleMimetique() {
  return (
    <OdysseyLayout
      currentStep={3}
      title="Le module mimétique"
      subtitle="Bientôt : enregistrement vidéo et miroir de ton étoile."
      maxWidthClass="max-w-4xl"
    >
      <div className="mt-8 rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg p-8 text-center">
        <p className="text-slate-700 text-lg">
          Cette étape sera dédiée au module mimétique (vidéo). Contenu à venir.
        </p>
      </div>
    </OdysseyLayout>
  );
}
