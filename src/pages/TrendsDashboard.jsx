import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Home } from 'lucide-react';

const data = [
  { name: 'AI Specialist', demand2030: 400, demand2040: 800 },
  { name: 'Green Engineer', demand2030: 300, demand2040: 600 },
  { name: 'Cyber Architect', demand2030: 200, demand2040: 500 },
  { name: 'Smart Urbanist', demand2030: 150, demand2040: 450 },
  { name: 'Bio-Engineer', demand2030: 100, demand2040: 400 },
];

const TrendsDashboard = () => {
  return (
    <div className="p-8 bg-slate-900 text-white min-h-screen">
      {/* Bouton Retour Accueil */}
      <div className="mb-6">
        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-gray-300 transition-colors"
        >
          <Home className="h-4 w-4" />
          Retour à l'accueil
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-8">Dashboard des Tendances Métiers (2030-2040)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Croissance de la Demande par Métier</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                <Legend />
                <Bar dataKey="demand2030" name="Demande 2030" fill="#3b82f6" />
                <Bar dataKey="demand2040" name="Demande 2040" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Évolution Technologique</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                <Legend />
                <Line type="monotone" dataKey="demand2040" name="Indice d'Innovation" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h2 className="text-xl font-semibold mb-4">Sources de Données</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="pb-3 font-medium text-slate-400">Source</th>
                <th className="pb-3 font-medium text-slate-400">Rapport</th>
                <th className="pb-3 font-medium text-slate-400">Fiabilité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              <tr>
                <td className="py-3">World Economic Forum</td>
                <td className="py-3">Future of Jobs Report 2025</td>
                <td className="py-3 text-green-400">Élevée</td>
              </tr>
              <tr>
                <td className="py-3">McKinsey & Company</td>
                <td className="py-3">The Future of Work in Europe</td>
                <td className="py-3 text-green-400">Élevée</td>
              </tr>
              <tr>
                <td className="py-3">OECD</td>
                <td className="py-3">Employment Outlook 2024</td>
                <td className="py-3 text-blue-400">Moyenne</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrendsDashboard;
