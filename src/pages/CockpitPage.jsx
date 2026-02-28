import React from 'react';
import OdysseyLayout from '../components/OdysseyLayout.jsx';
import CockpitSPOT from '../components/CockpitSPOT.jsx';

export default function CockpitPage({ onSignOut }) {
  return (
    <OdysseyLayout
      currentStep={3}
      title=""
      maxWidthClass="max-w-full"
      onSignOut={onSignOut}
    >
      <CockpitSPOT />
    </OdysseyLayout>
  );
}
