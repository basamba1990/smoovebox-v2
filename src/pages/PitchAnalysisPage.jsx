import React, { useState } from 'react'
import PersonasSelector from '../components/PersonasSelector'
import PitchRecording from '../components/PitchRecording'

/**
 * PitchAnalysisPage - Composant Parent d'Orchestration
 * 
 * Gère l'état de la persona sélectionnée et transmet les configurations
 * nécessaires (personaId, softPromptTask, agentName) au composant PitchRecording.
 * 
 * Étapes :
 * 1. Sélection de la Persona via PersonasSelector.
 * 2. Affichage de PitchRecording une fois la Persona sélectionnée.
 */
export default function PitchAnalysisPage() {
  const [selectedPersonaConfig, setSelectedPersonaConfig] = useState(null)
  const [isRecordingPhase, setIsRecordingPhase] = useState(false)

  /**
   * Fonction de callback appelée par PersonasSelector lorsque la configuration est chargée.
   * @param {object} personaConfig - Les données complètes du persona, y compris softPrompt et config.
   */
  const handlePersonaSelection = (personaConfig) => {
    setSelectedPersonaConfig(personaConfig)
    // On pourrait passer directement à l'enregistrement ici, ou attendre un clic sur un bouton
    // Pour l'exemple, on attendra un clic sur un bouton pour passer à la phase d'enregistrement.
  }

  const startRecordingPhase = () => {
    if (selectedPersonaConfig) {
      setIsRecordingPhase(true)
    }
  }

  // Si nous sommes dans la phase d'enregistrement
  if (isRecordingPhase && selectedPersonaConfig) {
    // Les valeurs sont extraites du personaConfig pour être passées en props
    const { id: personaId, softPromptTask } = selectedPersonaConfig
    // L'agentName est construit comme dans le pseudocode initial
    // NOTE: Le nom de l'agent pour l'analyse de pitch est 'pitch_{personaId}_agent'
    const agentName = `pitch_${personaId}_agent`

    return (
      <PitchRecording
        personaId={personaId}
        softPromptTask={softPromptTask}
        agentName={agentName}
      />
    )
  }

  // Phase de sélection de la Persona
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <PersonasSelector onSelectPersona={handlePersonaSelection} />

      {selectedPersonaConfig && (
        <div className="max-w-4xl mx-auto mt-8 p-6 bg-slate-800 rounded-xl shadow-lg text-center">
          <p className="text-white text-lg mb-4">
            Persona **{selectedPersonaConfig.name}** sélectionnée et configuration IA chargée.
          </p>
          <button
            onClick={startRecordingPhase}
            className="bg-green-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-600 transition-all duration-200"
          >
            Passer à l'enregistrement du Pitch
          </button>
        </div>
      )}
    </div>
  )
}
