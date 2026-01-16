import React from 'react';

/**
 * Composant pour sélectionner le type de contenu GENUP avant l'enregistrement
 * Types supportés : pitch, reflexive, action_trace, ai_synthesis, human_validation
 */
export default function VideoTypeSelector({ selectedType, onTypeChange }) {
  const videoTypes = [
    {
      id: 'pitch',
      label: 'Pitch',
      description: 'Présentez-vous et vos ambitions',
      icon: '🎤',
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'reflexive',
      label: 'Réflexion',
      description: 'Partagez vos apprentissages et insights',
      icon: '💭',
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 'action_trace',
      label: 'Trace d\'action',
      description: 'Documentez une action ou un projet',
      icon: '🎯',
      color: 'from-green-500 to-green-600',
    },
    {
      id: 'ai_synthesis',
      label: 'Synthèse IA',
      description: 'Résumé intelligent de votre parcours',
      icon: '🤖',
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      id: 'human_validation',
      label: 'Validation',
      description: 'Feedback et validation par un mentor',
      icon: '✓',
      color: 'from-emerald-500 to-emerald-600',
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          Quel type de contenu souhaitez-vous enregistrer ?
        </h2>
        <p className="text-gray-400">
          Chaque type contribue à votre journal de transformation personnel
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {videoTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => onTypeChange(type.id)}
            className={`p-4 rounded-lg transition-all duration-200 flex flex-col items-center text-center ${
              selectedType === type.id
                ? `bg-gradient-to-br ${type.color} ring-2 ring-white shadow-lg scale-105`
                : 'bg-slate-700 hover:bg-slate-600 ring-1 ring-slate-600'
            }`}
          >
            <div className="text-3xl mb-3">{type.icon}</div>
            <h3 className="text-sm font-bold text-white mb-1">{type.label}</h3>
            <p className="text-xs text-gray-200 line-clamp-2">{type.description}</p>
            {selectedType === type.id && (
              <div className="mt-2">
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full text-white font-semibold">✓ Sélectionné</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
