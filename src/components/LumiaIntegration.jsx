import React from 'react';
import { useLumia } from '../hooks/useLumia.js';
import { ENERGIES } from '../config/catalogue-interne.config.js';

export default function LumiaIntegration() {
  const { userProfile, territories, zones, calculateBalance } = useLumia();

  if (!userProfile?.lumia_id || !userProfile?.dominant_zone) {
    return null;
  }

  const territory = territories.find(t => t.id === userProfile.lumia_id);
  const zone = zones.find(z => z.id === userProfile.dominant_zone);
  const balance = calculateBalance();

  const zoneColor = ENERGIES[userProfile.dominant_zone]?.color || '#06b6d4';

  return (
    <div className="lumia-status-bar flex items-center gap-4 p-2 bg-slate-900/80 backdrop-blur rounded-lg border border-cyan-500/20 text-sm">
      {territory && (
        <div className="flex items-center gap-1">
          <span className="text-xl">🌍</span>
          <span className="font-medium text-cyan-300">{territory.territoire}</span>
        </div>
      )}
      <div className="w-px h-4 bg-slate-700" />
      {zone && (
        <div className="flex items-center gap-1">
          <span>{zone.icon}</span>
          <span style={{ color: zoneColor }} className="font-semibold">
            {zone.label}
          </span>
        </div>
      )}
      <div className="w-px h-4 bg-slate-700" />
      <div className="flex items-center gap-1">
        <span>⚖️</span>
        <span className="text-cyan-400">{balance}%</span>
      </div>
    </div>
  );
}
