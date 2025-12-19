import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EDGE_FUNCTION_URL =
  'https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/analyze-pitch-recording'

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

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setRecordingState('processing')
      }

      mediaRecorder.start()
      setRecordingState('recording')
      setDuration(0)

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (err) {
      setError(`Erreur microphone: ${err.message}`)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      clearInterval(timerRef.current)
    }
  }

  const submitPitch = async () => {
    if (!audioBlob || hasAnalyzed) return

    setLoading(true)
    setError(null)

    try {
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)

      reader.onload = async () => {
        const audioBase64 = reader.result.split(',')[1]

        // 🔥 Appel POST réel vers Edge Function
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: audioBase64,
            duration,
            personaId: 'young-talent',
            softPromptTask: 'young_talent_guidance',
            agentName: 'personas_young_talent',
          }),
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(text || 'Erreur Edge Function')
        }

        const data = await response.json()

        setTranscription(data.transcription)
        setAnalysis(data.analysis)
        setFeedback(data.feedback)
        setRecordingState('completed')
        setHasAnalyzed(true)

        try {
          await logPitchExecution(data)
        } catch (logErr) {
          console.warn('Erreur logging:', logErr.message)
        }
      }
    } catch (err) {
      setError(`Erreur analyse: ${err.message}`)
      setRecordingState('idle')
    } finally {
      setLoading(false)
    }
  }

  const logPitchExecution = async (analysisData) => {
    try {
      const { error } = await supabase.from('agent_execution_logs').insert({
        input_data: { duration, audio_transcription: transcription },
        output_data: { analysis, feedback },
        performance_feedback: {
          tokens_used: analysisData.tokens_used || 0,
          latency_ms: analysisData.latency_ms || 0,
          confidence: analysisData.analysis?.confidence || 0,
        },
        agent_config_id: analysisData.config_id || null,
      })
      if (error) console.warn('Erreur logging:', error.message)
    } catch (err) {
      console.error('Erreur logging execution:', err)
    }
  }

  const resetRecording = () => {
    setRecordingState('idle')
    setAudioBlob(null)
    setTranscription(null)
    setAnalysis(null)
    setFeedback(null)
    setError(null)
    setDuration(0)
    setHasAnalyzed(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8 text-white">
      <h1 className="text-4xl font-bold mb-6">🎤 Enregistrez Votre Pitch</h1>

      <div className="max-w-2xl mx-auto space-y-6">
        {(recordingState === 'idle' || recordingState === 'recording') && (
          <div className="bg-purple-600 rounded-2xl p-8 shadow-2xl text-center">
            <div className="text-6xl mb-4">{recordingState === 'recording' ? '🔴' : '🎤'}</div>
            <p className="mb-6">
              {recordingState === 'idle'
                ? 'Cliquez pour enregistrer'
                : 'Enregistrement en cours...'}
            </p>
            {recordingState === 'recording' && (
              <p className="text-2xl mb-4">
                {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
              </p>
            )}
            <div className="flex gap-4 justify-center">
              {recordingState === 'idle' ? (
                <button onClick={startRecording} className="bg-white text-purple-600 px-8 py-3 rounded font-bold hover:bg-gray-100">
                  Demarrer
                </button>
              ) : (
                <>
                  <button onClick={stopRecording} className="bg-red-500 px-6 py-3 rounded font-bold hover:bg-red-600">
                    Arreter
                  </button>
                  <button onClick={submitPitch} disabled={loading || hasAnalyzed} className="bg-green-500 px-6 py-3 rounded font-bold disabled:opacity-50">
                    {loading ? 'Analyse...' : 'Analyser'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {recordingState === 'completed' && (
          <div className="space-y-4">
            {transcription && (
              <div className="bg-slate-700 p-6 rounded-xl">
                <h2 className="font-bold mb-2">📝 Transcription</h2>
                <p>{transcription}</p>
              </div>
            )}
            {analysis && (
              <div className="bg-slate-700 p-6 rounded-xl">
                <h2 className="font-bold mb-2">🔍 Analyse</h2>
                <p>Ton: {analysis.tone}</p>
                <p>Emotions: {analysis.emotions?.join(', ')}</p>
                <p>Confiance: {(analysis.confidence * 100).toFixed(1)}%</p>
              </div>
            )}
            {feedback && (
              <div className="bg-green-600 p-6 rounded-xl">
                <h2 className="font-bold mb-2">💡 Feedback</h2>
                <p>{feedback.message}</p>
              </div>
            )}
            <button onClick={resetRecording} className="bg-slate-600 px-8 py-3 rounded font-bold hover:bg-slate-700">
              Nouvel enregistrement
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-600 p-4 rounded">
            <p>{error}</p>
            <button onClick={resetRecording} className="mt-2 bg-white text-red-600 px-4 py-2 rounded hover:bg-gray-100">
              Reessayer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
