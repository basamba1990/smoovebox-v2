import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * SoftPowerPassions - Sélecteur de Passions Multiples et Modèle T/M
 */

const EDGE_FUNCTION_URL =
  'https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/generate-hybrid-career-recommendations'

const PASSION_CATEGORIES = [
  {
    id: 'creative',
    name: 'Créativité & Arts',
    icon: '🎨',
    passions: [
      { id: 'dance', name: 'Danse', emoji: '💃' },
      { id: 'music', name: 'Musique', emoji: '🎵' },
      { id: 'video-editing', name: 'Création Vidéo', emoji: '🎬' },
      { id: 'photography', name: 'Photographie', emoji: '📸' },
      { id: 'graphic-design', name: 'Design Graphique', emoji: '🎨' },
      { id: 'writing', name: 'Écriture', emoji: '✍️' },
    ],
  },
  {
    id: 'science',
    name: 'Sciences & Technologie',
    icon: '🔬',
    passions: [
      { id: 'biology', name: 'Biologie', emoji: '🧬' },
      { id: 'chemistry', name: 'Chimie', emoji: '⚗️' },
      { id: 'physics', name: 'Physique', emoji: '⚡' },
      { id: 'programming', name: 'Programmation', emoji: '💻' },
      { id: 'ai-ml', name: 'IA & Machine Learning', emoji: '🤖' },
      { id: 'robotics', name: 'Robotique', emoji: '🦾' },
    ],
  },
  {
    id: 'business',
    name: 'Entrepreneuriat & Business',
    icon: '💼',
    passions: [
      { id: 'marketing', name: 'Marketing', emoji: '📢' },
      { id: 'sales', name: 'Vente', emoji: '💰' },
      { id: 'finance', name: 'Finance', emoji: '📊' },
      { id: 'entrepreneurship', name: 'Entrepreneuriat', emoji: '🚀' },
      { id: 'leadership', name: 'Leadership', emoji: '👑' },
      { id: 'strategy', name: 'Stratégie', emoji: '🎯' },
    ],
  },
  {
    id: 'social',
    name: 'Social & Humanitaire',
    icon: '❤️',
    passions: [
      { id: 'education', name: 'Éducation', emoji: '📚' },
      { id: 'healthcare', name: 'Santé', emoji: '⚕️' },
      { id: 'environment', name: 'Environnement', emoji: '🌱' },
      { id: 'social-justice', name: 'Justice Sociale', emoji: '⚖️' },
      { id: 'community', name: 'Développement Communautaire', emoji: '🤝' },
      { id: 'coaching', name: 'Coaching & Mentorat', emoji: '🏆' },
    ],
  },
  {
    id: 'sports',
    name: 'Sports & Bien-être',
    icon: '⚽',
    passions: [
      { id: 'football', name: 'Football', emoji: '⚽' },
      { id: 'fitness', name: 'Fitness', emoji: '💪' },
      { id: 'nutrition', name: 'Nutrition', emoji: '🥗' },
      { id: 'psychology', name: 'Psychologie du Sport', emoji: '🧠' },
      { id: 'sports-management', name: 'Gestion Sportive', emoji: '📋' },
      { id: 'wellness', name: 'Bien-être', emoji: '🧘' },
    ],
  },
]

const HYBRID_CAREERS = [
  {
    name: 'Créateur de Contenu Scientifique',
    passions: ['video-editing', 'biology', 'writing'],
    description: 'Vulgariser la science via des vidéos engageantes',
  },
  {
    name: 'Coach de Performance Créative',
    passions: ['coaching', 'psychology', 'dance'],
    description: 'Aider les artistes à optimiser leur créativité',
  },
  {
    name: 'Entrepreneur en HealthTech',
    passions: ['healthcare', 'programming', 'entrepreneurship'],
    description: 'Créer des solutions technologiques pour la santé',
  },
]

export default function SoftPowerPassions() {
  const [selectedPassions, setSelectedPassions] = useState([])
  const [suggestedCareers, setSuggestedCareers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const togglePassion = (id) => {
    setSelectedPassions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const generateRecommendations = async () => {
    if (selectedPassions.length === 0) {
      setError('Veuillez sélectionner au moins une passion')
      return
    }

    setLoading(true)
    setError(null)
    setSuggestedCareers([])

    try {
      // Charger config agent (optionnel)
      const { data: configData } = await supabase
        .from('agent_configurations')
        .select('id')
        .eq('agent_name', 'hybrid_career_agent')
        .eq('is_active', true)
        .maybeSingle()

      // 🔥 APPEL POST RÉEL (plus de invoke)
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedPassions,
          configId: configData?.id ?? null,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text)
      }

      const data = await response.json()

      const staticCareers = HYBRID_CAREERS.filter((c) =>
        c.passions.some((p) => selectedPassions.includes(p))
      )

      setSuggestedCareers([...(data.careers || []), ...staticCareers])
    } catch (err) {
      setError(err.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <h1 className="text-4xl font-bold mb-6">✨ Vos Passions Multiples</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {PASSION_CATEGORIES.map((cat) => (
          <div key={cat.id} className="bg-slate-700 rounded-xl p-5">
            <h2 className="font-bold mb-4">
              {cat.icon} {cat.name}
            </h2>

            {cat.passions.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePassion(p.id)}
                className={`w-full mb-2 p-2 rounded ${
                  selectedPassions.includes(p.id)
                    ? 'bg-purple-600'
                    : 'bg-slate-600'
                }`}
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        ))}
      </div>

      <button
        onClick={generateRecommendations}
        disabled={loading}
        className="bg-purple-600 px-8 py-4 rounded font-bold"
      >
        {loading ? 'Génération...' : 'Découvrir mes Métiers Hybrides'}
      </button>

      {error && <p className="text-red-400 mt-4">{error}</p>}

      {suggestedCareers.length > 0 && (
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          {suggestedCareers.map((c, i) => (
            <div key={i} className="bg-slate-700 p-5 rounded-xl">
              <h3 className="font-bold text-lg mb-2">{c.name}</h3>
              <p className="text-gray-300">{c.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
