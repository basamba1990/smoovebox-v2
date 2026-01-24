import React, { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { saveGenupVideo } from '../services/genupVideoService'
import { v4 as uuidv4 } from 'uuid'

/**
 * VERSION CORRIGÉE : Portfolio Vidéo GENUP
 * Correction : Ajout des paramètres manquants pour l'Edge Function (softPromptTask).
 */
export default function PitchRecording({ videoType = 'pitch', sessionId, onVideoRecorded, user }) {
  const [recordingState, setRecordingState] = useState('idle')
  const [videoBlob, setVideoBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [transcription, setTranscription] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [processingStep, setProcessingStep] = useState('')
  const navigate = useNavigate()

  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      setRecordingState('loading_camera')
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: 'user' 
        },
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true 
        } 
      })
      
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (playErr) {
          console.warn("Auto-play bloqué ou échoué:", playErr)
        }
      }
      
      setRecordingState('preview')
    } catch (err) {
      console.error('Erreur caméra:', err)
      setError(`Erreur d'accès à la caméra: ${err.message}. Veuillez vérifier les permissions de votre navigateur.`)
      setRecordingState('idle')
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [startCamera])

  const getAuthToken = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token || ''
    } catch (err) {
      console.warn('Impossible de récupérer le token auth:', err)
      return ''
    }
  }

  const startRecording = () => {
    if (!streamRef.current) {
      startCamera()
      return
    }

    try {
      setError(null)
      setTranscription(null)
      setAnalysis(null)
      setFeedback(null)
      setHasAnalyzed(false)

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') 
        ? 'video/webm;codecs=vp8,opus' 
        : 'video/webm'
        
      const options = { mimeType }
      const mediaRecorder = new MediaRecorder(streamRef.current, options)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' })
          setVideoBlob(blob)
          setPreviewUrl(URL.createObjectURL(blob))
          setRecordingState('processing')
        } else {
          setError('Aucun enregistrement capturé. Veuillez réessayer.')
          setRecordingState('preview')
        }
      }

      mediaRecorder.start(100)
      setRecordingState('recording')
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch (err) {
      console.error('Erreur lors du démarrage:', err)
      setError(`Erreur d'enregistrement: ${err.message}`)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop()
      clearInterval(timerRef.current)
    }
  }

  const submitPitch = async () => {
    if (!videoBlob || hasAnalyzed) return

    setLoading(true)
    setError(null)
    
    try {
      setProcessingStep('upload')
      const fileName = `${uuidv4()}.webm`
      const storagePath = `genup_videos/${user?.id || 'anonymous'}/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, videoBlob)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(storagePath)

      setProcessingStep('transcription')
      const reader = new FileReader()
      reader.readAsDataURL(videoBlob)
      
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1]
        const EDGE_FUNCTION_URL = 'https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/analyze-pitch-recording'
        const authToken = await getAuthToken()
        
        // CORRECTION : Ajout de softPromptTask requis par l'Edge Function
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            audio: base64Data,
            duration: duration,
            videoType: videoType,
            sessionId: sessionId,
            personaId: 'young-talent',
            agentName: 'personas_young_talent',
            softPromptTask: 'pitch-analysis' // AJOUTÉ
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Erreur ${response.status}: ${errorText}`)
        }

        const data = await response.json()

        await saveGenupVideo({
          title: `Vidéo ${videoType} - ${new Date().toLocaleDateString()}`,
          description: `Enregistrement Portfolio GENUP - Type: ${videoType}`,
          videoType: videoType,
          sessionId: sessionId,
          storagePath: storagePath,
          publicUrl: publicUrl,
          metadata: {
            transcription: data.transcription,
            analysis: data.analysis,
            feedback: data.feedback,
            duration: duration,
            is_video: true
          }
        })

        processResults(data)
      }
    } catch (err) {
      console.error('Erreur complète:', err)
      setError(`Erreur lors de l'analyse: ${err.message}`)
      setRecordingState('processing')
    } finally {
      setLoading(false)
      setProcessingStep('')
    }
  }

  const processResults = (data) => {
    setTranscription(data.transcription || 'Aucune transcription disponible')
    setAnalysis(data.analysis || {})
    setFeedback(data.feedback || { message: 'Aucun feedback disponible' })
    setRecordingState('completed')
    setHasAnalyzed(true)
  }

  const resetRecording = () => {
    setRecordingState('idle')
    setVideoBlob(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setTranscription(null)
    setAnalysis(null)
    setFeedback(null)
    setError(null)
    setDuration(0)
    setHasAnalyzed(false)
    startCamera()
  }

  const goBack = () => {
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <button 
            onClick={goBack}
            className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            ← Retour
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                Portfolio Vidéo GENUP
              </h1>
              <p className="text-gray-400 text-lg max-w-2xl">
                Type : <span className="text-blue-400 font-semibold capitalize">{videoType.replace('_', ' ')}</span>
              </p>
            </div>
            
            {recordingState === 'recording' && (
              <div className="flex items-center gap-4 bg-slate-800 px-6 py-3 rounded-2xl border border-red-500/30 shadow-lg shadow-red-500/10">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                <span className="text-2xl font-mono font-bold text-red-500">
                  {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        </div>

        {(recordingState === 'idle' || recordingState === 'loading_camera' || recordingState === 'preview' || recordingState === 'recording' || recordingState === 'processing') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="lg:col-span-2">
              <div className="relative aspect-video bg-slate-800 rounded-3xl overflow-hidden border-4 border-slate-700 shadow-2xl group">
                {recordingState === 'processing' && previewUrl ? (
                  <video src={previewUrl} controls className="w-full h-full object-cover" />
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      muted 
                      playsInline 
                      className={`w-full h-full object-cover ${recordingState !== 'processing' ? 'scale-x-[-1]' : ''}`} 
                    />
                    {recordingState === 'loading_camera' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/30 border-t-blue-500 mb-4"></div>
                        <p className="text-blue-400 font-medium">Activation de la caméra...</p>
                      </div>
                    )}
                  </>
                )}
                
                {recordingState === 'preview' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                    <div className="bg-blue-500/20 backdrop-blur-sm px-6 py-2 rounded-full border border-blue-500/30">
                      <p className="text-white font-bold">Caméra active - Prêt à enregistrer</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-6">
              <div className="bg-slate-800/50 rounded-3xl p-8 border border-slate-700">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="text-blue-400">●</span> Instructions
                </h3>
                <ul className="space-y-4 text-gray-300">
                  <li className="flex items-start gap-3">
                    <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-1">1</span>
                    <span>Positionnez-vous face à la caméra dans un endroit calme.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-1">2</span>
                    <span>Exprimez-vous naturellement sur votre {videoType}.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-1">3</span>
                    <span>L'IA analysera votre posture et votre discours.</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-4">
                {(recordingState === 'preview' || recordingState === 'loading_camera') && (
                  <button
                    onClick={startRecording}
                    disabled={recordingState === 'loading_camera'}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-5 rounded-2xl transition-all transform hover:scale-[1.02] shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                    Démarrer l'enregistrement
                  </button>
                )}

                {recordingState === 'recording' && (
                  <button
                    onClick={stopRecording}
                    className="w-full bg-white text-slate-900 font-bold py-5 rounded-2xl transition-all transform hover:scale-[1.02] shadow-xl flex items-center justify-center gap-3"
                  >
                    <div className="w-4 h-4 bg-slate-900 rounded-sm"></div>
                    Arrêter l'enregistrement
                  </button>
                )}

                {recordingState === 'processing' && (
                  <div className="space-y-4">
                    <button
                      onClick={submitPitch}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      ) : '🚀 Lancer l\'analyse IA'}
                    </button>
                    <button
                      onClick={resetRecording}
                      disabled={loading}
                      className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-2xl transition-all"
                    >
                      Recommencer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {recordingState === 'completed' && analysis && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-xl">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-3xl">📝</span> Transcription de votre vidéo
                  </h2>
                  <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
                    <p className="text-xl text-gray-200 leading-relaxed italic">
                      "{transcription}"
                    </p>
                  </div>
                </div>

                {feedback && (
                  <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <span>💡</span> Feedback Personnalisé GENUP
                    </h2>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6">
                      <p className="text-xl text-white leading-relaxed">{feedback.message}</p>
                    </div>
                    
                    {feedback.suggestions && (
                      <div className="space-y-3">
                        <p className="text-emerald-100 font-bold uppercase text-sm tracking-wider">Suggestions d'amélioration :</p>
                        {feedback.suggestions.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 bg-black/20 rounded-xl p-4 text-white">
                            <span className="text-emerald-400">✦</span> {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-xl">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                    <span>🎭</span> Analyse Émotionnelle
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {analysis.emotions?.map((emotion, idx) => (
                      <span
                        key={idx}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm px-5 py-2 rounded-full font-bold shadow-lg"
                      >
                        {emotion}
                      </span>
                    ))}
                  </div>
                </div>

                {analysis.confidence !== undefined && (
                  <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-gray-400 font-bold uppercase text-xs">Indice de Confiance</p>
                      <p className="text-2xl font-black text-white">{(analysis.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-emerald-400 h-full transition-all duration-1000"
                        style={{ width: `${analysis.confidence * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4 pt-6">
                  <button
                    onClick={resetRecording}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg"
                  >
                    🎤 Nouvel enregistrement
                  </button>
                  <button 
                    onClick={goBack}
                    className="w-full bg-white text-slate-900 font-bold py-4 rounded-2xl transition-all shadow-lg"
                  >
                    ← Retour au journal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 bg-red-500/10 border-2 border-red-500/50 rounded-3xl p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-red-400 mb-2">Une erreur est survenue</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={resetRecording}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-xl transition-all"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
