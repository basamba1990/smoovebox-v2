/**
 * Composant LumiaRadar - FIXED VERSION
 * Affiche le radar des 4 éléments avec styles CSS appropriés
 */

import React from 'react';
import '../styles/lumia-cockpit.css';

export default function LumiaRadar({ scores = { feu: 75, air: 75, terre: 75, eau: 75 } }) {
  const zones = [
    { id: 'feu', label: 'FEU', icon: '🔥', color: '#F97316', colorRgb: '249, 115, 22', desc: 'Leadership & Action' },
    { id: 'air', label: 'AIR', icon: '🌬', color: '#0EA5E9', colorRgb: '14, 165, 233', desc: 'Innovation & Vision' },
    { id: 'terre', label: 'TERRE', icon: '🌍', color: '#22C55E', colorRgb: '34, 197, 94', desc: 'Structure & Organisation' },
    { id: 'eau', label: 'EAU', icon: '💧', color: '#06B6D4', colorRgb: '6, 182, 212', desc: 'Cohésion & Impact social' },
  ];

  const balance = Math.round((scores.feu + scores.air + scores.terre + scores.eau) / 4);

  return (
    <div className="lumia-radar">
      <div className="radar-center">
        <div className="balance-score">
          <span className="balance-value">{balance}%</span>
          <span className="balance-label">ÉQUILIBRE</span>
        </div>
      </div>
      <div className="radar-zones">
        {zones.map((zone) => (
          <div 
            key={zone.id} 
            className="zone" 
            style={{ 
              '--zone-color': zone.color,
              '--zone-color-rgb': zone.colorRgb
            }}
          >
            <div className="zone-icon">{zone.icon}</div>
            <div className="zone-label">{zone.label}</div>
            <div className="zone-score">{scores[zone.id]}%</div>
            <div className="zone-desc">{zone.desc}</div>
            <div className="zone-bar">
              <div 
                className="zone-fill" 
                style={{ 
                  width: `${scores[zone.id]}%`, 
                  backgroundColor: zone.color 
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
