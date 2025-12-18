import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * PitchRecording - Enregistrement et Analyse du Pitch
 * 
 * Integre :
 * - Enregistrement audio/video du pitch (speech)
 * - Transcription via Supabase Edge Function
 * - Analyse du ton et des emotions (via Prompt Tuning)
 * - Feedback personnalise base sur la configuration agent optimisee
 * - Stockage des logs pour l'optimisation continue (Artemis feedback)
 */

export default function PitchRecording() {
  const [recordingState, setRecordingState] = useState('idle') // idle, recording, processing, completed
  const [audioBlob, setAudioBlob] = useState(null)
  const [transcription, setTranscription] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)
  const [hasAnalyzed, setHasAnalyzed] = useState(false) // NOUVEAU: Protection contre les appels repetes

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)

  /**
   * Demarre l'enregistrement audio
   */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setRecordingState('processing')
      }

      mediaRecorder.start()
      setRecordingState('recording')
      setDuration(0)

      // Timer pour afficher la duree
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch (err) {
      setError(`Erreur d'acces au microphone: ${err.message}`)
    }
  }

  /**
   * Arrete l'enregistrement audio
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      clearInterval(timerRef.current)
    }
  }

  /**
   * Envoie l'audio a Supabase Edge Function pour transcription et analyse
   */
  const submitPitch = async () => {
    if (!audioBlob || hasAnalyzed) return // PROTECTION: Empecher les appels repetes

    setLoading(true)
    setError(null)

    try {
      // 1. Convertir le blob en base64
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)

      reader.onload = async () => {
        const audioBase64 = reader.result.split(',')[1]

        // 2. Appeler la Edge Function pour transcription + analyse
        const { data, error: functionError } = await supabase.functions.invoke(
          'analyze-pitch-recording',
          {
            body: {
              audio: audioBase64,
              duration: duration,
              personaId: 'young-talent',
              softPromptTask: 'young_talent_guidance',
              agentName: 'personas_young_talent'
            }
          }
        )

        if (functionError) {
          console.error('Erreur detaillee de la fonction Edge:', functionError)
          throw new Error(`Erreur de la fonction Edge: ${functionError.message}`)
        }

        // 3. Mettre a jour l'etat avec les resultats
        setTranscription(data.transcription)
        setAnalysis(data.analysis)
        setFeedback(data.feedback)
        setRecordingState('completed')
        setHasAnalyzed(true) // MARQUER COMME ANALYSE

        // 4. Logger l'execution (avec protection)
        try {
          await logPitchExecution(data)
        } catch (logError) {
          console.warn('Erreur lors du logging:', logError.message)
          // Ne pas bloquer l'affichage des resultats
        }
      }
    } catch (err) {
      console.error('Erreur complete:', err)
      setError(`Erreur lors de l'analyse: ${err.message}`)
      setRecordingState('idle')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Enregistre l'execution du pitch pour le calcul de la fitness
   * (Feedback pour l'optimisation evolutionnaire d'agents)
   */
  const logPitchExecution = async (analysisData) => {
    try {
      const { error } = await supabase
        .from('agent_execution_logs')
        .insert({
          input_data: {
            duration: duration,
            audio_transcription: transcription
          },
          output_data: {
            analysis: analysis,
            feedback: feedback
          },
          performance_feedback: {
            tokens_used: analysisData.tokens_used || 0,
            latency_ms: analysisData.latency_ms || 0,
            confidence: analysisData.analysis?.confidence || 0
          },
          agent_config_id: analysisData.config_id || null
        })

      if (error) {
        console.warn('Erreur lors du logging:', error.message)
      }
    } catch (err) {
      console.error('Erreur lors du logging de l\'execution:', err)
    }
  }

  /**
   * Reinitialise l'etat pour un nouvel enregistrement
   */
  const resetRecording = () => {
    setRecordingState('idle')
    setAudioBlob(null)
    setTranscription(null)
    setAnalysis(null)
    setFeedback(null)
    setError(null)
    setDuration(0)
    setHasAnalyzed(false) // REINITIALISER LE FLAG
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">
          🎤 Enregistrez Votre Pitch
        </h1>
        <p className="text-gray-300">
          Exprimez-vous librement. Spot ecoute, analyse et vous offre un feedback personnalise.
        </p>
      </div>

      {/* Main Recording Interface */}
      <div className="max-w-2xl mx-auto">
        {/* Recording Section */}
        {recordingState === 'idle' || recordingState === 'recording' ? (
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-8 shadow-2xl mb-8">
            <div className="text-center">
              {/* Microphone Icon / Recording Indicator */}
              <div className="mb-8">
                {recordingState === 'recording' ? (
                  <div className="flex justify-center">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-2 bg-red-600 rounded-full flex items-center justify-center">
                        <div className="text-4xl">🎙️</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-6xl mb-4">🎤</div>
                )}
              </div>

              {/* Duration Display */}
              {recordingState === 'recording' && (
                <div className="text-white text-3xl font-bold mb-6">
                  {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                </div>
              )}

              {/* Instructions */}
              <p className="text-white text-lg mb-8">
                {recordingState === 'idle'
                  ? 'Cliquez sur le bouton ci-dessous pour commencer a enregistrer votre pitch'
                  : 'Enregistrement en cours... Parlez librement'}
              </p>

              {/* Recording Controls */}
              <div className="flex gap-4 justify-center">
                {recordingState === 'idle' ? (
                  <button
                    onClick={startRecording}
                    className="bg-white text-purple-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-105"
                  >
                    Demarrer l'enregistrement
                  </button>
                ) : (
                  <>
                    <button
                      onClick={stopRecording}
                      className="bg-red-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-600 transition-all duration-200"
                    >
                      Arreter
                    </button>
                    <button
                      onClick={submitPitch}
                      disabled={loading || hasAnalyzed}
                      className="bg-green-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-600 transition-all duration-200 disabled:opacity-50"
                    >
                      {loading ? 'Analyse en cours...' : 'Analyser'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Processing State */}
        {recordingState === 'processing' && (
          <div className="bg-blue-600 rounded-2xl p-8 shadow-2xl text-center mb-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Transcription et analyse en cours...</p>
          </div>
        )}

        {/* Results Section */}
        {recordingState === 'completed' && (
          <div className="space-y-6">
            {/* Transcription */}
            {transcription && (
              <div className="bg-slate-700 rounded-xl p-6 border border-gray-600">
                <h2 className="text-white font-bold text-lg mb-3">📝 Transcription</h2>
                <p className="text-gray-200">{transcription}</p>
              </div>
            )}

            {/* Analysis */}
            {analysis && (
              <div className="bg-slate-700 rounded-xl p-6 border border-gray-600">
                <h2 className="text-white font-bold text-lg mb-3">🔍 Analyse</h2>
                <div className="space-y-3">
                  {analysis.tone && (
                    <div>
                      <p className="text-gray-300 text-sm">Ton</p>
                      <p className="text-white font-semibold">{analysis.tone}</p>
                    </div>
                  )}
                  {analysis.emotions && (
                    <div>
                      <p className="text-gray-300 text-sm">Emotions detectees</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {analysis.emotions.map((emotion, idx) => (
                          <span
                            key={idx}
                            className="bg-purple-600 text-white text-xs px-3 py-1 rounded-full"
                          >
                            {emotion}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.confidence && (
                    <div>
                      <p className="text-gray-300 text-sm">Confiance</p>
                      <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${analysis.confidence * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-white text-sm mt-1">{(analysis.confidence * 100).toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 shadow-lg">
                <h2 className="text-white font-bold text-lg mb-3">💡 Feedback Personnalise</h2>
                <p className="text-white mb-4">{feedback.message}</p>
                {feedback.suggestions && (
                  <div>
                    <p className="text-white font-semibold mb-2">Suggestions d'amelioration :</p>
                    <ul className="text-white space-y-2">
                      {feedback.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="mr-3">→</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={resetRecording}
                className="flex-1 bg-slate-600 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-all duration-200"
              >
                Nouvel enregistrement
              </button>
              <button className="flex-1 bg-white text-slate-900 font-bold py-3 rounded-lg hover:bg-gray-100 transition-all duration-200">
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-600 rounded-xl p-6 text-white mb-8">
            <p className="font-bold mb-2">Erreur</p>
            <p>{error}</p>
            <button
              onClick={resetRecording}
              className="mt-4 bg-white text-red-600 font-bold py-2 px-4 rounded hover:bg-gray-100 transition-all"
            >
              Reessayer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
