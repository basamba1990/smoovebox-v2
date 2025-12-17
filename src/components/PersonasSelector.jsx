import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PERSONAS = [
  {
    id: 'young-talent',
    name: 'Jeune Talent',
    ageRange: '16-25 ans',
    icon: '🌟',
    color: 'from-purple-600 to-pink-600',
    objective: 'Découvrir ses passions et construire son parcours professionnel',
    promise: 'Révéler qui tu es. Imaginer qui tu peux devenir.',
    expectations: [
      'Découvrir mes passions multiples',
      'Construire un parcours hybride unique',
      'Recevoir un accompagnement personnalisé',
      'Être inspiré par des exemples concrets'
    ],
    softPromptTask: 'young_talent_guidance',
    agentName: 'personas_young_talent'
  },
  {
    id: 'institution',
    name: 'Institution',
    ageRange: '25-40 ans',
    icon: '🏛️',
    color: 'from-blue-600 to-cyan-600',
    objective: 'Accompagner les jeunes talents dans leur parcours',
    promise: 'Accompagner avec expertise et bienveillance.',
    expectations: [
      'Avoir des outils d\'accompagnement performants',
      'Comprendre les besoins des jeunes talents',
      'Proposer des parcours personnalisés',
      'Mesurer l\'impact de l\'accompagnement'
    ],
    softPromptTask: 'institution_guidance',
    agentName: 'personas_institution'
  },
  {
    id: 'entrepreneur',
    name: 'Entrepreneur',
    ageRange: '25-40 ans',
    icon: '🚀',
    color: 'from-green-600 to-emerald-600',
    objective: 'Développer son projet et sa carrière',
    promise: 'Développer avec ambition et stratégie.',
    expectations: [
      'Valider mon projet et ma vision',
      'Trouver des synergies entre mes compétences',
      'Optimiser ma communication',
      'Gagner en confiance et en impact'
    ],
    softPromptTask: 'entrepreneur_guidance',
    agentName: 'personas_entrepreneur'
  }
]

export default function PersonasSelector() {
  const [selectedPersona, setSelectedPersona] = useState(null)
  const [softPromptLoaded, setSoftPromptLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [agentConfig, setAgentConfig] = useState(null)

  /**
   * Charge le Soft Prompt et la configuration d'agent pour le persona sélectionné
   * Cela intègre le Prompt Tuning pour personnaliser les réponses IA
   */
  const loadPersonaOptimization = async (persona) => {
    setLoading(true)
    setError(null)

    try {
      // 1. Charger le Soft Prompt optimisé pour ce persona
      const { data: softPromptData, error: softPromptError } = await supabase
        .from('llm_soft_prompts')
        .select('id, prompt_text, is_active, task_name')
        .eq('task_name', persona.softPromptTask)
        .eq('is_active', true)
        .single()

      if (softPromptError && softPromptError.code !== 'PGRST116') {
        console.warn(`Soft prompt non trouvé pour ${persona.softPromptTask}:`, softPromptError.message)
      }

      // 2. Charger la configuration active de l'agent pour ce persona
      const { data: configData, error: configError } = await supabase
        .from('agent_configurations')
        .select('id, configuration, agent_name, is_active')
        .eq('agent_name', persona.agentName)
        .eq('is_active', true)
        .single()

      if (configError && configError.code !== 'PGRST116') {
        console.warn(`Configuration agent non trouvée pour ${persona.agentName}:`, configError.message)
      }

      // 3. Mettre à jour l'état
      setSoftPromptLoaded(!!softPromptData)
      setAgentConfig(configData)
      setSelectedPersona({
        ...persona,
        softPrompt: softPromptData,
        config: configData
      })
    } catch (err) {
      setError(err.message)
      setSelectedPersona(persona)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <h1 className="text-5xl font-bold text-white mb-4">
          🫧 SpotBulle - Sélecteur de Personas
        </h1>
        <p className="text-xl text-gray-300 mb-2">
          Révéler qui tu es. Imaginer qui tu peux devenir.
        </p>
        <p className="text-gray-400">
          Choisissez votre profil pour une expérience personnalisée et optimisée par IA
        </p>
      </div>

      {/* Personas Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {PERSONAS.map((persona) => (
          <button
            key={persona.id}
            onClick={() => loadPersonaOptimization(persona)}
            className={`p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 ${
              selectedPersona?.id === persona.id
                ? `border-white bg-gradient-to-br ${persona.color} shadow-2xl`
                : 'border-gray-600 bg-slate-700 hover:border-gray-400'
            }`}
          >
            <div className="text-4xl mb-3">{persona.icon}</div>
            <h3 className="text-lg font-bold text-white mb-2">{persona.name}</h3>
            <p className="text-sm text-gray-200 mb-3">{persona.ageRange}</p>
            <p className="text-xs text-gray-300 line-clamp-2">{persona.objective}</p>
          </button>
        ))}
      </div>

      {/* Persona Details Panel */}
      {selectedPersona && (
        <div className="max-w-4xl mx-auto">
          <div className={`bg-gradient-to-br ${selectedPersona.color} rounded-2xl p-8 shadow-2xl`}>
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <span className="ml-4 text-white text-lg">Chargement de la configuration optimisée...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-400 rounded-lg p-4 mb-6">
                <p className="text-red-200">{error}</p>
              </div>
            )}

            {/* Content */}
            {!loading && (
              <>
                <div className="mb-6">
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedPersona.name}</h2>
                  <p className="text-white text-lg italic">"{selectedPersona.promise}"</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Objectif */}
                  <div className="bg-white bg-opacity-10 rounded-lg p-4">
                    <h3 className="text-white font-bold mb-2">🎯 Objectif</h3>
                    <p className="text-white text-sm">{selectedPersona.objective}</p>
                  </div>

                  {/* Attentes */}
                  <div className="bg-white bg-opacity-10 rounded-lg p-4">
                    <h3 className="text-white font-bold mb-2">✨ Attentes</h3>
                    <ul className="text-white text-sm space-y-1">
                      {selectedPersona.expectations.slice(0, 2).map((exp, idx) => (
                        <li key={idx}>• {exp}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Soft Prompt Status */}
                <div className="bg-white bg-opacity-10 rounded-lg p-4 mb-6">
                  <h3 className="text-white font-bold mb-2">🤖 Optimisation IA (Prompt Tuning)</h3>
                  {softPromptLoaded ? (
                    <div className="text-green-200">
                      <p className="mb-2">✅ Soft prompt actif et chargé</p>
                      <p className="text-xs text-gray-200">
                        Tâche: {selectedPersona.softPromptTask}
                      </p>
                    </div>
                  ) : (
                    <p className="text-yellow-200">⚠️ Soft prompt par défaut (aucune optimisation personnalisée)</p>
                  )}
                </div>

                {/* Agent Configuration */}
                {agentConfig && (
                  <div className="bg-white bg-opacity-10 rounded-lg p-4">
                    <h3 className="text-white font-bold mb-2">⚙️ Configuration Agent</h3>
                    <div className="text-white text-sm space-y-2">
                      <p>
                        <strong>Système Prompt:</strong> {
                          agentConfig.configuration?.system_prompt 
                          ? agentConfig.configuration.system_prompt.substring(0, 80) + '...'
                          : 'Configuration chargée'
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button className="w-full mt-6 bg-white text-slate-900 font-bold py-3 rounded-lg hover:bg-gray-100 transition-all duration-200">
                  Commencer l'expérience SpotBulle
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
