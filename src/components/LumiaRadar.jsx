import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { ENERGIES } from '../config/catalogue-interne.config';

/**
 * Affiche un radar chart pour les 4 énergies.
 * @param {Object} props
 * @param {Object} props.scores - { feu: number, air: number, terre: number, eau: number }
 */
export default function LumiaRadar({ scores = { feu: 50, air: 50, terre: 50, eau: 50 } }) {
  // Préparer les données pour Recharts
  const data = [
    { name: ENERGIES.feu.label, value: scores.feu, fill: ENERGIES.feu.color },
    { name: ENERGIES.air.label, value: scores.air, fill: ENERGIES.air.color },
    { name: ENERGIES.terre.label, value: scores.terre, fill: ENERGIES.terre.color },
    { name: ENERGIES.eau.label, value: scores.eau, fill: ENERGIES.eau.color },
  ];

  return (
    <div className="lumia-radar">
      <h3>Radar de Compétences</h3>
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
          <PolarAngleAxis dataKey="name" stroke="#94a3b8" />
          <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#64748b" />
          <Radar
            name="Scores"
            dataKey="value"
            stroke="#06b6d4"
            fill="#06b6d4"
            fillOpacity={0.6}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #06b6d4',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value) => `${value}/100`}
          />
          <Legend wrapperStyle={{ color: '#fff' }} />
        </RadarChart>
      </ResponsiveContainer>

      <style jsx>{`
        .lumia-radar {
          padding: 1.5rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 12px;
          color: #fff;
        }

        .lumia-radar h3 {
          margin: 0 0 1rem 0;
          color: #06b6d4;
          font-size: 1.25rem;
        }
      `}</style>
    </div>
  );
}
