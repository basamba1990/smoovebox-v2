import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function PitchRecording() {
  const [recordingState, setRecordingState] = useState('idle')
  const [audioBlob, setAudioBlob] = useState(null)
  const [transcription, setTranscription] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [processingStep, setProcessingStep] = useState('')
  const navigate = useNavigate()

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)

  /**
   * Nettoie les ressources
   */
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  /**
   * CORRECTION CRITIQUE : Récupère le token d'authentification
   */
  const getAuthToken = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token || ''
    } catch (err) {
      console.warn('Impossible de récupérer le token auth:', err)
      return ''
    }
  }

  /**
   * Démarre l'enregistrement audio
   */
  const startRecording = async () => {
    try {
      setError(null)
      setTranscription(null)
      setAnalysis(null)
      setFeedback(null)
      setHasAnalyzed(false)

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          setAudioBlob(blob)
          setRecordingState('processing')
        } else {
          setError('Aucun audio enregistré. Veuillez réessayer.')
          setRecordingState('idle')
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('Erreur MediaRecorder:', event.error)
        setError(`Erreur d'enregistrement: ${event.error.name}`)
        setRecordingState('idle')
      }

      mediaRecorder.start(100)
      setRecordingState('recording')
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch (err) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', err)
      setError(`Erreur d'accès au microphone: ${err.message}. Vérifiez les permissions.`)
      setRecordingState('idle')
    }
  }

  /**
   * Arrête l'enregistrement audio
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      try {
        mediaRecorderRef.current.stop()
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }
        clearInterval(timerRef.current)
      } catch (err) {
        console.error('Erreur lors de l\'arrêt de l\'enregistrement:', err)
        setError('Erreur lors de l\'arrêt de l\'enregistrement')
      }
    }
  }

  /**
   * Envoie l'audio à Supabase Edge Function pour transcription et analyse
   */
  const submitPitch = async () => {
    if (!audioBlob || hasAnalyzed) return

    setLoading(true)
    setError(null)
    
    try {
      // 1. Convertir le blob en base64
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)
      
      reader.onload = async () => {
        const audioBase64 = reader.result.split(',')[1]
        
        // 2. Appel à l'Edge Function (CORRIGÉ)
        const EDGE_FUNCTION_URL = 'https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/analyze-pitch-recording'
        
        

        // Récupérer le token d'authentification
        const authToken = await getAuthToken()
        
        // Construire les headers
        const headers = {
          'Content-Type': 'application/json',
        }
        
        // Ajouter l'authentification seulement si le token existe
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`
        }

        setProcessingStep('transcription')
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            audio: audioBase64,
            duration: duration,
            personaId: 'young-talent',
            softPromptTask: 'young_talent_guidance',
            agentName: 'personas_young_talent'
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Erreur Edge Function:', response.status, errorText)
          
          // Tentative sans auth si 401/403
          if (response.status === 401 || response.status === 403) {
            console.warn('Tentative sans authentification...')
            const retryResponse = await fetch(EDGE_FUNCTION_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audio: audioBase64,
                duration: duration,
                personaId: 'young-talent',
                softPromptTask: 'young_talent_guidance',
                agentName: 'personas_young_talent'
              })
            })
            
            if (!retryResponse.ok) {
              throw new Error(`Échec de l'authentification et de l'accès public`)
            }
            
            const retryData = await retryResponse.json()
            processResults(retryData)
            return
          }
          
          throw new Error(`Erreur ${response.status}: ${errorText || 'Échec de l\'analyse'}`)
        }

        const data = await response.json()

        // 3. Traiter les résultats
        processResults(data)
      }

      reader.onerror = () => {
        throw new Error('Erreur lors de la lecture du fichier audio')
      }
    } catch (err) {
      console.error('Erreur complète lors de l\'analyse:', err)
      setError(`Erreur lors de l'analyse: ${err.message}`)
      setRecordingState('idle')
    } finally {
      setLoading(false)
      setProcessingStep('')
    }
  }

  /**
   * Traite les résultats de l'analyse
   */
  const processResults = (data) => {
    setTranscription(data.transcription || 'Aucune transcription disponible')
    setAnalysis(data.analysis || {})
    setFeedback(data.feedback || { message: 'Aucun feedback disponible' })
    setRecordingState('completed')
    setHasAnalyzed(true)

    // Logger l'exécution
    logPitchExecution(data).catch(err => 
      console.warn('Erreur lors du logging:', err.message)
    )
  }

  /**
   * Enregistre l'exécution
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
      console.error('Erreur lors du logging de l\'exécution:', err)
    }
  }

  /**
   * Réinitialise l'état
   */
  const resetRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    setRecordingState('idle')
    setAudioBlob(null)
    setTranscription(null)
    setAnalysis(null)
    setFeedback(null)
    setError(null)
    setDuration(0)
    setHasAnalyzed(false)
    mediaRecorderRef.current = null
    streamRef.current = null
    audioChunksRef.current = []
  }

  /**
   * Fonction de réessai
   */
  const retryRecording = () => {
    resetRecording()
    setTimeout(() => {
      startRecording()
    }, 300)
  }

  /**
   * Réessaye l'analyse
   */
  const retryAnalysis = async () => {
    setError(null)
    await submitPitch()
  }

  /**
   * Retour à la page précédente
   */
  const goBack = () => {
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <button 
          onClick={goBack}
          className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          ← Retour
        </button>
        
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          🎤 Enregistrez Votre Pitch
        </h1>
        <p className="text-gray-300 text-lg">
          Exprimez-vous librement. Spot écoute, analyse et vous offre un feedback personnalisé.
        </p>
      </div>

      {/* Main Recording Interface */}
      <div className="max-w-2xl mx-auto">
        {/* Recording Section */}
        {(recordingState === 'idle' || recordingState === 'recording') && (
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
                  <div className="text-6xl mb-4 animate-bounce">🎤</div>
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
                  ? 'Cliquez sur le bouton ci-dessous pour commencer à enregistrer votre pitch (max 5 minutes)' 
                  : 'Enregistrement en cours... Parlez clairement et naturellement'}
              </p>

              {/* Recording Controls */}
              <div className="flex gap-4 justify-center">
                {recordingState === 'idle' ? (
                  <button
                    onClick={startRecording}
                    className="bg-white text-purple-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    🎤 Démarrer l'enregistrement
                  </button>
                ) : (
                  <>
                    <button
                      onClick={stopRecording}
                      className="bg-red-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-600 transition-all duration-200 shadow-lg flex items-center gap-2"
                    >
                      ⏹️ Arrêter l'enregistrement
                    </button>
                  </>
                )}
              </div>

              {/* Bouton Réessayer visible uniquement si erreur précédente et idle */}
              {recordingState === 'idle' && audioBlob && (
                <div className="mt-6">
                  <button
                    onClick={retryRecording}
                    className="bg-yellow-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-yellow-600 transition-all duration-200"
                  >
                    🔄 Réessayer l'enregistrement
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing State */}
        {recordingState === 'processing' && (
          <div className="bg-blue-600 rounded-2xl p-8 shadow-2xl text-center mb-8">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg mb-2">
              {processingStep === 'transcription' ? 'Analyse IA en cours...' : 'Préparation de l\'analyse...'}
            </p>
            <p className="text-blue-200 text-sm">
              {processingStep === 'transcription' 
                ? 'Transcription et analyse du ton et des émotions' 
                : 'Votre pitch est prêt pour l\'analyse'}
            </p>
            <div className="mt-6">
              <button
                onClick={() => setRecordingState('idle')}
                className="bg-white text-blue-600 font-bold py-2 px-6 rounded-lg hover:bg-gray-100 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {recordingState === 'processing' && audioBlob && !loading && (
          <div className="mt-8 text-center">
            <button
              onClick={submitPitch}
              disabled={loading || hasAnalyzed}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 px-10 rounded-lg hover:shadow-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {processingStep === 'transcription' ? 'Analyse IA...' : 'Démarrage...'}
                </span>
              ) : (
                '🚀 Analyser mon pitch'
              )}
            </button>
            <p className="text-gray-400 text-sm mt-3">
              Durée enregistrée : {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
            </p>
          </div>
        )}

        {/* Results Section */}
        {recordingState === 'completed' && (
          <div className="space-y-6">
            {/* Transcription */}
            {transcription && (
              <div className="bg-slate-700 rounded-xl p-6 border border-gray-600">
                <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                  <span>📝</span> Transcription
                </h2>
                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="text-gray-200 leading-relaxed">{transcription}</p>
                </div>
              </div>
            )}

            {/* Analysis */}
            {analysis && (
              <div className="bg-slate-700 rounded-xl p-6 border border-gray-600">
                <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                  <span>🔍</span> Analyse Détailée
                </h2>
                <div className="space-y-4">
                  {analysis.tone && (
                    <div className="bg-slate-800 rounded-lg p-4">
                      <p className="text-gray-300 text-sm mb-1">Ton détecté</p>
                      <p className="text-white font-semibold text-lg">{analysis.tone}</p>
                    </div>
                  )}
                  
                  {analysis.emotions && analysis.emotions.length > 0 && (
                    <div className="bg-slate-800 rounded-lg p-4">
                      <p className="text-gray-300 text-sm mb-2">Émotions détectées</p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.emotions.map((emotion, idx) => (
                          <span
                            key={idx}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm px-4 py-2 rounded-full font-medium"
                          >
                            {emotion}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {analysis.confidence !== undefined && (
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-gray-300 text-sm">Confiance de l'analyse</p>
                        <p className="text-white font-bold">{(analysis.confidence * 100).toFixed(1)}%</p>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${analysis.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 shadow-lg">
                <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                  <span>💡</span> Feedback Personnalisé
                </h2>
                <div className="bg-green-700/30 rounded-lg p-4 mb-4">
                  <p className="text-white text-lg leading-relaxed">{feedback.message}</p>
                </div>
                
                {feedback.suggestions && feedback.suggestions.length > 0 && (
                  <div className="bg-green-700/30 rounded-lg p-4">
                    <p className="text-white font-semibold mb-3">🎯 Suggestions d'amélioration :</p>
                    <ul className="text-white space-y-3">
                      {feedback.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start bg-green-600/30 rounded-lg p-3">
                          <span className="text-yellow-300 mr-3 mt-1">✦</span>
                          <span className="leading-relaxed">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={resetRecording}
                className="flex-1 bg-slate-600 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-all duration-200 shadow-lg"
              >
                🎤 Nouvel enregistrement
              </button>
              <button
                onClick={retryAnalysis}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-lg"
              >
                🔄 Réanalyser
              </button>
              <button 
                onClick={goBack}
                className="flex-1 bg-white text-slate-900 font-bold py-3 rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg"
              >
                ← Retour aux passions
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-6 text-white mb-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-lg">Erreur</h3>
            </div>
            <p className="mb-4">{error}</p>
            
            <div className="flex gap-4">
              <button
                onClick={retryRecording}
                className="bg-white text-red-600 font-bold py-2 px-6 rounded-lg hover:bg-gray-100 transition-all shadow-md"
              >
                🔄 Réessayer l'enregistrement
              </button>
              <button
                onClick={() => setError(null)}
                className="bg-transparent border border-white text-white font-bold py-2 px-6 rounded-lg hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/30">
              <p className="text-sm opacity-80 mb-2">Conseils de dépannage :</p>
              <ul className="text-sm space-y-1">
                <li>• Vérifiez que votre microphone est connecté et autorisé</li>
                <li>• Parlez clairement et suffisamment fort</li>
                <li>• Assurez-vous d'avoir une connexion Internet stable</li>
                <li>• Réduisez le bruit ambiant si possible</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
