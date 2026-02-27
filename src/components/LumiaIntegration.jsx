import React from 'react';
import { useLumia } from '../hooks/useLumia.js';

export default function LumiaIntegration() {
  const { userProfile, territories, zones, calculateBalance } = useLumia();

  if (!userProfile.territory || !userProfile.dominantZone) {
    return null;
  }

  const territory = territories.find(t => t.id === userProfile.territory);
  const zone = zones.find(z => z.id === userProfile.dominantZone);
  const balance = calculateBalance();

  return (
    <div className="lumia-status-bar">
      <div className="lumia-territory">
        <span>{territory.icon} {territory.name}</span>
      </div>
      <div className="lumia-zone">
        <span>{zone.icon} {zone.label}</span>
      </div>
      <div className="lumia-balance">
        <span>Équilibre: {balance}%</span>
      </div>
    </div>
  );
}
