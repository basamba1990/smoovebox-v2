import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * SoftPowerPassions - Sélecteur de Passions Multiples et Modèle T/M
 * 
 * Basé sur la vision d'Estelle :
 * - Multipotentialité : ne pas forcer à choisir UNE passion
 * - Modèle T/M : hybrider plusieurs verticales pour créer des métiers nouveaux
 * - Exemple : Maria (danse + biologie + vidéo) → créer un métier unique
 * - Intégration avec le Prompt Tuning pour recommandations personnalisées
 * - Utilisation de la configuration agent pour adapter les suggestions
 */

const PASSION_CATEGORIES = [
  { 
    id: 'creative', 
    name: 'Créativité & Arts', 
    icon: '🎨', 
    color: 'from-pink-500 to-rose-500', 
    passions: [
      { id: 'dance', name: 'Danse', emoji: '💃' },
      { id: 'music', name: 'Musique', emoji: '🎵' },
      { id: 'video-editing', name: 'Création Vidéo', emoji: '🎬' },
      { id: 'photography', name: 'Photographie', emoji: '📸' },
      { id: 'graphic-design', name: 'Design Graphique', emoji: '🎨' },
      { id: 'writing', name: 'Écriture', emoji: '✍️' }
    ] 
  },
  { 
    id: 'science', 
    name: 'Sciences & Technologie', 
    icon: '🔬', 
    color: 'from-blue-500 to-cyan-500', 
    passions: [
      { id: 'biology', name: 'Biologie', emoji: '🧬' },
      { id: 'chemistry', name: 'Chimie', emoji: '⚗️' },
      { id: 'physics', name: 'Physique', emoji: '⚡' },
      { id: 'programming', name: 'Programmation', emoji: '💻' },
      { id: 'ai-ml', name: 'IA & Machine Learning', emoji: '🤖' },
      { id: 'robotics', name: 'Robotique', emoji: '🦾' }
    ] 
  },
  { 
    id: 'business', 
    name: 'Entrepreneuriat & Business', 
    icon: '💼', 
    color: 'from-green-500 to-emerald-500', 
    passions: [
      { id: 'marketing', name: 'Marketing', emoji: '📢' },
      { id: 'sales', name: 'Vente', emoji: '💰' },
      { id: 'finance', name: 'Finance', emoji: '📊' },
      { id: 'entrepreneurship', name: 'Entrepreneuriat', emoji: '🚀' },
      { id: 'leadership', name: 'Leadership', emoji: '👑' },
      { id: 'strategy', name: 'Stratégie', emoji: '🎯' }
    ] 
  },
  { 
    id: 'social', 
    name: 'Social & Humanitaire', 
    icon: '❤️', 
    color: 'from-red-500 to-orange-500', 
    passions: [
      { id: 'education', name: 'Éducation', emoji: '📚' },
      { id: 'healthcare', name: 'Santé', emoji: '⚕️' },
      { id: 'environment', name: 'Environnement', emoji: '🌱' },
      { id: 'social-justice', name: 'Justice Sociale', emoji: '⚖️' },
      { id: 'community', name: 'Développement Communautaire', emoji: '🤝' },
      { id: 'coaching', name: 'Coaching & Mentorat', emoji: '🏆' }
    ] 
  },
  { 
    id: 'sports', 
    name: 'Sports & Bien-être', 
    icon: '⚽', 
    color: 'from-yellow-500 to-amber-500', 
    passions: [
      { id: 'football', name: 'Football', emoji: '⚽' },
      { id: 'fitness', name: 'Fitness', emoji: '💪' },
      { id: 'nutrition', name: 'Nutrition', emoji: '🥗' },
      { id: 'psychology', name: 'Psychologie du Sport', emoji: '🧠' },
      { id: 'sports-management', name: 'Gestion Sportive', emoji: '📋' },
      { id: 'wellness', name: 'Bien-être', emoji: '🧘' }
    ] 
  }
]

// Exemple de métiers hybrides (T/M Model)
const HYBRID_CAREERS = [
  { 
    name: 'Créateur de Contenu Scientifique', 
    passions: ['video-editing', 'biology', 'writing'], 
    description: 'Vulgariser la science via des vidéos engageantes' 
  },
  { 
    name: 'Coach de Performance Créative', 
    passions: ['coaching', 'psychology', 'dance'], 
    description: 'Aider les artistes à optimiser leur créativité' 
  },
  { 
    name: 'Entrepreneur en HealthTech', 
    passions: ['healthcare', 'programming', 'entrepreneurship'], 
    description: 'Créer des solutions technologiques pour la santé' 
  },
  { 
    name: 'Directeur Artistique de Projets Sociaux', 
    passions: ['graphic-design', 'social-justice', 'leadership'], 
    description: 'Concevoir des campagnes visuelles pour l\'impact social' 
  },
  { 
    name: 'Spécialiste en Biomécanique Sportive', 
    passions: ['physics', 'sports-management', 'fitness'], 
    description: 'Optimiser les performances athlétiques via la science' 
  }
]

export default function SoftPowerPassions() {
  const [selectedPassions, setSelectedPassions] = useState([])
  const [suggestedCareers, setSuggestedCareers] = useState([])
  const [softPromptRecommendations, setSoftPromptRecommendations] = useState(null)
  const [agentConfig, setAgentConfig] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Ajoute/retire une passion de la sélection
   */
  const togglePassion = (passionId) => {
    setSelectedPassions((prev) => 
      prev.includes(passionId) 
        ? prev.filter((id) => id !== passionId) 
        : [...prev, passionId]
    )
  }

  /**
   * Charge les recommandations optimisées via Prompt Tuning
   * et la configuration agent pour adapter les suggestions
   */
  const generateRecommendations = async () => {
    if (selectedPassions.length === 0) {
      setError('Veuillez sélectionner au moins une passion')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Charger le Soft Prompt pour les recommandations de carrière hybride
      const { data: softPromptData, error: softPromptError } = await supabase
        .from('llm_soft_prompts')
        .select('id, prompt_text, is_active, task_name')
        .eq('task_name', 'hybrid_career_recommendations')
        .eq('is_active', true)
        .maybeSingle()

      if (softPromptError && softPromptError.code !== 'PGRST116') {
        console.warn('Soft prompt non trouvé, utilisation de la configuration par défaut:', softPromptError.message)
      }

      // 2. Charger la configuration active de l'agent pour les recommandations
      const { data: configData, error: configError } = await supabase
        .from('agent_configurations')
        .select('id, configuration, agent_name, is_active')
        .eq('agent_name', 'hybrid_career_agent')
        .eq('is_active', true)
        .maybeSingle()

      if (configError && configError.code !== 'PGRST116') {
        console.warn('Configuration agent non trouvée:', configError.message)
      }

      setSoftPromptRecommendations(softPromptData)
      setAgentConfig(configData)

      // 3. CORRECTION CRITIQUE : Appel DIRECT à la fonction Edge avec fetch
      // au lieu de supabase.functions.invoke pour garantir la méthode POST
      const EDGE_FUNCTION_URL = 'https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/generate-hybrid-career-recommendations'
      
      console.log('Envoi des données à l\'Edge Function:', {
        selectedPassions,
        softPromptId: softPromptData?.id || null,
        configId: configData?.id || null
      })

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST', // CORRIGÉ : Méthode POST explicite
        headers: {
          'Content-Type': 'application/json', // CORRIGÉ : Header obligatoire
          'Authorization': `Bearer ${supabase.auth.session()?.access_token || ''}`
        },
        body: JSON.stringify({
          selectedPassions: selectedPassions,
          softPromptId: softPromptData?.id || null,
          configId: configData?.id || null
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Erreur de réponse Edge Function:', response.status, errorText)
        throw new Error(`Erreur ${response.status}: ${errorText || 'Réponse non valide de l\'Edge Function'}`)
      }

      const recommendationsData = await response.json()
      console.log('Réponse reçue de l\'Edge Function:', recommendationsData)

      // 4. Combiner les recommandations de l'IA avec les métiers hybrides prédéfinis
      const filteredCareers = HYBRID_CAREERS.filter((career) =>
        career.passions.some((p) => selectedPassions.includes(p))
      )

      setSuggestedCareers([
        ...(recommendationsData?.careers || []),
        ...filteredCareers
      ])

      // 5. Logger l'exécution pour l'optimisation d'agents (Artemis feedback)
      await logRecommendationExecution(recommendationsData)

    } catch (err) {
      console.error('Erreur complète lors de la génération des recommandations:', err)
      setError(`Erreur lors de la génération des recommandations: ${err.message}. Vérifiez la console pour plus de détails.`)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Enregistre l'exécution de la recommandation pour le calcul de la fitness
   */
  const logRecommendationExecution = async (recommendationsData) => {
    try {
      const { error } = await supabase
        .from('agent_execution_logs')
        .insert({
          input_data: { selected_passions: selectedPassions },
          output_data: { 
            recommendations: recommendationsData?.careers || [],
            count: recommendationsData?.careers?.length || 0
          },
          performance_feedback: {
            tokens_used: recommendationsData?.tokens_used || 0,
            latency_ms: recommendationsData?.latency_ms || 0,
            relevance_score: recommendationsData?.relevance_score || 0
          },
          agent_config_id: agentConfig?.id || null
        })

      if (error) {
        console.warn('Erreur lors du logging:', error.message)
      }
    } catch (err) {
      console.error('Erreur lors du logging de l\'exécution:', err)
    }
  }

  /**
   * Réinitialise la sélection
   */
  const resetSelection = () => {
    setSelectedPassions([])
    setSuggestedCareers([])
    setSoftPromptRecommendations(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          ✨ Vos Passions Multiples
        </h1>
        <p className="text-gray-300 text-lg">
          Ne choisissez pas UNE passion. Hybridez-les.
        </p>
        <p className="text-gray-400">
          SpotBulle crée des métiers nouveaux à partir de vos combinaisons uniques (Modèle T/M)
        </p>
      </div>

      {/* Passion Categories Grid */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PASSION_CATEGORIES.map((category) => (
            <div
              key={category.id}
              className="bg-slate-700 rounded-xl p-6 border border-gray-600 hover:border-gray-400 transition-all"
            >
              <div className="flex items-center mb-4">
                <span className="text-3xl mr-3">{category.icon}</span>
                <h2 className="text-white font-bold text-lg">{category.name}</h2>
              </div>

              <div className="space-y-3">
                {category.passions.map((passion) => (
                  <button
                    key={passion.id}
                    onClick={() => togglePassion(passion.id)}
                    className={`w-full p-3 rounded-lg text-left transition-all duration-200 flex items-center justify-between ${
                      selectedPassions.includes(passion.id)
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-600 text-gray-200 hover:bg-slate-500'
                    }`}
                  >
                    <span className="flex items-center">
                      <span className="mr-2">{passion.emoji}</span>
                      {passion.name}
                    </span>
                    {selectedPassions.includes(passion.id) && (
                      <span className="text-lg">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Passions Summary */}
      {selectedPassions.length > 0 && (
        <div className="max-w-6xl mx-auto mb-8">
          <div className="bg-slate-700 rounded-xl p-6 border border-purple-500">
            <h3 className="text-white font-bold text-lg mb-4">
              🎯 Vos Passions Sélectionnées ({selectedPassions.length})
            </h3>
            <div className="flex flex-wrap gap-3">
              {selectedPassions.map((passionId) => {
                const passion = PASSION_CATEGORIES.flatMap((cat) => cat.passions).find(
                  (p) => p.id === passionId
                )
                return (
                  <div
                    key={passionId}
                    className="bg-purple-600 text-white px-4 py-2 rounded-full flex items-center gap-2"
                  >
                    <span>{passion?.emoji}</span>
                    <span>{passion?.name}</span>
                    <button
                      onClick={() => togglePassion(passionId)}
                      className="ml-2 hover:text-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Generate Recommendations Button */}
      <div className="max-w-6xl mx-auto mb-12 text-center">
        <button
          onClick={generateRecommendations}
          disabled={selectedPassions.length === 0 || loading}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-12 rounded-lg hover:shadow-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Génération des recommandations...
            </span>
          ) : (
            'Découvrir mes Métiers Hybrides'
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-6xl mx-auto mb-8 bg-red-600 rounded-xl p-6 text-white">
          <p className="font-bold mb-2">⚠️ Erreur</p>
          <p>{error}</p>
          <p className="text-sm mt-2">Consultez la console du navigateur pour plus de détails.</p>
        </div>
      )}

      {/* Suggested Careers */}
      {suggestedCareers.length > 0 && (
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">
            🚀 Métiers Hybrides Recommandés ({suggestedCareers.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {suggestedCareers.map((career, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-6 border border-gray-600 hover:border-purple-500 transition-all"
              >
                <h3 className="text-white font-bold text-xl mb-3">{career.name}</h3>
                <p className="text-gray-300 mb-4">{career.description}</p>

                {career.passions && (
                  <div className="mb-4">
                    <p className="text-gray-400 text-sm mb-2">Passions combinées :</p>
                    <div className="flex flex-wrap gap-2">
                      {career.passions.map((passionId) => {
                        const passion = PASSION_CATEGORIES.flatMap((cat) => cat.passions).find(
                          (p) => p.id === passionId
                        )
                        return (
                          <span
                            key={passionId}
                            className="bg-slate-600 text-white text-xs px-3 py-1 rounded-full"
                          >
                            {passion?.emoji} {passion?.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button className="w-full bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700 transition-all">
                  En savoir plus
                </button>
              </div>
            ))}
          </div>

          {/* Optimization Info */}
          <div className="bg-slate-700 rounded-xl p-6 border border-gray-600 mb-8">
            <h3 className="text-white font-bold text-lg mb-3">🤖 Optimisation IA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Soft Prompt (Prompt Tuning)</p>
                {softPromptRecommendations ? (
                  <p className="text-green-400">✅ Actif et optimisé</p>
                ) : (
                  <p className="text-yellow-400">⚠️ Configuration par défaut</p>
                )}
              </div>
              <div>
                <p className="text-gray-400 text-sm">Configuration Agent</p>
                {agentConfig ? (
                  <p className="text-green-400">✅ Chargée</p>
                ) : (
                  <p className="text-yellow-400">⚠️ Configuration par défaut</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={resetSelection}
              className="bg-slate-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-slate-700 transition-all"
            >
              Nouvelle sélection
            </button>
            <button className="bg-white text-slate-900 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all">
              Continuer vers le Pitch
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
