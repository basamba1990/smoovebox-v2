import React from 'react';

/**
 * UNIFIED SPOTBULLE RADAR
 * Displays 4-element radar (FEU/AIR/TERRE/EAU)
 */

export default function SpotBulleRadar({ scores = { feu: 50, air: 50, terre: 50, eau: 50 } }) {
  const zones = [
    { id: 'feu', label: 'FEU', icon: 'ðŸ”¥', color: '#F97316', desc: 'Leadership & Action' },
    { id: 'air', label: 'AIR', icon: 'ðŸŒ¬', color: '#0EA5E9', desc: 'Innovation & Vision' },
    { id: 'terre', label: 'TERRE', icon: 'ðŸŒ', color: '#22C55E', desc: 'Structure & Organisation' },
    { id: 'eau', label: 'EAU', icon: 'ðŸ’§', color: '#06B6D4', desc: 'CohÃ©sion & Impact social' },
  ];

  const balance = Math.round((scores.feu + scores.air + scores.terre + scores.eau) / 4);

  return (
    <div className="spotbulle-radar">
      <div className="radar-center">
        <div className="balance-score">
          <span className="balance-value">{balance}%</span>
          <span className="balance-label">Ã‰QUILIBRE</span>
        </div>
      </div>
      <div className="radar-zones">
        {zones.map((zone) => (
          <div key={zone.id} className="zone" style={{ '--zone-color': zone.color }}>
            <div className="zone-icon">{zone.icon}</div>
            <div className="zone-label">{zone.label}</div>
            <div className="zone-score">{scores[zone.id]}%</div>
            <div className="zone-desc">{zone.desc}</div>
            <div className="zone-bar">
              <div className="zone-fill" style={{ width: `${scores[zone.id]}%`, backgroundColor: zone.color }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
